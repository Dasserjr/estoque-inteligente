require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();
app.set('trust proxy', 1);                  // atrás do proxy do Railway

app.use(helmet({ contentSecurityPolicy: false }));  // frontend usa CDN (Tailwind)
app.use(cors());                            // app doméstico; mesma origem na prática
app.use(express.json({ limit: '10mb' }));

// API
app.use('/api', require('./routes/auth'));          // POST /api/login
app.use('/api/itens', require('./routes/itens'));
app.use('/api/compras', require('./routes/compras'));
app.use('/api/push', require('./routes/push'));
app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

require('./services/scheduler').iniciarAgendador();

// Frontend estático (PWA) — servido pelo mesmo servidor, como no panorama.
const FRONT = path.resolve(__dirname, '../../frontend');
app.use(express.static(FRONT));
app.get('*', (req, res) => res.sendFile(path.join(FRONT, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Estoque Inteligente rodando em http://localhost:${PORT}`));
