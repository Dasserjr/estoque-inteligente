# Changelog — Estoque Inteligente

## versão 1.1.4 · 23/06/2026

### Cadastro de produtos — duplicata e medidas
- Bloqueio de nome duplicado: impede cadastrar produto com nome igual a um já existente (comparação sem distinção de maiúsculas), com mensagem explicativa
- Campo de medida dividido em valor + unidade (g, kg, ml, L, m²): formulário de cadastro e de edição
- Nome final composto automaticamente ao salvar: "Sabão Barra" + 90 + g → "Sabão Barra 90g"
- Preview ao vivo do nome final durante o preenchimento do formulário
- Ao cadastrar da nota fiscal: medida extraída automaticamente do texto da nota (ex: "360ML" → 360 ml)

---

## versão 1.1.3 · 23/06/2026

### Gestão de Produtos (pré-Fase 3)

#### Tela "Meus Produtos" (menu do dono)
- Lista visual de todos os produtos — ativos e inativos — com quantidade de compras e data da última
- Edição completa de cada produto: nome, ícone, categoria, unidade, tamanho, setor, mínimo, ideal, lead time
- Inativar produto: sai da lista principal, histórico preservado
- Reativar produto com um toque
- Excluir produto: só permitido se não houver nenhum histórico (movimentações ou compras)
- Histórico de compras por produto: tabela com data, descrição exata da nota fiscal e preço unitário, com preço médio e última compra

#### Novo produto diretamente na nota fiscal
- Itens não reconhecidos na nota agora oferecem botão "Cadastrar novo"
- Abre formulário pré-preenchido com texto e preço da nota; dono ajusta nome canônico e confirma
- Após confirmação, item é vinculado automaticamente ao produto recém-criado

#### Toggle de IA
- Botão liga/desliga para leitura de nota fiscal por IA (em Meus Produtos → Configurações)
- Indicador no cabeçalho mostra status da IA (🤖 IA ativa / ⚫ IA desativada) — visível ao dono
- Se IA desativada, rota /foto retorna mensagem clara em vez de consumir créditos da API

#### Infraestrutura
- Nova tabela `config` no banco (chave/valor) para persistir configurações entre reinicializações
- Novas rotas: `GET /api/config`, `POST /api/config/ia`, `GET /api/itens/todos`, `DELETE /api/itens/:id`, `GET /api/compras/historico/:id`

---

## versão 1.1.2 · 23/06/2026

### Documentação
- `CLAUDE.md` atualizado para refletir Fase 2 concluída (rotas, variáveis, serviços)
- `docs/DIRETRIZES_UNIVERSAIS_CLAUDE_CODE_v3.0.md` adicionado ao controle de versão

---

## versão 1.0 · 23/06/2026

### Lançamento inicial

#### Fase 1 — Base do sistema
- Banco de dados PostgreSQL no Railway com 21 produtos no catálogo
- Ledger de eventos: estoque calculado pela soma de movimentos (nunca um número fixo)
- Login por perfil: dono e empregada, com senhas separadas
- PWA instalável na tela inicial do celular e como app no computador
- Tela principal com lista de produtos, cores por situação e botões + e −
- Situação automática: 🟢 ok · 🟡 atenção (estoque = mín+1) · 🔴 comprar (estoque ≤ mín)
- Lista de compras automática com envio por WhatsApp, e-mail ou cópia
- Funcionamento offline: marcações salvas e enviadas quando a conexão voltar

#### Fase 2 — Leitura de nota fiscal
- Foto do cupom fiscal lida por IA (Claude Haiku) — extrai produtos, quantidades e preços
- Tela de confirmação em 3 passos: foto → revisão → resultado
- Itens não reconhecidos ficam pendentes para vinculação manual ao catálogo
- O sistema aprende: após vincular uma vez, reconhece automaticamente nas próximas compras
- Provedor de IA configurável via variável de ambiente (AI_PROVIDER)

#### Automações
- Notificação push toda sexta às 12h lembrando a Delzita de atualizar o estoque
- E-mail de resumo semanal toda sexta às 18h para o dono com:
  - Consumo da semana (produto a produto)
  - Situação atual do estoque
  - Aviso se nenhum item foi atualizado na semana

#### UX e qualidade
- Banner grande verde/vermelho com animação de piscar quando sem internet
- Botão ❓ Ajuda com manuais separados para o dono e para a empregada
- Versionamento automático: hash do commit exibido na tela de login e no cabeçalho
- Versão instalável como PWA (Android e computador)
