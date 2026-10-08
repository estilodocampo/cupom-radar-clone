import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { worker, normSlot } from '../../../../lib/worker';
import { getUserPlan } from '../../../../lib/subscription';
import { PLANS } from '../../../../lib/plans';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const slot = normSlot(req.nextUrl.searchParams.get('slot'));
  if (slot === 'wa2') {
    const user = await prisma.user.findUnique({ where: { email: session.user.email } }).catch(() => null);
    const planId = user ? await getUserPlan(user.id).catch(() => 'gratuito' as const) : 'gratuito';
    const max = PLANS.find((p) => p.id === planId)?.whatsappNumbers ?? 0;
    if (max < 2) return NextResponse.json({ error: 'Seu plano permite 1 número. Faça upgrade para Master para o 2º.', needUpgrade: true }, { status: 402 });
  }
  const data = await worker.qr(slot).catch((e: Error) => ({ connected: false, qr: null, error: e.message }));
  return NextResponse.json(data);
}
