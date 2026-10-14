import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

function storeOf(url: string): string {
  const u = (url || '').toLowerCase();
  if (u.includes('shopee') || u.includes('shope.ee')) return 'shopee';
  if (u.includes('mercadolivre') || u.includes('mercadolibre') || u.includes('meli.')) return 'mercadolivre';
  if (u.includes('amazon') || u.includes('amzn.') || u.includes('/a.co')) return 'amazon';
  if (u.includes('magalu') || u.includes('magazineluiza')) return 'magalu';
  if (u.includes('shein')) return 'shein';
  return 'outros';
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } }).catch(() => null);
  if (!user) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const [bySlot, top, all] = await Promise.all([
    prisma.shortLink.groupBy({
      by: ['slot'],
      where: { userId: user.id },
      _sum: { clicks: true },
      _count: { _all: true },
    }).catch(() => []),
    prisma.shortLink.findMany({
      where: { userId: user.id },
      orderBy: { clicks: 'desc' },
      take: 10,
      select: { code: true, clicks: true, slot: true, url: true, createdAt: true },
    }).catch(() => []),
    prisma.shortLink.findMany({
      where: { userId: user.id },
      select: { url: true, clicks: true },
    }).catch(() => [] as { url: string; clicks: number }[]),
  ]);
  const agg: Record<string, { links: number; clicks: number }> = {};
  for (const l of all) {
    const s = storeOf(l.url);
    const b = (agg[s] = agg[s] || { links: 0, clicks: 0 });
    b.links += 1;
    b.clicks += l.clicks || 0;
  }
  return NextResponse.json({
    bySlot: bySlot.map((b) => ({ slot: b.slot, clicks: b._sum.clicks ?? 0, links: b._count._all })),
    top: top.map((t) => ({ ...t, url: t.url.slice(0, 90) })),
    byStore: Object.entries(agg).map(([store, v]) => ({ store, links: v.links, clicks: v.clicks })),
  });
}
