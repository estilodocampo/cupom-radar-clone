import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { detectStore, expandUrl, toAffiliateLink, toMlAffiliateLink, buildPost, resolveMlShowcase, resolveMlDdg } from '../../../lib/shopee-parser';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { checkPostLimit, incrementPostUsage } from '../../../lib/subscription';

export async function POST(req: NextRequest) {
  const body = await req.json();
  let { url, title, priceFrom, priceTo, coupon, affiliateId = 'SEU_ID', slot, extraUrl } = body;
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
  let shopeeCreds: { appId: string; secret: string } | null = null;
  if (store === 'shopee' && userId) {
    // Credenciais da API oficial (gera shope.ee comissionável)
    const api = await prisma.integration.findUnique({ where: { userId_provider: { userId, provider: 'shopee_api' } } }).catch(() => null);
    const acfg = api?.config as { appId?: string; secret?: string } | null;
    if (acfg?.appId && acfg?.secret) shopeeCreds = { appId: acfg.appId, secret: acfg.secret };
  }

  // Converte qualquer URL com o afiliado do usuário (loja detectada + encurtador próprio)
  async function convertLink(rawUrl: string, titleHint: string): Promise<{ link: string; via: 'api' | 'tag' }> {
    const expanded = await expandUrl(rawUrl);
    const st = detectStore(expanded);
    if (st === 'shopee' && shopeeCreds && userId) {
      try {
        const { shopeeShortLink } = await import('../../../lib/shopee');
        const out = await shopeeShortLink(expanded.split('?')[0], ['cupomradar'], shopeeCreds);
        return { link: out, via: 'api' as const };
      } catch {
        // cai para o modo tag
      }
    }
    // Se colaram vitrine (/social/), tenta resolver para a página do anúncio:
    // 1) produtos na própria vitrine  2) busca externa gratuita  3) mantém vitrine com rastreio.
    let base = expanded;
    if (st === 'mercadolivre' && /\/social\//.test(expanded)) {
      base = (await resolveMlShowcase(expanded, [titleHint]).catch(() => null))
        || (await resolveMlDdg([titleHint]).catch(() => null))
        || expanded;
    }
    const aff0 = (st === 'mercadolivre' && affId !== 'SEU_ID')
      ? toMlAffiliateLink(base, affId, mlMattTool)
      : toAffiliateLink(expanded, affId, st);
    const { shortenUrl } = await import('../../../lib/shorten');
    return { link: await shortenUrl(aff0, userId, slot), via: 'tag' as const };
  }

  const main = await convertLink(url, title);
  const affLink = main.link;
  convertedVia = main.via;
  let extraLink: string | null = null;
  if (extraUrl && String(extraUrl).trim()) {
    extraLink = (await convertLink(String(extraUrl).trim(), title)).link;
  }
  let text: string;
  if (template) {
    text = template
      .replaceAll('{titulo}', title)
      .replaceAll('{preco}', priceTo)
      .replaceAll('{precoDe}', priceFrom || '')
      .replaceAll('{link}', affLink)
      .replaceAll('{link2}', extraLink || '')
      .replaceAll('{cupom}', finalCoupon || '');
  } else {
    text = buildPost(store, { title, priceFrom, priceTo, link: affLink, coupon: finalCoupon, link2: extraLink || undefined });
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
  return NextResponse.json({ store, affiliateLink: affLink, extraLink, text, autoSent, convertedVia, warning: affId === 'SEU_ID' ? 'Você não está logado ou não salvou seu ID desta loja — link sem rastreio.' : null });
}
