import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { shopeeGraphql } from '../../../../lib/shopee';

// Relatório da própria Shopee (cliques, pedidos, comissão, top produtos).
// Funciona com link direto OU /r/ — a atribuição é pelo sub-ID, não pelo encurtador.

// Cache do schema por instância (evita re-introspectar a cada abertura)
const schemaCache: Record<string, string[]> = {};

async function scalarFields(creds: { appId: string; secret: string }, typeName: string): Promise<string[]> {
  if (schemaCache[typeName]) return schemaCache[typeName];
  try {
    const r = await shopeeGraphql(
      creds,
      `query { __type(name: "${typeName}") { fields { name type { name kind ofType { name kind } } } } }`
    );
    const t = ((r.data || {}) as Record<string, unknown>).__type as
      | { fields?: { name: string; type?: { name?: string; kind?: string; ofType?: { name?: string; kind?: string } } }[] }
      | undefined;
    const out = (t?.fields || [])
      .filter((f) => {
        const k = f?.type?.kind;
        const inner = f?.type?.ofType?.kind;
        return (
          k === 'SCALAR' ||
          k === 'ENUM' ||
          ((k === 'NON_NULL' || k === 'LIST') && (inner === 'SCALAR' || inner === 'ENUM'))
        );
      })
      .map((f) => f.name)
      .filter(Boolean)
      .slice(0, 25);
    schemaCache[typeName] = out;
    return out;
  } catch {
    return [];
  }
}

const num = (v: unknown): number =>
  typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;

const pick = (o: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
};

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
  const creds = { appId: cfg.appId, secret: cfg.secret };

  // Descobre fonte de cliques (clickReport? trafficReport?) — loga 1x
  try {
    const q = await shopeeGraphql(creds, 'query { __type(name: "Query") { fields { name } } }');
    const t = ((q.data || {}) as Record<string, unknown>).__type as { fields?: { name: string }[] } | undefined;
    const names = (t?.fields || []).map((f) => f.name);
    console.info('[shopee-report] Query fields:', names.filter((n) => /click|traffic|summary|stat|overview|report|conversion|valid|order/i.test(n || '')).join(',').slice(0, 500));
  } catch (e) {
    console.warn('[shopee-report] introspecção Query falhou:', String(e).slice(0, 150));
  }

  const convFields = await scalarFields(creds, 'ConversionReport');
  const orderFields = await scalarFields(creds, 'ConversionReportOrder');
  console.info('[shopee-report] ConversionReport:', convFields.join(',').slice(0, 600));
  console.info('[shopee-report] ConversionReportOrder:', orderFields.join(',').slice(0, 600));
  if (!convFields.length) {
    return NextResponse.json({ configured: true, error: 'Shopee: schema incompatível (calibrando)' });
  }

  const sel = convFields.filter((f) => f !== 'orders');
  if (orderFields.length) sel.push(`orders { ${orderFields.slice(0, 15).join(' ')} }`);
  const query = `query { conversionReport { nodes { ${sel.join(' ')} } } }`;
  let out: { data?: Record<string, unknown>; errors?: { message?: string }[] };
  try {
    out = await shopeeGraphql(creds, query);
  } catch (e) {
    return NextResponse.json({ configured: true, error: `Shopee: ${String(e).slice(0, 150)}` });
  }
  if (out.errors?.length) {
    console.warn('[shopee-report] erro da API:', out.errors.map((e) => e.message).join(' | ').slice(0, 400));
    return NextResponse.json({ configured: true, error: out.errors[0]?.message || 'Shopee: erro no relatório' });
  }

  const report = (out.data?.conversionReport || {}) as { nodes?: Record<string, unknown>[] };
  const nodes = report.nodes || [];
  if (nodes[0]) console.info('[shopee-report] amostra:', JSON.stringify(nodes[0]).slice(0, 1500));

  let clicks = 0, orders = 0, commission = 0;
  const prod = new Map<string, { name: string; orders: number; commission: number; clicks: number }>();
  const addProd = (o: Record<string, unknown>, oCount: number, oComm: number, oClick: number) => {
    const name = String(pick(o, ['productName', 'product_name', 'itemName', 'item_name', 'title', 'name']) ?? '').slice(0, 80);
    if (!name) return;
    const p = prod.get(name) || { name, orders: 0, commission: 0, clicks: 0 };
    p.orders += oCount;
    p.commission += oComm;
    p.clicks += oClick;
    prod.set(name, p);
  };

  for (const n0 of nodes) {
    const n = (n0 || {}) as Record<string, unknown>;
    const nClick = num(pick(n, ['clicks', 'clickCount', 'totalClicks', 'click']));
    const sub = Array.isArray(n.orders) ? (n.orders as Record<string, unknown>[]) : [];
    const nOrders = sub.length || num(pick(n, ['orders', 'orderCount', 'totalOrders', 'order']));
    const nComm = num(pick(n, ['estimatedCommission', 'commission', 'finalCommission', 'totalCommission', 'commissionAmount']));
    clicks += nClick;
    orders += nOrders;
    commission += nComm;
    if (sub.length) {
      for (const s0 of sub.slice(0, 50)) {
        const s = (s0 || {}) as Record<string, unknown>;
        addProd(
          s,
          num(pick(s, ['quantity', 'qty', 'amount'])) || 1,
          num(pick(s, ['commission', 'estimatedCommission', 'finalCommission', 'commissionAmount'])),
          0
        );
      }
    } else {
      addProd(n, nOrders || 1, nComm, nClick);
    }
  }

  const topProducts = [...prod.values()]
    .sort((a, b) => b.orders - a.orders || b.commission - a.commission)
    .slice(0, 10)
    .map((p) => ({ ...p, commission: Math.round(p.commission * 100) / 100 }));

  return NextResponse.json({
    configured: true,
    totals: { clicks, orders, commission: Math.round(commission * 100) / 100, rows: nodes.length },
    topProducts,
  });
}
