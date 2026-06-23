# Estoque Inteligente

App de controle de estoque doméstico de consumíveis em **Cloudflare Workers + D1 + PWA**.
Hoje usado para produtos de limpeza, mas o modelo é genérico (qualquer consumível: cozinha, sapato, etc.).
Fase 1 (fundação) pronta para rodar. Próximas fases em `CLAUDE.md`.

## Pré-requisitos
- Node 18+
- Conta Cloudflare e `wrangler` (vem como devDependency)

## Setup local
```bash
npm install

# 1) Criar o banco D1 (uma vez) e colar o database_id em wrangler.toml
npx wrangler d1 create estoque

# 2) Criar schema + carregar os dados da planilha (local)
npm run db:init:local

# 3) Rodar
npm run dev
# abre em http://localhost:8787
```

## Deploy (produção)
```bash
# cria as tabelas no D1 remoto e popula
npm run db:init:remote

# publica o Worker + PWA
npm run deploy
```
Depois conecte o repositório ao GitHub e, se quiser, ative o deploy automático
(Workers Builds / Pages) apontando para a branch principal.

## Estrutura
```
migrations/   schema (0001) + seed da planilha (0002)
src/index.js  API (Hono) sobre D1
public/       PWA (index.html, sw.js, manifest, icon) — sem build
wrangler.toml binding do D1 e dos assets; cron (Fase 3) comentado
CLAUDE.md     especificação e roadmap para continuar no Claude Code
```

## Endpoints rápidos
- `GET /api/itens` · `POST /api/itens/:id/mov {delta}` · `GET /api/lista-compras`
- `PUT /api/itens/:id` · `POST /api/itens` · `GET /api/health`

## Estado atual
- ✅ Ledger de eventos, estoque derivado, situação (ok/atenção/comprar)
- ✅ PWA offline-first com fila de envio (outbox) e Modo dono
- ✅ Lista de compras com quantidade sugerida e custo estimado
- ⏳ Fase 2: leitura da nota fiscal (NFC-e/foto) — `POST /api/compras/nota` é stub
- ⏳ Fase 3: previsões, dashboard, e-mail automático (cron)
