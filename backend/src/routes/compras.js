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

module.exports = router;
