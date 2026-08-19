import express from 'express';
import cors from 'cors';
import { jobManager } from './services/jobManager.js';
import { runXfoil } from './controllers/xfoilController.js';
import { runAvl } from './controllers/avlController.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '3mb' }));
  app.get('/api/health', (_req, res) => res.json({ ok: true, version: '0.1.0', solvers: jobManager.solverAvailability() }));
  app.post('/api/jobs/:solver', (req, res, next) => {
    try {
      const { solver } = req.params;
      if (!['xfoil', 'avl'].includes(solver)) return res.status(404).json({ error: 'Unknown solver' });
      const job = jobManager.create(solver, req.body);
      res.status(202).json(jobManager.publicJob(job));
      queueMicrotask(() => jobManager.execute(job, solver === 'xfoil' ? runXfoil : runAvl));
    } catch (error) { next(error); }
  });
  app.get('/api/jobs/:id', (req, res) => {
    const job = jobManager.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(jobManager.publicJob(job));
  });
  app.get('/api/jobs/:id/events', (req, res) => {
    const job = jobManager.get(req.params.id);
    if (!job) return res.status(404).end();
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.flushHeaders();
    const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
    job.history.forEach(send);
    if (['complete', 'failed', 'cancelled'].includes(job.status)) return res.end();
    job.listeners.add(send);
    req.on('close', () => job.listeners.delete(send));
  });
  app.delete('/api/jobs/:id', (req, res) => {
    const job = jobManager.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    jobManager.cancel(job);
    res.status(202).json(jobManager.publicJob(job));
  });
  app.use((error, _req, res, _next) => res.status(error.name === 'ValidationError' ? 400 : 500).json({ error: error.message || 'Unexpected server error' }));
  return app;
}
