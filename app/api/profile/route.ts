import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
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
  return NextResponse.json({ name: user.name, email: user.email, affiliateId: user.affiliateId, hasPassword: Boolean(user.passwordHash) });
}

export async function PATCH(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const { name, password } = (await req.json().catch(() => ({}))) as { name?: string; password?: string };
  const data: { name?: string; passwordHash?: string } = {};
  if (typeof name === 'string') data.name = name.slice(0, 80);
  if (typeof password === 'string' && password.length > 0) {
    if (password.length < 6) return NextResponse.json({ error: 'Mínimo de 6 caracteres' }, { status: 400 });
    data.passwordHash = await bcrypt.hash(password, 10);
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nada para salvar' }, { status: 400 });
  await prisma.user.update({ where: { id: user.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  await prisma.user.delete({ where: { id: user.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
