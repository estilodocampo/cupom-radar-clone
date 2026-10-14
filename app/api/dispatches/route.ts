import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } }).catch(() => null);
  if (!user) return NextResponse.json({ items: [], totals: { sent: 0, failed: 0 } });
  const [items, agg] = await Promise.all([
    prisma.dispatchLog
      .findMany({ where: { userId: user.id }, orderBy: { sentAt: 'desc' }, take: 50 })
      .catch(() => []),
    prisma.dispatchLog
      .groupBy({ by: ['status'], where: { userId: user.id }, _count: true })
      .catch(() => [] as { status: string; _count: number }[]),
  ]);
  let sent = 0, failed = 0;
  for (const a of agg) {
    if (a.status === 'sent') sent += a._count;
    else failed += a._count;
  }
  return NextResponse.json({ items, totals: { sent, failed } });
}
