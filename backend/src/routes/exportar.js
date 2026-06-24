const router = require('express').Router();
const pool = require('../db');
const { autenticar, exigirDono } = require('../middleware/auth');

// GET /api/exportar/movimentacoes?periodo=365
router.get('/movimentacoes', autenticar, exigirDono, async (req, res) => {
  const periodo = parseInt(req.query.periodo) || 365;
  try {
    const { rows } = await pool.query(`
      SELECT
        to_char(e.data AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS "Data",
        c.nome_canonico AS "Produto",
        COALESCE(c.categoria, '') AS "Categoria",
        CASE e.tipo WHEN 'uso' THEN 'Uso' WHEN 'compra' THEN 'Compra' ELSE 'Ajuste' END AS "Tipo",
        e.qtd AS "Quantidade",
        e.quem AS "Registrado por"
      FROM eventos e
      JOIN catalogo c ON c.id = e.catalogo_id
      WHERE e.data >= now() - (INTERVAL '1 day' * $1)
      ORDER BY e.data DESC
    `, [periodo]);
    res.json(rows);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// GET /api/exportar/compras?periodo=365
router.get('/compras', autenticar, exigirDono, async (req, res) => {
  const periodo = parseInt(req.query.periodo) || 365;
  try {
    const { rows } = await pool.query(`
      SELECT
        to_char(comp.data AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS "Data",
        COALESCE(comp.mercado, '') AS "Mercado",
        c.nome_canonico AS "Produto",
        COALESCE(c.categoria, '') AS "Categoria",
        ci.descricao_nota AS "Descricao nota",
        ci.qtd AS "Quantidade",
        ci.preco_unit AS "Preco unitario",
        CASE WHEN ci.preco_unit IS NOT NULL
          THEN ROUND((ci.qtd * ci.preco_unit)::numeric, 2) ELSE NULL END AS "Total"
      FROM compra_itens ci
      JOIN compras comp ON comp.id = ci.compra_id
      JOIN catalogo c ON c.id = ci.catalogo_id
      WHERE comp.data >= now() - (INTERVAL '1 day' * $1)
      ORDER BY comp.data DESC, comp.id, ci.id
    `, [periodo]);
    res.json(rows);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
