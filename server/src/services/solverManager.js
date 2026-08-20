import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const solverIds = new Set(['avl', 'xfoil']);
const maxBytes = 100 * 1024 * 1024;

export class SolverManager extends EventEmitter {
  constructor() {
    super();
    this.root = process.env.SOLVER_DATA_DIR || process.env.BINARY_ROOT || path.resolve(moduleDirectory, '..', '..', '..', 'binaries', process.platform);
    this.manifestPath = path.join(this.root, 'installed.json');
    this.catalogPath = process.env.SOLVER_CATALOG_PATH || path.resolve(moduleDirectory, '..', '..', '..', 'config', 'solver-catalog.json');
    this.cachedCatalogPath = path.join(this.root, 'catalog.json');
    this.catalog = null;
    this.locks = new Set();
  }

  platformKey() { return `${process.platform}-${process.arch}`; }
  enabled() { return process.env.ENABLE_SOLVER_MANAGEMENT !== 'false'; }

  async initialize() {
    await fs.mkdir(this.root, { recursive: true });
    await this.loadCatalog();
  }

  async readJson(filename, fallback = {}) {
    try { return JSON.parse(await fs.readFile(filename, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return fallback; throw error; }
  }

  validateCatalog(catalog) {
    if (catalog?.schemaVersion !== 1 || !catalog.solvers) throw new Error('Unsupported solver catalog');
    for (const id of solverIds) {
      if (!catalog.solvers[id]?.platforms) throw new Error(`Solver catalog is missing ${id}`);
      for (const release of Object.values(catalog.solvers[id].platforms)) {
        if (!['executable', 'zip', 'manual'].includes(release.format)) throw new Error(`Invalid ${id} release format`);
        if (!release.executableName || path.basename(release.executableName) !== release.executableName) throw new Error(`Invalid ${id} executable name`);
        if (release.format !== 'manual' && (new URL(release.url).protocol !== 'https:' || !/^[A-Fa-f0-9]{64}$/.test(release.sha256 || ''))) throw new Error(`Invalid ${id} download metadata`);
        if (release.format === 'zip' && (!release.archiveEntry || path.basename(release.archiveEntry) !== release.archiveEntry)) throw new Error(`Invalid ${id} archive entry`);
      }
    }
    return catalog;
  }

  async writeJsonAtomic(filename, value) {
    const temporary = `${filename}.${process.pid}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await fs.rename(temporary, filename);
  }

  async loadCatalog({ refresh = false } = {}) {
    if (this.catalog && !refresh) return this.catalog;
    const bundled = this.validateCatalog(await this.readJson(this.catalogPath));
    const remoteUrl = this.enabled() ? (process.env.SOLVER_CATALOG_URL || bundled.remoteCatalogUrl) : null;
    if (!remoteUrl) return (this.catalog = bundled);
    try {
      if (new URL(remoteUrl).protocol !== 'https:') throw new Error('Remote solver catalog must use HTTPS');
      const response = await fetch(remoteUrl, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`Catalog request failed with HTTP ${response.status}`);
      const remote = this.validateCatalog(await response.json());
      await this.writeJsonAtomic(this.cachedCatalogPath, remote);
      return (this.catalog = remote);
    } catch (error) {
      const cached = await this.readJson(this.cachedCatalogPath, null);
      this.publish({ solver: 'catalog', phase: 'warning', message: `${error.message}; using ${cached ? 'cached' : 'bundled'} catalog` });
      return (this.catalog = cached ? this.validateCatalog(cached) : bundled);
    }
  }

  async getStatus({ refresh = false } = {}) {
    const catalog = await this.loadCatalog({ refresh });
    const manifest = await this.readJson(this.manifestPath, { solvers: {} });
    const platform = this.platformKey();
    const solvers = {};
    for (const id of solverIds) {
      const definition = catalog.solvers[id];
      const release = definition.platforms[platform] || null;
      const executableName = release?.executableName || `${id}${process.platform === 'win32' ? '.exe' : ''}`;
      const executablePath = path.join(this.root, executableName);
      const installed = fsSync.existsSync(executablePath);
      const record = manifest.solvers?.[id];
      solvers[id] = {
        id, name: definition.name, description: definition.description, homepage: definition.homepage,
        installed, installedVersion: installed ? (record?.version || 'custom') : null,
        latestVersion: release?.version || null,
        updateAvailable: Boolean(installed && release?.version && record?.version && !['custom', release.version].includes(record.version)),
        canDownload: Boolean(this.enabled() && release?.url && release?.sha256 && release.format !== 'manual'),
        canProvide: this.enabled(), requiresManualBuild: release?.format === 'manual', sourceUrl: release?.sourceUrl || null,
        path: executablePath
      };
    }
    return { runtime: 'web', managementEnabled: this.enabled(), catalogVersion: catalog.catalogVersion, platform, directory: this.root, solvers };
  }

  publish(event) { this.emit('progress', { ...event, at: new Date().toISOString() }); }

  async sha256(filename) {
    const hash = crypto.createHash('sha256');
    await new Promise((resolve, reject) => fsSync.createReadStream(filename).on('data', (chunk) => hash.update(chunk)).on('end', resolve).on('error', reject));
    return hash.digest('hex').toUpperCase();
  }

  async downloadToFile(url, destination, solver) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}`);
    const total = Number(response.headers.get('content-length') || 0);
    if (total > maxBytes) throw new Error('Solver download is unexpectedly large');
    const handle = await fs.open(destination, 'w');
    let received = 0;
    try {
      for await (const chunk of response.body) {
        received += chunk.byteLength;
        if (received > maxBytes) throw new Error('Solver download exceeded the size limit');
        await handle.write(chunk);
        this.publish({ solver, phase: 'download', received, total, percent: total ? Math.round(received / total * 100) : null });
      }
    } finally { await handle.close(); }
  }

  async activate(solver, candidate, release, origin) {
    const target = path.join(this.root, release.executableName);
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
  }

  async withLock(solver, callback) {
    if (!this.enabled()) throw Object.assign(new Error('Solver management is disabled on this engine'), { status: 403 });
    if (!solverIds.has(solver)) throw Object.assign(new Error('Unknown solver'), { status: 404 });
    if (this.locks.has(solver)) throw Object.assign(new Error(`${solver.toUpperCase()} installation is already in progress`), { status: 409 });
    this.locks.add(solver);
    try { return await callback(); } finally { this.locks.delete(solver); }
  }

  async download(solver) {
    return this.withLock(solver, async () => {
      const catalog = await this.loadCatalog();
      const release = catalog.solvers[solver].platforms[this.platformKey()];
      if (!release?.url || !release.sha256 || release.format === 'manual') throw Object.assign(new Error(`No automatic ${solver.toUpperCase()} download is available for this platform`), { status: 400 });
      const workDir = await fs.mkdtemp(path.join(this.root, `.${solver}-`));
      const archive = path.join(workDir, 'download');
      try {
        this.publish({ solver, phase: 'starting', percent: 0 });
        await this.downloadToFile(release.url, archive, solver);
        this.publish({ solver, phase: 'verify', percent: 100 });
        if (await this.sha256(archive) !== release.sha256.toUpperCase()) throw new Error(`Checksum verification failed for ${solver.toUpperCase()}`);
        let candidate = archive;
        if (release.format === 'zip') {
          const entry = new AdmZip(archive).getEntries().find((item) => item.entryName.replace(/^\/+/, '').toLowerCase() === release.archiveEntry.toLowerCase());
          if (!entry || entry.isDirectory || entry.header.size > maxBytes) throw new Error(`Expected ${release.archiveEntry} was not found in the archive`);
          candidate = path.join(workDir, release.executableName);
          await fs.writeFile(candidate, entry.getData(), { mode: 0o755 });
        }
        if ((await fs.stat(candidate)).size < 10_000) throw new Error('Downloaded executable is unexpectedly small');
        await this.activate(solver, candidate, release, 'official-download');
        this.publish({ solver, phase: 'complete', percent: 100 });
        return this.getStatus();
      } finally { await fs.rm(workDir, { recursive: true, force: true }); }
    });
  }

  async provide(solver, buffer) {
    return this.withLock(solver, async () => {
      if (!Buffer.isBuffer(buffer) || buffer.length < 10_000 || buffer.length > maxBytes) throw Object.assign(new Error('Uploaded executable has an invalid size'), { status: 400 });
      const catalog = await this.loadCatalog();
      const release = catalog.solvers[solver].platforms[this.platformKey()] || { executableName: `${solver}${process.platform === 'win32' ? '.exe' : ''}` };
      const workDir = await fs.mkdtemp(path.join(this.root, `.${solver}-upload-`));
      const candidate = path.join(workDir, release.executableName);
      try {
        this.publish({ solver, phase: 'verify', percent: 100 });
        await fs.writeFile(candidate, buffer, { mode: 0o755 });
        await this.activate(solver, candidate, { ...release, version: 'custom' }, 'browser-upload');
        this.publish({ solver, phase: 'complete', percent: 100 });
        return this.getStatus();
      } finally { await fs.rm(workDir, { recursive: true, force: true }); }
    });
  }
}

export const solverManager = new SolverManager();
