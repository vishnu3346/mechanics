const envApi = (import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.VITE_API_BASE;
const envWs = (import.meta as any).env?.VITE_WS_URL || (import.meta as any).env?.VITE_WS_BASE;

const API_BASE = envApi || '/api';
const DEFAULT_WS = typeof window !== 'undefined'
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8000`
  : 'ws://localhost:8000';
const WS_BASE = envWs || DEFAULT_WS;

import {
  mockHealth,
  mockSystemInfo,
  mockScenarios,
  generateSimulationResult,
  mockHistory,
  mockDetections,
  mockClassCounts,
} from './mockApi'

function handleMockFallback(path: string, body?: any, _method: string = 'GET'): any {
  const cleanPath = path.replace(/\/$/, '')

  if (cleanPath === '/health') {
    return mockHealth
  }

  if (cleanPath === '/system') {
    return mockSystemInfo
  }

  if (cleanPath === '/scenarios') {
    return { scenarios: mockScenarios }
  }

  if (cleanPath === '/scenarios/comparison') {
    return {
      scenarios: mockScenarios.map((s) => ({
        id: s.id,
        name: s.name,
        result: generateSimulationResult(s.id),
      })),
    }
  }

  if (cleanPath.startsWith('/scenarios/') && cleanPath.endsWith('/run')) {
    const parts = cleanPath.split('/')
    const scenarioId = parts[2]
    return { result: generateSimulationResult(scenarioId) }
  }

  if (cleanPath.startsWith('/scenarios/')) {
    const scenarioId = cleanPath.replace('/scenarios/', '')
    const sc = mockScenarios.find((s) => s.id === scenarioId) || mockScenarios[0]
    return { scenario: sc }
  }

  if (cleanPath === '/simulation/run') {
    return { result: generateSimulationResult('custom', body) }
  }

  if (cleanPath === '/simulation/validate') {
    return { valid: true, warnings: [] }
  }

  if (cleanPath === '/simulation/status') {
    return { running: false, status: 'idle' }
  }

  if (cleanPath === '/fluidization/curve') {
    return {
      velocities: [0.02, 0.04, 0.06, 0.085, 0.12, 0.2, 0.4, 0.6, 0.85, 1.0, 1.2],
      dp_bed: [1.2, 3.4, 5.8, 8.58, 8.58, 8.58, 8.58, 8.58, 8.58, 8.58, 8.58],
      dp_distributor: [0.05, 0.15, 0.4, 0.85, 1.4, 2.1, 2.8, 3.12, 3.5, 3.9, 4.3],
      umf_wen_yu: 0.084,
      umf_ergun: 0.086,
      umf_effective: 0.085,
    }
  }

  if (cleanPath === '/anomaly/predict') {
    return {
      is_anomaly: false,
      anomaly_state: 'NORMAL_FLUIDIZATION',
      physics_risk_level: 'LOW',
      probability: 0.04,
      confidence: 0.96,
      contributing_factors: ['Normal bed operation', 'Clean sand bed'],
    }
  }

  if (cleanPath === '/vision/inference') {
    return {
      detections: mockDetections,
      class_counts: mockClassCounts,
      total_objects: mockDetections.length,
      mode: 'demo',
      synthetic: true,
    }
  }

  if (cleanPath === '/vision/classify') {
    return {
      predicted_class: 'Plastic',
      confidence: 0.94,
      probabilities: { Plastic: 0.94, Infectious: 0.03, Sharps: 0.02, General: 0.01 },
    }
  }

  if (cleanPath === '/history') {
    return { history: mockHistory, total: mockHistory.length }
  }

  if (cleanPath.startsWith('/history/')) {
    const id = cleanPath.replace('/history/', '')
    const item = mockHistory.find((h) => h.id === id) || mockHistory[0]
    return { entry: item, ...item }
  }

  return { message: 'OK', path: cleanPath }
}

export const api = {
  async get(path: string) {
    try {
      const res = await fetch(`${API_BASE}${path}`);
      const isJson = res.headers.get('content-type')?.includes('application/json');
      if (res.ok && isJson) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return handleMockFallback(path, undefined, 'GET');
  },
  async post(path: string, body?: any) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const isJson = res.headers.get('content-type')?.includes('application/json');
      if (res.ok && isJson) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return handleMockFallback(path, body, 'POST');
  },
  async postFile(path: string, file: File) {
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_BASE}${path}`, { method: 'POST', body: form });
      const isJson = res.headers.get('content-type')?.includes('application/json');
      if (res.ok && isJson) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return handleMockFallback(path, file, 'POST');
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
