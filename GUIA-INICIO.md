# Guia do zero — do projeto ao Claude Code (Express + PostgreSQL)

Passo a passo no Windows (PowerShell). Faça na ordem.

## 0. Pré-requisitos (uma vez)
1. Node.js 20+ — https://nodejs.org (LTS).
2. Git for Windows — https://git-scm.com/downloads/win
3. Conta Railway (https://railway.app) — vai hospedar o PostgreSQL e o app.
4. Claude Code exige plano Pro/Max/Team.

Confira (em um novo PowerShell): `node --version` e `git --version`.

## 1. Instalar o Claude Code
```powershell
irm https://claude.ai/install.ps1 | iex
```
Feche e reabra o PowerShell, confirme: `claude --version`

## 2. Banco PostgreSQL (Railway)
1. Em https://railway.app → New Project → **Add PostgreSQL**.
2. No serviço do Postgres → aba **Variables/Connect** → copie a **DATABASE_URL**
   (a "Postgres Connection URL", começa com `postgresql://...`).

## 3. Configurar o projeto
```powershell
cd "C:\Users\Usuário\Claude\Projects\Controle produtos de limpeza\estoque-app"
cd backend
npm install
copy .env.example .env
cd ..
```
Abra `backend\.env` no bloco de notas e preencha:
- `DATABASE_URL=` (a URL copiada do Railway)
- `JWT_SECRET=` (qualquer frase longa e aleatória)
- `SENHA_DONO=` e `SENHA_EMPREGADA=` (as senhas de acesso ao app)

## 4. Criar tabelas + dados e rodar
```powershell
npm run seed     # cria o schema e popula o catálogo (21 itens)
npm run dev      # http://localhost:3000
```
Abra http://localhost:3000 → faça login com a SENHA_DONO. Você deve ver os produtos,
com Bom Ar / Lysoform / saquinhos já em "Comprar". Pare com Ctrl+C.

## 5. Postar no GitHub
```powershell
git add .
git commit -m "v0.2: migra para Express + PostgreSQL + auth"
git push
```
(Se ainda não tiver remoto: crie o repo vazio em github.com/new e
`git remote add origin https://github.com/Dasserjr/estoque-inteligente.git` antes do push.)

## 6. Publicar no Railway (quando quiser)
1. Railway → New → **Deploy from GitHub repo** → escolha `estoque-inteligente`.
2. Em **Variables** do serviço, cole as mesmas do `.env` (use a DATABASE_URL do Postgres
   do mesmo projeto; o `start` já é `node backend/src/index.js`).
3. Rode o seed uma vez no banco de produção (Railway → Postgres → Query, ou rode local
   apontando a DATABASE_URL de produção: `npm run seed`).

## 7. Abrir no Claude Code (Fase 2)
```powershell
claude
```
Mensagem sugerida para colar:
> Leia CLAUDE.md, README.md e MODULO-COMPRAS.md. Stack Express + PostgreSQL, Fase 1 pronta.
> Quero a Fase 2 (leitura da nota fiscal). Implemente os adaptadores em
> modulo-compras/notas.js (foto por IA como padrão) e a tela de confirmação dos itens
> pendentes. Mantenha modulo-compras/ agnóstico (sem Express), como descrito no MODULO-COMPRAS.md.
> Antes de codar, explique o plano e o que precisa de mim (uma foto de nota real).

## Se travar
- `claude` não encontrado → reabra o PowerShell; `claude doctor`.
- Erro de banco no seed/dev → confira a DATABASE_URL no `backend\.env`.
- `irm não reconhecido` → você está no CMD; abra o PowerShell (prompt começa com `PS C:\`).
