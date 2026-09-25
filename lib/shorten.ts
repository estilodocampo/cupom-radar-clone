import { randomBytes } from 'crypto';
import { prisma } from './prisma';

function baseUrl() {
  return (process.env.NEXTAUTH_URL || process.env.WEB_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function newCode() {
  return randomBytes(3).toString('base64url');
}

// Encurtador próprio: /r/xxxx no nosso domínio, redirect direto sem interstitial.
export async function shortenUrl(longUrl: string, userId?: string | null): Promise<string> {
  if (longUrl.length <= 60) return longUrl;
  const short = `${baseUrl()}/r/`;
  // 1) tenta gravar no banco (funciona com ou sem usuário)
  for (let i = 0; i < 3; i++) {
    const code = newCode();
    try {
      const existing = await prisma.shortLink
        .findFirst({ where: { url: longUrl }, select: { code: true } })
        .catch(() => null);
      if (existing) return short + existing.code;
      await prisma.shortLink.create({ data: { code, url: longUrl, userId: userId || null } });
      return short + code;
    } catch {
      // colisão ou banco fora: tenta o próximo código
    }
  }
  // 2) reserva externa
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch('https://cleanuri.com/api/v1/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: longUrl }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const b = (await r.json().catch(() => ({}))) as { result_url?: string };
    if (r.ok && b.result_url && /^https?:\/\//.test(b.result_url)) return b.result_url;
  } catch {
    // mantém original
  }
  return longUrl;
}
