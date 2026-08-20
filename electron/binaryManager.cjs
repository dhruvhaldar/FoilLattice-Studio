const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const AdmZip = require('adm-zip');

const SOLVER_IDS = new Set(['avl', 'xfoil']);
const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024;

class BinaryManager {
  constructor({ app, dialog, ipcMain, BrowserWindow, shell, net }) {
    this.app = app;
    this.dialog = dialog;
    this.ipcMain = ipcMain;
    this.BrowserWindow = BrowserWindow;
    this.shell = shell;
    this.net = net;
    this.root = path.join(app.getPath('userData'), 'solvers');
    this.activeDir = path.join(this.root, 'active');
    this.manifestPath = path.join(this.root, 'installed.json');
    this.catalogPath = path.join(__dirname, '..', 'config', 'solver-catalog.json');
    this.cachedCatalogPath = path.join(this.root, 'catalog.json');
    this.catalog = null;
  }

  async initialize() {
    await fs.mkdir(this.activeDir, { recursive: true });
    await this.loadCatalog();
  }

  binaryRoot() { return this.activeDir; }
  platformKey() { return `${process.platform}-${process.arch}`; }

  async readJson(filename, fallback = {}) {
    try { return JSON.parse(await fs.readFile(filename, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return fallback; throw error; }
  }

  validateCatalog(catalog) {
    if (catalog?.schemaVersion !== 1 || !catalog.solvers || typeof catalog.solvers !== 'object') throw new Error('Unsupported solver catalog');
    for (const id of SOLVER_IDS) {
      if (!catalog.solvers[id]?.platforms) throw new Error(`Solver catalog is missing ${id}`);
      for (const release of Object.values(catalog.solvers[id].platforms)) {
        if (!['executable', 'zip', 'manual'].includes(release.format)) throw new Error(`Invalid ${id} release format`);
        if (!release.executableName || path.basename(release.executableName) !== release.executableName) throw new Error(`Invalid ${id} executable name`);
        if (release.format !== 'manual') {
          if (new URL(release.url).protocol !== 'https:' || !/^[A-Fa-f0-9]{64}$/.test(release.sha256 || '')) throw new Error(`Invalid ${id} download metadata`);
        }
        if (release.format === 'zip' && (!release.archiveEntry || path.basename(release.archiveEntry) !== release.archiveEntry)) throw new Error(`Invalid ${id} archive entry`);
      }
    }
    return catalog;
  }

  async loadCatalog({ refresh = false } = {}) {
    if (this.catalog && !refresh) return this.catalog;
    const bundled = this.validateCatalog(await this.readJson(this.catalogPath));
    const remoteUrl = process.env.SOLVER_CATALOG_URL || bundled.remoteCatalogUrl;
    if (!remoteUrl) return (this.catalog = bundled);
    try {
      const parsed = new URL(remoteUrl);
      if (parsed.protocol !== 'https:') throw new Error('Remote solver catalog must use HTTPS');
      const response = await this.net.fetch(parsed.href, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`Catalog request failed with HTTP ${response.status}`);
      const remote = this.validateCatalog(await response.json());
      await this.writeJsonAtomic(this.cachedCatalogPath, remote);
      return (this.catalog = remote);
    } catch (error) {
      const cached = await this.readJson(this.cachedCatalogPath, null);
      this.emit({ solver: 'catalog', phase: 'warning', message: `${error.message}; using ${cached ? 'cached' : 'bundled'} catalog` });
      return (this.catalog = cached ? this.validateCatalog(cached) : bundled);
    }
  }

  async writeJsonAtomic(filename, value) {
    await fs.mkdir(path.dirname(filename), { recursive: true });
    const temporary = `${filename}.${process.pid}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await fs.rename(temporary, filename);
  }

  async getStatus({ refresh = false } = {}) {
    const catalog = await this.loadCatalog({ refresh });
    const installed = await this.readJson(this.manifestPath, { solvers: {} });
    const platform = this.platformKey();
    const solvers = {};
    for (const id of SOLVER_IDS) {
      const definition = catalog.solvers[id];
      const release = definition.platforms[platform] || null;
      const executableName = release?.executableName || `${id}${process.platform === 'win32' ? '.exe' : ''}`;
      const executablePath = path.join(this.activeDir, executableName);
      const present = fsSync.existsSync(executablePath);
      const record = installed.solvers?.[id];
      solvers[id] = {
        id,
        name: definition.name,
        description: definition.description,
        homepage: definition.homepage,
        installed: present,
        installedVersion: present ? (record?.version || 'custom') : null,
        latestVersion: release?.version || null,
        updateAvailable: Boolean(present && release?.version && record?.version && record.version !== release.version && record.version !== 'custom'),
        canDownload: Boolean(release?.url && release?.sha256 && release.format !== 'manual'),
        requiresManualBuild: release?.format === 'manual',
        sourceUrl: release?.sourceUrl || null,
        path: executablePath
      };
    }
    return { catalogVersion: catalog.catalogVersion, platform, directory: this.activeDir, solvers };
  }

  emit(message) {
    for (const window of this.BrowserWindow.getAllWindows()) window.webContents.send('solvers:progress', message);
  }

  async downloadToFile(url, destination, solver) {
    const response = await this.net.fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}`);
    const total = Number(response.headers.get('content-length') || 0);
    if (total > MAX_DOWNLOAD_BYTES) throw new Error('Solver download is unexpectedly large');
    const handle = await fs.open(destination, 'w');
    let received = 0;
    try {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > MAX_DOWNLOAD_BYTES) throw new Error('Solver download exceeded the size limit');
        await handle.write(Buffer.from(value));
        this.emit({ solver, phase: 'download', received, total, percent: total ? Math.round(received / total * 100) : null });
      }
    } finally { await handle.close(); }
  }

  async sha256(filename) {
    const hash = crypto.createHash('sha256');
    await new Promise((resolve, reject) => fsSync.createReadStream(filename).on('data', (chunk) => hash.update(chunk)).on('end', resolve).on('error', reject));
    return hash.digest('hex').toUpperCase();
  }

  async activate(solver, candidate, release, origin) {
    const target = path.join(this.activeDir, release.executableName);
    const temporary = `${target}.${process.pid}.partial`;
    const backup = `${target}.${process.pid}.backup`;
    await fs.copyFile(candidate, temporary);
    if (process.platform !== 'win32') await fs.chmod(temporary, 0o755);
    const hadExisting = fsSync.existsSync(target);
    try {
      if (hadExisting) await fs.rename(target, backup);
      await fs.rename(temporary, target);
      if (hadExisting) await fs.rm(backup, { force: true });
    } catch (error) {
      await fs.rm(temporary, { force: true });
      if (hadExisting && fsSync.existsSync(backup)) await fs.rename(backup, target);
      throw error;
    }
    const manifest = await this.readJson(this.manifestPath, { schemaVersion: 1, solvers: {} });
    manifest.solvers ||= {};
    manifest.solvers[solver] = { version: release.version || 'custom', origin, installedAt: new Date().toISOString(), sha256: await this.sha256(target), executableName: release.executableName };
    await this.writeJsonAtomic(this.manifestPath, manifest);
    return target;
  }

  async download(solver) {
    if (!SOLVER_IDS.has(solver)) throw new Error('Unknown solver');
    const catalog = await this.loadCatalog();
    const release = catalog.solvers[solver].platforms[this.platformKey()];
    if (!release?.url || !release.sha256 || release.format === 'manual') throw new Error(`No automatic ${solver.toUpperCase()} download is available for this platform`);
    const workDir = await fs.mkdtemp(path.join(this.root, `.${solver}-`));
    const archive = path.join(workDir, 'download');
    try {
      this.emit({ solver, phase: 'starting', percent: 0 });
      await this.downloadToFile(release.url, archive, solver);
      this.emit({ solver, phase: 'verify', percent: 100 });
      const actualHash = await this.sha256(archive);
      if (actualHash !== release.sha256.toUpperCase()) throw new Error(`Checksum verification failed for ${solver.toUpperCase()}`);
      let candidate = archive;
      if (release.format === 'zip') {
        const zip = new AdmZip(archive);
        const entry = zip.getEntries().find((item) => item.entryName.replace(/^\/+/, '').toLowerCase() === release.archiveEntry.toLowerCase());
        if (!entry || entry.isDirectory || entry.header.size > MAX_DOWNLOAD_BYTES) throw new Error(`Expected ${release.archiveEntry} was not found in the archive`);
        candidate = path.join(workDir, release.executableName);
        await fs.writeFile(candidate, entry.getData(), { mode: 0o755 });
      }
      const stats = await fs.stat(candidate);
      if (stats.size < 10_000) throw new Error('Downloaded executable is unexpectedly small');
      const target = await this.activate(solver, candidate, release, 'official-download');
      this.emit({ solver, phase: 'complete', percent: 100, path: target });
      return await this.getStatus();
    } finally { await fs.rm(workDir, { recursive: true, force: true }); }
  }

  async provide(solver) {
    if (!SOLVER_IDS.has(solver)) throw new Error('Unknown solver');
    const catalog = await this.loadCatalog();
    const release = catalog.solvers[solver].platforms[this.platformKey()] || { executableName: `${solver}${process.platform === 'win32' ? '.exe' : ''}` };
    const result = await this.dialog.showOpenDialog({ title: `Choose ${catalog.solvers[solver].name} executable`, properties: ['openFile'], filters: process.platform === 'win32' ? [{ name: 'Executables', extensions: ['exe'] }, { name: 'All files', extensions: ['*'] }] : [{ name: 'All files', extensions: ['*'] }] });
    if (result.canceled || !result.filePaths[0]) return { canceled: true, status: await this.getStatus() };
    const stats = await fs.stat(result.filePaths[0]);
    if (!stats.isFile() || stats.size < 10_000) throw new Error('Selected file is not a valid solver executable');
    const customRelease = { ...release, version: 'custom', executableName: release.executableName || `${solver}${process.platform === 'win32' ? '.exe' : ''}` };
    await this.activate(solver, result.filePaths[0], customRelease, 'user-provided');
    this.emit({ solver, phase: 'complete', percent: 100 });
    return { canceled: false, status: await this.getStatus() };
  }

  registerIpc() {
    const handlers = {
      'solvers:get-status': (_event, options) => this.getStatus(options),
      'solvers:download': (_event, solver) => this.download(solver),
      'solvers:provide': (_event, solver) => this.provide(solver),
      'solvers:open-folder': async () => { await fs.mkdir(this.activeDir, { recursive: true }); return this.shell.openPath(this.activeDir); }
    };
    for (const [channel, handler] of Object.entries(handlers)) {
      this.ipcMain.removeHandler(channel);
      this.ipcMain.handle(channel, handler);
    }
  }
}

module.exports = { BinaryManager };
