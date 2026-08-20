import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createApp } from '../src/app.js';

class StubSolverManager extends EventEmitter {
  async initialize() {}
  async getStatus() { return { runtime: 'web', managementEnabled: true, solvers: { avl: { installed: false }, xfoil: { installed: false } } }; }
  async download(solver) { return { downloaded: solver }; }
  async provide(solver, body) { return { provided: solver, bytes: body.length }; }
}

test('Fastify engine exposes health and solver management', async (t) => {
  const app = createApp({ logger: false, solverManager: new StubSolverManager() });
  t.after(() => app.close());

  const health = await app.inject({ method: 'GET', url: '/api/health' });
  assert.equal(health.statusCode, 200);
  assert.equal(health.json().ok, true);

  const status = await app.inject({ method: 'GET', url: '/api/solvers' });
  assert.equal(status.statusCode, 200);
  assert.equal(status.json().runtime, 'web');

  const upload = await app.inject({ method: 'POST', url: '/api/solvers/avl/provide', headers: { 'content-type': 'application/octet-stream' }, payload: Buffer.alloc(12_000) });
  assert.equal(upload.statusCode, 200);
  assert.equal(upload.json().bytes, 12_000);

  const preflight = await app.inject({ method: 'OPTIONS', url: '/api/solvers/avl/provide' });
  assert.equal(preflight.statusCode, 204);
  assert.equal(preflight.headers['access-control-allow-methods'], 'GET,POST,DELETE,OPTIONS');
});

test('Fastify schema rejects unknown solver identifiers', async (t) => {
  const app = createApp({ logger: false, solverManager: new StubSolverManager() });
  t.after(() => app.close());
  const response = await app.inject({ method: 'POST', url: '/api/solvers/not-a-solver/download' });
  assert.equal(response.statusCode, 400);
});
