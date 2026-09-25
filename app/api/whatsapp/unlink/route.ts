import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { worker } from '../../../../lib/worker';
import { getUserPlan } from '../../../../lib/subscription';
import { PLANS } from '../../../../lib/plans';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } }).catch(() => null);
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  const planId = await getUserPlan(user.id).catch(() => 'gratuito' as const);
  const plan = PLANS.find((p) => p.id === planId)!;
  if (!plan || plan.whatsappNumbers < 1) {
    return NextResponse.json({ error: 'Seu plano não inclui automação WhatsApp.' }, { status: 402 });
  }
  try {
    await worker.logout();
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 502 });
  }
  await prisma.whatsappConnection.upsert({
    where: { userId: user.id },
    update: { status: 'disconnected', phone: null },
    create: { userId: user.id, status: 'disconnected' },
  }).catch(() => null);
  return NextResponse.json({ ok: true });
}
