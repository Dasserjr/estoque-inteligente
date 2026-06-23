const { Resend } = require('resend');
const pool = require('../db');

async function enviarResumoSemanal() {
  const apiKey = process.env.RESEND_API_KEY;
  const emailDono = process.env.EMAIL_DONO;
  if (!apiKey || !emailDono) {
    console.log('[email] RESEND_API_KEY ou EMAIL_DONO não configurado — ignorado.');
    return;
  }

  const { rows: movimentos } = await pool.query(`
    SELECT c.nome_canonico, c.icone, SUM(ABS(e.qtd)) AS consumido, COUNT(*) AS registros
    FROM eventos e
    JOIN catalogo c ON c.id = e.catalogo_id
    WHERE e.data >= NOW() - INTERVAL '7 days' AND e.tipo = 'uso'
    GROUP BY c.id, c.nome_canonico, c.icone
    ORDER BY c.nome_canonico
  `);

  const { rows: atencao } = await pool.query(`
    SELECT nome_canonico, icone, estoque, min_nivel,
      CASE WHEN estoque <= min_nivel THEN 'comprar' ELSE 'atencao' END AS situacao
    FROM v_estoque
    WHERE estoque <= min_nivel + 1
    ORDER BY estoque, nome_canonico
  `);

  const dataHoje = new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' });
  const semMovimentos = movimentos.length === 0;

  const tabelaMovimentos = semMovimentos
    ? '<p style="color:#dc2626;font-weight:600;margin:0">⚠️ Nenhum item foi atualizado esta semana.</p>'
    : `<table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="background:#f1f5f9">
          <th style="padding:8px 12px;text-align:left">Produto</th>
          <th style="padding:8px 12px">Consumido</th>
          <th style="padding:8px 12px">Registros</th>
        </tr></thead>
        <tbody>${movimentos.map(m=>`
          <tr style="border-bottom:1px solid #f1f5f9">
            <td style="padding:8px 12px">${m.icone||'🧴'} ${m.nome_canonico}</td>
            <td style="padding:8px 12px;text-align:center">${m.consumido} un.</td>
            <td style="padding:8px 12px;text-align:center;color:#64748b">${m.registros}×</td>
          </tr>`).join('')}
        </tbody>
      </table>`;

  const tabelaAtencao = atencao.length === 0
    ? '<p style="color:#16a34a;font-weight:600;margin:0">✅ Todos os itens em dia.</p>'
    : `<table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="background:#f1f5f9">
          <th style="padding:8px 12px;text-align:left">Produto</th>
          <th style="padding:8px 12px">Situação</th>
          <th style="padding:8px 12px">Estoque / Mín</th>
        </tr></thead>
        <tbody>${atencao.map(a=>`
          <tr style="border-bottom:1px solid #f1f5f9">
            <td style="padding:8px 12px">${a.icone||'🧴'} ${a.nome_canonico}</td>
            <td style="padding:8px 12px;text-align:center;font-weight:700;color:${a.situacao==='comprar'?'#dc2626':'#d97706'}">${a.situacao==='comprar'?'Comprar':'Atenção'}</td>
            <td style="padding:8px 12px;text-align:center">${a.estoque} / ${a.min_nivel}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;

  const html = `<!DOCTYPE html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <div style="background:#0ea5e9;padding:24px;color:#fff">
    <h1 style="margin:0;font-size:22px">🏠 Estoque de Casa</h1>
    <p style="margin:6px 0 0;opacity:.9">Resumo semanal — ${dataHoje}</p>
  </div>
  <div style="padding:24px">
    <h2 style="color:#0f172a;font-size:17px;margin:0 0 12px">📦 Consumo da semana</h2>
    ${tabelaMovimentos}
    <h2 style="color:#0f172a;font-size:17px;margin:24px 0 12px">🛒 Situação do estoque</h2>
    ${tabelaAtencao}
  </div>
  <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">
    Enviado automaticamente toda sexta-feira pelo Estoque de Casa.
  </div>
</div>
</body></html>`;

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: 'Estoque de Casa <onboarding@resend.dev>',
    to: emailDono,
    subject: `📦 Resumo do estoque — ${new Date().toLocaleDateString('pt-BR')}`,
    html
  });

  console.log(`[email] Resumo semanal enviado para ${emailDono}`);
}

module.exports = { enviarResumoSemanal };
