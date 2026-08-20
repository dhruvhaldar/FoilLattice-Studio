# Native solver binaries

This directory is only a fallback for running the Express engine without
Electron. Place GPL-compatible development solver builds here if needed:

- `win32/xfoil.exe` and `win32/avl.exe`
- `linux/xfoil` and `linux/avl` (executable permission required)

Electron installations use the per-user app-data solver manager instead; native
binaries are no longer embedded in desktop packages. The development server
automatically switches to deterministic demo runs when a requested binary is
absent. Production deployments can disable that fallback with `ALLOW_DEMO=false`.
