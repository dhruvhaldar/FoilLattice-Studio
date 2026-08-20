import { createApp } from './src/app.js';

const port = Number(process.env.PORT || 4317);
const host = process.env.HOST || '0.0.0.0';
const app = createApp();
try {
  await app.listen({ port, host });
  console.log(`FoilLattice engine listening on http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

const shutdown = async () => { await app.close(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
