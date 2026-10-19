/**
 * Migra os dados de um Postgres para outro (Railway → Render) sem pg_dump.
 *
 * Uso:
 *   1. crie o arquivo .env.migrate na raiz (já está no .gitignore):
 *        SOURCE_DATABASE_URL=postgresql://...   (Railway, conexão pública)
 *        TARGET_DATABASE_URL=postgresql://...   (Render, conexão externa)
 *   2. node scripts/migrate.js
 *
 * O que faz:
 *   - lê a lista de tabelas do schema public no destino;
 *   - remove as FKs do destino (banco recém-criado) para copiar sem ordem;
 *   - copia em lotes com ON CONFLICT DO NOTHING (pode rodar 2x sem duplicar);
 *   - reativa as FKs e ajusta as sequences de id.
 *
 * Não copia _prisma_migrations (o projeto usa db push).
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const BATCH = 250;

function loadEnvFile() {
  const file = path.join(__dirname, '..', '.env.migrate');
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}

function pool(url) {
  const remote = !/localhost|127\.0\.0\.1/.test(url);
  return new Pool({
    connectionString: url,
    ssl: remote ? { rejectUnauthorized: false } : undefined,
    max: 2,
    statement_timeout: 0,
  });
}

const q = (name) => `"${String(name).replace(/"/g, '""')}"`;

async function tables(db) {
  const { rows } = await db.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );
  return rows.map((r) => r.table_name).filter((t) => t !== '_prisma_migrations');
}

async function columns(db, table) {
  const { rows } = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
  return rows.map((r) => r.column_name);
}

async function foreignKeys(db) {
  const { rows } = await db.query(
    `SELECT conname, conrelid::regclass::text AS tabela, pg_get_constraintdef(oid) AS def
     FROM pg_constraint
     WHERE contype = 'f' AND connamespace = 'public'::regnamespace`
  );
  return rows;
}

async function copyTable(source, target, table, cols) {
  const { rows } = await source.query(`SELECT * FROM ${q(table)}`);
  if (rows.length === 0) {
    console.log(`  · ${table}: 0`);
    return 0;
  }

  const colList = cols.map(q).join(', ');
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const params = [];
    const tuples = chunk.map((row) => {
      const marks = cols.map((c) => {
        params.push(row[c] === undefined ? null : row[c]);
        return `$${params.length}`;
      });
      return `(${marks.join(', ')})`;
    });

    await target.query(
      `INSERT INTO ${q(table)} (${colList}) VALUES ${tuples.join(', ')} ON CONFLICT DO NOTHING`,
      params
    );
    inserted += chunk.length;
  }

  console.log(`  · ${table}: ${inserted}`);
  return inserted;
}

async function resetSequences(target, tableList) {
  for (const table of tableList) {
    const cols = await columns(target, table);
    if (!cols.includes('id')) continue;
    const { rows } = await target.query(`SELECT pg_get_serial_sequence($1, 'id') AS seq`, [
      `public.${q(table)}`,
    ]);
    const seq = rows[0] && rows[0].seq;
    if (!seq) continue;
    await target.query(
      `SELECT setval($1::regclass, COALESCE((SELECT MAX("id") FROM ${q(table)}), 0) + 1, false)`,
      [seq]
    );
  }
}

async function main() {
  loadEnvFile();
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  const targetUrl = process.env.TARGET_DATABASE_URL;

  if (!sourceUrl || !targetUrl) {
    console.error(
      'Faltam variáveis. Crie .env.migrate com SOURCE_DATABASE_URL e TARGET_DATABASE_URL.'
    );
    process.exit(1);
  }
  if (sourceUrl === targetUrl) {
    console.error('SOURCE e TARGET são a mesma URL.');
    process.exit(1);
  }

  const source = pool(sourceUrl);
  const target = pool(targetUrl);

  try {
    console.log('→ conectando…');
    await source.query('SELECT 1');
    await target.query('SELECT 1');

    const srcTables = await tables(source);
    const dstTables = await tables(target);
    const common = srcTables.filter((t) => dstTables.includes(t));
    const missing = srcTables.filter((t) => !dstTables.includes(t));

    if (missing.length) {
      console.warn(`⚠ tabelas no origem sem par no destino (ignoradas): ${missing.join(', ')}`);
    }

    console.log(`→ ${common.length} tabelas serão copiadas`);

    const fks = await foreignKeys(target);
    console.log(`→ removendo ${fks.length} FKs temporariamente`);
    for (const fk of fks) {
      await target.query(`ALTER TABLE ${fk.tabela} DROP CONSTRAINT IF EXISTS ${q(fk.conname)}`);
    }

    let total = 0;
    for (const table of common) {
      const srcCols = await columns(source, table);
      const dstCols = await columns(target, table);
      const cols = srcCols.filter((c) => dstCols.includes(c));
      const skipped = srcCols.filter((c) => !dstCols.includes(c));
      if (skipped.length) console.warn(`  ⚠ ${table}: colunas ignoradas ${skipped.join(', ')}`);
      if (cols.length === 0) continue;
      total += await copyTable(source, target, table, cols);
    }

    console.log(`→ restaurando ${fks.length} FKs`);
    for (const fk of fks) {
      await target.query(`ALTER TABLE ${fk.tabela} ADD CONSTRAINT ${q(fk.conname)} ${fk.def}`);
    }

    console.log('→ ajustando sequences');
    await resetSequences(target, common);

    console.log(`✓ migração concluída: ${total} linhas em ${common.length} tabelas`);
  } finally {
    await source.end().catch(() => {});
    await target.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error('✖ falhou:', e.message);
  process.exit(1);
});
