require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
app.set('trust proxy', 1);                  // atrás do proxy do Railway

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'", "'unsafe-inline'"],
      scriptSrcAttr:  ["'unsafe-inline'"],
      styleSrc:       ["'self'", "'unsafe-inline'"],
      imgSrc:         ["'self'", "blob:", "data:"],
      connectSrc:     ["'self'"],
      fontSrc:        ["'self'"],
      objectSrc:      ["'none'"],
      frameAncestors: ["'none'"],
    }
  }
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { erro: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

// API
app.use('/api/login', loginLimiter);
app.use('/api', require('./routes/auth'));          // POST /api/login
app.use('/api/itens', require('./routes/itens'));
app.use('/api/categorias', require('./routes/categorias'));
app.use('/api/compras', require('./routes/compras'));
app.use('/api/push', require('./routes/push'));
app.use('/api/config', require('./routes/config'));
app.use('/api/exportar', require('./routes/exportar'));
const _pkg = require('../../package.json');
app.get('/api/versao', (req, res) => res.json({ versao: _pkg.version }));
app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

require('./services/scheduler').iniciarAgendador();

// Frontend estático (PWA) — servido pelo mesmo servidor, como no panorama.
const FRONT = path.resolve(__dirname, '../../frontend');
app.use(express.static(FRONT));
app.get('*', (req, res) => res.sendFile(path.join(FRONT, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Estoque Inteligente rodando em http://localhost:${PORT}`));
