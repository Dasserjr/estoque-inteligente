// Rotas de compras: lista de compras automática + ingestão de nota (Fase 2, esboço).
const router = require('express').Router();
const pool = require('../db');
const { autenticar, exigirDono } = require('../middleware/auth');
const { processarNota, confirmarItem, itensDaFoto } = require('../modulo-compras/notas');

// GET /api/compras/lista — itens no ponto de reposição, com qtd sugerida e custo estimado.
router.get('/lista', autenticar, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT v.id, v.nome_canonico, v.categoria, v.icone, v.estoque, v.min_nivel, v.par_level,
        (SELECT ci.preco_unit FROM compra_itens ci
         WHERE ci.catalogo_id = v.id AND ci.preco_unit IS NOT NULL
         ORDER BY ci.id DESC LIMIT 1) AS ultimo_preco
      FROM v_estoque v
      WHERE v.estoque <= v.min_nivel
      ORDER BY v.categoria, v.nome_canonico
    `);
    const itens = rows.map((r) => {
      const estoque = Number(r.estoque);
      const sugerida = Math.max(1, (r.par_level || r.min_nivel + 1) - estoque);
      const preco = r.ultimo_preco != null ? Number(r.ultimo_preco) : null;
      return { ...r, estoque, qtd_sugerida: sugerida, custo_estimado: preco != null ? +(preco * sugerida).toFixed(2) : null };
    });
    const total = itens.reduce((s, i) => s + (i.custo_estimado || 0), 0);
    res.json({ itens, total_estimado: +total.toFixed(2), gerado_em: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// GET /api/compras/gastos/mensal?ano=2026 — gastos mês a mês do ano (12 meses).
router.get('/gastos/mensal', autenticar, exigirDono, async (req, res) => {
  const ano = parseInt(req.query.ano) || new Date().getFullYear();
  try {
    const { rows } = await pool.query(`
      SELECT EXTRACT(MONTH FROM comp.data)::int AS mes,
             ROUND(SUM(ci.preco_unit * ci.qtd)::numeric, 2) AS total
      FROM compra_itens ci
      JOIN compras comp ON comp.id = ci.compra_id
      WHERE ci.preco_unit IS NOT NULL
        AND ci.catalogo_id IS NOT NULL
        AND EXTRACT(YEAR FROM comp.data) = $1
      GROUP BY EXTRACT(MONTH FROM comp.data)::int
      ORDER BY mes
    `, [ano]);
    const meses = Array.from({ length: 12 }, (_, i) => {
      const found = rows.find(r => r.mes === i + 1);
      return { mes: i + 1, total: found ? Number(found.total) : 0 };
    });
    res.json({ ano, meses, total_ano: +meses.reduce((s, m) => s + m.total, 0).toFixed(2) });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// GET /api/compras/gastos?periodo=30 — gastos por categoria no período.
router.get('/gastos', autenticar, exigirDono, async (req, res) => {
  const periodo = parseInt(req.query.periodo) || 30;
  if (![30, 90, 365].includes(periodo))
    return res.status(400).json({ erro: 'periodo deve ser 30, 90 ou 365' });
  try {
    const { rows } = await pool.query(`
      SELECT COALESCE(c.categoria, 'Sem categoria') AS categoria,
             ROUND(SUM(ci.preco_unit * ci.qtd)::numeric, 2) AS total
      FROM compra_itens ci
      JOIN compras comp ON comp.id = ci.compra_id
      JOIN catalogo c ON c.id = ci.catalogo_id
      WHERE comp.data >= now() - (INTERVAL '1 day' * $1)
        AND ci.preco_unit IS NOT NULL
      GROUP BY COALESCE(c.categoria, 'Sem categoria')
      ORDER BY total DESC
    `, [periodo]);
    const total = rows.reduce((s, r) => s + Number(r.total), 0);
    res.json({
      periodo,
      total: +total.toFixed(2),
      categorias: rows.map(r => ({ categoria: r.categoria, total: Number(r.total) }))
    });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// GET /api/compras/historico/:id — histórico de compras de um produto.
router.get('/historico/:id', autenticar, exigirDono, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ erro: 'id inválido' });
  try {
    const { rows } = await pool.query(`
      SELECT comp.data, comp.mercado, ci.descricao_nota, ci.qtd, ci.preco_unit
      FROM compra_itens ci
      JOIN compras comp ON comp.id = ci.compra_id
      WHERE ci.catalogo_id = $1
      ORDER BY comp.data DESC
      LIMIT 100
    `, [id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// POST /api/compras/foto — recebe imagem base64, extrai itens via IA e retorna sem salvar.
router.post('/foto', autenticar, exigirDono, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT valor FROM config WHERE chave = 'ia_ativa'`);
    if (rows[0]?.valor === 'false')
      return res.status(503).json({ erro: 'Leitura por IA está desativada. Ative em Meus Produtos → Configurações.' });
    const { imagem, mime = 'image/jpeg' } = req.body || {};
    if (!imagem) return res.status(400).json({ erro: 'campo "imagem" obrigatório (base64)' });
    const resultado = await itensDaFoto(imagem, mime);
    res.json(resultado);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// POST /api/compras/nota — recebe itens já extraídos e reabastece. (Fase 2)
// Body: { mercado?, chave_nfce?, origem?, total?, itens:[{descricao, qtd, preco_unit, gtin?}] }
router.post('/nota', autenticar, exigirDono, async (req, res) => {
  try {
    const r = await processarNota(pool, req.body || {});
    if (r.erro) return res.status(400).json(r);
    res.status(201).json(r);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// POST /api/compras/confirmar — confirma item pendente, aprende apelido e dá entrada. (Fase 2)
router.post('/confirmar', autenticar, exigirDono, async (req, res) => {
  try {
    const r = await confirmarItem(pool, req.body || {});
    if (r.erro) return res.status(400).json(r);
    res.json(r);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// POST /api/compras/confirmar-lote — confirma vários itens pendentes de uma vez (mesmo produto).
// aprender=true (padrão) só aprende apelido no primeiro item para evitar duplicatas.
router.post('/confirmar-lote', autenticar, exigirDono, async (req, res) => {
  const { compra_item_ids, catalogo_id, aprender = true } = req.body || {};
  if (!Array.isArray(compra_item_ids) || !compra_item_ids.length || !catalogo_id)
    return res.status(400).json({ erro: 'compra_item_ids (array) e catalogo_id são obrigatórios' });
  try {
    for (let i = 0; i < compra_item_ids.length; i++) {
      const r = await confirmarItem(pool, {
        compra_item_id: Number(compra_item_ids[i]),
        catalogo_id: Number(catalogo_id),
        aprender: aprender && i === 0,
      });
      if (r.erro) return res.status(400).json(r);
    }
    res.json({ ok: true, confirmados: compra_item_ids.length });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// DELETE /api/compras/item/:id — descarta item pendente; apaga a nota se ficar sem itens.
router.delete('/item/:id', autenticar, exigirDono, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ erro: 'id inválido' });
  try {
    const { rows } = await pool.query(
      `SELECT compra_id FROM compra_itens WHERE id = $1 AND catalogo_id IS NULL`, [id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'item pendente não encontrado' });
    const compra_id = rows[0].compra_id;
    await pool.query(`DELETE FROM compra_itens WHERE id = $1`, [id]);
    const { rows: rest } = await pool.query(
      `SELECT id FROM compra_itens WHERE compra_id = $1`, [compra_id]
    );
    if (!rest.length) await pool.query(`DELETE FROM compras WHERE id = $1`, [compra_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// DELETE /api/compras/nota/:id — descarta itens pendentes da nota; apaga a nota se ficar vazia.
router.delete('/nota/:id', autenticar, exigirDono, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ erro: 'id inválido' });
  try {
    await pool.query(
      `DELETE FROM compra_itens WHERE compra_id = $1 AND catalogo_id IS NULL`, [id]
    );
    const { rows } = await pool.query(`SELECT id FROM compra_itens WHERE compra_id = $1`, [id]);
    if (!rows.length) await pool.query(`DELETE FROM compras WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
