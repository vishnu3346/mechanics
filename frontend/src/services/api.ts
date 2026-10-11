const API_BASE = '/api';
const WS_BASE = `ws://${window.location.hostname}:8000`;

export const api = {
  async get(path: string) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },
  async post(path: string, body?: any) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },
  async postFile(path: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}${path}`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },
};

export function createSimulationSocket(onMessage: (data: any) => void) {
  const ws = new WebSocket(`${WS_BASE}/ws/simulation`);
  ws.onmessage = (e) => onMessage(JSON.parse(e.data));
  ws.onerror = (e) => console.error('WebSocket error:', e);
  return ws;
}
