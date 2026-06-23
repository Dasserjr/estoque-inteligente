// Estoque Inteligente — API em Cloudflare Workers (Hono) sobre D1.
// Static assets (PWA em /public) são servidos automaticamente pelo binding ASSETS;
// o Worker só trata as rotas /api/*.

import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();
app.use('/api/*', cors());

const json = (c, data, status = 200) => c.json(data, status);

// Situação derivada do estoque vs. mínimo (filosofia: comprar antes de acabar).
function situacao(estoque, min) {
  if (estoque <= min) return 'comprar';
  if (estoque <= min + 1) return 'atencao';
  return 'ok';
}

// ---------- ITENS / ESTOQUE ----------

// Lista todos os itens ativos com estoque atual, situação e consumo recente.
app.get('/api/itens', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT v.*,
      COALESCE((SELECT -SUM(e.qtd) FROM eventos e
                WHERE e.catalogo_id = v.id AND e.tipo = 'uso'
                AND e.data >= datetime('now','-28 days')), 0) AS uso_28d
    FROM v_estoque v
    ORDER BY v.nome_canonico
  `).all();

  const itens = results.map((r) => {
    const consumoSemana = +(r.uso_28d / 4).toFixed(2);
    const consumoDia = r.uso_28d / 28;
    const diasCobertura = consumoDia > 0 ? Math.round(r.estoque / consumoDia) : null;
    return {
      ...r,
      situacao: situacao(r.estoque, r.min_nivel),
      consumo_semana: consumoSemana,
      dias_cobertura: diasCobertura,
    };
  });
  return json(c, itens);
});

// Registra um movimento (o coração do ledger). delta<0 = uso, delta>0 = compra.
app.post('/api/itens/:id/mov', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json().catch(() => ({}));
  const delta = Number(body.delta);
  if (!id || !delta) return json(c, { erro: 'delta inválido' }, 400);
  const tipo = delta < 0 ? 'uso' : 'compra';
  const quem = body.quem || 'empregada';
  await c.env.DB.prepare(
    `INSERT INTO eventos (catalogo_id, tipo, qtd, quem) VALUES (?, ?, ?, ?)`
  ).bind(id, tipo, delta, quem).run();
  const row = await c.env.DB.prepare(
    `SELECT estoque, min_nivel FROM v_estoque WHERE id = ?`
  ).bind(id).first();
  return json(c, { id, estoque: row?.estoque ?? 0, situacao: situacao(row?.estoque ?? 0, row?.min_nivel ?? 1) });
});

// Cria produto novo no catálogo.
app.post('/api/itens', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (!b.nome_canonico) return json(c, { erro: 'nome obrigatório' }, 400);
  const r = await c.env.DB.prepare(
    `INSERT INTO catalogo (nome_canonico, categoria, unidade, tamanho, par_level, min_nivel, icone)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(b.nome_canonico, b.categoria || null, b.unidade || 'un', b.tamanho || '',
         b.par_level ?? 1, b.min_nivel ?? 1, b.icone || '🧴').run();
  const id = r.meta.last_row_id;
  if (b.estoque_inicial) {
    await c.env.DB.prepare(`INSERT INTO eventos (catalogo_id, tipo, qtd, quem) VALUES (?, 'ajuste', ?, 'dono')`)
      .bind(id, Number(b.estoque_inicial)).run();
  }
  return json(c, { id }, 201);
});

// Atualiza parâmetros do item (par_level, min_nivel, etc.).
app.put('/api/itens/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const b = await c.req.json().catch(() => ({}));
  const campos = ['nome_canonico', 'categoria', 'unidade', 'tamanho', 'par_level', 'min_nivel', 'lead_time_dias', 'icone', 'ativo'];
  const sets = [], vals = [];
  for (const k of campos) if (k in b) { sets.push(`${k} = ?`); vals.push(b[k]); }
  if (!sets.length) return json(c, { erro: 'nada para atualizar' }, 400);
  vals.push(id);
  await c.env.DB.prepare(`UPDATE catalogo SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  return json(c, { ok: true });
});

// ---------- LISTA DE COMPRAS ----------
// Tudo que chegou no ponto de reposição, com quantidade sugerida (até o par_level)
// e custo estimado (último preço pago, quando houver).
app.get('/api/lista-compras', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT v.id, v.nome_canonico, v.categoria, v.icone, v.estoque, v.min_nivel, v.par_level,
      (SELECT ci.preco_unit FROM compra_itens ci
       WHERE ci.catalogo_id = v.id AND ci.preco_unit IS NOT NULL
       ORDER BY ci.id DESC LIMIT 1) AS ultimo_preco
    FROM v_estoque v
    WHERE v.estoque <= v.min_nivel
    ORDER BY v.categoria, v.nome_canonico
  `).all();
  const itens = results.map((r) => {
    const sugerida = Math.max(1, (r.par_level || r.min_nivel + 1) - r.estoque);
    return { ...r, qtd_sugerida: sugerida, custo_estimado: r.ultimo_preco ? +(r.ultimo_preco * sugerida).toFixed(2) : null };
  });
  const total = itens.reduce((s, i) => s + (i.custo_estimado || 0), 0);
  return json(c, { itens, total_estimado: +total.toFixed(2), gerado_em: new Date().toISOString() });
});

// ---------- FASE 2 (stubs prontos para o Claude Code continuar) ----------
// Recebe itens de uma nota (vindos do QR da NFC-e ou da foto lida por IA),
// casa com o catálogo via apelidos e dá entrada no estoque.
app.post('/api/compras/nota', async (c) => {
  // TODO (Fase 2): parsear NFC-e por chave/QR; casar descricao->catalogo via apelidos+IA;
  // criar compra + compra_itens + eventos 'compra'. Retornar itens não reconhecidos p/ confirmação.
  return json(c, { erro: 'não implementado (Fase 2)' }, 501);
});

// ---------- ANALYTICS (stub Fase 3) ----------
app.get('/api/analytics/resumo', async (c) => {
  const gasto = await c.env.DB.prepare(`
    SELECT COALESCE(SUM(qtd * preco_unit), 0) AS gasto_total FROM compra_itens
  `).first();
  return json(c, { gasto_total: gasto?.gasto_total ?? 0, nota: 'Expandir na Fase 3 (séries temporais por categoria).' });
});

app.get('/api/health', (c) => json(c, { ok: true, ts: Date.now() }));

// Fallback para chamadas /api desconhecidas (assets são servidos antes do Worker).
app.all('/api/*', (c) => json(c, { erro: 'rota não encontrada' }, 404));

export default app;
