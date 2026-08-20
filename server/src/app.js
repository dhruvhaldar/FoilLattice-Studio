import Fastify from 'fastify';
import { jobManager } from './services/jobManager.js';
import { solverManager } from './services/solverManager.js';
import { runXfoil } from './controllers/xfoilController.js';
import { runAvl } from './controllers/avlController.js';

const terminalStatuses = new Set(['complete', 'failed', 'cancelled']);
const solverIds = ['xfoil', 'avl'];
const solverParamSchema = {
  params: {
    type: 'object',
    required: ['solver'],
    properties: { solver: { type: 'string', enum: solverIds } }
  }
};

export function createApp(options = {}) {
  const app = Fastify({ logger: options.logger ?? process.env.NODE_ENV === 'production', bodyLimit: 3 * 1024 * 1024 });
  const managedSolvers = options.solverManager || solverManager;

  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_request, body, done) => done(null, body));
  app.addHook('onReady', () => managedSolvers.initialize());
  app.addHook('onRequest', (request, reply, done) => {
    reply.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    if (request.method === 'OPTIONS') { reply.code(204).send(); return; }
    done();
  });

  app.get('/api/health', async () => ({ ok: true, version: '0.1.0', solvers: jobManager.solverAvailability() }));

  app.post('/api/jobs/:solver', { schema: solverParamSchema }, async (request, reply) => {
    const { solver } = request.params;
    const job = jobManager.create(solver, request.body);
    reply.code(202);
    queueMicrotask(() => jobManager.execute(job, solver === 'xfoil' ? runXfoil : runAvl));
    return jobManager.publicJob(job);
  });

  app.get('/api/jobs/:id', async (request, reply) => {
    const job = jobManager.get(request.params.id);
    if (!job) return reply.code(404).send({ error: 'Job not found' });
    return jobManager.publicJob(job);
  });

  app.get('/api/jobs/:id/events', async (request, reply) => {
    const job = jobManager.get(request.params.id);
    if (!job) return reply.code(404).send({ error: 'Job not found' });
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive',
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*'
    });
    const send = (event) => reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    job.history.forEach(send);
    if (terminalStatuses.has(job.status)) return reply.raw.end();
    job.listeners.add(send);
    request.raw.on('close', () => job.listeners.delete(send));
  });

  app.delete('/api/jobs/:id', async (request, reply) => {
    const job = jobManager.get(request.params.id);
    if (!job) return reply.code(404).send({ error: 'Job not found' });
    jobManager.cancel(job);
    reply.code(202);
    return jobManager.publicJob(job);
  });

  app.get('/api/solvers', async (request) => managedSolvers.getStatus({ refresh: request.query?.refresh === '1' }));

  app.get('/api/solvers/events', async (request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive',
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*'
    });
    reply.raw.write(`data: ${JSON.stringify({ solver: 'manager', phase: 'connected' })}\n\n`);
    const send = (event) => reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    managedSolvers.on('progress', send);
    request.raw.on('close', () => managedSolvers.off('progress', send));
  });

  app.post('/api/solvers/:solver/download', { schema: solverParamSchema }, async (request) => managedSolvers.download(request.params.solver));
  app.post('/api/solvers/:solver/provide', { schema: solverParamSchema, bodyLimit: 100 * 1024 * 1024 }, async (request) => managedSolvers.provide(request.params.solver, request.body));

  app.setErrorHandler((error, _request, reply) => {
    const status = error.status || error.statusCode || (error.name === 'ValidationError' ? 400 : 500);
    reply.code(status).send({ error: error.message || 'Unexpected server error' });
  });
  return app;
}
