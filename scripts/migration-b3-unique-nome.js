// Cria UNIQUE INDEX em catalogo.nome_canonico (case-insensitive).
// Nunca derruba o servidor — erros são logados e ignorados.
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
      console.warn('[migration-b3] Duplicatas ativas encontradas — índice adiado:', dups.map(d => d.nome).join(', '));
      return;
    }
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS catalogo_nome_uniq
      ON catalogo (LOWER(nome_canonico))
    `);
    console.log('[migration-b3] Índice catalogo_nome_uniq OK.');
  } catch (e) {
    console.warn('[migration-b3] Aviso (não fatal):', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => console.warn('[migration-b3] Aviso (não fatal):', e.message));
