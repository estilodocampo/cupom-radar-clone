import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } }).catch(() => null);
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const items = await prisma.integration.findMany({ where: { userId: user.id } }).catch(() => []);
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const { provider, config } = (await req.json().catch(() => ({}))) as { provider?: string; config?: Record<string, unknown> };
  if (!provider) return NextResponse.json({ error: 'provider obrigatório' }, { status: 400 });
  const item = await prisma.integration.upsert({
    where: { userId_provider: { userId: user.id, provider: provider.toLowerCase() } },
    update: { config: (config || {}) as object },
    create: { userId: user.id, provider: provider.toLowerCase(), config: (config || {}) as object },
  });
  return NextResponse.json({ ok: true, item });
}
