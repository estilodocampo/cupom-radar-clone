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

  // Introspecção: descobre args e campos reais (log no servidor, 1x por abertura)
  try {
    const t = await shopeeGraphql({ appId: cfg.appId, secret: cfg.secret }, 'query { __type(name: "ConversionReportConnection") { fields { name } } }');
    console.info('[shopee-report] tipo:', JSON.stringify(t).slice(0, 1200));
    const q = await shopeeGraphql({ appId: cfg.appId, secret: cfg.secret }, 'query { __type(name: "Query") { fields { name args { name } } } }');
    const fields = (((q.data || {}) as Record<string, unknown>).__type || {}) as { fields?: { name: string; args?: { name: string }[] }[] };
    const rel = (fields.fields || []).filter((f) => /conversion|report|valid/i.test(f.name || ''));
    console.info('[shopee-report] queries:', JSON.stringify(rel).slice(0, 1200));
  } catch (e) {
    console.warn('[shopee-report] introspecção falhou:', String(e).slice(0, 150));
  }

  const query = 'query { conversionReport { nodes { id clicks orders estimatedCommission } } }';
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

  const report = (out.data?.conversionReport || {}) as { edges?: { node?: Record<string, unknown> }[]; nodes?: Record<string, unknown>[] };
  const nodes = report.nodes || (report.edges || []).map((e) => e?.node || {});
  // Log da amostra crua (truncada) para calibrar os campos exatos do relatório
  if (nodes[0]) {
    console.info('[shopee-report] amostra:', JSON.stringify(nodes[0]).slice(0, 1500));
  }
  let clicks = 0, orders = 0, commission = 0;
  for (const n0 of nodes) {
    const n = (n0 || {}) as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0);
    clicks += num(n.clicks ?? n.clickCount);
    orders += num(n.orders ?? n.orderCount);
    commission += num(n.estimatedCommission ?? n.commission);
  }
  return NextResponse.json({
    configured: true,
    totals: { clicks, orders, commission: Math.round(commission * 100) / 100, rows: nodes.length },
  });
}
