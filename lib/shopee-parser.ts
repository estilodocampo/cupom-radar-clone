export type Store = 'shopee' | 'amazon' | 'mercadolivre' | 'magalu' | 'shein' | 'unknown';

export function detectStore(url: string): Store {
  const u = url.toLowerCase();
  if (u.includes('shopee')) return 'shopee';
  if (u.includes('amazon')) return 'amazon';
  if (u.includes('mercadolivre') || u.includes('mercadolibre')) return 'mercadolivre';
  if (u.includes('magalu') || u.includes('magazineluiza')) return 'magalu';
  if (u.includes('shein')) return 'shein';
  return 'unknown';
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
