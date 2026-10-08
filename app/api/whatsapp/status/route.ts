import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { worker } from '../../../../lib/worker';
import { getUserPlan } from '../../../../lib/subscription';
import { PLANS } from '../../../../lib/plans';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const data = await worker.status().catch((e: Error) => ({ connected: false, error: e.message }));
  const user = await prisma.user.findUnique({ where: { email: session.user.email } }).catch(() => null);
  if (user && (data as { slots?: Record<string, { connected?: boolean; phone?: string }> }).slots) {
    const slots = (data as { slots: Record<string, { connected?: boolean; phone?: string }> }).slots;
    for (const [slot, s] of Object.entries(slots)) {
      await prisma.whatsappConnection
        .upsert({
          where: { userId_slot: { userId: user.id, slot } },
          update: { status: s.connected ? 'connected' : 'disconnected', phone: s.phone ?? undefined },
          create: { userId: user.id, slot, status: s.connected ? 'connected' : 'disconnected' },
        })
        .catch(() => null);
    }
  }
  return NextResponse.json(data);
}
