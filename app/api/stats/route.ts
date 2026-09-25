import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { getUserPlan } from '../../../lib/subscription';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } }).catch(() => null);
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  const plan = await getUserPlan(user.id).catch(() => 'gratuito' as const);
  const day = new Date().toISOString().slice(0, 10);
  const [usage, scheduledPending, sentTotal] = await Promise.all([
    prisma.postUsage.findUnique({ where: { userId_day: { userId: user.id, day } } }).catch(() => null),
    prisma.scheduledPost.count({ where: { userId: user.id, status: 'pending' } }).catch(() => 0),
    prisma.dispatchLog.count({ where: { userId: user.id, status: 'sent' } }).catch(() => 0),
  ]);
  return NextResponse.json({ plan, postsToday: usage?.count ?? 0, scheduledPending, sentTotal });
}
