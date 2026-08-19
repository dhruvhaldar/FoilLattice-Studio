import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function withWorkspace(files, callback) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'foil-lattice-'));
  try {
    await Promise.all(Object.entries(files).map(([name, content]) => fs.writeFile(path.join(directory, name), content, 'utf8')));
    return await callback(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

export async function spawnSolver({ binary, cwd, commands, job, manager }) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, [], { cwd, windowsHide: true });
    job.child = child;
    child.stdout.on('data', (chunk) => manager.emit(job, { type: 'log', stream: 'stdout', text: chunk.toString() }));
    child.stderr.on('data', (chunk) => manager.emit(job, { type: 'log', stream: 'stderr', text: chunk.toString() }));
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      job.child = null;
      if (job.status === 'cancelled') return resolve();
      if (code === 0) resolve();
      else reject(new Error(`Solver exited with code ${code ?? signal}`));
    });
    child.stdin.end(commands);
  });
}

export async function readIfExists(filename) {
  try { return await fs.readFile(filename, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export async function demoProgress(job, manager, solver) {
  manager.emit(job, { type: 'log', stream: 'stdout', text: `[demo] ${solver.toUpperCase()} binary not found; running deterministic preview model.\n` });
  for (const progress of [12, 28, 47, 66, 84]) {
    if (job.status === 'cancelled') return;
    await new Promise((resolve) => setTimeout(resolve, 90));
    job.progress = progress;
    manager.emit(job, { type: 'status', status: 'running', progress });
  }
}
