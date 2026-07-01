# Changelog — Estoque Inteligente

## v1.7.3 · 01/07/2026

### Scanner — embalagens múltiplas (C/5, 12UN, PCT C/12)

- Haiku detecta campo `multiplo` na descrição Cosmos (ex: "C/5" → 5)
- Formulário exibe banner laranja de atenção quando `multiplo > 1`
- Label da quantidade muda para "Quantas embalagens você comprou? (N un. cada)"
- Campo "Unidades por embalagem" pré-preenchido e editável
- Preview dinâmico: "Total a registrar no estoque: X unidades"
- Dica de preço: "Preço unitário = preço da embalagem ÷ N"
- Tela de sucesso mostra "X un. (N emb. × M un.)"
- `multiplo` é efêmero — derivado a cada scan, não armazenado; troca de tamanho pela indústria é captada automaticamente
- Categoria Lavanderia ampliada para reconhecer "sabão barra" e "sabão em barra"

---

## v1.7.2 · 01/07/2026

### Scanner — nome canônico inteligente via Claude Haiku

- Haiku analisa descrição Cosmos e retorna `{nome, tamanho, multiplo}` separados
- Remove palavras de embalagem: frasco, spray, squeeze, refil, galão, bisnaga, sachê, automático, dispenser, caixa, pacote
- Remove descritores redundantes (ex: "líquido" para lava-louças)
- Coloca marca no início, aplica Title Case, limita a 40 caracteres
- Campo Tamanho do formulário populado automaticamente
- Fallback regex + title case quando Haiku indisponível
- Exemplo: "MUCAMBO LAVA-LOUÇAS LÍQUIDO NEUTRO YPÊ SQUEEZE 500ML" → nome: "Ypê Lava-Louças Neutro", tamanho: "500ml"

---

## v1.7.1 · 01/07/2026

### Correção crítica: Cosmos API retornava 401

- `User-Agent` trocado de `'EstoqueInteligente/1.7'` para `'Cosmos-API-Request'` (exigido pela Cosmos)

---

## v1.7.0 · 01/07/2026

### Fase A — Cadastro por escaneamento de código de barras

- Botão 📷 Escanear no rodapé (visível apenas para o dono)
- Modal com 5 etapas: entrada → câmera → buscando → formulário → resultado
- ZXing @0.19.2 carregado lazily de `/lib/zxing.min.js` (285 KB, sem CDN, respeita CSP)
- Backend `GET /api/escanear/lookup`: verifica apelidos/GTIN → Cosmos Bluesoft → Open Food Facts
- Backend `POST /api/escanear/cadastrar`: transação atômica (catalogo + apelidos + evento)
- Evento tipo `'compra'` com `compra_itens` se preço informado; tipo `'ajuste'` se sem preço
- GTIN salvo em `apelidos.gtin`; `COSMOS_API_KEY` opcional
- Correção de gap pré-existente: `carregarCategorias()` adicionado ao bloco de auto-login

---

## v1.6.5 · Junho/2026

### Rename para Estoque Inteligente

- App renomeado em todos os arquivos: `manifest.json`, títulos HTML, e-mails e push

---

## v1.6.4 · Junho/2026

- Fix: nota de estimativa parcial incluída no texto copiado/compartilhado da lista de compras

---

## v1.6.3 · Junho/2026

- Fix: `GET /api/compras/lista` não quebrava se tabela `categorias` ainda não existisse

---

## v1.6.2 · Junho/2026

- Fix: itens carregados antes dos preços de referência; `compras/lista` em background para evitar tela em branco

---

## v1.6.1 · Junho/2026

- Fix: `GET /api/itens` com fallback se tabela `categorias` não existir; migration mais robusta

---

## v1.6.0 · Junho/2026

### Lista de compras agrupada por categoria com preço de referência

- Lista agrupada por categoria (antes: lista plana)
- Preço unitário de referência (última compra) ao lado de cada item
- Estimativa de custo total no rodapé

---

## v1.5.9 · Junho/2026

### Sistema de categorias

- Tabela `categorias` com categorias pré-definidas de limpeza
- FK `categoria_id` em `catalogo`; coluna `categoria` (texto) mantida para compatibilidade
- CRUD: `GET /api/categorias`, `POST`, `PUT`, `DELETE`
- Dropdowns de categoria no frontend em todos os formulários

---

## v1.5.8 · Junho/2026

- Separa botões "Tirar foto" e "Da galeria" na tela de nota fiscal

---

## v1.5.7 · Junho/2026

- Itens repetidos na nota agrupados automaticamente (soma de quantidade)
- Casamento fuzzy com threshold 0,5 (mais tolerante a abreviações)

---

## v1.5.6 · Junho/2026

- Fix: `ReferenceError 'nome is not defined'` ao cadastrar produto pela nota fiscal

---

## v1.5.5 · Junho/2026

- Quantidade sugerida exibida à frente de todos os itens na lista de compras

---

## v1.5.4 · Junho/2026

- Auditoria A3: `scriptSrcAttr: ["'unsafe-inline'"]` restaura `onclick=` bloqueado pelo Helmet/CSP

---

## v1.5.3 · Junho/2026

- Auditoria A3: CSP reativada no Helmet com diretivas ajustadas

---

## v1.5.2 · Junho/2026

- Auditoria C3: `copiarLista()` usa toast visual em vez de `alert()`

---

## v1.5.1 · Junho/2026

- Auditoria C1: Modo Dono salva em paralelo e exibe feedback visual com spinner

---

## v1.5.0 · Junho/2026

### Auditoria B3 — nome canônico único

- `UNIQUE INDEX` em `catalogo.nome_canonico` via migration idempotente no startup
- `POST` e `PUT /api/itens` bloqueiam duplicata, retornam 409; frontend trata com mensagem clara

---

## v1.4.9 · Junho/2026

- Botão Inativar direto no card em Meus Produtos (sem precisar abrir modal)

---

## v1.4.8 · Junho/2026

- Fix: botão Editar em Meus Produtos não abria o modal de edição

---

## v1.4.7 · Junho/2026

- 5 correções de segurança da auditoria (validação de entrada, rate limiting no login, sanitização de outputs)

---

## v1.4.6 · Junho/2026

- Descarte de notas fiscais em andamento; limpeza de itens pendentes órfãos

---

## v1.4.5 · Junho/2026

- Fix: `GET /api/compras/gastos/mensal` incluía corretamente itens de compras não confirmadas

---

## v1.4.4 · Junho/2026

- `min_nivel = 0` permitido para produtos esporádicos; premissa "produto aberto não conta" documentada

---

## v1.4.3 · Junho/2026

- Fix: lista de compras exibe quantidade sugerida corretamente por produto

---

## v1.4.2 · Junho/2026

- Fix: botão "Adicionar produto" no Modo Dono abria formulário errado

---

## v1.4.1 · Junho/2026

- Bump de versão e ajustes menores pós-v1.4.0

---

## versão 1.4.0 · 23/06/2026

### Relatórios — redesign acordeão

- Modal de relatórios completamente refeito: em vez de botões de download, os dados aparecem **na tela** em tabelas filtráveis
- 4 seções em acordeão (clique no título para expandir, × para fechar manualmente, abrir outro fecha o atual):
  - 📦 **Estoque atual** — todos os produtos com situação, mínimo, ideal e dias de cobertura; linhas vermelhas para "Comprar", amarelas para "Atenção"
  - 📋 **Movimentações (12 meses)** — uso, compras e ajustes
  - 🛒 **Histórico de compras (12 meses)** — datas, mercados, descrições de nota, quantidades e preços
  - 💰 **Gastos por categoria (12 meses)** — total e percentual por categoria
- Filtro por coluna em tempo real em todas as seções (campo de texto por coluna, sem botão)
- Contador de registros: "X de Y registros" quando há filtro ativo
- Botão 🖨 Imprimir no cabeçalho: imprime apenas a seção aberta via `window.print()` (sem biblioteca externa)
- Removido: SheetJS, jsPDF, html2canvas e todo código de exportação para arquivo (Excel vira evolutiva)
- Service worker atualizado para v7 (forçar refresh nos dispositivos)

---

## versão 1.3.0 · 23/06/2026

### Relatórios e Exportação (nova tela 📊)

#### Excel (.xlsx)
- **Estoque atual** — todos os produtos com situação, estoque, mínimo, ideal e dias de cobertura
- **Movimentações** — uso, compras e ajustes dos últimos 12 meses (6 colunas: data, produto, categoria, tipo, quantidade, registrado por)
- **Histórico de compras** — datas, mercados, quantidades e preços dos últimos 12 meses
- **Gasto mensal** — resumo por categoria mês a mês do ano atual
- **Relatório completo** — todas as 4 abas em um único arquivo Excel
- Bibliotecas carregadas sob demanda (SheetJS via CDN, não afeta carregamento inicial do app)

#### PDF
- **Opção A — como aparece na tela**: captura html2canvas da lista de produtos com cores e ícones, cabeçalho azul, multi-página automático
- **Opção B — tabela formal**: jsPDF + autoTable com tabela estruturada, situação colorida (verde/amarelo/vermelho), número de páginas no rodapé
- **Gráfico anual**: barras Jan–Dez desenhadas programaticamente em jsPDF, mês atual destacado em roxo, tabela por categoria abaixo

#### Infraestrutura
- Novas rotas: `GET /api/exportar/movimentacoes?periodo=365` e `GET /api/exportar/compras?periodo=365`
- Novo botão 📊 Relatórios no rodapé (somente dono)
- Rodapé agora é horizontalmente rolável em telas pequenas com muitos botões

---

## versão 1.2.0 · 23/06/2026

### Fase 3 — Previsão e Análise

#### 3.1 — Dias de cobertura na lista principal
- Cada produto exibe "acaba em ~X dias" calculado pelo consumo médio dos últimos 28 dias
- Se não houver histórico de uso, o campo não é exibido

#### 3.3 — Gasto por categoria
- Nova tela "💰 Gastos" no rodapé do menu dono
- Seletor de período: 30 dias / 3 meses / 12 meses
- Total gasto no período com barras proporcionais por categoria (percentual)
- Gráfico anual de barras (Jan–Dez) com navegação entre anos; mês atual destacado
- Aviso transparente: dados baseados apenas em notas fiscais processadas no app
- Novas rotas: `GET /api/compras/gastos?periodo=30` e `GET /api/compras/gastos/mensal?ano=2026`

---

## versão 1.1.6 · 23/06/2026

### Cadastro de produto — menu do dono
- Removido formulário de cadastro antigo sem validação do "Modo dono"
- Botão "＋ Adicionar produto" agora abre o modal completo de cadastro (com medidas, preview de nome, verificação de duplicata)

---

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
