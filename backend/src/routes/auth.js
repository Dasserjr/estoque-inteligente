// Login mínimo: uma senha por papel. Retorna um JWT.
const router = require('express').Router();
const { gerarToken } = require('../middleware/auth');

// POST /api/login  { senha }
router.post('/login', (req, res) => {
  const senha = (req.body && req.body.senha) || '';
  let perfil = null;
  if (process.env.SENHA_DONO && senha === process.env.SENHA_DONO) perfil = 'dono';
  else if (process.env.SENHA_EMPREGADA && senha === process.env.SENHA_EMPREGADA) perfil = 'empregada';

  if (!perfil) return res.status(401).json({ erro: 'Senha incorreta.' });
  return res.json({ token: gerarToken(perfil), perfil });
});

module.exports = router;
