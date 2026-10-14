import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { shopeeGraphql } from '../../../../lib/shopee';

// Relatório da própria Shopee (cliques, pedidos, comissão dos seus sub-IDs).
// Funciona com link direto OU /r/ — a atribuição é pelo sub-ID, não pelo encurtador.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } }).catch(() => null);
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

  const integ = await prisma.integration
    .findUnique({ where: { userId_provider: { userId: user.id, provider: 'shopee_api' } } })
    .catch(() => null);
  const cfg = (integ?.config || {}) as { appId?: string; secret?: string };
  if (!cfg.appId || !cfg.secret) {
    return NextResponse.json({ configured: false });
  }

  const query = 'query { conversionReport { edges { node { id clicks orders estimatedCommission } } } }';
  let out: { data?: Record<string, unknown>; errors?: { message?: string }[] };
  try {
    out = await shopeeGraphql({ appId: cfg.appId, secret: cfg.secret }, query);
  } catch (e) {
    return NextResponse.json({ configured: true, error: `Shopee: ${String(e).slice(0, 150)}` });
  }
  if (out.errors?.length) {
    console.warn('[shopee-report] erro da API:', out.errors.map((e) => e.message).join(' | ').slice(0, 300));
    return NextResponse.json({ configured: true, error: out.errors[0]?.message || 'Shopee: erro no relatório' });
  }

  const report = (out.data?.conversionReport || {}) as { edges?: { node?: Record<string, unknown> }[] };
  const edges = report.edges || [];
  // Log da amostra crua (truncada) para calibrar os campos exatos do relatório
  if (edges[0]?.node) {
    console.info('[shopee-report] amostra:', JSON.stringify(edges[0].node).slice(0, 1500));
  }
  let clicks = 0, orders = 0, commission = 0;
  for (const e of edges) {
    const n = (e?.node || {}) as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0);
    clicks += num(n.clicks ?? n.clickCount);
    orders += num(n.orders ?? n.orderCount);
    commission += num(n.estimatedCommission ?? n.commission);
  }
  return NextResponse.json({
    configured: true,
    totals: { clicks, orders, commission: Math.round(commission * 100) / 100, rows: edges.length },
  });
}
