import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const children = new Set();

function launch(command, args, options = {}) {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit', windowsHide: true, ...options });
  children.add(child);
  child.once('exit', (code) => {
    children.delete(child);
    if (!shuttingDown && code) shutdown(code);
  });
  return child;
}

function waitForPort(port, timeoutMs = 15000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const probe = () => {
      const socket = net.connect(port, '127.0.0.1');
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - started >= timeoutMs) reject(new Error(`Port ${port} did not become ready`));
        else setTimeout(probe, 150);
      });
    };
    probe();
  });
}

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  children.forEach((child) => child.kill());
  setTimeout(() => process.exit(code), 150).unref();
}

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());

const desktop = process.argv.includes('--electron');
if (!desktop) launch(process.execPath, [path.join(root, 'server', 'index.js')]);
launch(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')], { cwd: path.join(root, 'client') });

if (desktop) {
  await waitForPort(5173);
  launch(process.execPath, [path.join(root, 'node_modules', 'electron', 'cli.js'), root]);
}
