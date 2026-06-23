// Cria o schema e popula o catálogo inicial (migrado da planilha) + estoque como eventos.
// Uso: node src/db/seed.js   (lê DATABASE_URL do .env)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./index');

// [nome, categoria(corredor), unidade, tamanho, par_level, min_nivel, icone, estoque_inicial]
const PRODUTOS = [
  ['Água sanitária','Limpeza','L','5L',2,1,'🧴',2],
  ['Ajax','Limpeza','L','1L',2,1,'🧴',2],
  ['Amaciante','Lavanderia','L','2L',2,1,'🧺',2],
  ['Bom Ar','Ar e higiene','un','360ml',1,1,'💨',1],
  ['Buchinha','Utensílios','un','',6,2,'🧽',6],
  ['Detergente','Cozinha','un','500ml',12,3,'🧴',12],
  ['Lysoform','Limpeza','L','5L',1,1,'🧴',1],
  ['Óleo de peroba','Limpeza','un','',2,1,'🪵',2],
  ['Palha de aço inox (pia)','Utensílios','un','',3,1,'🧽',3],
  ['Palha de aço inox (tanque)','Utensílios','un','grande',2,1,'🧽',2],
  ['Rodinho de pia','Utensílios','un','',2,1,'🧹',2],
  ['Saquinhos G (lixo saída)','Descartáveis','rolo','',1,1,'🗑️',1],
  ['Saquinhos M (banheiro)','Descartáveis','rolo','',1,1,'🗑️',1],
  ['Sabão em barra','Lavanderia','un','',5,1,'🧼',5],
  ['Sabão de côco','Lavanderia','un','',5,1,'🧼',5],
  ['Sabão em pó','Lavanderia','un','caixa',2,1,'🧺',2],
  ['Sabão líquido','Lavanderia','L','',2,1,'🧺',2],
  ['Sapóleo','Limpeza','un','450ml',2,1,'🧴',2],
  ['Veja / Ypê multiuso','Limpeza','un','500ml',2,1,'🧴',2],
  ['Veja limpa chão','Limpeza','L','2L',2,1,'🧹',2],
  ['Vidrex','Limpeza','un','500ml',2,1,'🪟',2],
];

async function main() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('Schema aplicado.');

  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM catalogo');
  if (rows[0].n > 0) {
    console.log(`Catálogo já tem ${rows[0].n} itens — seed de dados ignorado.`);
    await pool.end();
    return;
  }

  for (const [nome, cat, un, tam, par, min, icone, est] of PRODUTOS) {
    const r = await pool.query(
      `INSERT INTO catalogo (nome_canonico, categoria, unidade, tamanho, par_level, min_nivel, icone)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [nome, cat, un, tam, par, min, icone]
    );
    await pool.query(
      `INSERT INTO eventos (catalogo_id, tipo, qtd, quem) VALUES ($1,'ajuste',$2,'sistema')`,
      [r.rows[0].id, est]
    );
  }
  console.log(`Seed concluído: ${PRODUTOS.length} produtos inseridos.`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
