# Guia do zero — do projeto ao Claude Code

Passo a passo no Windows (PowerShell). Faça na ordem. Marque cada bloco ao concluir.

---

## 0. Pré-requisitos (instalar uma vez)

1. **Node.js 18+** — https://nodejs.org (baixe o LTS, "Next" até o fim).
2. **Git for Windows** — https://git-scm.com/downloads/win (recomendado; o Claude Code usa para o terminal Bash).
3. **Conta** do GitHub e da Cloudflare (gratuitas). Você já tem.
4. Claude Code exige um plano **Pro, Max, Team ou Enterprise** (o plano grátis não dá acesso).

Confira o Node depois de instalar (abra um **novo** PowerShell):
```powershell
node --version
git --version
```

---

## 1. Instalar o Claude Code (instalador nativo)

No PowerShell:
```powershell
irm https://claude.ai/install.ps1 | iex
```
Feche e reabra o PowerShell e confirme:
```powershell
claude --version
```

---

## 2. Abrir a pasta do projeto

```powershell
cd "C:\Users\Usuário\Claude\Projects\Controle produtos de limpeza\estoque-app"
```
> Dica: `cd "` e depois arraste a pasta para a janela do PowerShell — ele completa o caminho.

---

## 3. Instalar as dependências

```powershell
npm install
```

---

## 4. Postar no GitHub

Inicie o repositório **dentro de `estoque-app`** (esta pasta é a raiz do projeto):
```powershell
git init
git add .
git commit -m "Fase 1: estoque inteligente (Workers + D1 + PWA)"
git branch -M main
```

Crie o repositório no GitHub e suba. Duas formas:

**A) Pelo site (mais simples):**
1. Vá em https://github.com/new → nome `estoque-limpeza` → **Create repository** (deixe vazio, sem README).
2. Copie a URL que aparece (ex.: `https://github.com/SEU_USUARIO/estoque-limpeza.git`) e rode:
```powershell
git remote add origin https://github.com/SEU_USUARIO/estoque-limpeza.git
git push -u origin main
```

**B) Pela CLI do GitHub (se tiver o `gh`):**
```powershell
gh repo create estoque-limpeza --private --source=. --push
```

---

## 5. Cloudflare — criar o banco D1

Faça login (abre o navegador):
```powershell
npx wrangler login
```
Crie o banco:
```powershell
npx wrangler d1 create estoque
```
O comando imprime algo assim:
```
[[d1_databases]]
binding = "DB"
database_name = "estoque"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```
Copie o **database_id** e cole no arquivo `wrangler.toml`, no lugar de
`PREENCHER_APOS_wrangler_d1_create`.

Crie as tabelas e carregue os dados da sua planilha (no banco local):
```powershell
npm run db:init:local
```

---

## 6. Rodar e testar localmente

```powershell
npm run dev
```
Abra **http://localhost:8787** no navegador. Você deve ver o app com os 21 produtos.
Teste tocar em **–/＋** e abrir o **Modo dono**. Para parar: `Ctrl + C`.

---

## 7. Publicar de verdade (quando quiser)

Cria as tabelas no banco remoto e publica o site:
```powershell
npm run db:init:remote
npm run deploy
```
O `deploy` mostra a URL pública (`https://estoque-limpeza.SEU_SUBDOMINIO.workers.dev`).
Para deploy automático a cada `git push`, conecte o repo em **Cloudflare → Workers & Pages → Create → connect to Git**.

---

## 8. Abrir no Claude Code e continuar

Ainda na pasta `estoque-app`:
```powershell
claude
```
Na primeira vez ele pede login (abre o navegador). Depois, é só conversar.

**Primeira mensagem sugerida para colar no Claude Code:**

> Leia o CLAUDE.md e o README.md deste projeto. É um controle de estoque doméstico
> em Cloudflare Workers + D1 + PWA, com a Fase 1 pronta. Quero começar a **Fase 2**
> (reabastecimento pela nota fiscal). Comece implementando o handler
> `POST /api/compras/nota` e o casamento de descrição → catálogo via tabela `apelidos`,
> usando como padrão a leitura por foto do cupom (IA). Antes de codar, me explique o
> plano em passos e o que você precisa de mim (ex.: uma foto de nota real).

---

## Resumo dos comandos (cola rápida)
```powershell
cd "C:\Users\Usuário\Claude\Projects\Controle produtos de limpeza\estoque-app"
npm install
git init && git add . && git commit -m "Fase 1" && git branch -M main
git remote add origin https://github.com/SEU_USUARIO/estoque-limpeza.git
git push -u origin main
npx wrangler login
npx wrangler d1 create estoque          # cole o database_id no wrangler.toml
npm run db:init:local
npm run dev                              # http://localhost:8787
claude                                   # abre o Claude Code
```

## Se algo der errado
- `claude` não encontrado → feche e reabra o PowerShell; rode `claude doctor`.
- Erro de banco no `dev` → confirme que colou o `database_id` no `wrangler.toml` e rodou `npm run db:init:local`.
- `irm não reconhecido` → você está no CMD, não no PowerShell (o prompt do PowerShell começa com `PS C:\`).
