# Apêndice — Estoque Inteligente
## Regras específicas do projeto (complementam as Diretrizes Universais v3.0)

Em caso de conflito entre este apêndice e as diretrizes universais, **este apêndice prevalece**.

---

## 1. Versionamento obrigatório a cada mudança

Toda correção ou melhoria, por menor que seja, deve incluir:
1. Bump do campo `"version"` em `package.json` (formato `X.Y.Z`)
2. Entrada correspondente em `CHANGELOG.md` com data e descrição em linguagem clara
3. Commit com mensagem descritiva em português (ex: `feat: descrição (vX.Y.Z)`)

**Nunca commitar sem bump de versão.** O Railway serve a versão via `GET /api/versao`, que lê o `package.json`.

---

## 2. Cache-buster do Service Worker

O script `scripts/bump-sw.js` é executado automaticamente no startup (`npm start`). Ele incrementa o número de versão do cache dentro de `frontend/sw.js`.

**Quando atualizar manualmente:** se uma mudança de frontend não disparar novo deploy (ex: apenas arquivos estáticos), rode `npm run bump-sw` antes do commit para forçar o navegador a descartar o cache antigo.

---

## 3. Deploy e verificação em produção

**Provedor:** Railway — deploy automático ao fazer `git push origin main`.

**Verificar se o deploy concluiu:**
- Acesse o painel Railway → serviço `estoque-inteligente` → aba **Deployments**
- Ou consulte `https://estoque-inteligente-production.up.railway.app/api/versao` — deve retornar a versão do `package.json` recém-commitada

**Verificar logs de produção:**
- Painel Railway → serviço → aba **Logs**
- Procurar por linhas com `[ERROR]`, `Error:`, `Unhandled` após o deploy
- O servidor deve logar `Estoque Inteligente rodando em http://localhost:PORT` na inicialização

**Após qualquer deploy significativo**, conferir os logs antes de declarar a tarefa concluída (Ordem 3-e das diretrizes universais).

---

## 4. Variáveis de ambiente

Arquivo de exemplo local: `backend/.env.example` (se não existir, criar com as chaves abaixo sem valores).

| Variável | Obrigatória | Onde configurar | Descrição |
|---|---|---|---|
| `DATABASE_URL` | Sim | Railway (Postgres → Connect) | URL de conexão PostgreSQL |
| `JWT_SECRET` | Sim | Railway Variables | Segredo para assinar tokens |
| `JWT_EXPIRES_IN` | Sim | Railway Variables | Ex: `7d` |
| `SENHA_DONO` | Sim | Railway Variables | Senha do perfil dono |
| `SENHA_EMPREGADA` | Sim | Railway Variables | Senha da Delzita (produção: `Delzita123`) |
| `PORT` | Sim | Railway (automático) | Porta do servidor |
| `NODE_ENV` | Sim | Railway Variables | `production` |
| `ANTHROPIC_API_KEY` | Sim | Railway Variables | Claude Haiku para nota fiscal e scanner |
| `AI_PROVIDER` | Sim | Railway Variables | `claude` |
| `COSMOS_API_KEY` | Não | Railway Variables | Lookup de GTIN via Cosmos Bluesoft |
| `VAPID_PUBLIC_KEY` | Sim | Railway Variables | Push notifications — chave pública |
| `VAPID_PRIVATE_KEY` | Sim | Railway Variables | Push notifications — chave privada |
| `VAPID_EMAIL` | Sim | Railway Variables | E-mail do remetente push |
| `RESEND_API_KEY` | Sim | Railway Variables | E-mail semanal via Resend |
| `EMAIL_DONO` | Sim | Railway Variables | Endereço do dono para resumo semanal |
| `FRONTEND_URL` | Sim | Railway Variables | URL pública do app (redirect ao clicar na notificação) |

**Ao adicionar variável nova:** incluir nesta tabela + alertar Dasser para configurar no Railway antes do próximo deploy.

---

## 5. Migrations de banco

As migrations rodam no startup via `npm start`. São scripts em `scripts/`:
- `migration-b3-unique-nome.js` — cria UNIQUE INDEX em `catalogo.nome_canonico`
- `migration-categorias.js` — cria tabela `categorias` e popula com defaults

**Regra obrigatória:** toda migration deve ser **idempotente** — rodar duas vezes seguidas sem erro. Testar localmente antes de fazer push.

**Antes de qualquer DROP, DELETE em massa ou ALTER de coluna com dados:** parada obrigatória conforme Parte 2 das diretrizes universais.

---

## 6. Arquivo `auditoria.html`

Arquivo HTML não rastreado no git (não está no `.gitignore` nem commitado). Presente na raiz do projeto desde antes de junho/2026. **Decisão pendente do Dasser**: commitar, deletar ou adicionar ao `.gitignore`. Não tocar sem instrução explícita.

---

## 7. Credenciais de acesso (não commitar)

- Dono: `dono123`
- Empregada local: `delzita123`
- Empregada produção: `Delzita123`

Estas credenciais estão na memória persistente do Claude Code. **Nunca incluir no código ou em commits.**

---

## 8. Padrão de resposta de erro

Todas as rotas retornam erros no formato `{ erro: "mensagem" }` (chave `erro`, não `error`). Manter este padrão em rotas novas.

---

## 9. Ledger — princípio inegociável

Estoque = `SUM(eventos.qtd)`. **Nunca** substituir por campo mutável no catálogo. Todo movimento (uso, compra, ajuste) é um evento imutável. Ver CLAUDE.md seção "Princípio inegociável: ledger, não contador".

---

## 10. Prompt de abertura de sessão sugerido

Cole este texto no início de cada sessão Claude Code neste projeto:

```
Antes de qualquer coisa, leia integralmente:
1. docs/DIRETRIZES_UNIVERSAIS_CLAUDE_CODE_v3.0.md
2. CLAUDE.md
3. docs/APENDICE_ESTOQUE.md

Confirme a leitura com a frase exata antes de prosseguir.
```
