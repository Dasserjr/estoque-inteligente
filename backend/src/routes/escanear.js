const router = require('express').Router();
const pool = require('../db');
const { autenticar, exigirDono } = require('../middleware/auth');
const https = require('https');
const Anthropic = require('@anthropic-ai/sdk');

// ─── HTTP helper ──────────────────────────────────────────────────────────────

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

// ─── Geração de nome canônico via Haiku ───────────────────────────────────────

const PROMPT_NOME = `Analise o nome do produto brasileiro abaixo (como aparece na embalagem) e retorne um JSON com nome canônico, tamanho e multiplicador separados.

Regras para o nome canônico:
- Inclua: marca principal, tipo do produto, variante essencial (neutro, concentrado, perfume/aroma quando relevante)
- Exclua: tipo de embalagem (frasco, spray, refil, galão, squeeze, bisnaga, sachê, dispenser, bomba, automático, caixa, pacote)
- Exclua: descritores óbvios para o tipo (ex: "líquido" para detergente)
- Exclua: quantidade de unidades por embalagem (C/5, 5UN, fardo c/12, PCT 3X, etc.)
- Coloque a marca no início quando identificável
- Use Title Case
- Máximo 40 caracteres

Tamanho: volume/peso de CADA UNIDADE no formato compacto (ex: 500ml, 1kg, 300g, 1L, 90g). Se não houver, retorne "".

Multiplo: número inteiro de unidades individuais dentro da embalagem vendida. Exemplos: "C/5"=5, "5UN"=5, "PCT C/12"=12, "FARDO C/24"=24, "3X500ML"=3. Se produto unitário ou não especificado, retorne 1.

Retorne SOMENTE JSON válido, sem texto adicional: {"nome": "...", "tamanho": "...", "multiplo": 1}

Exemplos:
"DETERGENTE NEUTRO LIMPOL FRASCO 500ML" → {"nome": "Limpol Detergente Neutro", "tamanho": "500ml", "multiplo": 1}
"SABÃO BARRA COALA C/5 90G" → {"nome": "Coala Sabão Barra", "tamanho": "90g", "multiplo": 5}
"PAPEL HIGIÊNICO NEVE PCT C/16 30M" → {"nome": "Neve Papel Higiênico", "tamanho": "30m", "multiplo": 16}
"DESODORIZADOR BOM AR SPRAY AUTOMÁTICO LAVANDA 360ML" → {"nome": "Bom Ar Desodorizador Lavanda", "tamanho": "360ml", "multiplo": 1}
"AMACIANTE COMFORT CONCENTRADO BRISA DE VERÃO REFIL 1L" → {"nome": "Comfort Amaciante Brisa de Verão", "tamanho": "1L", "multiplo": 1}
"ESPONJA SCOTCH BRITE LIMPEZA PESADA C/3" → {"nome": "Scotch-Brite Esponja Limpeza Pesada", "tamanho": "", "multiplo": 3}

Produto: {descricao}`;

async function gerarNomeCanonico(descricao) {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 128,
      messages: [{ role: 'user', content: PROMPT_NOME.replace('{descricao}', descricao) }],
    });
    const texto = msg.content[0].text.trim();
    const m = texto.match(/\{[\s\S]*?\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      if (parsed.nome) return {
        nome: parsed.nome.trim(),
        tamanho: (parsed.tamanho || '').trim(),
        multiplo: Math.max(1, Math.round(Number(parsed.multiplo) || 1)),
      };
    }
  } catch (e) {
    console.warn('[escanear] Haiku indisponível, usando fallback:', e.message);
  }
  // Fallback: regex + title case
  return gerarNomeBasico(descricao);
}

function gerarNomeBasico(descricao) {
  const re = /\b(\d+(?:[,\.]\d+)?)\s*(KG|G|GR|ML|L|LT|M²)\b/gi;
  const matches = [...descricao.matchAll(re)];
  let tamanho = '';
  let base = descricao;
  if (matches.length) {
    const m = matches[matches.length - 1];
    const unMap = { KG: 'kg', G: 'g', GR: 'g', ML: 'ml', L: 'L', LT: 'L', 'M²': 'm²' };
    const un = unMap[m[2].toUpperCase()] || m[2].toLowerCase();
    tamanho = m[1].replace(',', '.') + un;
    base = (descricao.slice(0, m.index) + descricao.slice(m.index + m[0].length))
      .replace(/\s+/g, ' ').trim();
  }
  const nome = base.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());
  return { nome, tamanho, multiplo: 1 };
}

// ─── Lookup em bases externas ─────────────────────────────────────────────────

async function buscarNaBase(gtin) {
  // 1. Cosmos Bluesoft (se COSMOS_API_KEY configurada)
  const cosmosKey = process.env.COSMOS_API_KEY;
  if (cosmosKey) {
    try {
      const d = await httpGetJSON(`https://api.cosmos.bluesoft.com.br/gtins/${gtin}.json`, {
        'X-Cosmos-Token': cosmosKey,
        'User-Agent': 'Cosmos-API-Request',
        'Content-Type': 'application/json',
      });
      if (d && d.description) {
        const { nome, tamanho, multiplo } = await gerarNomeCanonico(d.description);
        return { nome, tamanho, multiplo, fonte: 'cosmos' };
      }
    } catch { /* continua */ }
  }

  // 2. Open Food Facts (sem chave — fallback gratuito)
  try {
    const d = await httpGetJSON(`https://world.openfoodfacts.org/api/v0/product/${gtin}.json`, {
      'User-Agent': 'EstoqueInteligente/1.7 (contact: dasserjr@gmail.com)',
    });
    if (d && d.status === 1 && d.product) {
      const p = d.product;
      const nomeOFF = p.product_name_pt || p.product_name || '';
      if (nomeOFF) {
        const { nome, tamanho, multiplo } = await gerarNomeCanonico(nomeOFF);
        return { nome, tamanho: tamanho || p.quantity || '', multiplo, fonte: 'openfoodfacts' };
      }
    }
  } catch { /* não encontrado */ }

  return null;
}

// ─── Sugestão de categoria via Haiku ──────────────────────────────────────────

async function sugerirCategoria(nome, categorias) {
  if (!categorias || !categorias.length) return null;
  try {
    const lista = categorias.map(c => `${c.id} - ${c.nome}`).join('\n');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: `Produto: "${nome}"\n\nCategorias:\n${lista}\n\nResponda SOMENTE com o ID numérico da categoria mais adequada. Se nenhuma servir, responda 0.` }],
    });
    const id = parseInt(msg.content[0].text.trim(), 10);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

// ─── Rotas ────────────────────────────────────────────────────────────────────

// GET /api/escanear/lookup?gtin=XXXXX
router.get('/lookup', autenticar, exigirDono, async (req, res) => {
  const { gtin } = req.query;
  if (!gtin) return res.status(400).json({ erro: 'gtin obrigatório' });
  try {
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
    const [externo, { rows: cats }] = await Promise.all([
      buscarNaBase(gtin),
      pool.query('SELECT id, nome FROM categorias ORDER BY ordem, nome'),
    ]);
    if (externo) {
      externo.categoria_sugerida_id = await sugerirCategoria(externo.nome, cats);
    }
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

    const { rows: dup } = await client.query(
      `SELECT nome_canonico FROM catalogo WHERE LOWER(nome_canonico) = LOWER($1) LIMIT 1`,
      [b.nome_canonico]
    );
    if (dup.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ erro: `Já existe um produto com este nome: "${dup[0].nome_canonico}".` });
    }

    let categoriaTexto = null;
    if (b.categoria_id) {
      const { rows: cr } = await client.query('SELECT nome FROM categorias WHERE id = $1', [b.categoria_id]);
      if (cr[0]) categoriaTexto = cr[0].nome;
    }

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

    if (b.gtin) {
      await client.query(
        `INSERT INTO apelidos (catalogo_id, texto_na_nota, gtin, fonte)
         VALUES ($1,$2,$3,'escanear')
         ON CONFLICT DO NOTHING`,
        [prodId, b.nome_canonico, b.gtin]
      );
    }

    const qtd = Math.max(0, Number(b.quantidade) || 0);
    const preco = b.preco_unit != null ? Number(b.preco_unit) : null;

    if (qtd > 0) {
      if (preco != null && preco > 0) {
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
