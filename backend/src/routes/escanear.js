const router = require('express').Router();
const pool = require('../db');
const { autenticar, exigirDono } = require('../middleware/auth');
const https = require('https');

function httpGetJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('resposta inválida')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function buscarNaBase(gtin) {
  // 1. Cosmos (se COSMOS_API_KEY configurada)
  const cosmosKey = process.env.COSMOS_API_KEY;
  if (cosmosKey) {
    try {
      const d = await httpGetJSON(`https://api.cosmos.bluesoft.com.br/gtins/${gtin}.json`, {
        'X-Cosmos-Token': cosmosKey,
        'User-Agent': 'EstoqueInteligente/1.7',
      });
      if (d && d.description) {
        const marca = d.brand && d.brand.name ? d.brand.name + ' ' : '';
        return { nome: (marca + d.description).trim(), quantidade: d.quantity || '', fonte: 'cosmos' };
      }
    } catch { /* continua */ }
  }

  // 2. Open Food Facts (sem chave — cobertura menor para produtos de limpeza)
  try {
    const d = await httpGetJSON(`https://world.openfoodfacts.org/api/v0/product/${gtin}.json`, {
      'User-Agent': 'EstoqueInteligente/1.7 (contact: dasserjr@gmail.com)',
    });
    if (d && d.status === 1 && d.product) {
      const p = d.product;
      const nome = p.product_name_pt || p.product_name || '';
      if (nome) {
        const marca = p.brands ? p.brands.split(',')[0].trim() + ' ' : '';
        return { nome: (marca + nome).trim(), quantidade: p.quantity || '', fonte: 'openfoodfacts' };
      }
    }
  } catch { /* não encontrado */ }

  return null;
}

// GET /api/escanear/lookup?gtin=XXXXX
router.get('/lookup', autenticar, exigirDono, async (req, res) => {
  const { gtin } = req.query;
  if (!gtin) return res.status(400).json({ erro: 'gtin obrigatório' });
  try {
    // Verifica se GTIN já está em apelidos
    const { rows: alias } = await pool.query(
      `SELECT a.catalogo_id, c.nome_canonico, c.categoria_id, c.icone, c.min_nivel, c.par_level
       FROM apelidos a
       JOIN catalogo c ON c.id = a.catalogo_id
       WHERE a.gtin = $1 AND c.ativo = true
       LIMIT 1`,
      [gtin]
    );
    if (alias.length) {
      return res.json({ encontrado: true, existente: true, produto: alias[0] });
    }
    const externo = await buscarNaBase(gtin);
    res.json({ encontrado: !!externo, existente: false, externo: externo || null });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// POST /api/escanear/cadastrar
router.post('/cadastrar', autenticar, exigirDono, async (req, res) => {
  const b = req.body || {};
  if (!b.nome_canonico) return res.status(400).json({ erro: 'nome_canonico obrigatório' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Bloqueia nome duplicado
    const { rows: dup } = await client.query(
      `SELECT nome_canonico FROM catalogo WHERE LOWER(nome_canonico) = LOWER($1) LIMIT 1`,
      [b.nome_canonico]
    );
    if (dup.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ erro: `Já existe um produto com este nome: "${dup[0].nome_canonico}".` });
    }

    // Resolve nome da categoria
    let categoriaTexto = null;
    if (b.categoria_id) {
      const { rows: cr } = await client.query('SELECT nome FROM categorias WHERE id = $1', [b.categoria_id]);
      if (cr[0]) categoriaTexto = cr[0].nome;
    }

    // Cria produto no catálogo
    const { rows: prod } = await client.query(
      `INSERT INTO catalogo (nome_canonico, categoria, categoria_id, unidade, tamanho, par_level, min_nivel, icone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [
        b.nome_canonico,
        categoriaTexto,
        b.categoria_id || null,
        b.unidade || 'un',
        b.tamanho || '',
        b.par_level ?? 2,
        b.min_nivel ?? 1,
        b.icone || '🧴',
      ]
    );
    const prodId = prod[0].id;

    // Salva GTIN em apelidos (texto_na_nota NOT NULL → usa nome_canonico)
    if (b.gtin) {
      await client.query(
        `INSERT INTO apelidos (catalogo_id, texto_na_nota, gtin, fonte)
         VALUES ($1,$2,$3,'escanear')
         ON CONFLICT DO NOTHING`,
        [prodId, b.nome_canonico, b.gtin]
      );
    }

    // Lança estoque inicial + preço
    const qtd = Math.max(0, Number(b.quantidade) || 0);
    const preco = b.preco_unit != null ? Number(b.preco_unit) : null;

    if (qtd > 0) {
      if (preco != null && preco > 0) {
        // Com preço → cria compra para guardar histórico de preço
        const { rows: compra } = await client.query(
          `INSERT INTO compras (data, mercado, total, origem)
           VALUES (NOW(),'Cadastro manual',$1,'escanear') RETURNING id`,
          [+(preco * qtd).toFixed(2)]
        );
        await client.query(
          `INSERT INTO compra_itens (compra_id, catalogo_id, descricao_nota, qtd, preco_unit)
           VALUES ($1,$2,$3,$4,$5)`,
          [compra[0].id, prodId, b.nome_canonico, qtd, preco]
        );
        await client.query(
          `INSERT INTO eventos (catalogo_id, tipo, qtd, quem, compra_id)
           VALUES ($1,'compra',$2,'dono',$3)`,
          [prodId, qtd, compra[0].id]
        );
      } else {
        // Sem preço → ajuste de estoque inicial
        await client.query(
          `INSERT INTO eventos (catalogo_id, tipo, qtd, quem)
           VALUES ($1,'ajuste',$2,'dono')`,
          [prodId, qtd]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ id: prodId, nome_canonico: b.nome_canonico });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ erro: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
