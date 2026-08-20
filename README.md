# FoilLattice Studio

FoilLattice Studio is a cross-platform React, Node.js, and Electron workspace for
building and running XFOIL airfoil analyses and AVL aircraft analyses. The same
React client can use the local Electron execution engine or a remotely deployed
engine through the JSON/SSE API.

> [!IMPORTANT]
> When native solver binaries are absent, the engine runs a deterministic preview
> model so the complete UI and job pipeline remain testable. Preview values are
> prominently labeled and are **not** valid aerodynamic solver results.

## Features

- NACA 4/5-digit and custom `.dat` airfoil inputs
- Reynolds, Mach, iteration, and angle-of-attack sweep controls
- Multi-surface AVL aircraft builder with reference geometry and planform preview
- Isolated temporary workspaces for every native process
- Asynchronous job lifecycle, cancellation, progress, and live SSE output
- XFOIL polar, AVL stability, and AVL strip-force parsers
- Interactive lift, drag, moment, and efficiency plots with run comparison
- Local project persistence and desktop-aware API configuration
- Windows and Linux Electron packaging configuration

## Dependency policy

The application keeps its UI dependencies deliberate and offline-capable:

- React, React DOM, React-Bootstrap, and Bootstrap for the client
- Font Awesome Free for consistent interface icons
- Self-hosted Geist Sans and Geist Mono variable fonts from Fontsource
- Vite and its React plugin for development/building
- Express for the execution API
- Electron and electron-builder for desktop distribution

Charts remain a lightweight native SVG implementation. CORS handling, process
coordination, and port readiness checks use Node.js platform APIs, avoiding
Plotly, Axios, Concurrently, Wait-on, and standalone CORS packages.

## Quick start

Node.js 20 or newer is recommended.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The execution engine listens on port `4317`.

For the Electron development shell:

```bash
npm run dev:desktop
```

Run tests and create a production web bundle:

```bash
npm test
npm run build
```

This repository uses npm workspaces and commits `package-lock.json`. Avoid mixing
pnpm or Yarn installs into the same `node_modules` tree.

## Native binaries

Both deployments keep solvers outside the frontend bundle. Electron uses the
per-user app-data `solvers/active` directory; the web deployment uses the
execution engine's `BINARY_ROOT`. On startup the same React dialog checks the
active engine and opens when AVL or XFOIL is missing or outdated.
Users can either:

- download the supported official Windows build with SHA-256 verification; or
- choose an executable they compiled or obtained themselves. In a browser this
  uploads the selected file to the execution engine.

The **Solvers** button reopens the manager at any time. The installed version,
origin, checksum, and installation time are recorded in `installed.json` beside
the managed binaries. The application currently supports automatic downloads of
AVL 3.52 and XFOIL 6.99 on Windows. Linux builds remain user-provided because the
official current distributions are source packages requiring a local toolchain.

Solver metadata lives in `config/solver-catalog.json`, not in React code. The
manager checks the repository's raw catalog URL at startup, caches the last valid
catalog, and retains the bundled catalog as an offline fallback. Set
`SOLVER_CATALOG_URL` to override that endpoint with another HTTPS catalog. This
allows supported versions, URLs, and checksums to be updated independently of the
frontend.

The web engine downloads releases server-side and activates them atomically in
`BINARY_ROOT`; the browser never attempts to execute a native binary. Set
`ENABLE_SOLVER_MANAGEMENT=false` for an immutable deployment. Because executable
upload and activation are privileged operations, protect these routes with
authentication and authorization at the gateway before exposing the engine.

You can also supply executables directly through `BINARY_ROOT` or these
development paths:

```text
binaries/win32/xfoil.exe
binaries/win32/avl.exe
binaries/linux/xfoil
binaries/linux/avl
```

Linux files must have executable permission. Set `ALLOW_DEMO=false` in a
production engine to fail jobs when a native binary is missing instead of using
the preview model.

The binary redistribution terms, source-offer obligations, and notices must be
reviewed for the exact solver builds included in a release. This repository is
GPL-3.0-only; adding a binary is a release/compliance decision, not just a build
step.

## API

The execution engine uses Fastify. It fits this boundary well because route
parameters and future configuration contracts can use built-in JSON Schema,
tests can exercise routes through native request injection, and JSON parsing is
included without middleware. SSE output intentionally drops to Fastify's raw
Node response after `reply.hijack()`, preserving the existing real-time stream.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Engine and solver availability |
| `POST` | `/api/jobs/xfoil` | Queue an XFOIL configuration |
| `POST` | `/api/jobs/avl` | Queue an AVL configuration |
| `GET` | `/api/jobs/:id` | Read job status and final result |
| `GET` | `/api/jobs/:id/events` | Stream status, stdout, and result events |
| `DELETE` | `/api/jobs/:id` | Cancel a running job |
| `GET` | `/api/solvers` | Installed and supported solver versions |
| `GET` | `/api/solvers/events` | Stream install progress |
| `POST` | `/api/solvers/:solver/download` | Download and activate the catalog release |
| `POST` | `/api/solvers/:solver/provide` | Upload and activate a custom executable |

For a hosted web client, set `VITE_API_BASE_URL` to the HTTPS engine URL at build
time. Place the engine behind authentication, TLS, rate limits, request limits,
and a container/process sandbox before exposing it publicly.

Build the execution-engine container from the repository root with
`docker build -f server/Dockerfile .`. Mount a persistent volume at
`/app/binaries` so installed solvers survive container replacement. The base
image starts in preview mode; set `ALLOW_DEMO=false` for a native-only
deployment. Official Linux distributions are source packages, so the web dialog
offers upload rather than automatic compilation.

## Structure

```text
client/       React + Vite dashboard
server/       Fastify execution engine, generators, parsers, and tests
electron/     Secure Electron main process and preload bridge
binaries/     Platform-specific native solver assets (not included)
```

## Packaging

```bash
npm run package:win
npm run package:linux
```

Cross-building is toolchain-dependent; producing each target on its native CI
runner is the most reliable approach. Generated installers are written to
`release/`.

## License

[GNU General Public License v3.0](LICENSE)
