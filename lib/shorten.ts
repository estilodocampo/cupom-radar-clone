import { randomBytes } from 'crypto';
import { prisma } from './prisma';

function baseUrl() {
  return (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function newCode() {
  return randomBytes(4).toString('base64url');
}

// Encurtador próprio: /r/xxxx no nosso domínio, redirect direto sem interstitial.
export async function shortenUrl(longUrl: string, userId?: string | null): Promise<string> {
  if (longUrl.length <= 60) return longUrl;
  try {
    if (userId) {
      const existing = await prisma.shortLink
        .findFirst({ where: { userId, url: longUrl }, select: { code: true } })
        .catch(() => null);
      if (existing) return `${baseUrl()}/r/${existing.code}`;
    }
    for (let i = 0; i < 3; i++) {
      const code = newCode();
      try {
        await prisma.shortLink.create({ data: { code, url: longUrl, userId: userId || null } });
        return `${baseUrl()}/r/${code}`;
      } catch {
        // colisão de código: tenta outro
      }
    }
  } catch {
    // cai para o fallback externo
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r2 = await fetch('https://cleanuri.com/api/v1/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: longUrl }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const b2 = (await r2.json().catch(() => ({}))) as { result_url?: string };
    if (r2.ok && b2.result_url && /^https?:\/\//.test(b2.result_url)) return b2.result_url;
  } catch {
    // mantém original
  }
  return longUrl;
}
