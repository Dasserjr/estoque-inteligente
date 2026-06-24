// Substitui a versão do cache do Service Worker pela versão atual do package.json.
// Roda antes do servidor subir (ver "start" no package.json raiz).
const fs = require('fs');
const path = require('path');

const version = require('../package.json').version;
const swPath = path.join(__dirname, '..', 'frontend', 'sw.js');
const current = fs.readFileSync(swPath, 'utf8');
const updated = current.replace(/estoque-shell-v[^\s"']+/, 'estoque-shell-v' + version);

if (current !== updated) {
  fs.writeFileSync(swPath, updated, 'utf8');
  console.log(`[bump-sw] Service Worker atualizado para estoque-shell-v${version}`);
} else {
  console.log(`[bump-sw] Service Worker já em estoque-shell-v${version}`);
}
