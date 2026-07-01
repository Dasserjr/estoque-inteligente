const router = require('express').Router();
const pool = require('../db');
const { autenticar, exigirDono } = require('../middleware/auth');

// GET /api/categorias
router.get('/', autenticar, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM categorias ORDER BY ordem, nome');
    res.json(rows);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// POST /api/categorias
router.post('/', autenticar, exigirDono, async (req, res) => {
  const { nome, icone = '📦', ordem = 0 } = req.body || {};
  if (!nome) return res.status(400).json({ erro: 'nome obrigatório' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO categorias (nome, icone, ordem) VALUES ($1,$2,$3) RETURNING *`,
      [nome.trim(), icone.trim() || '📦', Number(ordem) || 0]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ erro: 'Já existe uma categoria com este nome.' });
    res.status(500).json({ erro: e.message });
  }
});

// PUT /api/categorias/:id
router.put('/:id', autenticar, exigirDono, async (req, res) => {
  const id = Number(req.params.id);
  const { nome, icone, ordem } = req.body || {};
  const sets = [], vals = [];
  let i = 1;
  if (nome  !== undefined) { sets.push(`nome  = $${i++}`); vals.push(nome.trim()); }
  if (icone !== undefined) { sets.push(`icone = $${i++}`); vals.push(icone.trim() || '📦'); }
  if (ordem !== undefined) { sets.push(`ordem = $${i++}`); vals.push(Number(ordem) || 0); }
  if (!sets.length) return res.status(400).json({ erro: 'nada para atualizar' });
  vals.push(id);
  try {
    await pool.query(`UPDATE categorias SET ${sets.join(', ')} WHERE id = $${i}`, vals);
    // Sincroniza o campo texto em catalogo
    if (nome !== undefined) {
      await pool.query(
        `UPDATE catalogo SET categoria = $1 WHERE categoria_id = $2`,
        [nome.trim(), id]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ erro: 'Já existe uma categoria com este nome.' });
    res.status(500).json({ erro: e.message });
  }
});

// DELETE /api/categorias/:id
router.delete('/:id', autenticar, exigirDono, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) FROM catalogo WHERE categoria_id = $1`, [id]
    );
    if (Number(rows[0].count) > 0)
      return res.status(409).json({ erro: 'Categoria tem produtos vinculados. Mova os produtos antes de excluir.' });
    await pool.query('DELETE FROM categorias WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
