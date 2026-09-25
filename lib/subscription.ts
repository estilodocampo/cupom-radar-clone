import { prisma } from './prisma';
import { PLANS, PlanId } from './plans';

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean);
}

export async function getUserPlan(userId: string): Promise<PlanId> {
  const user = await prisma.user.findUnique({ where: { id: userId } }).catch(() => null);
  if (user?.email && adminEmails().includes(user.email.toLowerCase().trim())) return 'master';
  const sub = await prisma.subscription.findUnique({ where: { userId } }).catch(() => null);
  const plan = (sub?.plan as PlanId) || 'gratuito';
  if (sub?.status !== 'active' && sub) return 'gratuito';
  return PLANS.some((p) => p.id === plan) ? plan : 'gratuito';
}

export async function checkPostLimit(userId: string): Promise<{ allowed: boolean; remaining: number | null }> {
  const planId = await getUserPlan(userId);
  const plan = PLANS.find((p) => p.id === planId)!;
  if (plan.postLimitPerDay === null) return { allowed: true, remaining: null };
  const day = new Date().toISOString().slice(0, 10);
  const usage = await prisma.postUsage.findUnique({ where: { userId_day: { userId, day } } }).catch(() => null);
  const used = usage?.count ?? 0;
  return { allowed: used < plan.postLimitPerDay, remaining: plan.postLimitPerDay - used };
}

export async function incrementPostUsage(userId: string) {
  const day = new Date().toISOString().slice(0, 10);
  await prisma.postUsage.upsert({
    where: { userId_day: { userId, day } },
    update: { count: { increment: 1 } },
    create: { userId, day, count: 1 },
  }).catch(() => null);
}
