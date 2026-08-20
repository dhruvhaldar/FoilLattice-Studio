export const API_BASE = window.foilLattice?.apiBaseUrl || import.meta.env.VITE_API_BASE_URL || '/api';

export async function health() {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) throw new Error('Execution engine is unavailable');
  return response.json();
}

export async function startJob(solver, payload, onEvent) {
  const response = await fetch(`${API_BASE}/jobs/${solver}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const job = await response.json();
  if (!response.ok) throw new Error(job.error || 'Unable to start analysis');
  const events = new EventSource(`${API_BASE}/jobs/${job.id}/events`);
  events.onmessage = ({ data }) => {
    const event = JSON.parse(data);
    onEvent(event, job);
    if ((event.type === 'status' && ['complete', 'failed', 'cancelled'].includes(event.status)) || event.type === 'error') events.close();
  };
  events.onerror = () => events.close();
  return { ...job, close: () => events.close() };
}

export async function cancelJob(id) {
  await fetch(`${API_BASE}/jobs/${id}`, { method: 'DELETE' });
}
