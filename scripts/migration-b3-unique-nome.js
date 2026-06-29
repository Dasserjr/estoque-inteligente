// Roda no startup do Railway para garantir o índice único em catalogo.nome_canonico.
// Usa || para localizar pg tanto no Railway (backend/node_modules) quanto localmente.
let Pool;
try { Pool = require('pg').Pool; } catch { Pool = require('../backend/node_modules/pg').Pool; }

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  if (!process.env.DATABASE_URL) { console.log('[migration-b3] DATABASE_URL ausente — pulando.'); return; }
  const client = await pool.connect();
  try {
    const { rows: dups } = await client.query(`
      SELECT LOWER(nome_canonico) AS nome, COUNT(*) AS total
      FROM catalogo WHERE ativo = true
      GROUP BY LOWER(nome_canonico) HAVING COUNT(*) > 1
    `);
    if (dups.length) {
      console.error('[migration-b3] ERRO: duplicatas ativas encontradas:', dups);
      process.exit(1);
    }
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS catalogo_nome_uniq
      ON catalogo (LOWER(nome_canonico))
    `);
    console.log('[migration-b3] Índice catalogo_nome_uniq OK.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error('[migration-b3]', e.message); process.exit(1); });
