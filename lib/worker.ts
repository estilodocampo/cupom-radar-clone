// Helper de comunicação com o worker WhatsApp (rede privada Railway ou localhost)
const WORKER_URL = (process.env.WORKER_URL || 'http://localhost:3001').replace(/\/$/, '');
const TOKEN = process.env.WORKER_TOKEN || '';

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

export const worker = {
  status: () => call('/status'),
  qr: () => call('/qr'),
  groups: () => call('/groups') as Promise<{ groups: { id: string; name: string }[] }>,
  send: (to: string, text: string) =>
    call('/send', { method: 'POST', body: JSON.stringify({ to, text }) }),
};

export function workerConfigured() {
  return Boolean(process.env.WORKER_URL || process.env.WORKER_TOKEN);
}
