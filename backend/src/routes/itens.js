// Rotas de itens/estoque. Toda escrita passa pelo ledger (tabela eventos).
const router = require('express').Router();
const pool = require('../db');
const { autenticar, exigirDono } = require('../middleware/auth');

const situacao = (estoque, min) =>
  estoque <= min ? 'comprar' : (estoque <= min + 1 ? 'atencao' : 'ok');

// GET /api/itens — itens com estoque, situação, consumo 28d e dias de cobertura.
router.get('/', autenticar, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT v.*,
        COALESCE((SELECT -SUM(e.qtd) FROM eventos e
                  WHERE e.catalogo_id = v.id AND e.tipo = 'uso'
                  AND e.data >= now() - interval '28 days'), 0) AS uso_28d
      FROM v_estoque v
      ORDER BY v.nome_canonico
    `);
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

// POST /api/itens/:id/mov  { delta, quem } — registra evento (coração do app).
router.post('/:id/mov', autenticar, async (req, res) => {
  const id = Number(req.params.id);
  const delta = Number(req.body && req.body.delta);
  if (!id || !delta) return res.status(400).json({ erro: 'delta inválido' });
  const tipo = delta < 0 ? 'uso' : 'compra';
  const quem = (req.body && req.body.quem) || req.usuario.perfil || 'empregada';
  try {
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
    const { rows } = await pool.query(
      `INSERT INTO catalogo (nome_canonico, categoria, unidade, tamanho, par_level, min_nivel, icone)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [b.nome_canonico, b.categoria || null, b.unidade || 'un', b.tamanho || '',
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
  const campos = ['nome_canonico','categoria','unidade','tamanho','par_level','min_nivel','lead_time_dias','setor','icone','ativo'];
  const sets = [], vals = [];
  let i = 1;
  for (const k of campos) if (k in b) { sets.push(`${k} = $${i++}`); vals.push(b[k]); }
  if (!sets.length) return res.status(400).json({ erro: 'nada para atualizar' });
  vals.push(id);
  try {
    await pool.query(`UPDATE catalogo SET ${sets.join(', ')} WHERE id = $${i}`, vals);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
