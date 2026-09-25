import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } }).catch(() => null);
  if (!user) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const existing = await prisma.radarConfig.findFirst({ where: { id: params.id, userId: user.id } }).catch(() => null);
  if (!existing) return NextResponse.json({ error: 'Radar não encontrado' }, { status: 404 });
  await prisma.radarConfig.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
