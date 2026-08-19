import { createApp } from './src/app.js';

const port = Number(process.env.PORT || 4317);
const host = process.env.HOST || '0.0.0.0';
const app = createApp();
const server = app.listen(port, host, () => console.log(`FoilLattice engine listening on http://${host}:${port}`));

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

