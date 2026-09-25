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
  if (u.includes('shopee')) return 'shopee';
  if (u.includes('amazon')) return 'amazon';
  if (u.includes('mercadolivre') || u.includes('mercadolibre')) return 'mercadolivre';
  if (u.includes('magalu') || u.includes('magazineluiza')) return 'magalu';
  if (u.includes('shein')) return 'shein';
  return 'unknown';
}

function toAffiliateLink(originalUrl, affiliateId, store) {
  const base = originalUrl.split('?')[0];
  if (store === 'shopee') return `${base}?af_id=${affiliateId}&sub_id=cupomradar`;
  if (store === 'amazon') return `${base}?tag=${affiliateId}`;
  return `${base}?af=${affiliateId}`;
}

function convertTextLinks(text, affIds) {
  let converted = 0;
  const out = text.replace(/https?:\/\/[^\s)]+/g, (url) => {
    const store = detectStore(url);
    const id = affIds[store];
    if (store === 'unknown' || !id) return url;
    converted++;
    return toAffiliateLink(url.replace(/[.,!?]+$/, ''), id, store);
  });
  return { out, converted };
}

async function loadCopiadores() {
  if (!pool) return;
  try {
    const { rows } = await pool.query('SELECT "userId", provider, config FROM "Integration" WHERE provider IN ($1,$2,$3,$4,$5,$6,$7,$8)', ['copiador', 'shopee', 'amazon', 'magalu', 'mercadolivre', 'shein', 'cupons', 'lista_envio']);
    const byUser = {};
    for (const r of rows) {
      byUser[r.userId] = byUser[r.userId] || { affIds: {} };
      if (r.provider === 'copiador') byUser[r.userId].copiador = r.config || {};
      else if (r.provider && r.config && r.config.affiliateId) byUser[r.userId].affIds[r.provider] = r.config.affiliateId;
    }
    copiadores = Object.entries(byUser)
      .filter(([, v]) => v.copiador && v.copiador.source)
      .map(([userId, v]) => ({ userId, source: v.copiador.source, targets: v.copiador.targets || [], affIds: v.affIds }));
    if (copiadores.length) log.info({ n: copiadores.length }, 'copiadores ativos');
  } catch (e) {
    log.warn({ e: String(e) }, 'load copiadores falhou');
  }
}

function extractText(msg) {
  const m = msg.message || {};
  return m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || null;
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
  for (const c of copiadores) {
    if (c.source !== remote || !c.targets.length) continue;
    const { out, converted } = convertTextLinks(text, c.affIds);
    if (!converted) continue;
    for (const t of c.targets) {
      try {
        await sock.sendMessage(t, { text: out });
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
