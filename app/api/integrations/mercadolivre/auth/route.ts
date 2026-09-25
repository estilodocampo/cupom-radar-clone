import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { mlAuthUrl, newPkce } from '../../../../../lib/ml';

export async function GET() {
  if (!process.env.ML_CLIENT_ID) {
    return NextResponse.json({ error: 'ML_CLIENT_ID não configurado' }, { status: 503 });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } }).catch(() => null);
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  const { verifier, challenge, state } = newPkce();
  await prisma.integration.upsert({
    where: { userId_provider: { userId: user.id, provider: 'ml_pkce' } },
    update: { config: { state, verifier } },
    create: { userId: user.id, provider: 'ml_pkce', config: { state, verifier } },
  });
  return NextResponse.redirect(mlAuthUrl(state, challenge));
}
