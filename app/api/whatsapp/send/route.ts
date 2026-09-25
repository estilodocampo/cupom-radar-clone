import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { worker } from '../../../../lib/worker';
import { getUserPlan } from '../../../../lib/subscription';
import { PLANS } from '../../../../lib/plans';

// Envio imediato de teste (requer plano pago com WhatsApp)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  const planId = await getUserPlan(user.id).catch(() => 'gratuito' as const);
  const plan = PLANS.find((p) => p.id === planId)!;
  if (!plan || plan.whatsappNumbers < 1) {
    return NextResponse.json({ error: 'Seu plano não inclui automação WhatsApp. Faça upgrade.' }, { status: 402 });
  }
  const { to, text } = (await req.json().catch(() => ({}))) as { to?: string; text?: string };
  if (!to || !text) return NextResponse.json({ error: 'to e text obrigatórios' }, { status: 400 });
  try {
    await worker.send(to, text);
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 502 });
  }
  await prisma.dispatchLog.create({ data: { userId: user.id, groupJid: to, message: text, status: 'sent' } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
