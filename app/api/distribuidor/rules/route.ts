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
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const items = await prisma.distribuidorRule.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } }).catch(() => []);
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const hub = String(body.hub || '').trim();
  const targets = [...new Set(((body.targets as string[]) || []).map((t) => String(t).trim()).filter(jidOk))].filter((t) => t !== hub);
  if (!jidOk(hub)) return NextResponse.json({ error: 'Selecione o grupo hub.' }, { status: 400 });
  if (!targets.length) return NextResponse.json({ error: 'Selecione ao menos um grupo destino.' }, { status: 400 });
  const data = {
    name: String(body.name || '').slice(0, 60),
    slot: slotOk(String(body.slot || 'wa1')),
    hub, targets,
    onlyMine: !!body.onlyMine,
    requireLink: !!body.requireLink,
    convert: body.convert !== false,
    stripCoupons: body.stripCoupons !== false,
    prefix: String(body.prefix || '').slice(0, 300),
    suffix: String(body.suffix || '').slice(0, 300),
    minInterval: clamp(Number(body.minInterval), 0, 1440),
    maxPerDay: clamp(Number(body.maxPerDay), 0, 50),
    dedupHoras: [0, 6, 24, 72, 168].includes(Number(body.dedupHoras)) ? Number(body.dedupHoras) : 24,
    pausado: !!body.pausado,
  };
  const id = String(body.id || '');
  if (id) {
    const existing = await prisma.distribuidorRule.findFirst({ where: { id, userId: user.id } }).catch(() => null);
    if (!existing) return NextResponse.json({ error: 'Regra não encontrada' }, { status: 404 });
    const item = await prisma.distribuidorRule.update({ where: { id }, data });
    return NextResponse.json({ ok: true, item });
  }
  const item = await prisma.distribuidorRule.create({ data: { ...data, userId: user.id } });
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id') || '';
  const existing = await prisma.distribuidorRule.findFirst({ where: { id, userId: user.id } }).catch(() => null);
  if (!existing) return NextResponse.json({ error: 'Regra não encontrada' }, { status: 404 });
  await prisma.distribuidorRule.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
