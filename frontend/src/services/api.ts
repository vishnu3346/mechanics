const envApi = (import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.VITE_API_BASE;
const envWs = (import.meta as any).env?.VITE_WS_URL || (import.meta as any).env?.VITE_WS_BASE;

const API_BASE = envApi || '/api';
const DEFAULT_WS = typeof window !== 'undefined'
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8000`
  : 'ws://localhost:8000';
const WS_BASE = envWs || DEFAULT_WS;

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

export function createSimulationSocket(
  onMessage: (data: any) => void,
  onError?: (e: Event) => void,
  onOpen?: (e: Event) => void
) {
  try {
    const ws = new WebSocket(`${WS_BASE}/ws/simulation`);
    ws.onmessage = (e) => onMessage(JSON.parse(e.data));
    ws.onerror = (e) => {
      console.warn('Simulation WebSocket unavailable:', e);
      onError?.(e);
    };
    if (onOpen) ws.onopen = onOpen;
    return ws;
  } catch (err) {
    console.warn('Simulation WebSocket init error:', err);
    if (onError) onError(err as any);
    return null;
  }
}
