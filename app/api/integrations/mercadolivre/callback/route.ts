import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { mlExchangeToken } from '../../../../../lib/ml';

export async function GET(req: NextRequest) {
  const base = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const mlError = req.nextUrl.searchParams.get('error');
  if (mlError) {
    console.error('[ml-oauth] erro do ML:', mlError);
    return NextResponse.redirect(`${base}/dashboard/robo?ml=negado`);
  }
  if (!code || !state) return NextResponse.redirect(`${base}/dashboard/robo?ml=erro`);
  const pkce = await prisma.integration.findFirst({ where: { provider: 'ml_pkce' } }).catch(() => null);
  const cfg = pkce?.config as { state?: string; verifier?: string } | null;
  if (!pkce || cfg?.state !== state || !cfg?.verifier) {
    return NextResponse.redirect(`${base}/dashboard/robo?ml=estado`);
  }
  try {
    const tok = await mlExchangeToken(code, cfg.verifier);
    await prisma.integration.upsert({
      where: { userId_provider: { userId: pkce.userId, provider: 'mercadolivre_oauth' } },
      update: { config: { accessToken: tok.access_token, refreshToken: tok.refresh_token, mlUserId: tok.user_id, expiresAt: Date.now() + tok.expires_in * 1000 } },
      create: { userId: pkce.userId, provider: 'mercadolivre_oauth', config: { accessToken: tok.access_token, refreshToken: tok.refresh_token, mlUserId: tok.user_id, expiresAt: Date.now() + tok.expires_in * 1000 } },
    });
    await prisma.integration.delete({ where: { id: pkce.id } }).catch(() => null);
    return NextResponse.redirect(`${base}/dashboard/robo?ml=ok`);
  } catch (e) {
    console.error('[ml-oauth] falha na troca do token:', String(e).slice(0, 300));
    return NextResponse.redirect(`${base}/dashboard/robo?ml=erro_token`);
  }
}
