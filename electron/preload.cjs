const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('foilLattice', {
  runtime: 'electron',
  apiBaseUrl: 'http://127.0.0.1:4317/api',
  solvers: {
    getStatus: (options) => ipcRenderer.invoke('solvers:get-status', options),
    download: (solver) => ipcRenderer.invoke('solvers:download', solver),
    provide: (solver) => ipcRenderer.invoke('solvers:provide', solver),
    openFolder: () => ipcRenderer.invoke('solvers:open-folder'),
    onProgress: (callback) => {
      const listener = (_event, progress) => callback(progress);
      ipcRenderer.on('solvers:progress', listener);
      return () => ipcRenderer.removeListener('solvers:progress', listener);
    }
  }
});
