import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { detectStore, toAffiliateLink, buildPost } from '../../../lib/shopee-parser';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { checkPostLimit, incrementPostUsage } from '../../../lib/subscription';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { url, title, priceFrom, priceTo, coupon, affiliateId = 'SEU_ID' } = body;
  if (!url || !title || !priceTo) {
    return NextResponse.json({ error: 'url, title, priceTo obrigatórios' }, { status: 400 });
  }
  // Se logado, impõe limite do plano e usa IDs de afiliado configurados
  let userId: string | null = null;
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.email) {
      const user = await prisma.user.findUnique({ where: { email: session.user.email } });
      if (user) {
        userId = user.id;
        const { allowed, remaining } = await checkPostLimit(user.id);
        if (!allowed) return NextResponse.json({ error: 'Limite diário do plano gratuito atingido. Faça upgrade.' }, { status: 402 });
        await incrementPostUsage(user.id);
        void remaining;
      }
    }
  } catch {
    // Sem banco configurado: segue modo demo
  }
  const store = detectStore(url);
  let affId = affiliateId;
  if (userId && affId === 'SEU_ID') {
    const integ = await prisma.integration.findUnique({ where: { userId_provider: { userId, provider: store } } }).catch(() => null);
    const cfg = integ?.config as { affiliateId?: string } | null;
    if (cfg?.affiliateId) affId = cfg.affiliateId;
  }
  const affLink = toAffiliateLink(url, affId, store);
  const text = buildPost(store, { title, priceFrom, priceTo, link: affLink, coupon });
  return NextResponse.json({ store, affiliateLink: affLink, text });
}
