-- Estoque Inteligente de Produtos de Limpeza — Schema (Cloudflare D1 / SQLite)
-- Filosofia central: o estoque NÃO é um número guardado; é a SOMA dos eventos.

-- Catálogo: o produto "canônico" (família). Ex.: Detergente neutro.
CREATE TABLE IF NOT EXISTS catalogo (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_canonico  TEXT    NOT NULL,
  categoria      TEXT,
  unidade        TEXT,                 -- un, L, kg, rolo...
  tamanho        TEXT,                 -- 500ml, 5L, caixa...
  par_level      INTEGER NOT NULL DEFAULT 0,   -- nível ideal/máximo a manter
  min_nivel      INTEGER NOT NULL DEFAULT 1,   -- ponto de reposição (entra na lista)
  lead_time_dias INTEGER NOT NULL DEFAULT 7,   -- dias até a próxima compra (p/ ROP dinâmico)
  icone          TEXT,
  ativo          INTEGER NOT NULL DEFAULT 1,
  criado_em      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Apelidos: como o produto aparece nas notas fiscais. Resolve "variações agrupadas".
CREATE TABLE IF NOT EXISTS apelidos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  catalogo_id   INTEGER NOT NULL REFERENCES catalogo(id) ON DELETE CASCADE,
  texto_na_nota TEXT    NOT NULL,      -- ex.: "DET YPE NEUTRO 500"
  gtin          TEXT,                  -- código de barras, quando houver
  fonte         TEXT,                  -- 'manual' | 'nfce' | 'ia'
  criado_em     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_apelidos_texto ON apelidos(texto_na_nota);
CREATE INDEX IF NOT EXISTS idx_apelidos_gtin  ON apelidos(gtin);

-- Eventos: o livro-razão (ledger). Estoque atual = SUM(qtd) por catalogo_id.
--   uso     -> qtd negativa (gastou/abriu)
--   compra  -> qtd positiva (reabasteceu)
--   ajuste  -> correção manual (positiva ou negativa)
CREATE TABLE IF NOT EXISTS eventos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  catalogo_id INTEGER NOT NULL REFERENCES catalogo(id) ON DELETE CASCADE,
  tipo        TEXT    NOT NULL CHECK (tipo IN ('uso','compra','ajuste')),
  qtd         REAL    NOT NULL,
  data        TEXT    NOT NULL DEFAULT (datetime('now')),
  quem        TEXT,                    -- 'empregada' | 'dono' | 'sistema'
  compra_id   INTEGER REFERENCES compras(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_eventos_cat  ON eventos(catalogo_id);
CREATE INDEX IF NOT EXISTS idx_eventos_data ON eventos(data);

-- Compras: cada ida ao supermercado (uma nota fiscal).
CREATE TABLE IF NOT EXISTS compras (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  data       TEXT NOT NULL DEFAULT (datetime('now')),
  mercado    TEXT,
  chave_nfce TEXT,                     -- chave de acesso 44 dígitos
  total      REAL,
  origem     TEXT                      -- 'qr' | 'foto' | 'manual'
);

-- Itens da compra: histórico de preço por produto (base da análise de gasto).
CREATE TABLE IF NOT EXISTS compra_itens (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  compra_id     INTEGER NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  catalogo_id   INTEGER REFERENCES catalogo(id),  -- NULL = ainda não casado
  descricao_nota TEXT,
  qtd           REAL,
  preco_unit    REAL
);
CREATE INDEX IF NOT EXISTS idx_compraitens_cat ON compra_itens(catalogo_id);

-- View de conveniência: estoque atual por produto.
CREATE VIEW IF NOT EXISTS v_estoque AS
SELECT
  c.id, c.nome_canonico, c.categoria, c.unidade, c.tamanho,
  c.par_level, c.min_nivel, c.lead_time_dias, c.icone, c.ativo,
  COALESCE((SELECT SUM(e.qtd) FROM eventos e WHERE e.catalogo_id = c.id), 0) AS estoque
FROM catalogo c
WHERE c.ativo = 1;
