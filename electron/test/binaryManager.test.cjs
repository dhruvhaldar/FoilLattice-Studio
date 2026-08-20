const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { BinaryManager } = require('../binaryManager.cjs');

function createManager(root, selectedFile = null) {
  return new BinaryManager({
    app: { getPath: () => root },
    dialog: { showOpenDialog: async () => selectedFile ? { canceled: false, filePaths: [selectedFile] } : { canceled: true, filePaths: [] } },
    ipcMain: { removeHandler() {}, handle() {} },
    BrowserWindow: { getAllWindows: () => [] },
    shell: { openPath: async () => '' },
    net: { fetch: async () => { throw new Error('Unexpected network request'); } }
  });
}

test('reports downloadable Windows solvers separately from the UI bundle', { skip: process.platform !== 'win32' }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'foil-solver-manager-'));
  try {
    const manager = createManager(root);
    await manager.initialize();
    const status = await manager.getStatus();
    assert.equal(status.platform, 'win32-x64');
    assert.equal(status.solvers.avl.canDownload, true);
    assert.equal(status.solvers.xfoil.canDownload, true);
    assert.equal(status.solvers.avl.installed, false);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('copies a user-provided executable into managed storage', { skip: process.platform !== 'win32' }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'foil-solver-manager-'));
  const source = path.join(root, 'custom-avl.exe');
  await fs.writeFile(source, Buffer.alloc(20_000, 7));
  try {
    const manager = createManager(root, source);
    await manager.initialize();
    const result = await manager.provide('avl');
    assert.equal(result.canceled, false);
    assert.equal(result.status.solvers.avl.installed, true);
    assert.equal(result.status.solvers.avl.installedVersion, 'custom');
    assert.equal((await fs.stat(path.join(root, 'solvers', 'active', 'avl.exe'))).size, 20_000);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
