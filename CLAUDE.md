# Estoque Inteligente de Produtos de Limpeza

Contexto e convenções para o agente de código. Leia antes de mexer.

## O que é
App doméstico de controle de estoque de produtos de limpeza, com dois usuários:
- **Empregada** (usuária principal do dia a dia): marca consumo no app. UI tem que ser grande, simples, à prova de erro, offline. Toda a complexidade fica escondida dela.
- **Dono** (dasser): mantém o catálogo, confere a lista de compras, recebe alertas.

Filosofia de produto: **nunca deixar acabar** (repor ao atingir o ponto de reposição, não ao zerar) e **registrar histórico** para análise de consumo/gasto.

## Princípio central de dados: ledger, não contador
O estoque **não** é um número guardado. É a **soma de eventos** (`SELECT SUM(qtd) FROM eventos`). Todo movimento é um evento imutável (`uso` negativo, `compra` positivo, `ajuste` correção). Isso é o que destrava tendências, previsão de ruptura e gasto por item. **Nunca** troque isso por um campo "quantidade" mutável no catálogo.

## Stack
- **Cloudflare Workers** (runtime) + **Hono** (router) — `src/index.js`.
- **Cloudflare D1** (SQLite) — schema em `migrations/`.
- **PWA** estático em `public/` (HTML/CSS/JS puro, sem build). Servido pelo binding `[assets]`; requisições que casam com arquivo são servidas direto, o resto cai no Worker (por isso a API vive em `/api/*`).
- Sem framework de front e sem passo de build de propósito: manter simples e legível.

## Modelo de dados (migrations/0001_init.sql)
- `catalogo` — produto canônico (família). `par_level` = nível ideal/máximo; `min_nivel` = ponto de reposição; `lead_time_dias` para ROP dinâmico futuro.
- `apelidos` — como o produto aparece nas notas (`texto_na_nota`, `gtin`). Resolve "variações agrupadas" (entity resolution).
- `eventos` — o ledger. `estoque atual = SUM(qtd)`.
- `compras` + `compra_itens` — uma nota fiscal e seus itens; base do histórico de preço.
- View `v_estoque` — junta catálogo + estoque somado.

## API atual (Fase 1 — pronta)
- `GET  /api/itens` — itens com estoque, `situacao` (ok|atencao|comprar), consumo 28d e dias de cobertura.
- `POST /api/itens/:id/mov` `{delta, quem}` — registra evento (coração do app).
- `POST /api/itens` — cria produto (+ `estoque_inicial` opcional).
- `PUT  /api/itens/:id` — atualiza par/min/etc.
- `GET  /api/lista-compras` — itens no ponto de reposição, com qtd sugerida (até par) e custo estimado (último preço).
- `GET  /api/health`.

Regra de situação (mantenha igual no front e no back):
`estoque <= min` → comprar · `estoque <= min+1` → atencao · senão ok.

## Roadmap / TODOs
### Fase 2 — Reabastecimento pela nota (stub em `POST /api/compras/nota`)
1. Entrada por **chave/QR da NFC-e** (44 dígitos). Decidir fonte dos itens:
   - (a) consultar portal SEFAZ do estado — **varia por UF e pode ter captcha**; validar com nota real;
   - (b) **API de NFC-e** de terceiros (paga, barata) — mais confiável;
   - (c) **foto do cupom lida por IA** (Claude vision) → JSON de itens. Fallback universal, recomendado como padrão até validar (a)/(b).
2. Casar `descricao_nota` → `catalogo` via `apelidos` (exato/GTIN) e, se não achar, sugerir com IA + fuzzy. Salvar o apelido aprendido após confirmação.
3. Criar `compras` + `compra_itens` + eventos `compra`. Devolver itens não reconhecidos para a tela de confirmação ("é isto?").
4. **Sempre confirmar antes de dar entrada.** Nunca reabastecer cegamente.

### Fase 3 — Inteligência
- ROP dinâmico: `min_nivel` sugerido a partir do consumo (`consumo_dia * lead_time_dias + folga`).
- Previsão de ruptura por item; gasto por categoria/mês (séries temporais a partir de `compra_itens`).
- Alerta automático: handler `scheduled` (Cron já comentado no wrangler.toml) gera a lista e envia e-mail (Cloudflare Email Routing / Resend) — não depende do Gmail.

### Fase 4 — Extras
- Leitor de código de barras no PWA (`BarcodeDetector` ou lib) como alternativa à nota.
- WhatsApp 2 vias (Twilio/Meta — pago).

## Convenções
- Idioma do domínio em **português** (nomes de colunas, rotas, UI).
- Respostas de erro em JSON `{erro: "..."}` com status adequado.
- Datas em UTC no banco; converter para BRT (UTC-3) só na exibição/cron.
- Não introduzir dependências pesadas sem necessidade. Manter o PWA sem build.

## Como rodar / testar
Veja `README.md`. Resumo: `npm i` → `wrangler d1 create estoque` (cole o id no wrangler.toml) → `npm run db:init:local` → `npm run dev`.
