// Helper de comunicação com o worker WhatsApp (rede privada Railway ou localhost)
const WORKER_URL = (process.env.WORKER_URL || 'http://localhost:3001').replace(/\/$/, '');
const TOKEN = process.env.WORKER_TOKEN || '';

export type WaSlot = 'wa1' | 'wa2';
export function normSlot(s?: string | null): WaSlot {
  return s === 'wa2' ? 'wa2' : 'wa1';
}

async function call(path: string, init?: RequestInit) {
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-worker-token': TOKEN, ...(init?.headers || {}) },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `worker ${res.status}`);
  return data;
}

export type WaStatus = {
  connected?: boolean; phone?: string; qrUpdatedAt?: string | null; lastError?: string | null;
  slots?: Record<string, { connected?: boolean; phone?: string; qrUpdatedAt?: string | null; lastError?: string | null }>;
};

export const worker = {
  status: () => call('/status') as Promise<WaStatus>,
  qr: (slot: WaSlot = 'wa1') => call(`/qr?slot=${slot}`),
  groups: (slot: WaSlot = 'wa1') => call(`/groups?slot=${slot}`) as Promise<{ groups: { id: string; name: string }[] }>,
  participants: (groupJid: string, slot: WaSlot = 'wa1') =>
    call(`/participants?groupJid=${encodeURIComponent(groupJid)}&slot=${slot}`) as Promise<{ participants: { id: string; admin: string | null }[] }>,
  send: (to: string, text: string, slot: WaSlot = 'wa1') =>
    call('/send', { method: 'POST', body: JSON.stringify({ to, text, slot }) }),
  logout: (slot: WaSlot = 'wa1') =>
    call('/logout', { method: 'POST', body: JSON.stringify({ slot }) }),
};

export function workerConfigured() {
  return Boolean(process.env.WORKER_URL || process.env.WORKER_TOKEN);
}
