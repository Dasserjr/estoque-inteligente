// Migration: adiciona confirmado_em a compra_itens (idempotente).
// S1 — staged review: compra_itens agora é área de preparo; evento só criado após confirmação humana.
let Pool;
try { Pool = require('pg').Pool; } catch { Pool = require('../backend/node_modules/pg').Pool; }

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  if (!process.env.DATABASE_URL) { console.log('[migration-confirmado] DATABASE_URL ausente — pulando.'); return; }
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE compra_itens ADD COLUMN IF NOT EXISTS confirmado_em TIMESTAMPTZ`);
    console.log('[migration-confirmado] confirmado_em ok.');
  } catch (e) {
    console.warn('[migration-confirmado] Aviso (não fatal):', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => console.warn('[migration-confirmado] Erro:', e.message));
