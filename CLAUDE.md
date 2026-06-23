# Estoque Inteligente — guia para o agente de código

## O que é
Controle de estoque doméstico de consumíveis em geral (hoje produtos de limpeza, mas o
modelo é agnóstico: cozinha, açúcar, cera de sapato...). Dois usuários:
- **empregada**: marca consumo no app. UI grande, simples, offline, à prova de erro.
- **dono**: mantém catálogo, confere a lista, recebe alertas.
Filosofia: nunca deixar acabar (repor ao atingir o mínimo) e registrar histórico p/ análise.

## Princípio inegociável: ledger, não contador
Estoque = SOMA dos eventos (`SELECT SUM(qtd) FROM eventos`). Todo movimento é um evento
imutável (uso negativo, compra positivo, ajuste). NUNCA trocar por um campo "quantidade"
mutável no catálogo — é isso que destrava previsão, tendência e gasto.

## Stack (igual à do panorama-patrimonio, de propósito)
- **Express** + **PostgreSQL** (driver `pg`, SQL puro) — `backend/`.
- **JWT** (auth mínimo: 1 senha por papel; ver middleware/auth.js).
- **PWA** estático em `frontend/` (HTML/CSS/JS puro, sem build), servido pelo Express.
- Convenções espelham o panorama: rotas `require('express').Router()`, `pool.query(sql,$1)`,
  respostas de erro `{ erro }`, middleware `autenticar`/`exigirDono`.

## Modelo de dados (backend/src/db/schema.sql)
`catalogo` (par_level=ideal, min_nivel=reposição, setor=escopo opcional) · `apelidos`
(texto_na_nota, gtin → resolve variações) · `eventos` (ledger) · `compras` + `compra_itens`
(histórico de preço) · view `v_estoque`.

## API (Fase 1 pronta)
- `POST /api/login {senha}` → { token, perfil } (perfil = dono | empregada).
- `GET /api/itens` (situação ok|atencao|comprar, consumo 28d, dias de cobertura).
- `POST /api/itens/:id/mov {delta}` (registra evento). `POST/PUT /api/itens` (exigirDono).
- `GET /api/compras/lista` (no ponto de reposição, qtd sugerida + custo estimado).
- `POST /api/compras/nota` e `/confirmar` (Fase 2 — usam modulo-compras/notas.js).
Regra de situação (manter igual no front e back): estoque<=min → comprar; <=min+1 → atencao.

## modulo-compras/ — núcleo portável
`notas.js` é AGNÓSTICO: recebe `db` (interface pg), não importa Express nem conhece rotas.
Funções: normalizar, casarItem (gtin>apelido>fuzzy tolerante a abreviações), processarNota,
confirmarItem. Adaptadores itensDaNFCe/itensDaFoto são stubs da Fase 2. Não acoplar a Express.

## Roadmap
- Fase 2: adaptadores de entrada (foto por IA como padrão; NFC-e por QR depois), tela de
  confirmação dos pendentes, aprendizado de apelidos. Confirmar SEMPRE antes de dar entrada.
- Fase 3: ROP dinâmico (consumo*lead_time), previsão de ruptura, gasto por categoria,
  alerta automático (cron + e-mail).

## Reaproveitamento (panorama-patrimonio)
Mesma stack → porte = copiar modulo-compras/, prefixar tabelas com estoque_, e criar uma rota
Express no padrão de lá. Ver MODULO-COMPRAS.md.
