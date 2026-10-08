import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } }).catch(() => null);
}

const jidOk = (s: string) => s.endsWith('@g.us');
const slotOk = (s: string) => (s === 'wa2' ? 'wa2' : 'wa1');

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const items = await prisma.copiadorRule.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } }).catch(() => []);
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    id?: string; name?: string; slot?: string; source?: string; hub?: string; keepCoupons?: boolean; active?: boolean;
  };
  const source = String(body.source || '').trim();
  const hub = String(body.hub || '').trim();
  if (!jidOk(source)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 400 });
  if (!jidOk(hub)) return NextResponse.json({ error: 'Selecione o grupo hub.' }, { status: 400 });
  const data = {
    name: String(body.name || '').slice(0, 60),
    slot: slotOk(String(body.slot || 'wa1')),
    source, hub,
    keepCoupons: !!body.keepCoupons,
    active: body.active !== false,
  };
  if (body.id) {
    const existing = await prisma.copiadorRule.findFirst({ where: { id: body.id, userId: user.id } }).catch(() => null);
    if (!existing) return NextResponse.json({ error: 'Regra não encontrada' }, { status: 404 });
    const item = await prisma.copiadorRule.update({ where: { id: body.id }, data });
    return NextResponse.json({ ok: true, item });
  }
  const item = await prisma.copiadorRule.create({ data: { ...data, userId: user.id } });
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id') || '';
  const existing = await prisma.copiadorRule.findFirst({ where: { id, userId: user.id } }).catch(() => null);
  if (!existing) return NextResponse.json({ error: 'Regra não encontrada' }, { status: 404 });
  await prisma.copiadorRule.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
