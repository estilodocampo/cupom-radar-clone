import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { detectStore, expandUrl, toAffiliateLink, toMlAffiliateLink, buildPost } from '../../../lib/shopee-parser';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { checkPostLimit, incrementPostUsage } from '../../../lib/subscription';

export async function POST(req: NextRequest) {
  const body = await req.json();
  let { url, title, priceFrom, priceTo, coupon, affiliateId = 'SEU_ID' } = body;
  if (!url || !title || !priceTo) {
    return NextResponse.json({ error: 'url, title, priceTo obrigatórios' }, { status: 400 });
  }
  url = await expandUrl(url);
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
  let mlMattTool: string | undefined;
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
    const scfg = storeInteg?.config as { affiliateId?: string; mattTool?: string } | null;
    if (scfg?.affiliateId) affId = scfg.affiliateId;
    if (scfg?.mattTool) mlMattTool = scfg.mattTool;
    const ccfg = cupons?.config as Record<string, string> | null;
    if (ccfg?.[store]) finalCoupon = ccfg[store];
    const tcfg = templates?.config as Record<string, string> | null;
    if (tcfg?.[store]) template = tcfg[store];
    const hcfg = ganchos?.config as { items?: string[] } | null;
    if (hcfg?.items?.length) hook = hcfg.items[Math.floor(Math.random() * hcfg.items.length)];
  }
  let convertedVia: 'api' | 'tag' = 'tag';
  let short: string | null = null;
  if (store === 'shopee' && userId) {
    // Conversão oficial via API (gera shope.ee comissionável)
    const api = await prisma.integration.findUnique({ where: { userId_provider: { userId, provider: 'shopee_api' } } }).catch(() => null);
    const acfg = api?.config as { appId?: string; secret?: string } | null;
    if (acfg?.appId && acfg?.secret) {
      try {
        const { shopeeShortLink } = await import('../../../lib/shopee');
        short = await shopeeShortLink(url.split('?')[0], ['cupomradar'], { appId: acfg.appId, secret: acfg.secret });
        convertedVia = 'api';
      } catch {
        // cai para o modo tag
      }
    }
  }
  const affLink =
    short ||
    (store === 'mercadolivre' && affId !== 'SEU_ID'
      ? toMlAffiliateLink(url, affId, mlMattTool)
      : toAffiliateLink(url, affId, store));
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
  let autoSent = false;
  if (userId) {
    const envio = await prisma.integration.findUnique({ where: { userId_provider: { userId, provider: 'envio_auto' } } }).catch(() => null);
    const ecfg = envio?.config as { groupJid?: string; autoNovo?: boolean } | null;
    if (ecfg?.autoNovo && ecfg.groupJid) {
      try {
        const { worker } = await import('../../../lib/worker');
        await worker.send(ecfg.groupJid, text);
        await prisma.dispatchLog.create({ data: { userId, groupJid: ecfg.groupJid, message: text, status: 'sent' } }).catch(() => null);
        autoSent = true;
      } catch {
        // sem conexão: mantém só o texto gerado
      }
    }
  }
  return NextResponse.json({ store, affiliateLink: affLink, text, autoSent, convertedVia, warning: affId === 'SEU_ID' ? 'Você não está logado ou não salvou seu ID desta loja — link sem rastreio.' : null });
}
