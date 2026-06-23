# Módulo de Compras — portabilidade para o panorama-patrimonio

Boa notícia: o projeto pessoal agora usa a **mesma stack** do panorama
(Express + PostgreSQL + SQL puro + JWT). Então o porte deixou de ser "reescrever" e
virou "copiar + ajustar nomes".

## Core (viaja) x App (específico)
| Camada | Arquivo | Porta? |
|---|---|---|
| Casamento de nota | `backend/src/modulo-compras/notas.js` | ✅ copiar como está (recebe `db` pg) |
| Schema (5 tabelas + view) | `backend/src/db/schema.sql` | ✅ anexar ao schema.sql do panorama, com prefixo `estoque_` |
| Regras estoque/lista | `routes/itens.js`, `routes/compras.js` | ◐ recriar como rota no padrão do host |
| Catálogo inicial | `db/seed.js` | ❌ trocar pelo do prédio |
| UI | `frontend/` | ❌ específico |

Regra de ouro: `modulo-compras/` NÃO importa Express nem conhece rotas. Só recebe `db.query`.

## Contrato (notas.js)
- `normalizar(txt)`; `casarItem(db, descricao, gtin?)` → {catalogo_id, confianca, score, sugestoes[]};
- `processarNota(db, {mercado, chave_nfce, origem, total, itens[]})` → {compra_id, aplicados[], pendentes[]};
- `confirmarItem(db, {compra_item_id, catalogo_id?|novo?, gtin?, aprender?})`;
- adaptadores `itensDaNFCe`, `itensDaFoto` (Fase 2) → itens[] no formato
  `{ descricao, qtd, preco_unit, gtin? }`.

## Achados do panorama-patrimonio (lido em 2026-06)
- Stack: Express + pg (SQL puro), JWT/bcrypt, rotas em `backend/src/routes/*.js` montadas em
  `index.js` (`app.use('/api/x', require('./routes/x'))`), middleware `autenticar` /
  `exigirPerfil(...)` / `registrarLog`.
- **Já tem a infra da Fase 2/3**: `tesseract.js` (OCR), `multer` (upload),
  `@aws-sdk/client-s3`→R2 (storage), `resend`/`nodemailer` (e-mail), `node-cron` (agendador).

## Plano de port (quando for a hora)
1. Anexar as 5 tabelas ao `schema.sql` do panorama com prefixo `estoque_` (SERIAL, TIMESTAMPTZ,
   BOOLEAN já são iguais; é só renomear). Ajustar os nomes de tabela dentro de uma cópia de notas.js.
2. Escopo: compras do prédio são de áreas comuns → começar **sem** apartamento_id; usar `setor` (texto) se precisar separar áreas.
3. Criar `backend/src/routes/compras.js` no padrão do host (`autenticar`, `exigirPerfil('sindico')`,
   `registrarLog`), montar em `index.js`. Adicionar chave `compras` em `permissoes`.
4. Reusar a infra existente: nota por foto → `routes/ocr.js`+tesseract (ou visão); upload → multer+`services/r2.js`;
   alerta semanal → novo job em `services/scheduler.js` + `services/email.js`.
5. Frontend: aba nova no padrão vanilla+Tailwind, reusando o JWT do localStorage.

O que é idêntico independente do host: ledger, regra de situação, ROP, lista por categoria, casamento por apelidos.
