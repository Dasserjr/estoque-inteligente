# Changelog — Estoque Inteligente

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
