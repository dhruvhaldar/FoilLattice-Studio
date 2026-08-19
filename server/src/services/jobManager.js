import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const jobs = new Map();
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const binaryRoot = process.env.BINARY_ROOT || path.resolve(moduleDirectory, '..', '..', '..', 'binaries', process.platform);
const binaryPath = (solver) => path.join(binaryRoot, `${solver}${process.platform === 'win32' ? '.exe' : ''}`);

class JobManager {
  create(solver, input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw Object.assign(new Error('A JSON configuration object is required'), { name: 'ValidationError' });
    const job = { id: crypto.randomUUID(), solver, input, status: 'queued', progress: 0, createdAt: new Date().toISOString(), history: [], listeners: new Set(), child: null };
    jobs.set(job.id, job);
    setTimeout(() => jobs.delete(job.id), 60 * 60 * 1000).unref();
    return job;
  }
  get(id) { return jobs.get(id); }
  emit(job, event) {
    const stamped = { ...event, at: new Date().toISOString() };
    job.history.push(stamped);
    if (job.history.length > 1000) job.history.shift();
    job.listeners.forEach((listener) => listener(stamped));
  }
  publicJob(job) { return { id: job.id, solver: job.solver, status: job.status, progress: job.progress, createdAt: job.createdAt, result: job.result, error: job.error }; }
  async execute(job, runner) {
    job.status = 'running'; this.emit(job, { type: 'status', status: job.status, progress: 2 });
    try {
      const result = await runner(job, this);
      if (job.status === 'cancelled') return;
      job.result = result; job.progress = 100; job.status = 'complete';
      this.emit(job, { type: 'result', result });
      this.emit(job, { type: 'status', status: job.status, progress: 100 });
    } catch (error) {
      if (job.status === 'cancelled') return;
      job.status = 'failed'; job.error = error.message;
      this.emit(job, { type: 'error', message: error.message });
      this.emit(job, { type: 'status', status: job.status, progress: job.progress });
    }
  }
  cancel(job) { job.child?.kill(); job.status = 'cancelled'; this.emit(job, { type: 'status', status: 'cancelled', progress: job.progress }); }
  solverAvailability() { return Object.fromEntries(['xfoil', 'avl'].map((solver) => [solver, { installed: fs.existsSync(binaryPath(solver)), path: binaryPath(solver) }])); }
  binaryPath = binaryPath;
}
export const jobManager = new JobManager();
