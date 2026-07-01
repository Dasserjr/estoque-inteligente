// Migration: cria tabela categorias, adiciona categoria_id em catalogo, migra dados.
let Pool;
try { Pool = require('pg').Pool; } catch { Pool = require('../backend/node_modules/pg').Pool; }

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  if (!process.env.DATABASE_URL) { console.log('[migration-cat] DATABASE_URL ausente — pulando.'); return; }
  const client = await pool.connect();
  try {
    // 1. Tabela de categorias
    await client.query(`
      CREATE TABLE IF NOT EXISTS categorias (
        id    SERIAL PRIMARY KEY,
        nome  VARCHAR(100) NOT NULL UNIQUE,
        icone VARCHAR(10)  NOT NULL DEFAULT '📦',
        ordem INTEGER      NOT NULL DEFAULT 0
      )
    `);

    // 2. Insere as 9 categorias padrão
    const cats = [
      ['Lava Louças',              '🍽️', 1],
      ['Lavanderia',               '👕',  2],
      ['Desinfetante e Alvejante', '🧪',  3],
      ['Limpador Multiuso',        '🧹',  4],
      ['Limpador Abrasivo',        '💪',  5],
      ['Limpeza Especializada',    '✨',  6],
      ['Aromatizadores',           '🌸',  7],
      ['Utensílios de Limpeza',    '🧽',  8],
      ['Descartáveis',             '🗑️', 9],
    ];
    for (const [nome, icone, ordem] of cats) {
      await client.query(
        `INSERT INTO categorias (nome, icone, ordem) VALUES ($1,$2,$3) ON CONFLICT (nome) DO NOTHING`,
        [nome, icone, ordem]
      );
    }

    // 3. Coluna categoria_id no catálogo
    await client.query(`ALTER TABLE catalogo ADD COLUMN IF NOT EXISTS categoria_id INTEGER REFERENCES categorias(id)`);

    // 4. Migra produtos pela categoria de texto atual
    const porCategoria = [
      ['Lavanderia',   'Lavanderia'],
      ['Descartáveis', 'Descartáveis'],
      ['Utensílios',   'Utensílios de Limpeza'],
      ['Ar e higiene', 'Aromatizadores'],
      ['Cozinha',      'Lava Louças'],
    ];
    for (const [old, novo] of porCategoria) {
      await client.query(
        `UPDATE catalogo SET categoria_id = (SELECT id FROM categorias WHERE nome = $1)
         WHERE categoria = $2 AND categoria_id IS NULL`,
        [novo, old]
      );
    }

    // 5. Migra produtos da categoria 'Limpeza' pelo nome canônico
    const porNome = [
      ['%lava louca%',  'Lava Louças'],
      ['%limpol%',      'Lava Louças'],
      ['%lava roupas%', 'Lavanderia'],
      ['%lysoform%',    'Desinfetante e Alvejante'],
      ['%sanit%',       'Desinfetante e Alvejante'],
      ['%ajax%',        'Limpador Abrasivo'],
      ['%ap_leo%',      'Limpador Abrasivo'],   // Sapóleo / Sapoleo
      ['%vidrex%',      'Limpeza Especializada'],
      ['%peroba%',      'Limpeza Especializada'],
      ['%bom ar%',      'Aromatizadores'],
      ['%neutr%',       'Aromatizadores'],
    ];
    for (const [pattern, catNome] of porNome) {
      await client.query(
        `UPDATE catalogo SET categoria_id = (SELECT id FROM categorias WHERE nome = $1)
         WHERE nome_canonico ILIKE $2 AND categoria_id IS NULL`,
        [catNome, pattern]
      );
    }

    // 6. Restante de 'Limpeza' → Limpador Multiuso (Veja, Ypê, limpa chão...)
    await client.query(`
      UPDATE catalogo SET categoria_id = (SELECT id FROM categorias WHERE nome = 'Limpador Multiuso')
      WHERE categoria = 'Limpeza' AND categoria_id IS NULL
    `);

    // 7. Sincroniza campo texto 'categoria' com o nome da categoria_id
    await client.query(`
      UPDATE catalogo c SET categoria = cat.nome
      FROM categorias cat
      WHERE c.categoria_id = cat.id AND (c.categoria IS DISTINCT FROM cat.nome)
    `);

    // 8. Recria a view v_estoque incluindo categoria_id
    await client.query(`
      CREATE OR REPLACE VIEW v_estoque AS
      SELECT c.id, c.nome_canonico, c.categoria, c.categoria_id, c.unidade, c.tamanho,
             c.par_level, c.min_nivel, c.lead_time_dias, c.icone, c.ativo,
             COALESCE(SUM(e.qtd), 0) AS estoque
      FROM catalogo c
      LEFT JOIN eventos e ON e.catalogo_id = c.id
      WHERE c.ativo = true
      GROUP BY c.id, c.nome_canonico, c.categoria, c.categoria_id, c.unidade, c.tamanho,
               c.par_level, c.min_nivel, c.lead_time_dias, c.icone, c.ativo
    `);

    console.log('[migration-cat] Categorias criadas e produtos migrados com sucesso.');
  } catch (e) {
    console.warn('[migration-cat] Aviso (não fatal):', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => console.warn('[migration-cat] Erro:', e.message));
