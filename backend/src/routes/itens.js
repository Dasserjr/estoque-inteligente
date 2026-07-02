// Rotas de itens/estoque. Toda escrita passa pelo ledger (tabela eventos).
const router = require('express').Router();
const pool = require('../db');
const { autenticar, exigirDono } = require('../middleware/auth');
const { registrarEntrada } = require('../db/movimentar');

const situacao = (estoque, min) =>
  estoque <= min ? 'comprar' : (estoque <= min + 1 ? 'atencao' : 'ok');

// GET /api/itens/todos — todos os produtos (ativos + inativos), com contagem de compras.
router.get('/todos', autenticar, exigirDono, async (req, res) => {
  try {
    let rows;
    try {
      const r = await pool.query(`
        SELECT c.*, cat.nome AS categoria_nome, cat.icone AS categoria_icone,
          COALESCE(SUM(e.qtd), 0) AS estoque,
          COUNT(DISTINCT ci.compra_id) AS total_compras,
          MAX(comp.data) AS ultima_compra
        FROM catalogo c
        LEFT JOIN categorias cat ON cat.id = c.categoria_id
        LEFT JOIN eventos e ON e.catalogo_id = c.id
        LEFT JOIN compra_itens ci ON ci.catalogo_id = c.id
        LEFT JOIN compras comp ON comp.id = ci.compra_id
        GROUP BY c.id, cat.nome, cat.icone, cat.ordem
        ORDER BY c.ativo DESC, COALESCE(cat.ordem, 999), c.nome_canonico
      `);
      rows = r.rows;
    } catch {
      const r = await pool.query(`
        SELECT c.*,
          COALESCE(SUM(e.qtd), 0) AS estoque,
          COUNT(DISTINCT ci.compra_id) AS total_compras,
          MAX(comp.data) AS ultima_compra
        FROM catalogo c
        LEFT JOIN eventos e ON e.catalogo_id = c.id
        LEFT JOIN compra_itens ci ON ci.catalogo_id = c.id
        LEFT JOIN compras comp ON comp.id = ci.compra_id
        GROUP BY c.id
        ORDER BY c.ativo DESC, c.nome_canonico
      `);
      rows = r.rows;
    }
    res.json(rows.map(r => ({ ...r, estoque: Number(r.estoque), total_compras: Number(r.total_compras) })));
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// GET /api/itens — itens com estoque, situação, consumo 28d e dias de cobertura.
router.get('/', autenticar, async (req, res) => {
  try {
    let rows;
    try {
      // Query completa com categorias (requer migration-categorias aplicada)
      const r = await pool.query(`
        SELECT v.*, cat.nome AS categoria_nome, cat.icone AS categoria_icone,
          COALESCE((SELECT -SUM(e.qtd) FROM eventos e
                    WHERE e.catalogo_id = v.id AND e.tipo = 'uso'
                    AND e.data >= now() - interval '28 days'), 0) AS uso_28d
        FROM v_estoque v
        LEFT JOIN catalogo c ON c.id = v.id
        LEFT JOIN categorias cat ON cat.id = c.categoria_id
        ORDER BY COALESCE(cat.ordem, 999), v.nome_canonico
      `);
      rows = r.rows;
    } catch {
      // Fallback: tabela categorias ou coluna categoria_id ainda não disponível
      const r = await pool.query(`
        SELECT v.*,
          COALESCE((SELECT -SUM(e.qtd) FROM eventos e
                    WHERE e.catalogo_id = v.id AND e.tipo = 'uso'
                    AND e.data >= now() - interval '28 days'), 0) AS uso_28d
        FROM v_estoque v
        ORDER BY v.nome_canonico
      `);
      rows = r.rows;
    }
    const itens = rows.map((r) => {
      const estoque = Number(r.estoque);
      const uso28 = Number(r.uso_28d);
      const consumoDia = uso28 / 28;
      return {
        ...r,
        estoque,
        situacao: situacao(estoque, r.min_nivel),
        consumo_semana: +(uso28 / 4).toFixed(2),
        dias_cobertura: consumoDia > 0 ? Math.round(estoque / consumoDia) : null,
      };
    });
    res.json(itens);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// POST /api/itens/:id/mov  { delta, quem, preco_unit?, mercado? } — registra evento.
// Se delta > 0 e preco_unit fornecido, cria compras + compra_itens (visível em Gastos).
router.post('/:id/mov', autenticar, async (req, res) => {
  const id = Number(req.params.id);
  const delta = Number(req.body && req.body.delta);
  if (!id || !delta) return res.status(400).json({ erro: 'delta inválido' });
  const quem = (req.body && req.body.quem) || req.usuario.perfil || 'empregada';
  try {
    if (delta > 0 && req.body.preco_unit) {
      const r = await registrarEntrada({
        catalogo_id: id, qtd: delta,
        preco_unit: Number(req.body.preco_unit),
        mercado: req.body.mercado || null,
        quem,
      });
      return res.json({ id, estoque: r.estoque, situacao: r.situacao });
    }
    const tipo = delta < 0 ? 'uso' : 'compra';
    await pool.query(
      `INSERT INTO eventos (catalogo_id, tipo, qtd, quem) VALUES ($1,$2,$3,$4)`,
      [id, tipo, delta, quem]
    );
    const { rows } = await pool.query(
      `SELECT estoque, min_nivel FROM v_estoque WHERE id = $1`, [id]
    );
    const estoque = Number(rows[0]?.estoque ?? 0);
    res.json({ id, estoque, situacao: situacao(estoque, rows[0]?.min_nivel ?? 1) });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// POST /api/itens — cria produto (só dono).
router.post('/', autenticar, exigirDono, async (req, res) => {
  const b = req.body || {};
  if (!b.nome_canonico) return res.status(400).json({ erro: 'nome obrigatório' });
  try {
    const { rows: dup } = await pool.query(
      `SELECT nome_canonico FROM catalogo WHERE LOWER(nome_canonico) = LOWER($1) LIMIT 1`,
      [b.nome_canonico]
    );
    if (dup.length)
      return res.status(409).json({ erro: `Já existe um produto com este nome: "${dup[0].nome_canonico}". Se for tamanho diferente, inclua a medida no nome (ex: "Sabão Barra 90g" e "Sabão Barra 200g").` });
    let categoriaTexto = b.categoria || null;
    if (b.categoria_id) {
      const { rows: cr } = await pool.query('SELECT nome FROM categorias WHERE id = $1', [b.categoria_id]);
      if (cr[0]) categoriaTexto = cr[0].nome;
    }
    const { rows } = await pool.query(
      `INSERT INTO catalogo (nome_canonico, categoria, categoria_id, unidade, tamanho, par_level, min_nivel, icone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [b.nome_canonico, categoriaTexto, b.categoria_id || null, b.unidade || 'un', b.tamanho || '',
       b.par_level ?? 1, b.min_nivel ?? 1, b.icone || '🧴']
    );
    const id = rows[0].id;
    if (b.estoque_inicial) {
      await pool.query(
        `INSERT INTO eventos (catalogo_id, tipo, qtd, quem) VALUES ($1,'ajuste',$2,'dono')`,
        [id, Number(b.estoque_inicial)]
      );
    }
    res.status(201).json({ id });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// PUT /api/itens/:id — atualiza parâmetros (só dono).
router.put('/:id', autenticar, exigirDono, async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const campos = ['nome_canonico','categoria','categoria_id','unidade','tamanho','par_level','min_nivel','lead_time_dias','setor','icone','ativo'];
  const sets = [], vals = [];
  let i = 1;
  for (const k of campos) if (k in b) { sets.push(`${k} = $${i++}`); vals.push(b[k]); }
  if (!sets.length) return res.status(400).json({ erro: 'nada para atualizar' });
  if (b.nome_canonico) {
    const { rows: dup } = await pool.query(
      `SELECT id FROM catalogo WHERE LOWER(nome_canonico) = LOWER($1) AND id <> $2 LIMIT 1`,
      [b.nome_canonico, id]
    );
    if (dup.length)
      return res.status(409).json({ erro: `Já existe um produto com este nome: "${b.nome_canonico}".` });
  }
  // Quando categoria_id é enviado, sincroniza o campo texto categoria
  if ('categoria_id' in b && b.categoria_id) {
    const { rows: cr } = await pool.query('SELECT nome FROM categorias WHERE id = $1', [b.categoria_id]);
    if (cr[0] && !('categoria' in b)) { sets.push(`categoria = $${i++}`); vals.push(cr[0].nome); }
  }
  vals.push(id);
  try {
    await pool.query(`UPDATE catalogo SET ${sets.join(', ')} WHERE id = $${i}`, vals);
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23505')
      return res.status(409).json({ erro: 'Já existe um produto com este nome.' });
    res.status(500).json({ erro: e.message });
  }
});

// DELETE /api/itens/:id — exclui produto sem histórico (só dono).
router.delete('/:id', autenticar, exigirDono, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ erro: 'id inválido' });
  try {
    const { rows: evs } = await pool.query('SELECT COUNT(*) FROM eventos WHERE catalogo_id = $1', [id]);
    if (Number(evs[0].count) > 0)
      return res.status(409).json({ erro: 'Produto tem movimentações registradas e não pode ser excluído. Use a opção inativar.' });
    const { rows: cis } = await pool.query('SELECT COUNT(*) FROM compra_itens WHERE catalogo_id = $1', [id]);
    if (Number(cis[0].count) > 0)
      return res.status(409).json({ erro: 'Produto tem histórico de compras e não pode ser excluído. Use a opção inativar.' });
    await pool.query('DELETE FROM catalogo WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
