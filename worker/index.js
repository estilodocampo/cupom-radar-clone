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

let sock = null;
let connected = false;
let phone = null;
let qrDataUrl = null;
let qrUpdatedAt = null;
let lastError = null;
const bootTime = Date.now();
const seenIds = new Set();
let copiadores = []; // [{userId, source, targets, affIds}]

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

const SHORT_HOSTS = ['meli.la', 'shope.ee', 'amzn.to', 'a.co', 'bit.ly', 'tinyurl.com', 'is.gd'];

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
  return mergeTracking(originalUrl, { matt_tool: mattTool || 'afiliados', matt_word: tag });
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
const WEB_URL = (process.env.WEB_URL || 'https://cupom-radar-clone-production.up.railway.app').replace(/\/$/, '');

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
async function shortenUrl(longUrl, userId, timeoutMs = 8000) {
  if (longUrl.length <= 60) return longUrl;
  if (pool) {
    try {
      const ex = await pool.query('SELECT code FROM "ShortLink" WHERE url = $1 LIMIT 1', [longUrl]);
      if (ex.rows[0]) return `${WEB_URL}/r/${ex.rows[0].code}`;
    } catch { /* segue */ }
    for (let i = 0; i < 3; i++) {
      const code = crypto.randomBytes(3).toString('base64url');
      try {
        await pool.query('INSERT INTO "ShortLink" (id, code, url, "userId") VALUES (gen_random_uuid(), $1, $2, $3)', [code, longUrl, userId || null]);
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

async function convertTextLinks(text, affIds, shopeeCreds, mlMattTool, userId, stripCoupons = true) {
  let converted = 0;
  const urls = [...new Set(text.match(/https?:\/\/[^\s)]+/g) || [])];
  let out = text;
  for (let raw of urls) {
    let url = raw.replace(/[.,!?]+$/, '');
    url = await expandUrl(url).catch(() => url);
    const store = detectStore(url);
    let final = null;
    try {
      if (store === 'shopee' && shopeeCreds) {
        final = await shopeeShortLink(url.split('?')[0], ['cupomradar'], shopeeCreds);
        converted++;
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
      } else if (store !== 'unknown' && store !== 'mercadolivre' && affIds[store]) {
        final = toAffiliateLink(url, affIds[store], store);
        converted++;
      }
      if (final) {
        final = await shortenUrl(final, userId);
        out = out.split(raw).join(final);
      }
    } catch (e) {
      log.warn({ e: String(e).slice(0, 150) }, 'conversao falhou, mantendo original');
    }
  }
  // Remove linhas de cupom da origem (ex.: "Cupom: MELHORCUPOM") — não valem no seu grupo
  if (stripCoupons) out = out.split('\n').filter((l) => !/cupom/i.test(l)).join('\n').replace(/\n{3,}/g, '\n\n');
  return { out, converted };
}

async function loadCopiadores() {
  if (!pool) return;
  try {
    const { rows } = await pool.query('SELECT "userId", provider, config FROM "Integration" WHERE provider IN ($1,$2,$3,$4,$5,$6,$7,$8,$9)', ['copiador', 'shopee', 'amazon', 'magalu', 'mercadolivre', 'shein', 'cupons', 'lista_envio', 'shopee_api']);
    const byUser = {};
    for (const r of rows) {
      byUser[r.userId] = byUser[r.userId] || { affIds: {} };
      if (r.provider === 'copiador') byUser[r.userId].copiador = r.config || {};
      else if (r.provider === 'shopee_api' && r.config && r.config.appId && r.config.secret) byUser[r.userId].shopeeCreds = { appId: r.config.appId, secret: r.config.secret };
      else if (r.provider === 'mercadolivre' && r.config) {
        if (r.config.mattTool) byUser[r.userId].mlMattTool = r.config.mattTool;
        if (r.config.affiliateId) byUser[r.userId].affIds[r.provider] = r.config.affiliateId;
      }
      else if (r.provider && r.config && r.config.affiliateId) byUser[r.userId].affIds[r.provider] = r.config.affiliateId;
    }
    copiadores = Object.entries(byUser)
      .filter(([, v]) => v.copiador && v.copiador.source)
      .map(([userId, v]) => ({ userId, source: v.copiador.source, targets: v.copiador.targets || [], keepCoupons: !!v.copiador.keepCoupons, affIds: v.affIds, shopeeCreds: v.shopeeCreds || null, mlMattTool: v.mlMattTool || null }));
    if (copiadores.length) log.info({ n: copiadores.length }, 'copiadores ativos');
  } catch (e) {
    log.warn({ e: String(e) }, 'load copiadores falhou');
  }
}

function extractText(msg) {
  const m = msg.message || {};
  return m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || null;
}

async function handleCopiador(msg) {
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
    try {
      media = await downloadMediaMessage(msg, 'buffer', {});
    } catch (e) {
      log.warn({ e: String(e).slice(0, 120) }, 'copiador midia falhou, enviando só texto');
    }
  }
  for (const c of copiadores) {
    if (c.source !== remote || !c.targets.length) continue;
    const { out, converted } = await convertTextLinks(text, c.affIds, c.shopeeCreds, c.mlMattTool, c.userId, !c.keepCoupons);
    if (!converted) continue;
    const caption = out.length > 1000 ? out.slice(0, 1000) : out;
    const rest = out.length > 1000 ? out.slice(1000) : '';
    for (const t of c.targets) {
      try {
        if (media && hasImage) await sock.sendMessage(t, { image: media, caption });
        else if (media && hasVideo) await sock.sendMessage(t, { video: media, caption });
        else await sock.sendMessage(t, { text: out });
        if (rest && media) await sock.sendMessage(t, { text: rest });
        await new Promise((r) => setTimeout(r, 1500));
        if (pool) await pool.query('INSERT INTO "DispatchLog" (id, "userId", "groupJid", message, status) VALUES (gen_random_uuid(), $1, $2, $3, $4)', [c.userId, t, out, 'sent']).catch(() => {});
      } catch (e) {
        log.warn({ e: String(e).slice(0, 200) }, 'copiador envio falhou');
      }
    }
  }
}

function checkAuth(req) {
  if (!TOKEN) return true;
  const h = req.headers['x-worker-token'] || '';
  return h === TOKEN;
}

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

async function connect() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 0] }));
  sock = makeWASocket({ version, auth: state, logger: pino({ level: 'warn' }) });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const m of messages || []) {
      try { await handleCopiador(m); } catch (e) { log.warn(String(e).slice(0, 200)); }
    }
  });
  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      qrDataUrl = await QRCode.toDataURL(qr).catch(() => null);
      qrUpdatedAt = new Date().toISOString();
      connected = false;
    }
    if (connection === 'open') {
      connected = true;
      phone = sock?.user?.id?.split(':')[0] || null;
      qrDataUrl = null;
      lastError = null;
      log.info({ phone }, 'whatsapp conectado');
    }
    if (connection === 'close') {
      connected = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      lastError = `close:${code}`;
      const loggedOut = code === DisconnectReason.loggedOut;
      if (loggedOut) {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        log.warn('sessao encerrada, QR necessario');
      }
      setTimeout(connect, 5000);
    }
  });
}

async function sendText(to, text) {
  if (!sock || !connected) throw new Error('whatsapp desconectado');
  await sock.sendMessage(to, { text });
}

async function listGroups() {
  if (!sock || !connected) return [];
  const chats = await sock.groupFetchAllParticipating().catch(() => ({}));
  return Object.values(chats).map((g) => ({ id: g.id, name: g.subject }));
}

// Scheduler: envia posts agendados vencidos
async function tick() {
  if (!pool || !connected) return;
  const { rows } = await pool
    .query('SELECT id, "userId", "groupJid", message FROM "ScheduledPost" WHERE status = $1 AND "scheduledAt" <= NOW() ORDER BY "scheduledAt" LIMIT 10', ['pending'])
    .catch((e) => {
      log.warn({ e: String(e) }, 'poll scheduled falhou');
      return { rows: [] };
    });
  for (const r of rows) {
    try {
      await sendText(r.groupJid, r.message);
      await pool.query('UPDATE "ScheduledPost" SET status = $1 WHERE id = $2', ['sent', r.id]);
      await pool.query('INSERT INTO "DispatchLog" (id, "userId", "groupJid", message, status) VALUES (gen_random_uuid(), $1, $2, $3, $4)', [r.userId, r.groupJid, r.message, 'sent']);
    } catch (e) {
      await pool.query('UPDATE "ScheduledPost" SET status = $1, error = $2 WHERE id = $3', ['failed', String(e).slice(0, 500), r.id]).catch(() => {});
      await pool.query('INSERT INTO "DispatchLog" (id, "userId", "groupJid", message, status, error) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)', [r.userId, r.groupJid, r.message, 'failed', String(e).slice(0, 500)]).catch(() => {});
    }
  }
}

// ---- Radar Shopee: importação automática por palavras-chave ----
function buildShopeePost({ title, priceFrom, priceTo, link, coupon }) {
  return `🔥 OFERTA SHOPEE 🔥\n\n📌 ${title}\n${priceFrom ? `❌ De: ${priceFrom}\n` : ''}✅ Por: ${priceTo}\n${coupon ? `🎟️ Cupom: ${coupon}\n` : ''}\n👉 ${link}\n\n⚠️ Estoque limitado!`;
}

let radarDiscoveryWarnedAt = 0;

// Descoberta de produtos na API de afiliados Shopee.
// PENDENTE: confirmar as queries de busca após introspecção do schema com as
// credenciais do usuário (App ID + Secret). Interface de retorno:
// [{ key, url, title, priceFrom?, priceTo }] — preços já formatados ("R$ 49,90").
async function discoverShopeeProducts(keywords, creds) {
  void keywords; void creds;
  if (Date.now() - radarDiscoveryWarnedAt > 6 * 3600 * 1000) {
    radarDiscoveryWarnedAt = Date.now();
    log.warn('radar: descoberta Shopee pendente de introspecção da API (aguardando credenciais)');
  }
  return [];
}

async function tickRadar() {
  if (!pool || !connected) return;
  let radars = [];
  try {
    const r = await pool.query(
      `SELECT id, "userId", name, keywords, "targetGroups", "intervalMinutes", "maxPostsPerRun"
       FROM "RadarConfig" WHERE active = true
       AND ("lastRunAt" IS NULL OR "lastRunAt" <= NOW() - ("intervalMinutes" || ' minutes')::INTERVAL)
       ORDER BY "lastRunAt" NULLS FIRST LIMIT 5`
    );
    radars = r.rows;
  } catch (e) {
    log.warn({ e: String(e) }, 'poll radar falhou');
    return;
  }
  if (!radars.length) return;
  let credsByUser = {};
  try {
    const c = await pool.query('SELECT "userId", config FROM "Integration" WHERE provider = $1', ['shopee_api']);
    for (const row of c.rows) {
      if (row.config && row.config.appId && row.config.secret) credsByUser[row.userId] = { appId: row.config.appId, secret: row.config.secret };
    }
  } catch { /* segue sem credenciais */ }
  for (const radar of radars) {
    const done = async () => {
      await pool.query('UPDATE "RadarConfig" SET "lastRunAt" = NOW() WHERE id = $1', [radar.id]).catch(() => {});
    };
    const creds = credsByUser[radar.userId];
    if (!creds) {
      log.warn({ radar: radar.name }, 'radar sem credenciais Shopee, pulando rodada');
      await done();
      continue;
    }
    try {
      const found = await discoverShopeeProducts(radar.keywords || [], creds);
      const fresh = [];
      for (const item of found.slice(0, radar.maxPostsPerRun * 3)) {
        if (!item || !item.url || !item.title || !item.priceTo) continue;
        const ex = await pool.query('SELECT 1 FROM "RadarPost" WHERE "radarId" = $1 AND "itemKey" = $2 LIMIT 1', [radar.id, item.key || item.url]).catch(() => ({ rows: [] }));
        if (ex.rows && ex.rows.length) continue;
        fresh.push(item);
        if (fresh.length >= radar.maxPostsPerRun) break;
      }
      for (const item of fresh) {
        const short = await shopeeShortLink(item.url.split('?')[0], ['cupomradar'], creds);
        const text = buildShopeePost({ title: item.title, priceFrom: item.priceFrom, priceTo: item.priceTo, link: short });
        for (const t of radar.targetGroups || []) {
          try {
            await sock.sendMessage(t, { text });
            await new Promise((rr) => setTimeout(rr, 1500));
            await pool.query('INSERT INTO "DispatchLog" (id, "userId", "groupJid", message, status) VALUES (gen_random_uuid(), $1, $2, $3, $4)', [radar.userId, t, text, 'sent']).catch(() => {});
          } catch (e) {
            log.warn({ e: String(e).slice(0, 200) }, 'radar envio falhou');
          }
        }
        await pool.query('INSERT INTO "RadarPost" (id, "radarId", "itemKey") VALUES (gen_random_uuid(), $1, $2) ON CONFLICT ("radarId", "itemKey") DO NOTHING', [radar.id, item.key || item.url]).catch(() => {});
      }
      await done();
      log.info({ radar: radar.name, enviados: fresh.length }, 'radar rodada concluída');
    } catch (e) {
      log.warn({ e: String(e).slice(0, 200), radar: radar.name }, 'radar rodada falhou');
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://x');
  if (url.pathname === '/health') return sendJson(res, 200, { ok: true, connected });
  if (!checkAuth(req)) return sendJson(res, 401, { error: 'unauthorized' });
  if (url.pathname === '/status' && req.method === 'GET') {
    return sendJson(res, 200, { connected, phone, qrUpdatedAt, lastError, copiadores: copiadores.length });
  }
  if (url.pathname === '/qr' && req.method === 'GET') {
    return sendJson(res, 200, { connected, qr: qrDataUrl, updatedAt: qrUpdatedAt });
  }
  if (url.pathname === '/groups' && req.method === 'GET') {
    const groups = await listGroups().catch(() => []);
    return sendJson(res, 200, { groups });
  }
  if (url.pathname === '/send' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}');
    if (!body.to || !body.text) return sendJson(res, 400, { error: 'to e text obrigatórios' });
    try {
      await sendText(body.to, body.text);
      return sendJson(res, 200, { ok: true });
    } catch (e) {
      return sendJson(res, 502, { error: String(e).slice(0, 300) });
    }
  }
  if (url.pathname === '/logout' && req.method === 'POST') {
    try { await sock?.logout().catch(() => {}); } catch { /* ignore */ }
    sock = null;
    connected = false;
    phone = null;
    qrDataUrl = null;
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    setTimeout(connect, 2000);
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 404, { error: 'not found' });
});

server.listen(PORT, () => log.info({ PORT }, 'worker http no ar'));
connect().catch((e) => log.error(String(e)));
loadCopiadores().catch(() => {});
setInterval(tick, 15000);
setInterval(loadCopiadores, 60000);
setInterval(() => tickRadar().catch((e) => log.warn(String(e).slice(0, 150))), 5 * 60 * 1000);
setTimeout(() => tickRadar().catch(() => {}), 60000);
