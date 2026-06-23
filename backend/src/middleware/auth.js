// Auth mínimo, no MESMO formato do panorama-patrimonio (autenticar via Bearer JWT),
// para facilitar o reaproveitamento. Hoje: 1 senha por papel (dono/empregada).
// Amanhã: trocar por tabela de usuários + bcrypt sem mudar as rotas.
const jwt = require('jsonwebtoken');

function gerarToken(perfil) {
  return jwt.sign({ perfil }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
}

function autenticar(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token não fornecido.' });
  }
  try {
    req.usuario = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

// Só o dono pode mexer em catálogo/parâmetros/compras. (Espelha exigirPerfil.)
function exigirDono(req, res, next) {
  if (!req.usuario) return res.status(401).json({ erro: 'Não autenticado.' });
  if (req.usuario.perfil === 'dono') return next();
  return res.status(403).json({ erro: 'Apenas o dono pode fazer isto.' });
}

module.exports = { gerarToken, autenticar, exigirDono };
