# Estoque Inteligente

Controle de estoque doméstico de consumíveis. Hoje usado para produtos de limpeza,
mas o modelo é genérico (qualquer item que se gasta e se repõe).

**Stack:** Express + PostgreSQL (SQL puro) + JWT, PWA em HTML/JS puro.
Mesma stack do projeto panorama-patrimonio, para o módulo de compras ser reaproveitável.

## Estrutura
```
backend/
  src/
    index.js            servidor Express (serve a API e o frontend)
    db/{index.js, schema.sql, seed.js}
    middleware/auth.js  autenticar + exigirDono (JWT)
    routes/{auth,itens,compras}.js
    modulo-compras/notas.js   núcleo agnóstico (casamento de nota) — portável
frontend/               PWA (index.html, sw.js, manifest, icon)
```

## Rodar (resumo — passo a passo completo em docs/GUIA-INICIO.md)
```bash
cd backend && npm install && cd ..
cp backend/.env.example backend/.env     # preencha DATABASE_URL, JWT_SECRET, senhas
npm run seed                              # cria tabelas + popula catálogo
npm run dev                               # http://localhost:3000
```

## Endpoints
- `POST /api/login {senha}` → { token, perfil }
- `GET /api/itens` · `POST /api/itens/:id/mov {delta}` · `POST/PUT /api/itens` (dono)
- `GET /api/compras/lista` · `POST /api/compras/nota` (Fase 2) · `POST /api/compras/confirmar`

## Estado
- ✅ Fase 1: ledger de eventos, estoque derivado, situação, lista de compras, PWA offline + login.
- ⏳ Fase 2: leitura da nota (NFC-e/foto) — `modulo-compras/notas.js` tem o esboço.
- ⏳ Fase 3: previsões, dashboard, alerta automático.

Ver CLAUDE.md (convenções/roadmap) e docs/MODULO-COMPRAS.md (portabilidade p/ o prédio).
