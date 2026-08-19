const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('foilLattice', {
  runtime: 'electron',
  apiBaseUrl: 'http://127.0.0.1:4317/api'
});

