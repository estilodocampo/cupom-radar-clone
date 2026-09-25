import { createHash, randomBytes } from 'crypto';

export function mlRedirectUri() {
  const base = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/api/integrations/mercadolivre/callback`;
}

export function mlAuthUrl(state: string, challenge: string) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.ML_CLIENT_ID || '',
    redirect_uri: mlRedirectUri(),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return `https://auth.mercadolivre.com.br/authorization?${params.toString()}`;
}

export function newPkce() {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(16).toString('hex');
  return { verifier, challenge, state };
}

export async function mlExchangeToken(code: string, verifier: string) {
  const res = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.ML_CLIENT_ID || '',
      client_secret: process.env.ML_CLIENT_SECRET || '',
      code,
      redirect_uri: mlRedirectUri(),
      code_verifier: verifier,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message || `ML token ${res.status}`);
  return data as { access_token: string; refresh_token: string; expires_in: number; user_id: number };
}

export async function mlRefreshToken(refreshToken: string) {
  const res = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.ML_CLIENT_ID || '',
      client_secret: process.env.ML_CLIENT_SECRET || '',
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message || `ML refresh ${res.status}`);
  return data as { access_token: string; refresh_token: string; expires_in: number; user_id: number };
}
