// Encurta o link final preservando os parâmetros de rastreio (o redirect mantém a query).
export async function shortenUrl(longUrl: string, timeoutMs = 8000): Promise<string> {
  if (longUrl.length <= 60) return longUrl;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(longUrl)}`, { signal: ctrl.signal });
    clearTimeout(t);
    const short = (await res.text()).trim();
    if (res.ok && /^https?:\/\/is\.gd\/[A-Za-z0-9]+$/.test(short)) return short;
    return longUrl;
  } catch {
    return longUrl;
  }
}
