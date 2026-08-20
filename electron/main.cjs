const { app, BrowserWindow, dialog, ipcMain, shell, net: electronNet } = require('electron');
const { fork } = require('node:child_process');
const path = require('node:path');
const net = require('node:net');
const { BinaryManager } = require('./binaryManager.cjs');

let backend;
let binaryManager;

function waitForPort(port, timeoutMs = 12000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const probe = () => {
      const socket = net.connect(port, '127.0.0.1');
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) reject(new Error('Execution engine did not start'));
        else setTimeout(probe, 150);
      });
    };
    probe();
  });
}

async function createWindow() {
  const dev = !app.isPackaged;
  const serverEntry = path.join(__dirname, '..', 'server', 'index.js');
  const binaryRoot = binaryManager.binaryRoot();

  if (!backend || backend.killed) {
    backend = fork(serverEntry, [], {
      env: { ...process.env, PORT: '4317', HOST: '127.0.0.1', BINARY_ROOT: binaryRoot, ENABLE_SOLVER_MANAGEMENT: 'false' },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc']
    });
    backend.stdout?.pipe(process.stdout);
    backend.stderr?.pipe(process.stderr);
    backend.once('exit', () => { backend = null; });
  }

  try { await waitForPort(4317); }
  catch (error) { dialog.showErrorBox('Startup failed', error.message); app.quit(); return; }

  const win = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1040,
    minHeight: 720,
    backgroundColor: '#07111e',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = dev ? url.startsWith('http://localhost:5173') : url.startsWith('file:');
    if (!allowed) { event.preventDefault(); if (url.startsWith('https://')) shell.openExternal(url); }
  });

  if (dev) await win.loadURL('http://localhost:5173');
  else await win.loadFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
}

app.whenReady().then(async () => {
  binaryManager = new BinaryManager({ app, dialog, ipcMain, BrowserWindow, shell, net: electronNet });
  await binaryManager.initialize();
  binaryManager.registerIpc();
  await createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => backend?.kill());
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
