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
  let finalCoupon = coupon as string | undefined;
  let template: string | null = null;
  let hook: string | null = null;
  if (userId) {
    const [storeInteg, cupons, templates, ganchos] = await Promise.all([
      affId === 'SEU_ID' ? prisma.integration.findUnique({ where: { userId_provider: { userId, provider: store } } }).catch(() => null) : null,
      !finalCoupon ? prisma.integration.findUnique({ where: { userId_provider: { userId, provider: 'cupons' } } }).catch(() => null) : null,
      prisma.integration.findUnique({ where: { userId_provider: { userId, provider: 'templates' } } }).catch(() => null),
      prisma.integration.findUnique({ where: { userId_provider: { userId, provider: 'ganchos' } } }).catch(() => null),
    ]);
    const scfg = storeInteg?.config as { affiliateId?: string } | null;
    if (scfg?.affiliateId) affId = scfg.affiliateId;
    const ccfg = cupons?.config as Record<string, string> | null;
    if (ccfg?.[store]) finalCoupon = ccfg[store];
    const tcfg = templates?.config as Record<string, string> | null;
    if (tcfg?.[store]) template = tcfg[store];
    const hcfg = ganchos?.config as { items?: string[] } | null;
    if (hcfg?.items?.length) hook = hcfg.items[Math.floor(Math.random() * hcfg.items.length)];
  }
  const affLink = toAffiliateLink(url, affId, store);
  let text: string;
  if (template) {
    text = template
      .replaceAll('{titulo}', title)
      .replaceAll('{preco}', priceTo)
      .replaceAll('{precoDe}', priceFrom || '')
      .replaceAll('{link}', affLink)
      .replaceAll('{cupom}', finalCoupon || '');
  } else {
    text = buildPost(store, { title, priceFrom, priceTo, link: affLink, coupon: finalCoupon });
  }
  if (hook) text = `${hook}\n\n${text}`;
  return NextResponse.json({ store, affiliateLink: affLink, text });
}
