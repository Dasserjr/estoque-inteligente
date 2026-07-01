# Estoque Inteligente — guia para o agente de código

## LEITURA OBRIGATÓRIA AO INICIAR QUALQUER SESSÃO

Antes de qualquer outra ação, leia integralmente:
1. `docs/DIRETRIZES_UNIVERSAIS_CLAUDE_CODE_v3.0.md`
2. Este arquivo (`CLAUDE.md`)
3. O apêndice do projeto, se existir (`docs/APENDICE_ESTOQUE.md`)

Após a leitura, confirme ao Dasser com a frase exata:
**"Diretrizes universais lidas. CLAUDE.md lido. Pronto para a tarefa. Apresento o plano?"**

Não prossiga sem emitir essa confirmação.

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

## Premissas do modelo
- **Tudo unitário**: menor fração de uso. Comprou um fardo de 12 panos → entra como 12 unidades.
- **Nome canônico inclui medida**: "Sabão Barra 90g", não só "Sabão Barra". Facilita compra.
- **Mínimo padrão = 1**: pilar "nunca deixar acabar". Mínimo 0 é permitido para produtos de grande rendimento ou uso esporádico — entra na lista só quando o último for aberto. Ideal sempre ≥ 1.
- **Produto aberto não conta**: estoque = unidades fechadas/inteiras na prateleira. O item em uso não é reserva; a reposição deve ocorrer antes de ele acabar.
- **Padrão ao cadastrar**: mínimo 1, ideal 2. Ajustável depois em Meus Produtos.

## Stack
- **Express** + **PostgreSQL** (driver `pg`, SQL puro) — `backend/`.
- **JWT** (auth mínimo: 1 senha por papel; ver middleware/auth.js).
- **PWA** estático em `frontend/` (HTML/CSS/JS puro, sem build), servido pelo Express.
- Convenções: rotas `require('express').Router()`, `pool.query(sql,$1)`,
  respostas de erro `{ erro }`, middleware `autenticar`/`exigirDono`.

## Modelo de dados (backend/src/db/schema.sql)
- `catalogo` — par_level=ideal, min_nivel=reposição, setor, lead_time_dias (default 7)
- `apelidos` — texto_na_nota, gtin → resolve variações de nome na nota fiscal
- `eventos` — ledger imutável de todo movimento
- `compras` + `compra_itens` — histórico de compras com preço unitário
- `config` — chave/valor para configurações persistentes (ex: ia_ativa)
- `push_subscriptions` — criada em runtime por `ensureTable()` em push.js
- view `v_estoque` — estoque atual por produto (SUM de eventos)

## API completa

### Auth
- `POST /api/login {senha}` → `{ token, perfil }` (perfil = dono | empregada)
- `GET /api/versao` → versão do package.json

### Itens / Estoque
- `GET /api/itens` — lista com situação (ok|atencao|comprar), consumo 28d, dias_cobertura
- `GET /api/itens/todos` (exigirDono) — todos os produtos ativos e inativos, com total_compras e ultima_compra
- `POST /api/itens` (exigirDono) — cria produto; bloqueia nome duplicado (case-insensitive, retorna 409)
- `PUT /api/itens/:id` (exigirDono) — atualiza campos do catálogo (incluindo ativo)
- `DELETE /api/itens/:id` (exigirDono) — exclui produto sem histórico; retorna 409 se tiver eventos ou compras
- `POST /api/itens/:id/mov {delta, quem}` — registra evento (coração do app)

Regra de situação (manter igual no front e back): `estoque <= min_nivel` → comprar; `<= min_nivel+1` → atencao.

### Compras
- `GET /api/compras/lista` — itens no ponto de reposição com qtd sugerida e custo estimado
- `GET /api/compras/historico/:id` (exigirDono) — histórico de compras de um produto
- `GET /api/compras/gastos?periodo=30` (exigirDono) — gasto total por categoria no período (30|90|365 dias)
- `GET /api/compras/gastos/mensal?ano=2026` (exigirDono) — gasto mês a mês do ano (12 meses, zeros incluídos)
- `POST /api/compras/foto {imagem, mime}` (exigirDono) — envia foto base64, retorna itens extraídos pela IA
- `POST /api/compras/nota` (exigirDono) — processa itens extraídos, casa com catálogo, registra pendentes
- `POST /api/compras/confirmar` (exigirDono) — confirma item pendente, aprende apelido, dá entrada no estoque

### Exportação
- `GET /api/exportar/movimentacoes?periodo=365` (exigirDono) — ledger completo (Data, Produto, Categoria, Tipo, Quantidade, Registrado por)
- `GET /api/exportar/compras?periodo=365` (exigirDono) — histórico de compras (Data, Mercado, Produto, Categoria, Descrição nota, Quantidade, Preço unitário, Total)

### Configuração
- `GET /api/config` (autenticar) → `{ ia_ativa: boolean }`
- `POST /api/config/ia` (exigirDono) → `{ ativo: boolean }` — liga/desliga leitura de nota por IA

### Push notifications
- `GET /api/push/vapid-key` — chave pública VAPID para o frontend
- `POST /api/push/subscribe` (autenticar) — registra subscription
- `POST /api/push/testar` (autenticar) — dispara notificação de teste

## Variáveis de ambiente obrigatórias
Ver `backend/.env` (local) e painel Railway (produção):
- `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `SENHA_DONO`, `SENHA_EMPREGADA`, `PORT`, `NODE_ENV`
- `ANTHROPIC_API_KEY` — chave da API Claude para leitura de fotos e geração de nome canônico (Claude Haiku)
- `AI_PROVIDER` — provedor de IA (`claude`; extensível)
- `COSMOS_API_KEY` — chave da API Cosmos Bluesoft para lookup de GTIN no scanner (opcional; sem ela usa Open Food Facts)
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` — push notifications
- `RESEND_API_KEY` — e-mail semanal via Resend
- `EMAIL_DONO` — endereço do dono para resumo semanal
- `FRONTEND_URL` — URL pública do app (usado no redirect ao clicar na notificação push)

## modulo-compras/ — núcleo portável
`notas.js` é AGNÓSTICO: recebe `db` (interface pg), não importa Express nem conhece rotas.
Funções: `normalizar`, `casarItem` (gtin > apelido > fuzzy tolerante a abreviações),
`processarNota`, `confirmarItem`, `itensDaFoto` (delega a `src/ai/foto.js`).
`src/ai/foto.js` — chama Claude Haiku com imagem base64, extrai JSON de itens.

## Automações (backend/src/services/)
- `scheduler.js` — cron jobs: sexta 12h BRT → push para Delzita; sexta 18h BRT → e-mail para o dono
- `push.js` — gerencia subscriptions, envia push para todos os dispositivos registrados
- `email.js` — monta e envia e-mail HTML com consumo semanal e situação do estoque via Resend

## Frontend — telas do dono (rodapé)
- **🔑 Modo dono** — ajusta mínimo/ideal de cada produto; abre modal com linhas editáveis
- **📷 Nota fiscal** — fluxo em 3 passos: foto → revisão → resultado
- **📦 Meus Produtos** — lista de ativos e inativos, edição completa, histórico por produto, toggle de IA
- **💰 Gastos** — gasto por categoria com seletor de período (30d/3m/12m) e gráfico anual Jan–Dez
- **📊 Relatórios** — dados na tela em acordeão: 4 seções colapsáveis (Estoque, Movimentações, Compras, Gastos), filtro por coluna em tempo real, botão imprimir via `window.print()` sem biblioteca externa
- **📷 Escanear** — cadastro por código de barras (Fase A); ver seção específica abaixo

## Scanner de código de barras — Fase A (v1.7.x)

### Rotas
- `GET /api/escanear/lookup?gtin=XXX` (autenticar + exigirDono) — verifica apelidos/GTIN no banco → Cosmos Bluesoft → Open Food Facts; retorna `{ encontrado, existente, produto | externo }`
- `POST /api/escanear/cadastrar` (autenticar + exigirDono) — transação: `catalogo` + `apelidos` (gtin, fonte='escanear') + evento (`'compra'` com `compra_itens` se preço; `'ajuste'` se sem preço)

### Arquivos
- `backend/src/routes/escanear.js` — lógica completa de lookup e cadastro
- `frontend/lib/zxing.min.js` — ZXing @0.19.2 (285 KB), carregado lazily ao abrir o modal

### Decisões de arquitetura
- **Nome canônico via Haiku**: a descrição Cosmos é enviada ao `claude-haiku-4-5-20251001` com prompt few-shot; retorna `{nome, tamanho, multiplo}`. Fallback: regex + title case se Haiku indisponível.
- **`multiplo` é efêmero**: quantidade de unidades por embalagem (C/5, 12UN etc.) é extraída a cada escaneamento pelo Haiku e usada apenas no formulário para multiplicar a quantidade. **Não é armazenada no catálogo.** Troca de capacidade de embalagem pela indústria é captada automaticamente no próximo scan.
- **Cosmos API**: exige `User-Agent: 'Cosmos-API-Request'` (string exata) e `X-Cosmos-Token`. Sem `COSMOS_API_KEY`, usa Open Food Facts como único lookup.
- **GTIN em apelidos**: `apelidos.gtin` (índice não-único), `texto_na_nota` recebe o nome canônico (satisfaz NOT NULL), `fonte = 'escanear'`.

## Roadmap e status das fases

| Fase | Status | Descrição |
|------|--------|-----------|
| Fase 1 | ✅ Completa | Ledger, login, PWA, offline, automações semanais |
| Fase 2 | ✅ Completa | Foto por IA, confirmação em 3 passos, apelidos aprendidos |
| Fase 3.1 | ✅ Completa | "Acaba em ~X dias" na lista principal |
| Fase 3.3 | ✅ Completa | Gasto por categoria + gráfico anual |
| Fase 3.2 | ❌ Fora do escopo | ROP dinâmico (alerta por consumo × lead_time) |
| Fase 3.4 | ❌ Fora do escopo | Alerta diário de ruptura por push/e-mail |
| Relatórios | ✅ Completa | Acordeão on-screen com filtros e impressão (v1.4.0) |
| Fase A scanner | ✅ Completa | Cadastro por código de barras — Cosmos/OFF + Haiku + embalagens múltiplas (v1.7.x) |
| Fase B scanner | ⏳ Pendente | Preço via API Mercado Livre (hoje abre browser) |
| Fase C scanner | ⏳ Pendente | GTIN já cadastrado → tela de entrada de estoque direta |

### Pendentes / evolutivas (sem prazo)
- Exportação Excel — removida do escopo em v1.4.0; infraestrutura de rotas `/api/exportar` já existe
- Adaptador NFC-e por QR code (alternativa à foto para entrada de nota)
- Gasto por produto (detalhar dentro da tela de Gastos)
- ROP dinâmico e alerta diário — infraestrutura pronta (`lead_time_dias`, `dias_cobertura`), lógica não implementada por decisão do dono
- D3 — verificação de domínio no Resend (ação externa de DNS, fora do código)

## Reaproveitamento (panorama-patrimonio)
Mesma stack → porte = copiar modulo-compras/, prefixar tabelas com estoque_, criar rota
Express no padrão de lá. Ver docs/MODULO-COMPRAS.md.
