import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

export type RuleStat = {
  id: string;
  name: string;
  kind: 'copiador' | 'distribuidor';
  slot: string;
  active: boolean;
  alvos: number;
  sent: number;
  failed: number;
};

// Desempenho por regra: envios e falhas agregados (somente leitura).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } }).catch(() => null);
  if (!user) return NextResponse.json({ items: [] });

  const [cop, dis, agg] = await Promise.all([
    prisma.copiadorRule.findMany({ where: { userId: user.id }, select: { id: true, name: true, slot: true, active: true } }).catch(() => []),
    prisma.distribuidorRule.findMany({ where: { userId: user.id }, select: { id: true, name: true, slot: true, pausado: true, targets: true } }).catch(() => []),
    prisma.dispatchLog.groupBy({ by: ['ruleId', 'status'], where: { userId: user.id, NOT: { ruleId: null } }, _count: true }).catch(() => []),
  ]);

  const counts: Record<string, { sent: number; failed: number }> = {};
  for (const a of agg) {
    if (!a.ruleId) continue;
    const c = (counts[a.ruleId] = counts[a.ruleId] || { sent: 0, failed: 0 });
    if (a.status === 'sent') c.sent += a._count;
    else c.failed += a._count;
  }

  const items: RuleStat[] = [
    ...cop.map((r) => ({
      id: r.id, name: r.name || 'Cópia', kind: 'copiador' as const,
      slot: r.slot || 'wa1', active: r.active !== false, alvos: 1,
      sent: counts[r.id]?.sent || 0, failed: counts[r.id]?.failed || 0,
    })),
    ...dis.map((r) => ({
      id: r.id, name: r.name || 'Distribuição', kind: 'distribuidor' as const,
      slot: r.slot || 'wa1', active: !r.pausado, alvos: (r.targets || []).length,
      sent: counts[r.id]?.sent || 0, failed: counts[r.id]?.failed || 0,
    })),
  ];
  return NextResponse.json({ items });
}
