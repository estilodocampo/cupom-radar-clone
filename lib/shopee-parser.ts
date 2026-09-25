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

// Converte link original para link de afiliado preservando os parâmetros
// originais e trocando SÓ o rastreio (remove o da origem).
function mergeTracking(originalUrl: string, params: Record<string, string>): string {
  try {
    const u = new URL(originalUrl);
    for (const k of Object.keys(params)) u.searchParams.delete(k);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return u.toString();
  } catch {
    const base = originalUrl.split('?')[0].split('#')[0];
    const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    return `${base}?${qs}`;
  }
}

export function toAffiliateLink(originalUrl: string, affiliateId: string, store: Store): string {
  if (store === 'shopee') return mergeTracking(originalUrl, { af_id: affiliateId, sub_id: 'cupomradar' });
  if (store === 'amazon') return mergeTracking(originalUrl, { tag: affiliateId });
  return mergeTracking(originalUrl, { af: affiliateId });
}

// Mercado Livre: rastreio via matt_tool + matt_word (mesmo do Gerador de links).
export function toMlAffiliateLink(originalUrl: string, tag: string, mattTool?: string): string {
  return mergeTracking(originalUrl, { matt_tool: mattTool || 'afiliados', matt_word: tag });
}

const TITLE_STOP = new Set(['com', 'para', 'por', 'uma', 'dos', 'das', 'que', 'nos', 'nas', 'sem', 'the', 'and', 'for', 'link', 'cupom', 'oferta', 'estoque', 'limitado', 'frete', 'gratis', 'imperdivel']);

function normWords(s: string): string[] {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !TITLE_STOP.has(w));
}

// Busca externa gratuita (DuckDuckGo, sem chave): encontra a página do anúncio
// pelo título quando a vitrine não lista o produto. Só aceita quase-exato
// (score >= 0.7) para não trocar por produto parecido de outro vendedor.
export async function resolveMlDdg(hints: string[], timeoutMs = 8000): Promise<string | null> {
  try {
    if (!hints.length) return null;
    const q = encodeURIComponent('site:produto.mercadolivre.com.br ' + normWords(hints[0]).join(' '));
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(`https://html.duckduckgo.com/html/?q=${q}`, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const html = await r.text();
    const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null, best: string | null = null, bestScore = 0;
    while ((m = re.exec(html))) {
      let href = m[1];
      const ud = href.match(/[?&]uddg=([^&]+)/);
      if (ud) { try { href = decodeURIComponent(ud[1]); } catch { /* mantém */ } }
      if (!/produto\.mercadolivre\.com\.br\/MLB-[0-9]+/.test(href)) continue;
      const title = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const tw = normWords(title);
      if (!tw.length) continue;
      for (const h of hints) {
        const hw = normWords(h);
        if (!hw.length) continue;
        const score = hw.filter((w) => tw.includes(w)).length / hw.length;
        if (score > bestScore) { bestScore = score; best = href.split('?')[0].split('#')[0]; }
      }
      if (bestScore >= 0.95) break;
    }
    return bestScore >= 0.7 ? best : null;
  } catch {
    return null;
  }
}
export async function resolveMlShowcase(showcaseUrl: string, hints: string[], timeoutMs = 10000): Promise<string | null> {
  try {
    if (!/\/social\//.test(showcaseUrl) || !hints.length) return null;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(showcaseUrl.split('?')[0], {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const html = await r.text();
    if (!html || html.length > 2500000) return null;
    const urls = [...new Set(html.match(/https?:\/\/produto\.mercadolivre\.com\.br\/MLB-[0-9]+[^"'\\\s]*/g) || [])]
      .map((u) => u.split('?')[0].split('#')[0]);
    if (!urls.length) return null;
    let best: string | null = null, bestScore = 0;
    for (const u of urls) {
      const sw = normWords((u.split('/').pop() || '').replace(/-/g, ' '));
      if (!sw.length) continue;
      for (const h of hints) {
        const hw = normWords(h);
        if (!hw.length) continue;
        const score = hw.filter((w) => sw.includes(w)).length / hw.length;
        if (score > bestScore) { bestScore = score; best = u; }
      }
    }
    return bestScore >= 0.4 ? best : null;
  } catch {
    return null;
  }
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
