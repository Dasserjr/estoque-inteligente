const router = require('express').Router();
const pool = require('../db');
const { autenticar, exigirDono } = require('../middleware/auth');

async function ensureConfigTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)`);
  await pool.query(`INSERT INTO config (chave, valor) VALUES ('ia_ativa','true') ON CONFLICT DO NOTHING`);
}
ensureConfigTable().catch(e => console.error('config ensureTable:', e.message));

// GET /api/config — retorna configurações atuais.
router.get('/', autenticar, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT chave, valor FROM config');
    const cfg = {};
    rows.forEach(r => {
      cfg[r.chave] = r.valor === 'true' ? true : r.valor === 'false' ? false : r.valor;
    });
    res.json(cfg);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// POST /api/config/ia { ativo: boolean } — ativa ou desativa a IA.
router.post('/ia', autenticar, exigirDono, async (req, res) => {
  const { ativo } = req.body || {};
  if (typeof ativo !== 'boolean') return res.status(400).json({ erro: 'campo ativo (boolean) obrigatório' });
  try {
    await pool.query(`UPDATE config SET valor = $1 WHERE chave = 'ia_ativa'`, [String(ativo)]);
    res.json({ ia_ativa: ativo });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
