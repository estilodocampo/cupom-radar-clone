// Worker WhatsApp (Baileys) - Fase 2 MVP
// - Conexão via QR (auth persistida em AUTH_DIR, montar volume em /data)
// - HTTP interno: /health /status /qr /groups /send
// - Scheduler: dispara ScheduledPost pendentes e grava DispatchLog
const http = require('http');
const fs = require('fs');
const { Pool } = require('pg');
const QRCode = require('qrcode');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
} = require('@whiskeysockets/baileys');

const PORT = parseInt(process.env.PORT || '3001', 10);
const TOKEN = process.env.WORKER_TOKEN || '';
const AUTH_DIR = process.env.AUTH_DIR || '/data/auth';
const DATABASE_URL = process.env.DATABASE_URL || '';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });
const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL }) : null;

const AUTH_BASE = (process.env.AUTH_DIR || '/data/auth').replace(/\/$/, '');
function slotDir(slot) { return slot === 'wa2' ? `${AUTH_BASE}_2` : AUTH_BASE; }
function newConn(slot) {
  return { slot, sock: null, connected: false, phone: null, qrDataUrl: null, qrUpdatedAt: null, lastError: null };
}
const conns = { wa1: newConn('wa1'), wa2: newConn('wa2') };
function normSlot(s) { return s === 'wa2' ? 'wa2' : 'wa1'; }
const bootTime = Date.now();
const seenIds = new Set();
let copiadores = []; // [{userId, source, targets, affIds, minInterval, maxPerDay}]
let distribuidores = []; // [{userId, hub, targets, ...}] — relé do seu grupo para outros
let boasvindasCfgs = []; // [{userId, targets, text}]
const sentAtByUser = new Map(); // userId -> timestamp do último envio (limite de frequência)
const sentDays = new Map(); // userId -> { day, count } (limite diário)

// ---- Conversão de links (espelho de lib/shopee-parser) ----
function detectStore(url) {
  const u = url.toLowerCase();
  if (u.includes('shopee') || u.includes('shope.ee')) return 'shopee';
  if (u.includes('amazon') || u.includes('amzn.to') || u.includes('/a.co')) return 'amazon';
  if (u.includes('mercadolivre') || u.includes('mercadolibre') || u.includes('meli.la')) return 'mercadolivre';
  if (u.includes('magalu') || u.includes('magazineluiza')) return 'magalu';
  if (u.includes('shein')) return 'shein';
  return 'unknown';
}

const SHORT_HOSTS = ['meli.la', 'shope.ee', 's.shopee.com.br', 'amzn.to', 'a.co', 'bit.ly', 'tinyurl.com', 'is.gd'];

async function expandUrl(url, timeoutMs = 8000) {
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
    return url;
  } catch {
    return url;
  }
}

function toAffiliateLink(originalUrl, affiliateId, store) {
  if (store === 'shopee') return mergeTracking(originalUrl, { af_id: affiliateId, sub_id: 'cupomradar' });
  if (store === 'amazon') return mergeTracking(originalUrl, { tag: affiliateId });
  return mergeTracking(originalUrl, { af: affiliateId });
}

function toMlAffiliateLink(originalUrl, tag, mattTool) {
  // Forma canônica curta: o ML resolve só pelo ID (slug do título é decorativo).
  // Ex.: .../MLB-5117843076-fritadeira...-_JM -> .../MLB-5117843076-_JM (~-35% menor).
  const m = String(originalUrl).match(/\/MLB-?(\d+)/i);
  const base = m ? `https://produto.mercadolivre.com.br/MLB-${m[1]}-_JM` : originalUrl;
  return mergeTracking(base, { matt_tool: mattTool || 'afiliados', matt_word: tag });
}

// Preserva os parâmetros originais e troca SÓ o rastreio (remove o da origem).
// Evita mutilar o destino (ex.: perder contexto da página do anúncio).
function mergeTracking(originalUrl, params) {
  try {
    const u = new URL(originalUrl);
    for (const k of Object.keys(params)) u.searchParams.delete(k);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
    return u.toString();
  } catch {
    const base = originalUrl.split('?')[0].split('#')[0];
    const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
    return `${base}?${qs}`;
  }
}

const BROWSER_UA2 = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const TITLE_STOP = new Set(['com', 'para', 'por', 'uma', 'dos', 'das', 'que', 'nos', 'nas', 'sem', 'the', 'and', 'for', 'link', 'cupom', 'oferta', 'estoque', 'limitado', 'frete', 'gratis', 'imperdivel']);

function normWords(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !TITLE_STOP.has(w));
}

// Linhas candidatas a título do produto dentro do texto da oferta
function titleHints(text) {
  return (text || '').split('\n')
    .map((l) => l.replace(/^[^a-zA-Z0-9\u00C0-\u024F]+/, '').trim())
    .filter((l) => l.length >= 12 && !/https?:\/\//.test(l) && !/^(por|cupom|link|de:|r\$|preço|preco|estoque)/i.test(l))
    .sort((a, b) => b.length - a.length)
    .slice(0, 3);
}

// Busca externa gratuita (DuckDuckGo, sem chave): encontra a página do anúncio
// pelo título quando a vitrine não lista o produto. Só aceita quase-exato
// (score >= 0.7) para não trocar por produto parecido de outro vendedor.
async function resolveMlDdg(hints, timeoutMs = 8000) {
  try {
    if (!hints.length) return null;
    const q = encodeURIComponent('site:produto.mercadolivre.com.br ' + normWords(hints[0]).join(' '));
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(`https://html.duckduckgo.com/html/?q=${q}`, {
      signal: ctrl.signal,
      headers: { 'User-Agent': BROWSER_UA2, 'Accept-Language': 'pt-BR,pt;q=0.9' },
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const html = await r.text();
    const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m, best = null, bestScore = 0;
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
        const score = scoreTitulo(hw, tw);
        if (score > bestScore) { bestScore = score; best = href.split('?')[0].split('#')[0]; }
      }
      if (bestScore >= 0.95) break;
    }
    return bestScore >= 0.7 ? best : null;
  } catch {
    return null;
  }
}
async function resolveMlShowcase(showcaseUrl, hints, timeoutMs = 10000) {
  try {
    if (!/\/social\//.test(showcaseUrl) || !hints.length) return null;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(showcaseUrl.split('?')[0], {
      signal: ctrl.signal,
      headers: { 'User-Agent': BROWSER_UA2, 'Accept-Language': 'pt-BR,pt;q=0.9' },
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const html = await r.text();
    if (!html || html.length > 2500000) return null;
    const urls = [...new Set(html.match(/https?:\/\/produto\.mercadolivre\.com\.br\/MLB-[0-9]+[^"'\\\s]*/g) || [])]
      .map((u) => u.split('?')[0].split('#')[0]);
    if (!urls.length) return null;
    let best = null, bestScore = 0;
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

const crypto = require('crypto');
const WEB_URL = (process.env.WEB_URL || 'https://app.estilodocampo.com.br').replace(/\/$/, '');

async function shopeeShortLink(originUrl, subIds, creds) {
  const query = `mutation { generateShortLink(input: { originUrl: ${JSON.stringify(originUrl)}, subIds: ${JSON.stringify(subIds.slice(0, 5))} }) { shortLink } }`;
  const payload = JSON.stringify({ query });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto.createHash('sha256').update(creds.appId + timestamp + payload + creds.secret).digest('hex');
  const res = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `SHA256 Credential=${creds.appId}, Timestamp=${timestamp}, Signature=${signature}` },
    body: payload,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.errors?.length) throw new Error(data.errors?.[0]?.message || `Shopee API ${res.status}`);
  if (!data.data?.generateShortLink?.shortLink) throw new Error('Shopee: sem shortLink');
  return data.data.generateShortLink.shortLink;
}

// Encurtador próprio: grava no banco e devolve /r/xxxx (redirect direto, sem interstitial)
async function shortenUrl(longUrl, userId, slot, timeoutMs = 8000) {
  if (longUrl.length <= 60) return longUrl;
  const sl = slot === 'wa2' ? 'wa2' : 'wa1';
  if (pool) {
    try {
      const ex = await pool.query('SELECT code FROM "ShortLink" WHERE url = $1 AND slot = $2 LIMIT 1', [longUrl, sl]);
      if (ex.rows[0]) return `${WEB_URL}/r/${ex.rows[0].code}`;
    } catch { /* segue */ }
    for (let i = 0; i < 3; i++) {
      const code = crypto.randomBytes(3).toString('base64url');
      try {
        await pool.query('INSERT INTO "ShortLink" (id, code, url, "userId", slot) VALUES (gen_random_uuid(), $1, $2, $3, $4)', [code, longUrl, userId || null, sl]);
        return `${WEB_URL}/r/${code}`;
      } catch { /* colisão */ }
    }
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r2 = await fetch('https://cleanuri.com/api/v1/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: longUrl }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const b2 = await r2.json().catch(() => ({}));
    if (r2.ok && b2.result_url && /^https?:\/\//.test(b2.result_url)) return b2.result_url;
  } catch { /* mantém original */ }
  return longUrl;
}

const UA_NAV = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const IMG_MAX = 6 * 1024 * 1024; // ignora foto maior que 6MB

// Só busca foto em PÁGINA DE PRODUTO (nunca em vitrine/perfil/loja)
function isProductPage(u) {
  try {
    const s = String(u).toLowerCase();
    if (/\/social\//.test(s)) return false;
    return /\/mlb-[0-9]+/.test(s)
      || /produto\.mercadolivre\.com\.br\//.test(s)
      || /shopee\.[^/]+\/(.*product|.*-i\.\d+\.\d+)/i.test(s)
      // Link de afiliado Shopee expandido: shopee.com.br/opaanlp/{shopid}/{itemid}
      || /shopee\.[^/]+\/[^/?#]+\/\d+\/\d+/.test(s)
      || /\/(dp|gp\/product)\/[a-z0-9]+/i.test(s)
      || /shein\.[^/]+\/.*-p-[0-9]+\.html/i.test(s)
      || /magazineluiza\.com\.br\/.*\/p\//i.test(s);
  } catch { return false; }
}

// Baixa e valida bytes de imagem (limite de tamanho + content-type)
async function baixarImagemUrl(src, pageUrl, timeoutMs = 10000) {
  try {
    if (!src || /^data:/i.test(src)) return null;
    src = new URL(src, pageUrl).toString();
    if (!/^https?:\/\//i.test(src)) return null;
    const c2 = new AbortController();
    const t2 = setTimeout(() => c2.abort(), timeoutMs);
    const r2 = await fetch(src, {
      redirect: 'follow', signal: c2.signal,
      headers: { 'User-Agent': UA_NAV },
    });
    clearTimeout(t2);
    if (!r2.ok) return null;
    const ct2 = String(r2.headers.get('content-type') || '').toLowerCase();
    if (!ct2.includes('image/') && !ct2.includes('webp')) return null;
    if (Number(r2.headers.get('content-length') || 0) > IMG_MAX) return null;
    const buf = Buffer.from(await r2.arrayBuffer());
    if (!buf.length || buf.length > IMG_MAX) return null;
    return buf;
  } catch { return null; }
}

// Fallback: foto via busca de imagens do DuckDuckGo (sem chave), casando o título.
// Só aceita parecido (>= 0.5) para não anexar foto de outro produto.
// Score bidirecional: títulos truncados (Bing/DDG) ainda casam com a dica.
function scoreTitulo(hw, tw) {
  if (!tw.length) return 0;
  const a = hw.filter((w) => tw.includes(w)).length / hw.length;
  const b = tw.filter((w) => hw.includes(w)).length / tw.length;
  return Math.max(a, b);
}

async function buscarImagemDdg(hints, timeoutMs = 8000) {
  try {
    const hint = (hints || []).find((h) => normWords(h).length >= 3);
    if (!hint) return null;
    const query = normWords(hint).join(' ');
    const p = await fetch('https://duckduckgo.com/?q=' + encodeURIComponent(query) + '&iar=images', {
      headers: { 'User-Agent': UA_NAV, 'Accept-Language': 'pt-BR,pt;q=0.9' },
    });
    const phtml = await p.text();
    const vqd = (phtml.match(/vqd="([^"]+)"/) || phtml.match(/vqd=([\d-]+)/) || [])[1];
    if (!vqd) { log.info('foto DDG: sem vqd (bloqueio?)'); return null; }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(`https://duckduckgo.com/i.js?o=json&q=${encodeURIComponent(query)}&vqd=${vqd}`, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA_NAV, Referer: 'https://duckduckgo.com/', 'Accept-Language': 'pt-BR,pt;q=0.9' },
    });
    clearTimeout(t);
    if (!r.ok) { log.info({ status: r.status }, 'foto DDG: i.js recusado'); return null; }
    const j = await r.json().catch(() => null);
    const results = (j && j.results) || [];
    log.info({ q: query.slice(0, 60), n: results.length }, 'foto DDG: resultados');
    if (!results.length) return null;
    const hw = normWords(hint);
    // Candidatos com score; thumbnail do Bing entra como reserva (-0.05)
    const cands = [];
    for (const it of results.slice(0, 12)) {
      const tw = normWords(it.title || '');
      if (!tw.length) continue;
      const score = scoreTitulo(hw, tw);
      if (score < 0.5) continue;
      if (it.image) cands.push({ score, url: it.image });
      if (it.thumbnail) cands.push({ score: score - 0.05, url: it.thumbnail });
      if (score >= 0.95) break;
    }
    // Prefere jpg/png (WhatsApp exibe com certeza); webp entra se for o que há
    const bonus = (u) => (/\.(jpe?g|png)(\?|#|$)/i.test(u) ? 0.1 : 0);
    cands.sort((a, b) => (b.score + bonus(b.url)) - (a.score + bonus(a.url)));
    const bestScore = cands.length ? (cands[0].score + bonus(cands[0].url)) : 0;
    log.info({ n: cands.length, score: Number(bestScore.toFixed(2)) }, 'foto DDG: candidatos');
    for (const c of cands.slice(0, 3)) {
      const buf = await baixarImagemUrl(c.url, 'https://duckduckgo.com/', timeoutMs);
      if (buf) return buf;
    }
    log.info('foto DDG: nenhum download válido');
    return null;
  } catch { return null; }
}

// Fallback 2: busca de imagens do Bing (sem chave). Entra quando o DDG
// está em rate-limit (HTTP 202) ou sem resultados.
async function buscarImagemBing(hints, timeoutMs = 8000) {
  try {
    const hint = (hints || []).find((h) => normWords(h).length >= 3);
    if (!hint) return null;
    const query = normWords(hint).join(' ');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch('https://www.bing.com/images/search?q=' + encodeURIComponent(query) + '&form=HDRSC2&first=1', {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA_NAV, 'Accept-Language': 'pt-BR,pt;q=0.9' },
    });
    clearTimeout(t);
    if (!r.ok) { log.info({ status: r.status }, 'foto Bing: recusado'); return null; }
    const html = await r.text();
    const hw = normWords(hint);
    // Bing embute cada resultado em murl&quot;:&quot;URL&quot;...&quot;t&quot;:&quot;Título&quot;
    const parts = html.split('murl&quot;:&quot;');
    const cands = [];
    for (const p of parts.slice(1, 13)) {
      const url = p.split('&quot;')[0].replace(/&amp;/g, '&');
      if (!/^https?:\/\//i.test(url)) continue;
      const tm = p.slice(0, 4000).match(/&quot;t&quot;:&quot;([\s\S]*?)&quot;/);
      const tw = normWords(tm ? tm[1] : '');
      const score = scoreTitulo(hw, tw);
      if (score < 0.5) continue;
      cands.push({ score, url });
    }
    const bonus = (u) => (/\.(jpe?g|png)(\?|#|$)/i.test(u) ? 0.1 : 0);
    cands.sort((a, b) => (b.score + bonus(b.url)) - (a.score + bonus(a.url)));
    const bestScore = cands.length ? (cands[0].score + bonus(cands[0].url)) : 0;
    log.info({ n: cands.length, score: Number(bestScore.toFixed(2)) }, 'foto Bing: candidatos');
    for (const c of cands.slice(0, 3)) {
      const buf = await baixarImagemUrl(c.url, 'https://www.bing.com/', timeoutMs);
      if (buf) return buf;
    }
    log.info('foto Bing: nenhum download válido');
    return null;
  } catch { return null; }
}

// Baixa a foto do anúncio quando a oferta veio só texto:
// 1) og:image da página do produto  2) busca de imagens pelo título (DDG, depois Bing)
async function buscarImagemProduto(pageUrl, hints, timeoutMs = 10000) {
  try {
    log.info({ url: String(pageUrl).slice(0, 100) }, 'foto: tentando enriquecer oferta sem imagem');
    let src = null;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const r = await fetch(pageUrl, {
        redirect: 'follow', signal: ctrl.signal,
        headers: { 'User-Agent': UA_NAV, 'Accept-Language': 'pt-BR,pt;q=0.9' },
      });
      clearTimeout(t);
      if (!r.ok) {
        log.info({ status: r.status, url: pageUrl.slice(0, 80) }, 'foto og:image: página recusada, indo por título');
      } else if (String(r.headers.get('content-type') || '').toLowerCase().includes('html')) {
        const html = await r.text();
        if (html && html.length <= 3000000) {
          const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
            || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
          src = m && m[1] ? m[1].trim().replace(/&amp;/g, '&') : null;
        }
      }
    } catch (e) {
      log.info({ e: String(e).slice(0, 80) }, 'foto og:image: fetch falhou, indo por título');
    }
    if (src) {
      const img = await baixarImagemUrl(src, pageUrl, timeoutMs);
      if (img) return img;
      log.info('foto og:image: download falhou, indo por título');
    } else {
      log.info('foto og:image: ausente (SPA), indo por título');
    }
    // Página sem og:image (ex.: Shopee/ML renderizam via JS) -> busca pelo título:
    // DDG primeiro; se bloqueado (202/rate-limit), Bing.
    return await buscarImagemPorTitulo(hints, timeoutMs);
  } catch { return null; }
}

// Busca a foto do produto só pelo título da oferta (DDG, depois Bing).
// Usada quando não há página de produto (ex.: vitrine ML não resolvida).
async function buscarImagemPorTitulo(hints, timeoutMs = 10000) {
  log.info('foto: sem página de produto, buscando por título');
  const viaDdg = await buscarImagemDdg(hints, timeoutMs).catch(() => null);
  if (viaDdg) return viaDdg;
  return await buscarImagemBing(hints, timeoutMs).catch(() => null);
}

async function convertTextLinks(text, affIds, shopeeCreds, mlMattTool, userId, stripCoupons = true, slot = 'wa1') {
  let converted = 0;
  let destino = null; // página do produto (para buscar a foto quando vier só texto)
  const urls = [...new Set(text.match(/https?:\/\/[^\s)]+/g) || [])];
  let out = text;
  // Expande links curtos em paralelo (1 oferta com 3 links: ~1.5s em vez de ~4.5s)
  const expanded = new Map();
  await Promise.all(urls.map(async (raw) => {
    const clean = raw.replace(/[.,!?]+$/, '');
    try {
      expanded.set(raw, await expandUrl(clean));
    } catch {
      expanded.set(raw, clean);
    }
  }));
  for (let raw of urls) {
    let url = expanded.get(raw) || raw.replace(/[.,!?]+$/, '');
    const store = detectStore(url);
    // Guarda a página do produto para buscar a foto (independe de ter afiliado p/ converter)
    if (!destino && store !== 'unknown') {
      const cand = url.split('?')[0].split('#')[0];
      if (isProductPage(cand)) destino = cand;
    }
    let final = null;
    try {
      if (store === 'shopee' && shopeeCreds) {
        // subId por número: mantém atribuição wa1/wa2 dentro do painel Shopee
        final = await shopeeShortLink(url.split('?')[0], ['cupomradar', normSlot(slot)], shopeeCreds);
        converted++;
        if (!destino) { const c0 = url.split('?')[0]; if (isProductPage(c0)) destino = c0; }
      } else if (store === 'mercadolivre' && affIds[store]) {
        // Origem postou vitrine (/social/): tenta resolver para a página do anúncio.
        // 1) produtos listados na própria vitrine  2) busca externa gratuita  3) mantém vitrine com rastreio.
        const hints = titleHints(text);
        let base = url;
        const viaHtml = await resolveMlShowcase(url, hints).catch(() => null);
        if (viaHtml) {
          base = viaHtml;
          log.info('vitrine ML resolvida via HTML da vitrine');
        } else if (/\/social\//.test(url)) {
          const viaDdg = await resolveMlDdg(hints).catch(() => null);
          if (viaDdg) {
            base = viaDdg;
            log.info('vitrine ML resolvida via busca');
          } else log.warn({ url: url.slice(0, 120) }, 'vitrine ML sem produto correspondente; mantendo vitrine com rastreio');
        }
        final = toMlAffiliateLink(base, affIds[store], mlMattTool);
        converted++;
        if (!destino && isProductPage(base)) destino = base;
      } else if (store !== 'unknown' && store !== 'mercadolivre' && affIds[store]) {
        final = toAffiliateLink(url, affIds[store], store);
        converted++;
        if (!destino && isProductPage(url)) destino = url;
      }
      if (final) {
        // Link direto (opção do painel): publica o afiliado puro, sem /r/ e sem contagem de cliques
        if (!linkPrefs[userId]) final = await shortenUrl(final, userId, slot);
        out = out.split(raw).join(final);
      }
    } catch (e) {
      log.warn({ e: String(e).slice(0, 150) }, 'conversao falhou, mantendo original');
    }
  }
  // Remove linhas de cupom da origem (ex.: "Cupom: MELHORCUPOM") — não valem no seu grupo
  if (stripCoupons) out = out.split('\n').filter((l) => !/cupom/i.test(l)).join('\n').replace(/\n{3,}/g, '\n\n');
  return { out, converted, destino };
}

const linkPrefs = {}; // userId -> true = link direto do afiliado (sem /r/)

async function loadCopiadores() {
  if (!pool) return;
  try {
    const { rows } = await pool.query('SELECT "userId", provider, config FROM "Integration" WHERE provider IN ($1,$2,$3,$4,$5,$6,$7,$8,$9)', ['shopee', 'amazon', 'magalu', 'mercadolivre', 'shein', 'cupons', 'shopee_api', 'boasvindas', 'link_prefs']);
    const byUser = {};
    for (const r of rows) {
      byUser[r.userId] = byUser[r.userId] || { affIds: {} };
      if (r.provider === 'boasvindas') byUser[r.userId].boasvindas = r.config || {};
      else if (r.provider === 'link_prefs') linkPrefs[r.userId] = !!(r.config || {}).rawLink;
      else if (r.provider === 'shopee_api' && r.config && r.config.appId && r.config.secret) byUser[r.userId].shopeeCreds = { appId: r.config.appId, secret: r.config.secret };
      else if (r.provider === 'mercadolivre' && r.config) {
        if (r.config.mattTool) byUser[r.userId].mlMattTool = r.config.mattTool;
        if (r.config.affiliateId) byUser[r.userId].affIds[r.provider] = r.config.affiliateId;
      }
      else if (r.provider && r.config && r.config.affiliateId) byUser[r.userId].affIds[r.provider] = r.config.affiliateId;
    }
    // Regras de distribuição (várias por número)
    const dist = await pool.query('SELECT id,"userId",name,slot,hub,targets,"onlyMine","requireLink",convert,"stripCoupons",prefix,suffix,"minInterval","maxPerDay","dedupHoras",pausado FROM "DistribuidorRule"').catch(() => ({ rows: [] }));
    distribuidores = dist.rows
      .filter((r) => r.hub && (r.targets || []).length)
      .map((r) => {
        const v = byUser[r.userId] || { affIds: {} };
        return {
          userId: r.userId, kind: 'distribuidor', ruleId: r.id, name: r.name || '', slot: r.slot || 'wa1',
          hub: r.hub, targets: r.targets || [],
          onlyMine: !!r.onlyMine, requireLink: !!r.requireLink, convert: r.convert !== false,
          pausado: !!r.pausado,
          stripCoupons: r.stripCoupons !== false,
          dedupHoras: Number.isFinite(Number(r.dedupHoras)) ? Number(r.dedupHoras) : 24,
          prefix: String(r.prefix || '').slice(0, 300), suffix: String(r.suffix || '').slice(0, 300),
          minInterval: Number(r.minInterval) || 0, maxPerDay: Number(r.maxPerDay) || 0,
          affIds: v.affIds, shopeeCreds: v.shopeeCreds || null, mlMattTool: v.mlMattTool || null,
        };
      });
    if (distribuidores.length) log.info({ n: distribuidores.length }, 'distribuidores ativos');
    // Regras de cópia (várias por número): cada uma alimenta o seu hub
    const cop = await pool.query('SELECT id,"userId",name,slot,source,hub,"keepCoupons" FROM "CopiadorRule" WHERE active = true').catch(() => ({ rows: [] }));
    copiadores = cop.rows
      .filter((r) => r.source && r.hub && r.source !== r.hub)
      .map((r) => {
        const v = byUser[r.userId] || { affIds: {} };
        return {
          userId: r.userId, kind: 'copiador', ruleId: r.id, name: r.name || '', slot: r.slot || 'wa1',
          source: r.source, targets: [r.hub],
          keepCoupons: !!r.keepCoupons,
          dedupHoras: 24, minInterval: 0, maxPerDay: 0,
          affIds: v.affIds, shopeeCreds: v.shopeeCreds || null, mlMattTool: v.mlMattTool || null,
        };
      });
    if (copiadores.length) log.info({ n: copiadores.length }, 'copiadores ativos');
    boasvindasCfgs = Object.entries(byUser)
      .filter(([, v]) => v.boasvindas && (v.boasvindas.targets || []).length && v.boasvindas.text)
      .map(([userId, v]) => ({ userId, slot: v.boasvindas.slot || 'wa1', targets: v.boasvindas.targets || [], text: String(v.boasvindas.text).slice(0, 500) }));
  } catch (e) {
    log.warn({ e: String(e) }, 'load copiadores falhou');
  }
}

function extractText(msg) {
  const m = msg.message || {};
  return m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || null;
}

// Baixa mídia com reupload automático pelo número certo.
// Sem ctx, URLs de CDN expiradas (410/404) falham em silêncio e a oferta sai só texto.
async function baixarMidia(msg, slot, onde) {
  const sl = normSlot(slot);
  const sock = conns[sl].sock;
  try {
    return await downloadMediaMessage(msg, 'buffer', {}, {
      logger: log,
      reuploadRequest: (m) => sock.updateMediaMessage(m),
    });
  } catch (e) {
    log.warn({ slot: sl, e: String(e).slice(0, 120) }, `${onde} midia falhou, enviando só texto`);
    return null;
  }
}

// Chave de contagem: separa por usuário, tipo e REGRA (várias regras por número)
function limKey(c) { return `${c.userId}:${c.kind || 'copiador'}:${c.ruleId || ''}`; }

const MEDIA_MAX_B64 = 2 * 1024 * 1024; // ~1,5MB: acima disso envia na hora

// Contagem diária vinda do banco (sobrevive a reinício do worker), por regra
async function enviadosHoje(c) {
  if (!pool) return (sentDays.get(limKey(c)) || { count: 0 }).count;
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM "DispatchLog" WHERE "userId" = $1 AND COALESCE(kind, $3) = $2 AND COALESCE("ruleId", \'\') = $4 AND "sentAt" >= CURRENT_DATE',
      [c.userId, c.kind || 'copiador', 'copiador', c.ruleId || '']
    );
    return rows[0] ? rows[0].n : 0;
  } catch {
    return (sentDays.get(limKey(c)) || { count: 0 }).count;
  }
}

// Aplica os limites de frequência e quantidade diária configurados pelo usuário
async function passaLimites(c, pularIntervalo = false) {
  if (c.maxPerDay > 0) {
    const n = await enviadosHoje(c);
    if (n >= c.maxPerDay) return false;
  }
  // Post manual seu fura a janela de intervalo (mas conta na cota diária)
  if (!pularIntervalo && c.minInterval > 0) {
    const last = sentAtByUser.get(limKey(c)) || 0;
    if (Date.now() - last < c.minInterval * 60000) return false;
  }
  return true;
}

function marcarEnvio(c) {
  sentAtByUser.set(limKey(c), Date.now());
  const today = new Date().toISOString().slice(0, 10);
  const reg = sentDays.get(limKey(c));
  sentDays.set(limKey(c), reg && reg.day === today ? { day: today, count: reg.count + 1 } : { day: today, count: 1 });
}

// Registra a oferta na fila (chave única = usuário+kind+texto+destino).
// É o que trava repetição: o índice único impede o mesmo texto 2x no mesmo grupo.
// NUNCA grava mídia (base64 de ~1MB por envio lotou o disco em 09/2026);
// a anti-duplicata só precisa do hash do texto.
async function registrarOferta(c, targetJid, text, status) {
  if (!pool) return false;
  const fp = ofertaFp(c, text);
  try {
    const res = await pool.query(
      'INSERT INTO "QueuedOffer" (id, "userId", kind, "targetJid", text, "mediaType", media, fp, status) VALUES (gen_random_uuid(), $1, $2, $3, $4, NULL, NULL, $5, $6) ON CONFLICT ("userId", kind, fp, "targetJid") DO NOTHING',
      [c.userId, c.kind || 'copiador', targetJid, text, fp, status]
    );
    return res.rowCount > 0;
  } catch (e) {
    log.warn({ e: String(e).slice(0, 150) }, 'registro de oferta falhou');
    return false;
  }
}

function ofertaFp(c, text) {
  return crypto.createHash('sha1').update(`${c.kind || 'copiador'}|${text}`).digest('hex').slice(0, 16);
}

// Cache em memória: evita ida ao banco e fecha a janela de corrida da duplicata
const dedupCache = new Map(); // key -> timestamp
function dedupKey(c, targetJid, text) {
  return `${c.userId}|${c.kind || 'copiador'}|${ofertaFp(c, text)}|${targetJid}`;
}
function cacheBloqueia(c, targetJid, text) {
  if (!(c.dedupHoras > 0)) return false;
  const k = dedupKey(c, targetJid, text);
  const at = dedupCache.get(k);
  if (at && Date.now() - at < c.dedupHoras * 3600000) return true;
  if (dedupCache.size > 20000) dedupCache.clear();
  return false;
}
function marcarCache(c, targetJid, text) {
  if (!(c.dedupHoras > 0)) return;
  dedupCache.set(dedupKey(c, targetJid, text), Date.now());
}

// Reserva a oferta ANTES de enviar: o índice único garante que uma segunda
// ocorrência da mesma mensagem não seja reservada (e portanto não seja enviada).
// Retorna a lista de destinos realmente reservados.
async function reservarDestinos(c, targets, text, mediaBuf, mediaType) {
  const ok = [];
  for (const t of targets) {
    if (cacheBloqueia(c, t, text)) continue;
    if (await jaProcessou(c, t, text)) { marcarCache(c, t, text); continue; }
    if (await registrarOferta(c, t, text, 'sending')) {
      marcarCache(c, t, text);
      ok.push(t);
    }
    // registrarOferta devolve false = já existia registro = duplicata
  }
  return ok;
}

// O mesmo texto já foi enviado/enfileirado para este destino dentro da janela?
async function jaProcessou(c, targetJid, text) {
  if (!pool || !(c.dedupHoras > 0)) return false;
  const fp = ofertaFp(c, text);
  try {
    const { rows } = await pool.query(
      'SELECT 1 FROM "QueuedOffer" WHERE "userId" = $1 AND kind = $2 AND fp = $3 AND "targetJid" = $4 AND "createdAt" > NOW() - ($5 || \' hours\')::INTERVAL LIMIT 1',
      [c.userId, c.kind || 'copiador', fp, targetJid, String(c.dedupHoras)]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

// Alvos com falha PERMANENTE (ex.: número saiu do grupo): após 3 forbiddens
// seguidos o worker pula o alvo por 24h em vez de tentar a cada oferta.
// key = slot|targetJid -> { fails, lastAt }
const brokenTargets = new Map();
const BROKEN_AFTER = 3;
const BROKEN_SKIP_MS = 24 * 3600 * 1000;
const skipLogAt = new Map(); // kind|slot -> timestamp do último alerta de pulo

// ===== MODO SEGURO: saúde por número (anti-ban) =====
// Sinais: forbiddens/hora, rajadas de falha, quedas de conexão, ritmo de envio.
// Score 0-100 por slot; >= 85 pausa os disparos sozinho até o risco diluir.
const RISCO_PAUSA = 80;
const slotHealth = {
  wa1: { forbids: [], fails: [], disconnects: [], sends: [] },
  wa2: { forbids: [], fails: [], disconnects: [], sends: [] },
};
function regEv(slot, key) {
  const h = slotHealth[normSlot(slot)];
  if (!h) return;
  h[key].push(Date.now());
  // poda: mantém só últimas 24h e no máx. 500 eventos
  const cut = Date.now() - 24 * 3600 * 1000;
  h[key] = h[key].filter((t) => t > cut).slice(-500);
}
function riscoSlot(slot) {
  const h = slotHealth[normSlot(slot)] || { forbids: [], fails: [], disconnects: [], sends: [] };
  const now = Date.now();
  const inLast = (arr, ms) => arr.filter((t) => now - t < ms).length;
  const forb1h = inLast(h.forbids, 3600e3);
  const fails10m = inLast(h.fails, 600e3);
  const disc6h = inLast(h.disconnects, 6 * 3600e3);
  const sends10m = inLast(h.sends, 600e3);
  let score = 0;
  const motivos = [];
  if (forb1h > 0) { score += Math.min(60, forb1h * 10); motivos.push(`${forb1h} forbidden/1h`); }
  if (fails10m >= 5) { score += 15; motivos.push('rajada de falhas'); }
  if (disc6h > 0) { score += Math.min(30, disc6h * 10); motivos.push(`${disc6h} quedas/6h`); }
  if (sends10m > 30) { score += 10; motivos.push('ritmo alto'); }
  score = Math.min(100, Math.round(score));
  return { score, motivos, paused: score >= RISCO_PAUSA };
}
// Intervalo humanizado entre disparos: acelera com risco baixo, freia com risco alto
function atrasoEnvio(slot) {
  const { score } = riscoSlot(slot);
  const [a, b] = score >= 60 ? [12000, 25000] : score >= 30 ? [5000, 12000] : [2000, 5000];
  return Math.floor(a + Math.random() * (b - a));
}

function erroPermanente(e) {
  return /forbidden|not-?authorized|unauthorized|not-?in-?group|not-?participant|[^0-9]403[^0-9]/.test(String(e || '').toLowerCase());
}
function alvoQuebrado(slot, t) {
  const b = brokenTargets.get(`${slot}|${t}`);
  return !!b && b.fails >= BROKEN_AFTER && Date.now() - b.lastAt < BROKEN_SKIP_MS;
}
function marcarFalha(slot, t, permanente) {
  const k = `${slot}|${t}`;
  if (!permanente) { brokenTargets.delete(k); return 0; }
  const b = brokenTargets.get(k) || { fails: 0, lastAt: 0 };
  b.fails += 1;
  b.lastAt = Date.now();
  brokenTargets.set(k, b);
  if (brokenTargets.size > 5000) brokenTargets.clear();
  return b.fails;
}

// Restaura os alvos quebrados a partir das falhas recentes no banco,
// para não tentar de novo após cada restart/deploy.
async function carregarAlvosQuebrados() {
  if (!pool) return;
  try {
    const { rows } = await pool.query(
      `SELECT "groupJid", SUBSTRING(error FROM '^\\[([^\\]]+)\\]') AS slot, COUNT(*) AS n
       FROM "DispatchLog" WHERE status = 'failed' AND "sentAt" > NOW() - INTERVAL '24 hours'
       AND error ILIKE '%forbidden%' GROUP BY 1, 2`
    );
    let marcados = 0;
    for (const r of rows) {
      if (r.slot && r.groupJid && Number(r.n) >= BROKEN_AFTER) {
        brokenTargets.set(`${r.slot}|${r.groupJid}`, { fails: Number(r.n), lastAt: Date.now() });
        marcados++;
      }
    }
    if (marcados) log.info({ marcados }, 'alvos quebrados restaurados do banco');
  } catch (e) {
    log.warn({ e: String(e).slice(0, 120) }, 'restauração de alvos quebrados falhou');
  }
}

// Sem fila: se não couber na janela, perde-se (decisão do usuário).
// A trava anti-duplicata (reserva + marca) continua valendo.
// Retorna { ok, sent: [{jid, id, participant}] } para o mapa de repasses.
async function enviarLote(c, targets, text, mediaBuf, mediaType, slot, pularIntervalo = false) {
  if (!targets.length) return { ok: false, sent: [] };
  const sl0 = normSlot(slot);
  const risco0 = riscoSlot(sl0);
  if (risco0.paused) {
    log.warn({ kind: c.kind, slot: sl0, risco: risco0.score, motivos: risco0.motivos.join(', ') }, 'slot em pausa de segurança (modo seguro)');
    return { ok: false, sent: [] };
  }
  if (!(await passaLimites(c, pularIntervalo))) {
    log.info({ kind: c.kind }, 'fora da janela: oferta descartada (sem fila)');
    return { ok: false, sent: [] };
  }
  const reservados = await reservarDestinos(c, targets, text, mediaBuf, mediaType);
  if (!reservados.length) {
    log.info({ kind: c.kind }, 'nada novo para enviar (anti-duplicata)');
    return { ok: false, sent: [] };
  }
  let ok = 0, permFails = 0, pulados = 0;
  const sent = [];
  const sl = normSlot(slot);
  for (const t of reservados) {
    if (alvoQuebrado(sl, t)) { pulados++; continue; }
    try {
      const key = await sendComMidia(t, text, mediaBuf, mediaType, slot);
      brokenTargets.delete(`${sl}|${t}`);
      regEv(sl, 'sends');
      await pool.query('UPDATE "QueuedOffer" SET status = $1, "sentAt" = NOW() WHERE "userId" = $2 AND kind = $3 AND fp = $4 AND "targetJid" = $5', ['sent', c.userId, c.kind || 'copiador', ofertaFp(c, text), t]).catch(() => {});
      await pool.query('INSERT INTO "DispatchLog" (id, "userId", "groupJid", message, status, kind, "ruleId") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)', [c.userId, t, text, 'sent', c.kind || 'copiador', c.ruleId || null]).catch(() => {});
      if (key && key.id) sent.push({ jid: t, id: key.id, participant: key.participant || null });
      ok++;
    } catch (e) {
      const msg = String(e).slice(0, 200);
      const perm = erroPermanente(e);
      const fails = marcarFalha(sl, t, perm);
      regEv(sl, 'fails');
      if (perm && /forbidden/i.test(msg)) regEv(sl, 'forbids');
      // Prefixo [slot]: permite restaurar os alvos quebrados do banco após restart
      const errDb = `[${sl}] ${msg}`.slice(0, 220);
      await pool.query('INSERT INTO "DispatchLog" (id, "userId", "groupJid", message, status, kind, "ruleId", error) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)', [c.userId, t, text, 'failed', c.kind || 'copiador', c.ruleId || null, errDb]).catch(() => {});
      log.warn({ e: msg, to: t, slot: sl, kind: c.kind || 'copiador', fails }, 'envio falhou');
      if (perm) permFails++;
    }
  }
  if (pulados) {
    // Alerta no máximo 1x a cada 6h por regra: informa sem spammar o log
    const k = `${c.kind || 'copiador'}|${sl}`;
    const last = skipLogAt.get(k) || 0;
    if (Date.now() - last > 6 * 3600 * 1000) {
      skipLogAt.set(k, Date.now());
      log.info({ kind: c.kind, slot: sl, pulados }, 'alvos ignorados (falha permanente): confira se o número está nos grupos');
    }
  }
  if (ok) {
    marcarEnvio(c);
    log.info({ kind: c.kind, slot: sl, ok, total: reservados.length }, 'lote enviado');
  } else if (permFails === reservados.length && reservados.length) {
    log.warn({ kind: c.kind, slot: sl, n: reservados.length }, 'regra 100% bloqueada: número fora dos grupos? confira a regra');
  }
  return { ok: ok > 0, sent };
}

async function sendComMidia(targetJid, text, mediaBuf, mediaType, slot) {
  const sock = conns[normSlot(slot)].sock;
  const caption = text.length > 1000 ? text.slice(0, 1000) : text;
  const rest = text.length > 1000 ? text.slice(1000) : '';
  let key = null;
  if (mediaBuf && mediaType === 'image') key = (await sock.sendMessage(targetJid, { image: mediaBuf, caption })).key;
  else if (mediaBuf && mediaType === 'video') key = (await sock.sendMessage(targetJid, { video: mediaBuf, caption })).key;
  // linkPreview: null = sem card de preview (o card repetia o título do anúncio)
  else key = (await sock.sendMessage(targetJid, { text, linkPreview: null })).key;
  if (rest && mediaBuf) await sock.sendMessage(targetJid, { text: rest, linkPreview: null });
  await new Promise((r) => setTimeout(r, atrasoEnvio(slot)));
  return key || null;
}

async function handleCopiador(msg, slot) {
  if (!msg.key || msg.key.fromMe) return;
  const remote = msg.key.remoteJid || '';
  const ts = Number(msg.messageTimestamp) * 1000;
  if (!remote.endsWith('@g.us') || ts < bootTime) return;
  if (msg.key.id && seenIds.has(msg.key.id)) return;
  if (msg.key.id) {
    seenIds.add(msg.key.id);
    if (seenIds.size > 2000) seenIds.clear();
  }
  const text = extractText(msg);
  if (!text || !/https?:\/\//.test(text)) return;
  // Baixa a mídia (se houver) uma vez para reenviar com a legenda convertida
  const hasImage = !!msg.message?.imageMessage;
  const hasVideo = !!msg.message?.videoMessage;
  let media = null;
  if (hasImage || hasVideo) {
    media = await baixarMidia(msg, slot, 'copiador');
  }
  for (const c of copiadores) {
    if ((c.slot || 'wa1') !== slot) continue;
    if (c.source !== remote || !c.targets.length) continue;
    const { out, converted, destino } = await convertTextLinks(text, c.affIds, c.shopeeCreds, c.mlMattTool, c.userId, !c.keepCoupons, c.slot);
    if (!converted) continue;
    let mediaType = hasImage ? 'image' : hasVideo ? 'video' : null;
    // Oferta veio só texto? Busca a foto: na página do anúncio se houver,
    // senão direto pelo título (ex.: vitrine ML não resolvida).
    if (!media) {
      const img = destino
        ? await buscarImagemProduto(destino, titleHints(text))
        : await buscarImagemPorTitulo(titleHints(text));
      if (img) { media = img; mediaType = 'image'; log.info({ slot }, 'imagem do anúncio anexada'); }
    }
    const res = await enviarLote(c, c.targets, comMarca(out), media, mediaType, slot);
    if (!res.ok) continue;
    // Cadeia determinística: o que o Copiador posta num hub dispara o
    // Distribuidor na hora (sem depender do eco do WhatsApp, que duplicava).
    for (const s of res.sent) {
      for (const d of distribuidores) {
        if (d.userId !== c.userId || d.hub !== s.jid || d.pausado) continue;
        if ((d.slot || 'wa1') !== slot) continue;
        try {
          await distribuirAgora(d, out, media, mediaType, s.id, slot);
        } catch (e) {
          log.warn(String(e).slice(0, 150));
        }
      }
    }
  }
}

// Marca d'água invisível: identifica mensagens postadas pelo próprio sistema.
// Quando o WhatsApp reemite (eco) o que o bot enviou, a marca impede o reenvio.
const MARCA = '⁣'; // U+2063 INVISIBLE SEPARATOR
function comMarca(text) {
  return `${text}\n${MARCA}`;
}
function temMarca(text) {
  return typeof text === 'string' && text.includes(MARCA);
}

// Fan-out do Distribuidor para os demais grupos (1 janela por mensagem).
// Marca o que o sistema posta: o eco futuro volta com marca e é ignorado.
// Registra o mapa hub -> cópias para apagar em cascata quando apagarem no hub.
async function distribuirAgora(d, out, media, mediaType, hubMsgId, slot, pularIntervalo = false) {
  if (!temMarca(out)) out = comMarca(out);
  const targets = [...new Set(d.targets)].filter((t) => t !== d.hub);
  if (!targets.length) return false;
  const res = await enviarLote(d, targets, out, media, mediaType, slot, pularIntervalo);
  if (res.ok && hubMsgId && pool) {
    for (const s of res.sent) {
      await pool.query(
        'INSERT INTO "ForwardMap" (id, "userId", "hubJid", "hubMsgId", "targetJid", "sentMsgId", "sentParticipant") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6) ON CONFLICT ("userId", "hubJid", "hubMsgId", "targetJid") DO NOTHING',
        [d.userId, d.hub, hubMsgId, s.jid, s.id, s.participant]
      ).catch(() => {});
    }
  }
  return res.ok;
}

// Distribuidor: o que você posta no SEU grupo é repassado para os demais.
// Anti-loop: eco do próprio bot (com marca) nunca redistribui; a cadeia
// Copiador -> hub é disparada por chamada direta (não depende do eco).
async function handleDistribuidor(msg, slot) {
  if (!msg || !msg.key) return;
  const remote = msg.key.remoteJid || '';
  if (!remote.endsWith('@g.us')) return;
  const ts = Number(msg.messageTimestamp) * 1000;
  if (ts < bootTime) return;
  for (const d of distribuidores) {
    if ((d.slot || 'wa1') !== slot) continue;
    if (d.pausado) continue; // pausa de emergência
    if (d.hub !== remote) continue;
    const eManual = !!msg.key.fromMe;
    const hasImage = !!msg.message?.imageMessage;
    const hasVideo = !!msg.message?.videoMessage;
    const text = extractText(msg) || '';
    if (!text.trim() && !(hasImage || hasVideo)) { log.info({ hub: remote }, 'distribuidor: sem texto nem mídia, ignorada'); continue; }
    if (temMarca(text)) continue; // eco do próprio bot: ignora
    if (d.onlyMine && !msg.key.fromMe) { log.info({ hub: remote }, 'distribuidor: onlyMine e não é sua, ignorada'); continue; }
    if (d.requireLink && !/https?:\/\//.test(text)) { log.info({ hub: remote }, 'distribuidor: sem link e requireLink ligado, ignorada'); continue; }
    let out = text;
    let destino = null;
    if (d.convert) {
      const r = await convertTextLinks(text, d.affIds, d.shopeeCreds, d.mlMattTool, d.userId, d.stripCoupons, d.slot);
      if (r.converted) out = r.out;
      // Usa a página do produto para a foto mesmo quando a conversão falhou
      if (r.destino) destino = r.destino;
    }
    if (d.prefix) out = `${d.prefix}\n\n${out}`;
    if (d.suffix) out = `${out}\n\n${d.suffix}`;
    let media = null;
    let mediaType = hasImage ? 'image' : hasVideo ? 'video' : null;
    if (hasImage || hasVideo) {
      media = await baixarMidia(msg, slot, 'distribuidor');
    }
    if (!media) {
      const img = destino
        ? await buscarImagemProduto(destino, titleHints(text))
        : await buscarImagemPorTitulo(titleHints(text));
      if (img) { media = img; mediaType = 'image'; log.info({ slot }, 'imagem do anúncio anexada'); }
    }
    // Post manual seu fura a janela de intervalo (mas conta na cota e na anti-duplicata)
    await distribuirAgora(d, out, media, mediaType, msg.key.id, slot, eManual);
  }
}

// Apagou no hub -> apaga as cópias nos demais grupos (dentro da janela do WhatsApp)
async function handleApagouNoHub(gid, hubMsgId, slot) {
  const sock = conns[normSlot(slot)].sock;
  for (const d of distribuidores) {
    if ((d.slot || 'wa1') !== normSlot(slot)) continue;
    if (d.hub !== gid) continue;
    let rows = [];
    try {
      const r = await pool.query(
        'SELECT "targetJid", "sentMsgId", "sentParticipant" FROM "ForwardMap" WHERE "userId" = $1 AND "hubJid" = $2 AND "hubMsgId" = $3',
        [d.userId, gid, hubMsgId]
      );
      rows = r.rows;
    } catch { continue; }
    let apagados = 0;
    for (const row of rows) {
      try {
        await sock.sendMessage(row.targetJid, {
          delete: {
            remoteJid: row.targetJid,
            fromMe: true,
            id: row.sentMsgId,
            ...(row.sentParticipant ? { participant: row.sentParticipant } : {}),
          },
        });
        await new Promise((r) => setTimeout(r, 1500));
        apagados++;
      } catch (e) {
        log.warn({ e: String(e).slice(0, 200), to: row.targetJid }, 'apagar repasse falhou (fora da janela?)');
      }
    }
    if (apagados) {
      await pool.query('DELETE FROM "ForwardMap" WHERE "userId" = $1 AND "hubJid" = $2 AND "hubMsgId" = $3', [d.userId, gid, hubMsgId]).catch(() => {});
      log.info({ hub: gid, apagados }, 'repasse apagado junto');
    }
  }
}

function checkAuth(req) {  if (!TOKEN) return true;
  const h = req.headers['x-worker-token'] || '';
  return h === TOKEN;
}

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

async function connectSlot(slot) {
  const cx = conns[slot];
  if (!cx) return;
  fs.mkdirSync(slotDir(slot), { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(slotDir(slot));
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 0] }));
  cx.sock = makeWASocket({ version, auth: state, logger: pino({ level: 'warn' }) });
  cx.sock.ev.on('creds.update', saveCreds);
  cx.sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const m of messages || []) {
      try { await handleCopiador(m, slot); } catch (e) { log.warn(String(e).slice(0, 200)); }
      try { await handleDistribuidor(m, slot); } catch (e) { log.warn(String(e).slice(0, 200)); }
    }
  });
  // Apagou mensagem no grupo -> se foi no hub, apaga as cópias nos demais
  cx.sock.ev.on('messages.delete', async ({ keys }) => {
    try {
      for (const k of keys || []) {
        const gid = k.remoteJid || '';
        if (!gid.endsWith('@g.us') || !k.id) continue;
        await handleApagouNoHub(gid, k.id, slot);
      }
    } catch (e) {
      log.warn(String(e).slice(0, 200));
    }
  });
  cx.sock.ev.on('group-participants.update', async ({ id, participants, action }) => {    try {
      if (action !== 'add' || !id.endsWith('@g.us')) return;
      for (const b of boasvindasCfgs) {
        if ((b.slot || 'wa1') !== slot) continue;
        if (!b.targets.includes(id) || !b.text) continue;
        for (const p of participants || []) {
          try {
            await cx.sock.sendMessage(id, { text: b.text, mentions: [p] });
            await new Promise((r) => setTimeout(r, 1500));
          } catch (e) {
            log.warn({ e: String(e).slice(0, 200) }, 'boasvindas envio falhou');
          }
        }
      }
    } catch (e) {
      log.warn(String(e).slice(0, 200));
    }
  });
  cx.sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      cx.qrDataUrl = await QRCode.toDataURL(qr).catch(() => null);
      cx.qrUpdatedAt = new Date().toISOString();
      cx.connected = false;
    }
    if (connection === 'open') {
      cx.connected = true;
      cx.phone = cx.sock?.user?.id?.split(':')[0] || null;
      cx.qrDataUrl = null;
      cx.lastError = null;
      log.info({ slot, phone: cx.phone }, 'whatsapp conectado');
    }
    if (connection === 'close') {
      cx.connected = false;
      regEv(slot, 'disconnects');
      const code = lastDisconnect?.error?.output?.statusCode;
      cx.lastError = `close:${code}`;
      const loggedOut = code === DisconnectReason.loggedOut;
      if (loggedOut) {
        fs.rmSync(slotDir(slot), { recursive: true, force: true });
        log.warn({ slot }, 'sessao encerrada, QR necessario');
      }
      setTimeout(() => connectSlot(slot), 5000);
    }
  });
}

async function sendText(to, text, slot) {
  const cx = conns[normSlot(slot)];
  if (!cx.sock || !cx.connected) throw new Error('whatsapp desconectado');
  const r = riscoSlot(slot);
  if (r.paused) throw new Error(`slot em pausa de segurança (risco ${r.score})`);
  await cx.sock.sendMessage(to, { text, linkPreview: null });
}

// Indica em quais grupos o usuário pode enviar: é admin (ou não éRestrito)
const meId = (sock) => (sock?.user?.id || '').split(':')[0];
const meLid = (sock) => (sock?.user?.lid || '').split('@')[0];

function canSendTo(sock, g) {
  // Grupo normal (todos falam): se participo, posso enviar.
  // Só no modo "só admins" (announce) preciso ser admin.
  if (!g.announce) return true;
  if (!g.participants) return true; // sem dados: não bloqueia
  const adm = g.participants.filter((p) => p.admin);
  if (!adm.length) return true;
  // Todas as formas do meu número (telefone, LID, só-dígitos, minúsculo):
  // cobre @lid/@s.whatsapp.net/:dispositivo para não dar falso "sem permissão".
  const mine = new Set();
  for (const v of [meId(sock), meLid(sock)]) {
    const b = String(v || '').split('@')[0].split(':')[0];
    if (b) { mine.add(b.toLowerCase()); mine.add(b.replace(/\D/g, '')); }
  }
  if (!mine.size || mine.has('')) return true; // não sei quem sou: não bloqueia
  return adm.some((p) => {
    const forms = [p.id, p.lid, p.phone].filter(Boolean)
      .map((x) => String(x).split('@')[0].split(':')[0].toLowerCase());
    return forms.some((f) => mine.has(f) || (f && mine.has(f.replace(/\D/g, ''))));
  });
}

const groupsCache = new Map(); // slot -> { at, data } (evita refetch de 166+ grupos a cada abertura)
const GROUPS_TTL = 45000;

async function listGroups(slot, force = false) {
  const sl = normSlot(slot);
  const hit = groupsCache.get(sl);
  if (!force && hit && Date.now() - hit.at < GROUPS_TTL) return hit.data;
  const cx = conns[sl];
  // Desconectado momentâneo: serve o cache em vez de lista vazia
  if (!cx.sock || !cx.connected) return hit ? hit.data : [];
  const chats = await cx.sock.groupFetchAllParticipating().catch(() => ({}));
  const data = Object.values(chats).map((g) => {
    const total = g.participants ? g.participants.length : null;
    const admins = g.participants ? g.participants.filter((p) => p.admin).length : null;
    return { id: g.id, name: g.subject, total, admins, canSend: canSendTo(cx.sock, g) };
  });
  groupsCache.set(sl, { at: Date.now(), data });
  if (groupsCache.size > 10) groupsCache.clear();
  return data;
}

// Grupos já configurados pelo usuário (para destacar na UI)
async function groupsInUse() {
  const out = [];
  if (!pool) return out;
  try {
    const { rows } = await pool.query('SELECT provider, config FROM "Integration"');
    for (const r of rows) {
      const c = r.config || {};
      if (r.provider === 'envio_auto' && c.groupJid) out.push(c.groupJid);
      else if (r.provider === 'boasvindas') out.push(...(c.targets || []));
    }
    const cop = await pool.query('SELECT hub FROM "CopiadorRule"').catch(() => ({ rows: [] }));
    for (const r of cop.rows) if (r.hub) out.push(r.hub);
    const dist = await pool.query('SELECT hub, targets FROM "DistribuidorRule"').catch(() => ({ rows: [] }));
    for (const r of dist.rows) {
      if (r.hub) out.push(r.hub);
      out.push(...(r.targets || []));
    }
  } catch { /* ignora */ }
  return [...new Set(out)];
}

// Scheduler: envia posts agendados vencidos (sempre pelo número principal wa1)
async function tick() {
  if (!pool || !conns.wa1.connected) return;
  const { rows } = await pool
    .query('SELECT id, "userId", "groupJid", message FROM "ScheduledPost" WHERE status = $1 AND "scheduledAt" <= NOW() ORDER BY "scheduledAt" LIMIT 10', ['pending'])
    .catch((e) => {
      log.warn({ e: String(e) }, 'poll scheduled falhou');
      return { rows: [] };
    });
  for (const r of rows) {
    try {
      await sendText(r.groupJid, r.message, 'wa1');
      await pool.query('UPDATE "ScheduledPost" SET status = $1 WHERE id = $2', ['sent', r.id]);
      await pool.query('INSERT INTO "DispatchLog" (id, "userId", "groupJid", message, status, kind) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)', [r.userId, r.groupJid, r.message, 'sent', 'agendado']);
    } catch (e) {
      await pool.query('UPDATE "ScheduledPost" SET status = $1, error = $2 WHERE id = $3', ['failed', String(e).slice(0, 500), r.id]).catch(() => {});
      await pool.query('INSERT INTO "DispatchLog" (id, "userId", "groupJid", message, status, kind, error) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)', [r.userId, r.groupJid, r.message, 'failed', 'agendado', String(e).slice(0, 500)]).catch(() => {});
    }
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(b));
  });
}

function slotPayload(slot) {
  const cx = conns[normSlot(slot)];
  return { slot: cx.slot, connected: cx.connected, phone: cx.phone, qrUpdatedAt: cx.qrUpdatedAt, lastError: cx.lastError };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://x');
  const slot = normSlot(url.searchParams.get('slot') || '');
  if (url.pathname === '/health') return sendJson(res, 200, { ok: true, connected: conns.wa1.connected });
  if (!checkAuth(req)) return sendJson(res, 401, { error: 'unauthorized' });
  if (url.pathname === '/status' && req.method === 'GET') {
    return sendJson(res, 200, {
      ...slotPayload('wa1'),
      slots: { wa1: slotPayload('wa1'), wa2: slotPayload('wa2') },
      health: { wa1: riscoSlot('wa1'), wa2: riscoSlot('wa2') },
      copiadores: copiadores.length, distribuidores: distribuidores.length,
    });
  }
  if (url.pathname === '/qr' && req.method === 'GET') {
    const cx = conns[slot];
    return sendJson(res, 200, { connected: cx.connected, qr: cx.qrDataUrl, updatedAt: cx.qrUpdatedAt });
  }
  if (url.pathname === '/groups' && req.method === 'GET') {
    const groups = await listGroups(slot, url.searchParams.get('refresh') === '1').catch(() => []);
    const inUse = new Set(await groupsInUse());
    return sendJson(res, 200, { groups: groups.map((g) => ({ ...g, inUse: inUse.has(g.id) })) });
  }
  if (url.pathname === '/channel' && req.method === 'GET') {
    // Resolve link de convite do Canal (https://whatsapp.com/channel/XXXX) -> JID @newsletter
    const cx = conns[slot];
    const invite = url.searchParams.get('invite') || '';
    const code = ((invite.match(/channel\/([A-Za-z0-9_-]+)/) || [])[1] || invite.trim()).replace(/[^A-Za-z0-9_-]/g, '');
    if (!cx.sock || !cx.connected) return sendJson(res, 502, { error: 'whatsapp desconectado' });
    if (!code) return sendJson(res, 400, { error: 'convite inválido' });
    try {
      const meta = await cx.sock.newsletterMetadata('invite', code);
      const id = meta && meta.id ? String(meta.id) : '';
      if (!id.endsWith('@newsletter')) return sendJson(res, 404, { error: 'canal não encontrado' });
      const tm = meta.thread_metadata || {};
      let followers = null;
      try {
        const subs = await cx.sock.newsletterSubscribers(id);
        const n = subs && (subs.count ?? subs.total ?? subs.subscribers);
        if (typeof n === 'number') followers = n;
        else if (Array.isArray(subs)) followers = subs.length;
      } catch { /* seguidores é opcional */ }
      return sendJson(res, 200, {
        id,
        name: String(meta.name || tm.name || ''),
        description: String(meta.description || tm.description || '').slice(0, 140),
        followers,
      });
    } catch (e) {
      return sendJson(res, 502, { error: String(e).slice(0, 200) });
    }
  }
  if (url.pathname === '/participants' && req.method === 'GET') {    const cx = conns[slot];
    const groupJid = url.searchParams.get('groupJid') || '';
    if (!groupJid.endsWith('@g.us')) return sendJson(res, 400, { error: 'groupJid inválido' });
    try {
      if (!cx.sock || !cx.connected) return sendJson(res, 502, { error: 'whatsapp desconectado' });
      const meta = await cx.sock.groupMetadata(groupJid);
      const participants = (meta.participants || []).map((p) => ({ id: p.id, admin: p.admin || null }));
      return sendJson(res, 200, { participants });
    } catch (e) {
      return sendJson(res, 502, { error: String(e).slice(0, 200) });
    }
  }
  if (url.pathname === '/send' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}');
    if (!body.to || !body.text) return sendJson(res, 400, { error: 'to e text obrigatórios' });
    try {
      await sendText(body.to, body.text, normSlot(body.slot));
      return sendJson(res, 200, { ok: true });
    } catch (e) {
      return sendJson(res, 502, { error: String(e).slice(0, 300) });
    }
  }
  if (url.pathname === '/logout' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}');
    const lslot = normSlot(body.slot || url.searchParams.get('slot'));
    const cx = conns[lslot];
    try { await cx.sock?.logout().catch(() => {}); } catch { /* ignore */ }
    cx.sock = null;
    cx.connected = false;
    cx.phone = null;
    cx.qrDataUrl = null;
    fs.rmSync(slotDir(lslot), { recursive: true, force: true });
    setTimeout(() => connectSlot(lslot), 2000);
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 404, { error: 'not found' });
});

server.listen(PORT, () => log.info({ PORT }, 'worker http no ar'));
connectSlot('wa1').catch((e) => log.error(String(e)));
connectSlot('wa2').catch((e) => log.error(String(e)));
loadCopiadores().catch(() => {});
carregarAlvosQuebrados().catch(() => {});
try { limpezaRetencao(); } catch { /* ignora */ }
setInterval(tick, 15000);
setInterval(loadCopiadores, 60000);
// Limpa mapas de repasse com mais de 7 dias (fora da janela de apagar do WhatsApp)
setInterval(() => {
  if (pool) pool.query('DELETE FROM "ForwardMap" WHERE "createdAt" < NOW() - INTERVAL \'7 days\'').catch(() => {});
}, 24 * 3600 * 1000);
// Retenção: anti-duplicata expira em 7 dias; log de disparos em 90 dias;
// agendados já processados em 30 dias. Sem isso as tabelas crescem para sempre.
function limpezaRetencao() {
  if (!pool) return;
  pool.query('DELETE FROM "QueuedOffer" WHERE "createdAt" < NOW() - INTERVAL \'7 days\'').catch(() => {});
  pool.query('DELETE FROM "DispatchLog" WHERE "sentAt" < NOW() - INTERVAL \'90 days\'').catch(() => {});
  pool.query('DELETE FROM "ScheduledPost" WHERE status IN (\'sent\',\'failed\') AND "scheduledAt" < NOW() - INTERVAL \'30 days\'').catch(() => {});
}
setInterval(limpezaRetencao, 24 * 3600 * 1000);
