# Native solver binaries

Place GPL-compatible solver builds here before packaging:

- `win32/xfoil.exe` and `win32/avl.exe`
- `linux/xfoil` and `linux/avl` (executable permission required)

The development server automatically switches to deterministic demo runs when a
requested binary is absent. Production deployments can disable that fallback with
`ALLOW_DEMO=false`.

