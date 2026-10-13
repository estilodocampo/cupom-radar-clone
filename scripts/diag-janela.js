const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query(`SELECT "sentAt", status, kind, "groupJid", LEFT(message, 55) AS m FROM "DispatchLog" WHERE "sentAt" BETWEEN '2026-10-13T15:15:00Z' AND '2026-10-13T16:20:00Z' ORDER BY "sentAt" DESC LIMIT 20`);
  if (!r.rows.length) console.log('NENHUM ENVIO entre 12:15 e 13:20 local');
  for (const x of r.rows) console.log(x.sentAt.toISOString().slice(11, 19), x.status, (x.kind || '-').padEnd(12), x.groupJid.slice(0, 22), '|', x.m.replace(/\n/g, ' '));
  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
