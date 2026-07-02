// Registra uma entrada de estoque (compra) com transação própria.
// Se preco_unit for fornecido, cria compras + compra_itens + evento 'compra'.
// Se não, cria só o evento 'compra'.
const pool = require('./index');

const _situacao = (est, min) =>
  est <= min ? 'comprar' : (est <= min + 1 ? 'atencao' : 'ok');

async function registrarEntrada({ catalogo_id, qtd, preco_unit, mercado, quem }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let compra_id = null;
    if (preco_unit != null && preco_unit > 0) {
      const total = +(preco_unit * qtd).toFixed(2);
      const { rows: cr } = await client.query(
        `INSERT INTO compras (data, mercado, total, origem) VALUES (NOW(),$1,$2,'manual') RETURNING id`,
        [mercado || null, total]
      );
      compra_id = cr[0].id;
      const { rows: nc } = await client.query(
        `SELECT nome_canonico FROM catalogo WHERE id = $1`, [catalogo_id]
      );
      await client.query(
        `INSERT INTO compra_itens (compra_id, catalogo_id, descricao_nota, qtd, preco_unit)
         VALUES ($1,$2,$3,$4,$5)`,
        [compra_id, catalogo_id, nc[0]?.nome_canonico || null, qtd, preco_unit]
      );
    }
    await client.query(
      `INSERT INTO eventos (catalogo_id, tipo, qtd, quem${compra_id ? ', compra_id' : ''})
       VALUES ($1,'compra',$2,$3${compra_id ? ',$4' : ''})`,
      compra_id ? [catalogo_id, qtd, quem, compra_id] : [catalogo_id, qtd, quem]
    );
    const { rows } = await client.query(
      `SELECT estoque, min_nivel FROM v_estoque WHERE id = $1`, [catalogo_id]
    );
    await client.query('COMMIT');
    const est = Number(rows[0]?.estoque ?? 0);
    const min = rows[0]?.min_nivel ?? 1;
    return { ok: true, estoque: est, situacao: _situacao(est, min) };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { registrarEntrada };
