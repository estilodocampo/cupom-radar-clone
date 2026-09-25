import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { getUserPlan } from '../../../lib/subscription';
import { PLANS } from '../../../lib/plans';

async function paidUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return null;
  const planId = await getUserPlan(user.id).catch(() => 'gratuito' as const);
  const plan = PLANS.find((p) => p.id === planId)!;
  if (!plan || plan.whatsappNumbers < 1) return null;
  return user;
}

export async function GET() {
  const user = await paidUser();
  if (!user) return NextResponse.json({ error: 'Plano com WhatsApp necessário' }, { status: 402 });
  const items = await prisma.scheduledPost
    .findMany({ where: { userId: user.id }, orderBy: { scheduledAt: 'desc' }, take: 50 })
    .catch(() => []);
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await paidUser();
  if (!user) return NextResponse.json({ error: 'Plano com WhatsApp necessário' }, { status: 402 });
  const { groupJid, groupName, message, scheduledAt } = (await req.json().catch(() => ({}))) as {
    groupJid?: string; groupName?: string; message?: string; scheduledAt?: string;
  };
  if (!groupJid || !message || !scheduledAt) {
    return NextResponse.json({ error: 'groupJid, message e scheduledAt obrigatórios' }, { status: 400 });
  }
  const when = new Date(scheduledAt);
  if (isNaN(when.getTime()) || when.getTime() < Date.now() - 60000) {
    return NextResponse.json({ error: 'scheduledAt deve ser data/hora futura' }, { status: 400 });
  }
  const item = await prisma.scheduledPost.create({
    data: { userId: user.id, groupJid, groupName, message, scheduledAt: when },
  });
  return NextResponse.json({ ok: true, item });
}
