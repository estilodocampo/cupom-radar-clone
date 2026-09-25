import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { shopeeShortLink } from '../../../../lib/shopee';

// Conversão Shopee via API oficial (usada pelo gerador e pelo worker do Copiador).
// Auth: token do worker (x-worker-token) OU sessão do usuário dono do link.
export async function POST(req: NextRequest) {
  const isWorker = (process.env.WORKER_TOKEN || '') !== '' && req.headers.get('x-worker-token') === process.env.WORKER_TOKEN;
  const body = (await req.json().catch(() => ({}))) as { userId?: string; url?: string; subIds?: string[] };
  if (!isWorker) return NextResponse.json({ error: 'Acesso do worker' }, { status: 403 });
  if (!body.userId || !body.url) return NextResponse.json({ error: 'userId e url obrigatórios' }, { status: 400 });

  const api = await prisma.integration.findUnique({
    where: { userId_provider: { userId: body.userId, provider: 'shopee_api' } },
  }).catch(() => null);
  const cfg = api?.config as { appId?: string; secret?: string } | null;
  if (!cfg?.appId || !cfg?.secret) return NextResponse.json({ error: 'API Shopee não configurada' }, { status: 422 });

  try {
    const shortLink = await shopeeShortLink(body.url, body.subIds || ['cupomradar'], cfg as { appId: string; secret: string });
    return NextResponse.json({ shortLink });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 502 });
  }
}
