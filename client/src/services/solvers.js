import { API_BASE } from './api.js';

const desktop = window.foilLattice?.solvers;

async function request(path, options) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Solver request failed with HTTP ${response.status}`);
  return payload;
}

function chooseExecutable() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.exe,application/octet-stream';
    input.onchange = () => resolve(input.files?.[0] || null);
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.click();
  });
}

export const solverApi = {
  canOpenFolder: Boolean(desktop?.openFolder),
  getStatus: (options = {}) => desktop?.getStatus
    ? desktop.getStatus(options)
    : request(`/solvers${options.refresh ? '?refresh=1' : ''}`),
  download: (solver) => desktop?.download
    ? desktop.download(solver)
    : request(`/solvers/${solver}/download`, { method: 'POST' }),
  async provide(solver) {
    if (desktop?.provide) return desktop.provide(solver);
    const file = await chooseExecutable();
    if (!file) return { canceled: true };
    const status = await request(`/solvers/${solver}/provide`, {
      method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file
    });
    return { canceled: false, status };
  },
  openFolder: () => desktop?.openFolder?.(),
  onProgress(callback) {
    if (desktop?.onProgress) return desktop.onProgress(callback);
    const events = new EventSource(`${API_BASE}/solvers/events`);
    events.onmessage = ({ data }) => callback(JSON.parse(data));
    return () => events.close();
  }
};
