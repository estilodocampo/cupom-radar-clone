// Encurta o link final preservando os parâmetros de rastreio (o redirect mantém a query).
async function tryShorten(longUrl: string, timeoutMs: number): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r1 = await fetch(`https://da.gd/s/?url=${encodeURIComponent(longUrl)}`, { signal: ctrl.signal });
    const b1 = (await r1.text()).trim();
    if (r1.ok && /^https?:\/\/da\.gd\/[A-Za-z0-9]+$/.test(b1)) return b1;
  } catch { /* tenta próximo */ }
  try {
    const r2 = await fetch('https://cleanuri.com/api/v1/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: longUrl }),
      signal: ctrl.signal,
    });
    const b2 = (await r2.json().catch(() => ({}))) as { result_url?: string };
    if (r2.ok && b2.result_url && /^https?:\/\//.test(b2.result_url)) return b2.result_url;
  } catch { /* mantém original */ }
  finally {
    clearTimeout(t);
  }
  return null;
}

export async function shortenUrl(longUrl: string, timeoutMs = 8000): Promise<string> {
  if (longUrl.length <= 60) return longUrl;
  return (await tryShorten(longUrl, timeoutMs)) || longUrl;
}
