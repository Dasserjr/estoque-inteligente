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

## API (Fases 1 e 2 implementadas)
- `POST /api/login {senha}` → { token, perfil } (perfil = dono | empregada).
- `GET /api/itens` (situação ok|atencao|comprar, consumo 28d, dias de cobertura).
- `POST /api/itens/:id/mov {delta}` (registra evento). `POST/PUT /api/itens` (exigirDono).
- `GET /api/compras/lista` (no ponto de reposição, qtd sugerida + custo estimado).
- `POST /api/compras/nota` e `/confirmar` (processam nota: casa itens, registra pendentes).
- `POST /api/compras/foto {imagem, mime}` (exigirDono) — envia foto em base64, retorna itens extraídos pela IA.
- `GET /api/versao` — retorna versão do package.json para exibição no frontend.
- `GET /api/push/vapid-key` — chave pública VAPID para o frontend.
- `POST /api/push/subscribe` (autenticar) — registra subscription de push notification.
- `POST /api/push/testar` (autenticar) — dispara notificação de teste imediata.
Regra de situação (manter igual no front e back): estoque<=min → comprar; <=min+1 → atencao.

## Variáveis de ambiente obrigatórias
Ver `backend/.env` (local) e painel Railway (produção):
- `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `SENHA_DONO`, `SENHA_EMPREGADA`, `PORT`, `NODE_ENV`
- `ANTHROPIC_API_KEY` — chave da API Claude para leitura de fotos.
- `AI_PROVIDER` — provedor de IA (valor: `claude`; extensível).
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` — para push notifications.
- `RESEND_API_KEY` — para e-mail semanal via Resend.
- `EMAIL_DONO` — endereço do dono para receber o resumo semanal.
- `FRONTEND_URL` — URL pública do app (usado nas notificações push para redirecionar ao clicar).

## Tabelas adicionais (criadas em runtime)
`push_subscriptions` — criada automaticamente ao iniciar o servidor (`ensureTable()` em push.js).
Campos: endpoint, p256dh, auth, criado_em.

## modulo-compras/ — núcleo portável
`notas.js` é AGNÓSTICO: recebe `db` (interface pg), não importa Express nem conhece rotas.
Funções: normalizar, casarItem (gtin>apelido>fuzzy tolerante a abreviações), processarNota,
confirmarItem, itensDaFoto (implementado — delega a `src/ai/foto.js`). Não acoplar a Express.
`src/ai/foto.js` — chama Claude Haiku com a imagem em base64, extrai JSON de itens.

## Automações (backend/src/services/)
- `scheduler.js` — cron jobs: sexta 12h BRT → push para Delzita; sexta 18h BRT → e-mail para o dono.
- `push.js` — gerencia subscriptions, envia push para todos os dispositivos registrados.
- `email.js` — monta e envia e-mail HTML com consumo semanal e situação do estoque via Resend.

## Roadmap
- Fase 2 ✅ CONCLUÍDA: foto por IA (Claude Haiku), confirmação em 3 passos, apelidos aprendidos.
  Pendente ainda: adaptador NFC-e por QR code.
- Fase 3: ROP dinâmico (consumo*lead_time), previsão de ruptura, gasto por categoria,
  alerta automático (cron + e-mail além do semanal já implementado).

## Reaproveitamento (panorama-patrimonio)
Mesma stack → porte = copiar modulo-compras/, prefixar tabelas com estoque_, e criar uma rota
Express no padrão de lá. Ver docs/MODULO-COMPRAS.md.
