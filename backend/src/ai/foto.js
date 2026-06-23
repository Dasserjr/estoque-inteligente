const Anthropic = require('@anthropic-ai/sdk');

const PROMPT = `Analise este cupom fiscal / nota fiscal brasileira.
Extraia todos os itens comprados e retorne SOMENTE um JSON válido, sem texto adicional:

{
  "mercado": "nome do estabelecimento (ou null)",
  "total": 0.00,
  "itens": [
    {"descricao": "NOME DO PRODUTO NA NOTA", "qtd": 1, "preco_unit": 0.00}
  ]
}

Regras:
- descricao: exatamente como aparece na nota (preserve abreviações e maiúsculas)
- qtd: quantidade numérica (1 se não especificado)
- preco_unit: preço unitário em reais (número decimal)
- total: valor total da nota (null se não visível)
- Inclua TODOS os produtos da nota`;

async function itensDaFotoViaClaude(imagemBase64, mimeType) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: imagemBase64 } },
        { type: 'text', text: PROMPT }
      ]
    }]
  });
  const texto = msg.content[0].text.trim();
  const m = texto.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('IA não retornou JSON válido');
  return JSON.parse(m[0]);
}

module.exports = { itensDaFotoViaClaude };
