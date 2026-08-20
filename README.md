# FoilLattice Studio

[![License: GPL v3](https://img.shields.io/github/license/dhruvhaldar/FoilLattice-Studio?style=flat-square&color=2ea44f)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/dhruvhaldar/FoilLattice-Studio?include_prereleases&style=flat-square)](https://github.com/dhruvhaldar/FoilLattice-Studio/releases)
[![GitHub last commit](https://img.shields.io/github/last-commit/dhruvhaldar/FoilLattice-Studio?style=flat-square)](https://github.com/dhruvhaldar/FoilLattice-Studio/commits/main)
[![GitHub issues](https://img.shields.io/github/issues/dhruvhaldar/FoilLattice-Studio?style=flat-square)](https://github.com/dhruvhaldar/FoilLattice-Studio/issues)
[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=111)](https://react.dev/)
[![Fastify 5](https://img.shields.io/badge/Fastify-5-000000?style=flat-square&logo=fastify&logoColor=white)](https://fastify.dev/)
[![Windows and Linux](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-536DFE?style=flat-square)](#supported-platforms)

FoilLattice Studio is a modern graphical workspace for **XFOIL airfoil
analysis** and **AVL aircraft stability analysis**. It combines approachable
configuration forms, live solver output, and interactive results in one app.

Use it as a native Windows/Linux desktop application or deploy the same React
interface with a remote execution engine for browser access.

> [!IMPORTANT]
> If a native solver is not installed, the engine uses a deterministic preview
> model so you can explore the interface. Preview results are clearly labelled
> and are **not valid aerodynamic analysis results**.

## Contents

- [What you can do](#what-you-can-do)
- [Quick start](#quick-start)
- [Installing AVL and XFOIL](#installing-avl-and-xfoil)
- [Using the application](#using-the-application)
- [Desktop application](#desktop-application)
- [Web deployment](#web-deployment)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [API reference](#api-reference)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Security and solver licensing](#security-and-solver-licensing)

## What you can do

### XFOIL airfoil analysis

- Enter a NACA 4/5-digit airfoil or select a custom `.dat` coordinate file.
- Configure Reynolds number, Mach number, iteration limit, and angle-of-attack
  sweep.
- Watch XFOIL output in the built-in terminal.
- Plot lift, drag, pitching moment, and aerodynamic efficiency.
- Compare results from multiple runs.

### AVL aircraft analysis

- Define reference area, chord, and span.
- Build wings and stabilizers using span, root/tip chord, sweep, dihedral,
  incidence, panel counts, location, and airfoil settings.
- Add simplified fuselage/body definitions.
- Preview the aircraft planform while editing.
- Parse stability totals, derivatives, and strip-force output.

### Projects and execution

- Save up to 20 project configurations in local browser/app storage.
- Run analyses asynchronously without blocking the interface.
- Stream progress and solver output using Server-Sent Events (SSE).
- Cancel active jobs.
- Manage solver downloads independently from frontend releases.

## Quick start

### Requirements

- Node.js 20 or newer
- npm (the repository uses npm workspaces and commits `package-lock.json`)
- Git

Clone and start the browser development version:

```bash
git clone https://github.com/dhruvhaldar/FoilLattice-Studio.git
cd FoilLattice-Studio
npm install
npm run dev
```

Open <http://localhost:5173>. The execution engine runs at
<http://127.0.0.1:4317> and Vite proxies `/api` requests to it.

To open the Electron desktop shell instead:

```bash
npm run dev:desktop
```

> [!TIP]
> Do not mix npm, pnpm, and Yarn installations in the same working tree. If npm
> reports unusual dependency-resolution errors after another package manager was
> used, remove that package manager's generated modules/store links and run
> `npm install` again.

## Installing AVL and XFOIL

Solver executables are deliberately kept outside the frontend and packaged app.
This lets solver versions be updated without rebuilding React.

When a solver is missing or a supported update is available, FoilLattice opens
the **Set up aerodynamic solvers** dialog. You can choose:

1. **Download official** — the engine downloads the catalogued release and
   verifies its pinned SHA-256 checksum before activation.
2. **Choose executable** — use a binary you compiled or obtained yourself. In a
   web browser, the file is uploaded to the execution engine.
3. **Not now** — continue in preview mode when `ALLOW_DEMO=true`.

The **Solvers** button opens this dialog again at any time.

### Supported solver releases

| Solver | Windows x64 | Linux x64 | Automatic installation |
| --- | --- | --- | --- |
| AVL | 3.52 | 3.52 source | Windows only |
| XFOIL | 6.99 | 6.996 source | Windows only |

The official Linux distributions are source packages and require a compatible
compiler/toolchain, so Linux users currently provide compiled executables.
`Pplot` is not installed because FoilLattice renders polar charts natively.

Solver URLs, versions, archive entries, and checksums live in
[`config/solver-catalog.json`](config/solver-catalog.json). At startup the
manager checks the remote catalog, caches the last valid copy, and falls back to
the bundled catalog when offline.

### Managed locations

- **Electron:** the operating system's per-user app-data directory under
  `solvers/active`.
- **Web engine:** `BINARY_ROOT`, or `binaries/<platform>` when unset.
- **Development fallback:**

```text
binaries/win32/xfoil.exe
binaries/win32/avl.exe
binaries/linux/xfoil
binaries/linux/avl
```

Linux executables must have execute permission, for example
`chmod +x binaries/linux/avl binaries/linux/xfoil`.

## Using the application

1. Select **Airfoil analysis** or **Aircraft analysis**.
2. Enter the geometry and operating conditions.
3. Select **Run analysis**.
4. Follow progress and native output in the terminal panel.
5. Inspect the plots and compare additional runs.
6. Use **Save** to preserve the current configuration locally.

The status indicator distinguishes **Native solver ready**, **Preview mode**,
and **Engine offline**. Always confirm that the native solver is ready before
using results for engineering work.

## Desktop application

### Development

```bash
npm install
npm run dev:desktop
```

Electron starts the local Fastify engine, exposes only a small secure preload
bridge, and loads the React interface. Solver management uses Electron IPC;
browser-accessible solver mutation routes are disabled inside the desktop engine.

### Build installers

```bash
# Windows NSIS installer
npm run package:win

# Linux AppImage and Debian package
npm run package:linux
```

Artifacts are written to `release/`. Packaging each target on its native
operating system or CI runner is the most reliable approach because signing and
system packaging tools vary by platform.

## Web deployment

The web version has two independently deployable pieces:

1. A static React/Vite bundle from `client/dist`.
2. The Fastify execution engine, which must run on a server capable of spawning
   AVL and XFOIL processes.

Build the frontend with the public HTTPS API address:

```bash
VITE_API_BASE_URL=https://engine.example.com/api npm run build
```

On PowerShell:

```powershell
$env:VITE_API_BASE_URL = 'https://engine.example.com/api'
npm run build
```

Serve `client/dist` using any static host. Deploy the engine on a persistent,
sandboxed host rather than a frontend-only/serverless runtime.

### Docker execution engine

Build from the repository root so Docker can include the shared solver catalog:

```bash
docker build -f server/Dockerfile -t foil-lattice-engine .
docker run --rm -p 4317:4317 \
  -v foil-lattice-solvers:/app/binaries \
  -e ALLOW_DEMO=false \
  foil-lattice-engine
```

The volume keeps uploaded/installed solvers across container replacements.
Since the official Linux releases require compilation, upload compatible Linux
executables through the dialog or place them in the mounted volume.

> [!WARNING]
> Solver download and upload endpoints change executable files on the engine.
> Put a public deployment behind TLS, authentication, authorization, rate
> limits, body-size limits, and process/container isolation. Disable management
> with `ENABLE_SOLVER_MANAGEMENT=false` on immutable deployments.

## Configuration

Copy `.env.example` as a reference. Environment files are intentionally ignored
by Git.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4317` | Fastify listening port |
| `HOST` | `0.0.0.0` | Fastify listening interface |
| `CORS_ORIGIN` | `*` | Allowed browser origin; set an exact origin in production |
| `ALLOW_DEMO` | `true` | Allow clearly labelled preview results when binaries are absent |
| `BINARY_ROOT` | Platform fallback | Directory containing active `avl` and `xfoil` executables |
| `SOLVER_DATA_DIR` | `BINARY_ROOT` | Persistent directory managed by the web solver service |
| `ENABLE_SOLVER_MANAGEMENT` | `true` | Enable server-side download/upload operations |
| `SOLVER_CATALOG_URL` | Bundled catalog URL | Alternate HTTPS catalog endpoint |
| `SOLVER_CATALOG_PATH` | `config/solver-catalog.json` | Bundled/local catalog location |
| `VITE_API_BASE_URL` | `/api` | Execution-engine API URL embedded in the web build |

Use `ALLOW_DEMO=false`, an exact `CORS_ORIGIN`, and persistent solver storage for
production.

## Architecture

```text
React + Vite client
        │ JSON requests + SSE output
        ▼
Fastify execution engine
        │ isolated temporary directory + stdin commands
        ▼
XFOIL / AVL native process
        │ polar, stability, and strip-force files
        ▼
Parser → JSON → interactive UI
```

The desktop package wraps the client and engine with Electron. The web build
hosts the client statically and runs the same engine remotely. Each native job
uses a temporary workspace that is removed after completion.

### Repository layout

```text
client/       React, Vite, React-Bootstrap, plots, and API adapters
server/       Fastify routes, job manager, solver runners, generators, parsers
electron/     Main process, secure preload bridge, desktop binary manager
config/       Shared versioned solver catalog
binaries/     Ignored local solver executables plus tracked documentation
scripts/      Development process orchestration
```

### Dependency policy

The project keeps dependencies focused and offline-capable:

- React, React-Bootstrap, Bootstrap, and Font Awesome for the interface.
- Self-hosted Geist Sans and Geist Mono fonts through Fontsource.
- Native SVG charts instead of a large charting framework.
- Fastify for JSON routes, validation, SSE, and test injection.
- Electron and electron-builder for desktop distribution.
- Node.js platform APIs for subprocesses, temporary files, and coordination.

Axios, Plotly, Concurrently, Wait-on, and standalone CORS middleware are not
required.

## API reference

All endpoints use the `/api` prefix.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Engine status and native solver availability |
| `POST` | `/jobs/xfoil` | Queue an XFOIL configuration |
| `POST` | `/jobs/avl` | Queue an AVL configuration |
| `GET` | `/jobs/:id` | Read job status and final result |
| `GET` | `/jobs/:id/events` | Stream status, stdout, and results over SSE |
| `DELETE` | `/jobs/:id` | Cancel a queued or running job |
| `GET` | `/solvers` | Read installed and supported solver versions |
| `GET` | `/solvers/events` | Stream installation progress over SSE |
| `POST` | `/solvers/:solver/download` | Download and activate the catalogued release |
| `POST` | `/solvers/:solver/provide` | Upload an executable as `application/octet-stream` |

Example health check:

```bash
curl http://localhost:4317/api/health
```

Job requests are asynchronous. The initial response contains a job ID; subscribe
to `/api/jobs/<id>/events` for logs, progress, and final results.

## Development

### Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start Fastify and Vite for browser development |
| `npm run dev:desktop` | Start Vite inside the Electron development shell |
| `npm start` | Start only the execution engine |
| `npm test` | Run server and Electron binary-manager tests |
| `npm run build` | Build the production React bundle |
| `npm run package:win` | Build the Windows installer |
| `npm run package:linux` | Build Linux AppImage and Debian packages |

Before submitting a change:

```bash
npm test
npm run build
npm audit --omit=dev
```

Generated directories (`node_modules`, `client/dist`, and `release`) and native
solver binaries are ignored. Commit source, tests, documentation, catalog
metadata, `package.json` files, and `package-lock.json`.

## Supported platforms

| Deployment | Windows 10/11 x64 | Linux x64 | Notes |
| --- | --- | --- | --- |
| Browser client | Yes | Yes | Any modern browser; execution occurs on the engine host |
| Execution engine | Yes | Yes | Requires compatible native solvers for real results |
| Electron desktop | Yes | Yes | NSIS, AppImage, and Debian packaging configured |
| Automatic solver download | Yes | No | Linux official distributions currently require compilation |

Other architectures may work with user-provided solver binaries but are not yet
catalogued or packaged.

## Troubleshooting

### The interface says “Preview mode”

Open **Solvers** and install or provide the required executable. Check that the
engine process can read and execute the file. Set `ALLOW_DEMO=false` if missing
binaries should produce an error instead of preview data.

### The interface says “Engine offline”

- Confirm the engine is running on port `4317`.
- Open `http://localhost:4317/api/health` locally.
- For hosted builds, verify `VITE_API_BASE_URL`, TLS, reverse-proxy routing, and
  `CORS_ORIGIN`.

### A solver download is rejected

The manager refuses unexpected archives and checksum mismatches. Refresh the
catalog, confirm internet access from the execution-engine host, or use **Choose
executable** with a trusted compatible build.

### A Linux executable will not start

Confirm its architecture, shared-library requirements, and execute permission:

```bash
file /path/to/avl
ldd /path/to/avl
chmod +x /path/to/avl
```

### `npm install` fails after using pnpm or Yarn

Use one package manager per working tree. Preserve your source changes, remove
the other package manager's generated installation artifacts, and reinstall with
npm using the committed lockfile.

## Security and solver licensing

- Do not expose solver-management or job-execution endpoints directly to the
  public internet without access controls and isolation.
- Treat user-provided executables as trusted administrator input. They run with
  the execution engine's operating-system permissions.
- Official downloads are accepted only over HTTPS and checked against pinned
  SHA-256 values.
- Every solver run receives an isolated temporary working directory, but this is
  not a substitute for OS/container sandboxing.
- Review the redistribution terms, notices, and source-offer obligations for the
  exact AVL/XFOIL builds used in a release.

FoilLattice Studio is licensed under the
[GNU General Public License v3.0](LICENSE). AVL and XFOIL remain the work of their
respective authors and are distributed under their own accompanying terms.

## Contributing

Bug reports, documentation improvements, platform testing, parser fixtures, and
carefully scoped feature contributions are welcome.

1. Open an issue describing the problem or proposed behavior.
2. Create a focused branch.
3. Add or update tests where applicable.
4. Run the verification commands above.
5. Open a pull request explaining user-visible changes and solver compatibility.

Please do not commit native solver executables, archives, credentials,
environment files, generated builds, or dependency directories.

---

Built with React, Vite, React-Bootstrap, Fastify, and Electron for practical
airfoil and aircraft analysis workflows.
