export type Store = 'shopee' | 'amazon' | 'mercadolivre' | 'magalu' | 'shein' | 'unknown';

export function detectStore(url: string): Store {
  const u = url.toLowerCase();
  if (u.includes('shopee') || u.includes('shope.ee')) return 'shopee';
  if (u.includes('amazon') || u.includes('amzn.to') || u.includes('/a.co')) return 'amazon';
  if (u.includes('mercadolivre') || u.includes('mercadolibre') || u.includes('meli.la')) return 'mercadolivre';
  if (u.includes('magalu') || u.includes('magazineluiza')) return 'magalu';
  if (u.includes('shein')) return 'shein';
  return 'unknown';
}

const SHORT_HOSTS = ['meli.la', 'shope.ee', 'amzn.to', 'a.co', 'bit.ly', 'tinyurl.com', 'is.gd'];

// Expande links curtos (meli.la, shope.ee...) para a URL final antes de converter
export async function expandUrl(url: string, timeoutMs = 8000): Promise<string> {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (!SHORT_HOSTS.includes(host)) return url;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    clearTimeout(t);
    if (res.url && res.url !== url) return res.url;
    const loc = res.headers.get('location');
    if (loc) return new URL(loc, url).toString();
    return url;
  } catch {
    return url;
  }
}

export function extractShortId(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    return parts.slice(-1)[0]?.slice(0, 32) || 'oferta';
  } catch {
    return 'oferta';
  }
}

// Converte link original para link de afiliado (placeholder - ligar API real depois)
export function toAffiliateLink(originalUrl: string, affiliateId: string, store: Store): string {
  const base = originalUrl.split('?')[0];
  if (store === 'shopee') return `${base}?af_id=${affiliateId}&sub_id=cupomradar`;
  if (store === 'amazon') return `${base}?tag=${affiliateId}`;
  return `${base}?af=${affiliateId}`;
}

// Mercado Livre: rastreio via matt_tool + matt_word (mesmo do Gerador de links).
// Remove parâmetros inúteis (ref, forceInApp...) para o link ficar curto.
export function toMlAffiliateLink(originalUrl: string, tag: string, mattTool?: string): string {
  const base = originalUrl.split('?')[0].split('#')[0];
  const tool = mattTool || 'afiliados';
  return `${base}?matt_tool=${encodeURIComponent(tool)}&matt_word=${encodeURIComponent(tag)}`;
}

const TEMPLATES: Record<string, (p: { title: string; priceFrom?: string; priceTo: string; link: string; coupon?: string }) => string> = {
  shopee: ({ title, priceFrom, priceTo, link, coupon }) =>
    `🔥 OFERTA SHOPEE 🔥\n\n📌 ${title}\n${priceFrom ? `❌ De: ${priceFrom}\n` : ''}✅ Por: ${priceTo}\n${coupon ? `🎟️ Cupom: ${coupon}\n` : ''}\n👉 ${link}\n\n⚠️ Estoque limitado!`,
  default: ({ title, priceTo, link, coupon }) =>
    `🛒 OFERTA IMPERDÍVEL\n\n📌 ${title}\n✅ Por: ${priceTo}\n${coupon ? `🎟️ Cupom: ${coupon}\n` : ''}\n👉 ${link}`,
};

export function buildPost(store: Store, data: { title: string; priceFrom?: string; priceTo: string; link: string; coupon?: string }) {
  const fn = TEMPLATES[store] || TEMPLATES.default;
  return fn(data);
}
