import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

// Exporta todos os dados do próprio usuário (backup/portabilidade LGPD).
// Nunca inclui passwordHash.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } }).catch(() => null);
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

  const uid = user.id;
  const [
    integrations, copiador, distribuidor, scheduled, queued, dispatches,
    subscription, usage, links, feedback, connections,
  ] = await Promise.all([
    prisma.integration.findMany({ where: { userId: uid } }).catch(() => []),
    prisma.copiadorRule.findMany({ where: { userId: uid } }).catch(() => []),
    prisma.distribuidorRule.findMany({ where: { userId: uid } }).catch(() => []),
    prisma.scheduledPost.findMany({ where: { userId: uid }, orderBy: { scheduledAt: 'desc' }, take: 2000 }).catch(() => []),
    prisma.queuedOffer.findMany({ where: { userId: uid }, orderBy: { createdAt: 'desc' }, take: 2000 }).catch(() => []),
    prisma.dispatchLog.findMany({ where: { userId: uid }, orderBy: { sentAt: 'desc' }, take: 5000 }).catch(() => []),
    prisma.subscription.findUnique({ where: { userId: uid } }).catch(() => null),
    prisma.postUsage.findMany({ where: { userId: uid }, orderBy: { day: 'desc' }, take: 365 }).catch(() => []),
    prisma.shortLink.findMany({ where: { userId: uid }, orderBy: { createdAt: 'desc' }, take: 5000 }).catch(() => []),
    prisma.feedback.findMany({ where: { userId: uid }, orderBy: { createdAt: 'desc' }, take: 500 }).catch(() => []),
    prisma.whatsappConnection.findMany({ where: { userId: uid } }).catch(() => []),
  ]);

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    user: { email: user.email, name: user.name, createdAt: user.createdAt },
    integrations, copiadorRules: copiador, distribuidorRules: distribuidor,
    scheduledPosts: scheduled, queuedOffers: queued, dispatchLogs: dispatches,
    subscription, postUsage: usage, shortLinks: links,
    feedbacks: feedback, whatsappConnections: connections,
  });
}
