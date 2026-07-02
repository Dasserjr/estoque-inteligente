-- Estoque Inteligente — Schema (PostgreSQL)
-- Filosofia central: o estoque NÃO é um número guardado; é a SOMA dos eventos.
-- (No panorama-patrimonio estas tabelas entrariam com prefixo estoque_; aqui o
--  banco é dedicado, então usamos nomes simples.)

CREATE TABLE IF NOT EXISTS categorias (
  id    SERIAL PRIMARY KEY,
  nome  VARCHAR(100) NOT NULL UNIQUE,
  icone VARCHAR(10)  NOT NULL DEFAULT '📦',
  ordem INTEGER      NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS catalogo (
  id             SERIAL PRIMARY KEY,
  nome_canonico  TEXT    NOT NULL,
  categoria      TEXT,
  categoria_id   INTEGER REFERENCES categorias(id),
  unidade        TEXT,
  tamanho        TEXT,
  par_level      INTEGER NOT NULL DEFAULT 0,    -- nível ideal/máximo a manter
  min_nivel      INTEGER NOT NULL DEFAULT 1,    -- ponto de reposição (entra na lista)
  lead_time_dias INTEGER NOT NULL DEFAULT 7,
  setor          TEXT,                          -- escopo opcional (área/local)
  icone          TEXT,
  ativo          BOOLEAN NOT NULL DEFAULT true,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compras (
  id         SERIAL PRIMARY KEY,
  data       TIMESTAMPTZ NOT NULL DEFAULT now(),
  mercado    TEXT,
  chave_nfce TEXT,
  total      NUMERIC(12,2),
  origem     TEXT
);

CREATE TABLE IF NOT EXISTS apelidos (
  id            SERIAL PRIMARY KEY,
  catalogo_id   INTEGER NOT NULL REFERENCES catalogo(id) ON DELETE CASCADE,
  texto_na_nota TEXT    NOT NULL,
  gtin          TEXT,
  fonte         TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_apelidos_texto ON apelidos(texto_na_nota);
CREATE INDEX IF NOT EXISTS idx_apelidos_gtin  ON apelidos(gtin);

CREATE TABLE IF NOT EXISTS eventos (
  id          SERIAL PRIMARY KEY,
  catalogo_id INTEGER NOT NULL REFERENCES catalogo(id) ON DELETE CASCADE,
  tipo        TEXT    NOT NULL CHECK (tipo IN ('uso','compra','ajuste')),
  qtd         NUMERIC NOT NULL,
  data        TIMESTAMPTZ NOT NULL DEFAULT now(),
  quem        TEXT,
  compra_id   INTEGER REFERENCES compras(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_eventos_cat  ON eventos(catalogo_id);
CREATE INDEX IF NOT EXISTS idx_eventos_data ON eventos(data);

CREATE TABLE IF NOT EXISTS compra_itens (
  id             SERIAL PRIMARY KEY,
  compra_id      INTEGER NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  catalogo_id    INTEGER REFERENCES catalogo(id),
  descricao_nota TEXT,
  qtd            NUMERIC,
  preco_unit     NUMERIC(12,2),
  confirmado_em  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_compraitens_cat ON compra_itens(catalogo_id);

-- Subscriptions de push notification (criadas também em runtime por push.js).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id        SERIAL PRIMARY KEY,
  endpoint  TEXT NOT NULL UNIQUE,
  p256dh    TEXT,
  auth      TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Configurações do sistema (chave/valor).
CREATE TABLE IF NOT EXISTS config (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
INSERT INTO config (chave, valor) VALUES ('ia_ativa', 'true') ON CONFLICT DO NOTHING;

-- View: estoque atual por produto (soma do ledger).
-- Versão com categoria_id (pós migration-categorias).
CREATE OR REPLACE VIEW v_estoque AS
SELECT
  c.id, c.nome_canonico, c.categoria, c.categoria_id, c.unidade, c.tamanho,
  c.par_level, c.min_nivel, c.lead_time_dias, c.icone, c.ativo,
  COALESCE(SUM(e.qtd), 0) AS estoque
FROM catalogo c
LEFT JOIN eventos e ON e.catalogo_id = c.id
WHERE c.ativo = true
GROUP BY c.id, c.nome_canonico, c.categoria, c.categoria_id, c.unidade, c.tamanho,
         c.par_level, c.min_nivel, c.lead_time_dias, c.icone, c.ativo;
