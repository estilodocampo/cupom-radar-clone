import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } }).catch(() => null);
  if (!user) return NextResponse.json({ items: [] });
  const items = await prisma.dispatchLog
    .findMany({ where: { userId: user.id }, orderBy: { sentAt: 'desc' }, take: 50 })
    .catch(() => []);
  return NextResponse.json({ items });
}
