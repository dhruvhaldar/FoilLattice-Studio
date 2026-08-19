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

The application intentionally keeps only the architectural dependencies:

- React and React DOM for the client
- Vite and its React plugin for development/building
- Express for the execution API
- Electron and electron-builder for desktop distribution

Charts, form primitives, responsive layout, icons, CORS handling, process
coordination, and port readiness checks are implemented locally with browser or
Node.js platform APIs. This avoids Bootstrap, Plotly, Font Awesome, Axios,
Concurrently, Wait-on, and standalone CORS packages.

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

Supply executable builds at these paths:

```text
binaries/win32/xfoil.exe
binaries/win32/avl.exe
binaries/linux/xfoil
binaries/linux/avl
```

Linux files must have executable permission. Set `ALLOW_DEMO=false` in a
production engine to fail jobs when a native binary is missing instead of using
the preview model. `BINARY_ROOT` can override the platform directory.

The binary redistribution terms, source-offer obligations, and notices must be
reviewed for the exact solver builds included in a release. This repository is
GPL-3.0-only; adding a binary is a release/compliance decision, not just a build
step.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Engine and solver availability |
| `POST` | `/api/jobs/xfoil` | Queue an XFOIL configuration |
| `POST` | `/api/jobs/avl` | Queue an AVL configuration |
| `GET` | `/api/jobs/:id` | Read job status and final result |
| `GET` | `/api/jobs/:id/events` | Stream status, stdout, and result events |
| `DELETE` | `/api/jobs/:id` | Cancel a running job |

For a hosted web client, set `VITE_API_BASE_URL` to the HTTPS engine URL at build
time. Place the engine behind authentication, TLS, rate limits, request limits,
and a container/process sandbox before exposing it publicly.

Build the execution-engine container from the repository root with
`docker build -f server/Dockerfile .`. The base image starts in preview mode;
mount Linux solver binaries at `/app/binaries` and set `ALLOW_DEMO=false` for a
native deployment.

## Structure

```text
client/       React + Vite dashboard
server/       Express execution engine, generators, parsers, and tests
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
