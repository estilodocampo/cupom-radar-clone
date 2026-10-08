import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } }).catch(() => null);
  if (!user) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const bySlot = await prisma.shortLink.groupBy({
    by: ['slot'],
    where: { userId: user.id },
    _sum: { clicks: true },
    _count: { _all: true },
  }).catch(() => []);
  const top = await prisma.shortLink.findMany({
    where: { userId: user.id },
    orderBy: { clicks: 'desc' },
    take: 10,
    select: { code: true, clicks: true, slot: true, url: true, createdAt: true },
  }).catch(() => []);
  return NextResponse.json({
    bySlot: bySlot.map((b) => ({ slot: b.slot, clicks: b._sum.clicks ?? 0, links: b._count._all })),
    top: top.map((t) => ({ ...t, url: t.url.slice(0, 90) })),
  });
}
