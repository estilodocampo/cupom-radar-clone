import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { worker } from '../../../../lib/worker';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const data = await worker.status().catch((e: Error) => ({ connected: false, error: e.message }));
  const user = await prisma.user.findUnique({ where: { email: session.user.email } }).catch(() => null);
  if (user && (data as { connected?: boolean }).connected !== undefined) {
    await prisma.whatsappConnection
      .upsert({
        where: { userId: user.id },
        update: { status: (data as { connected?: boolean }).connected ? 'connected' : 'disconnected', phone: (data as { phone?: string }).phone ?? undefined },
        create: { userId: user.id, status: (data as { connected?: boolean }).connected ? 'connected' : 'disconnected' },
      })
      .catch(() => null);
  }
  return NextResponse.json(data);
}
