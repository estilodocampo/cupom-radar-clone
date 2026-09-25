import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } }).catch(() => null);
}

function clean(body: {
  name?: string; keywords?: string[]; targetGroups?: string[];
  intervalMinutes?: number; maxPostsPerRun?: number; active?: boolean;
}) {
  const keywords = [...new Set((body.keywords || []).map((k) => String(k).trim()).filter(Boolean))].slice(0, 10);
  const targetGroups = [...new Set((body.targetGroups || []).map((g) => String(g).trim()).filter(Boolean))].slice(0, 30);
  if (!keywords.length) return { error: 'Informe ao menos uma palavra-chave.' };
  if (!targetGroups.length) return { error: 'Selecione ao menos um grupo destino.' };
  return {
    data: {
      name: String(body.name || 'Meu radar').slice(0, 60),
      keywords,
      targetGroups,
      intervalMinutes: Math.min(1440, Math.max(30, Number(body.intervalMinutes) || 120)),
      maxPostsPerRun: Math.min(10, Math.max(1, Number(body.maxPostsPerRun) || 3)),
      active: body.active !== false,
    },
  };
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const items = await prisma.radarConfig.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { posts: true } } },
  }).catch(() => []);
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { id, ...rest } = body as { id?: string } & Parameters<typeof clean>[0];
  const parsed = clean(rest);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (id) {
    const existing = await prisma.radarConfig.findFirst({ where: { id, userId: user.id } }).catch(() => null);
    if (!existing) return NextResponse.json({ error: 'Radar não encontrado' }, { status: 404 });
    const item = await prisma.radarConfig.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ ok: true, item });
  }
  const item = await prisma.radarConfig.create({ data: { ...parsed.data, userId: user.id } });
  return NextResponse.json({ ok: true, item });
}
