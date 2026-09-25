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
  return NextResponse.json({ name: user.name, email: user.email, affiliateId: user.affiliateId });
}

export async function PATCH(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  await prisma.user.update({ where: { id: user.id }, data: { name: (name || '').slice(0, 80) } });
  return NextResponse.json({ ok: true });
}
