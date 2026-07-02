// ============================================================================
// MÓDULO DE COMPRAS — ingestão de nota fiscal e casamento com o catálogo.
// Agnóstico de host: recebe um `db` com interface pg (db.query(sql, params)).
// Não conhece Express nem rotas → copiável para o panorama-patrimonio
// (lá as tabelas levariam prefixo estoque_).
// Fonte (QR NFC-e, foto+IA ou JSON manual) produz itens:
//   { descricao, qtd, preco_unit, gtin? }
// ============================================================================

function normalizar(s) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // tira acentos
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const tokens = (s) => new Set(normalizar(s).split(' ').filter((t) => t.length > 1));

// Token casa se igual (1.0) ou um for prefixo do outro (0.8) → pega abreviações
// de nota fiscal (DET~DETERGENTE, AMAC~AMACIANTE).
function tokenMatch(t, set) {
  if (set.has(t)) return 1;
  for (const u of set) {
    if ((t.length >= 3 || u.length >= 3) && (t.startsWith(u) || u.startsWith(t))) return 0.8;
  }
  return 0;
}

// Similaridade 0..1 entre dois textos (tolerante a abreviações e ordem).
function similar(a, b) {
  const A = [...tokens(a)], B = tokens(b);
  if (!A.length || !B.size) return 0;
  let s = 0;
  for (const t of A) s += tokenMatch(t, B);
  return s / Math.max(A.length, B.size);
}

// Casa UMA descrição -> item do catálogo. GTIN exato > apelido exato > fuzzy.
async function casarItem(db, descricao, gtin) {
  if (gtin) {
    const { rows } = await db.query(`SELECT catalogo_id FROM apelidos WHERE gtin = $1 LIMIT 1`, [gtin]);
    if (rows[0]) return { catalogo_id: rows[0].catalogo_id, confianca: 'gtin', score: 1, sugestoes: [] };
  }
  const alvo = normalizar(descricao);
  const { rows: apes } = await db.query(`SELECT catalogo_id, texto_na_nota FROM apelidos`);
  for (const a of apes) {
    if (normalizar(a.texto_na_nota) === alvo) {
      return { catalogo_id: a.catalogo_id, confianca: 'apelido', score: 1, sugestoes: [] };
    }
  }
  const { rows: cat } = await db.query(`SELECT id, nome_canonico FROM catalogo WHERE ativo = true`);
  const cand = [];
  for (const c of cat) cand.push({ id: c.id, base: c.nome_canonico, score: similar(alvo, c.nome_canonico) });
  for (const a of apes) cand.push({ id: a.catalogo_id, base: a.texto_na_nota, score: similar(alvo, a.texto_na_nota) });
  cand.sort((x, y) => y.score - x.score);
  const top = cand[0];
  const AUTO = 0.6, SUGERE = 0.5;
  if (top && top.score >= AUTO) {
    return { catalogo_id: top.id, confianca: 'fuzzy', score: top.score, sugestoes: [] };
  }
  const sugestoes = cand.filter((c) => c.score >= SUGERE).slice(0, 3)
    .map((c) => ({ catalogo_id: c.id, base: c.base, score: +c.score.toFixed(2) }));
  return { catalogo_id: null, confianca: null, score: top ? top.score : 0, sugestoes };
}

// Processa uma nota inteira (itens já extraídos).
// S1: todos os itens ficam em compra_itens para revisão humana — nenhum evento é criado aqui.
// O dono revisa na tela e confirma via /compras/confirmar-todos.
async function processarNota(db, { mercado, chave_nfce, origem, total, itens }) {
  if (!Array.isArray(itens) || !itens.length) return { erro: 'nota sem itens' };
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: cr } = await client.query(
      `INSERT INTO compras (mercado, chave_nfce, total, origem) VALUES ($1,$2,$3,$4) RETURNING id`,
      [mercado || null, chave_nfce || null, total ?? null, origem || 'manual']
    );
    const compra_id = cr[0].id;
    const revisao = [];
    for (const it of itens) {
      const m = await casarItem(client, it.descricao, it.gtin);
      if (m.catalogo_id) {
        const { rows: ci } = await client.query(
          `INSERT INTO compra_itens (compra_id, catalogo_id, descricao_nota, qtd, preco_unit) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [compra_id, m.catalogo_id, it.descricao, it.qtd ?? 1, it.preco_unit ?? null]
        );
        revisao.push({
          compra_item_id: ci[0].id, descricao: it.descricao,
          qtd: it.qtd ?? 1, preco_unit: it.preco_unit ?? null,
          catalogo_id: m.catalogo_id, nome_canonico: null,
          confianca: m.confianca, score: m.score, sugestoes: [],
        });
      } else {
        const { rows: ci } = await client.query(
          `INSERT INTO compra_itens (compra_id, descricao_nota, qtd, preco_unit) VALUES ($1,$2,$3,$4) RETURNING id`,
          [compra_id, it.descricao, it.qtd ?? 1, it.preco_unit ?? null]
        );
        revisao.push({
          compra_item_id: ci[0].id, descricao: it.descricao,
          qtd: it.qtd ?? 1, preco_unit: it.preco_unit ?? null,
          catalogo_id: null, nome_canonico: null,
          confianca: null, score: m.score, sugestoes: m.sugestoes,
        });
      }
    }
    // Busca nomes canônicos de todos os produtos reconhecidos
    const matchedIds = [...new Set(revisao.filter(r => r.catalogo_id).map(r => r.catalogo_id))];
    if (matchedIds.length) {
      const { rows: nomes } = await client.query(
        `SELECT id, nome_canonico FROM catalogo WHERE id = ANY($1)`, [matchedIds]
      );
      const nomeMap = Object.fromEntries(nomes.map(n => [n.id, n.nome_canonico]));
      revisao.forEach(r => { if (r.catalogo_id) r.nome_canonico = nomeMap[r.catalogo_id] || null; });
    }
    await client.query('COMMIT');
    return { compra_id, itens: revisao };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// Confirmação humana de item individual: vincula, aprende apelido e dá entrada.
// Idempotente: se já confirmado (confirmado_em preenchido), retorna ok sem novo evento.
async function confirmarItem(db, { compra_item_id, catalogo_id, gtin, aprender = true }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT * FROM compra_itens WHERE id = $1`, [compra_item_id]);
    const ci = rows[0];
    if (!ci) { await client.query('ROLLBACK'); return { erro: 'item de compra não encontrado' }; }
    if (ci.confirmado_em) { await client.query('COMMIT'); return { ok: true, catalogo_id: ci.catalogo_id }; }
    let alvoId = catalogo_id;
    if (!alvoId) { await client.query('ROLLBACK'); return { erro: 'catalogo_id obrigatório' }; }
    await client.query(
      `UPDATE compra_itens SET catalogo_id = $1, confirmado_em = NOW() WHERE id = $2`,
      [alvoId, compra_item_id]
    );
    await client.query(
      `INSERT INTO eventos (catalogo_id, tipo, qtd, quem, compra_id) VALUES ($1,'compra',$2,'dono',$3)`,
      [alvoId, ci.qtd ?? 1, ci.compra_id]
    );
    if (aprender && ci.descricao_nota) {
      const { rows: ae } = await client.query(
        `SELECT 1 FROM apelidos WHERE catalogo_id=$1 AND LOWER(texto_na_nota)=LOWER($2) LIMIT 1`,
        [alvoId, ci.descricao_nota]
      );
      if (!ae.length) {
        await client.query(
          `INSERT INTO apelidos (catalogo_id, texto_na_nota, gtin, fonte) VALUES ($1,$2,$3,'confirmacao')`,
          [alvoId, ci.descricao_nota, gtin || null]
        );
      }
    }
    await client.query('COMMIT');
    return { ok: true, catalogo_id: alvoId };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ===== ADAPTADORES DE ENTRADA (a implementar — cada um devolve itens[]) =====
// (A) NFC-e por chave/QR (44 dígitos): portal SEFAZ varia por UF / pode ter captcha; avaliar API paga.
async function itensDaNFCe(/* chave */) { throw new Error('itensDaNFCe: nao implementado (Fase 2)'); }
// (B) Foto do cupom lida por IA. Provedor configurado em AI_PROVIDER (.env).
async function itensDaFoto(imagemBase64, mimeType = 'image/jpeg') {
  const provider = (process.env.AI_PROVIDER || 'claude').toLowerCase();
  if (provider === 'claude') {
    const { itensDaFotoViaClaude } = require('../ai/foto');
    return itensDaFotoViaClaude(imagemBase64, mimeType);
  }
  throw new Error(`AI_PROVIDER "${provider}" não implementado`);
}

module.exports = { normalizar, casarItem, processarNota, confirmarItem, itensDaNFCe, itensDaFoto };
