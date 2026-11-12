import { defineConfig } from 'vite';
import { readFile } from 'node:fs/promises';
import { resolve, normalize } from 'node:path';

// Servidor local da cópia do site. Os arquivos ficam em site/ e a tela
// atualiza sozinha quando um deles muda. --host libera o acesso pelo celular.

// Os scripts de site/js/ (o do site e as bibliotecas em vendor/) saem do jeito que estão no disco, igual a VPS vai servir.
// Sem isso o Vite reescreve o site.js (por causa do import() do mapa) e o MapLibre, e nada funciona no localhost.
const raiz = resolve('site');
const vendorCru = {
  name: 'vendor-cru',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const caminho = decodeURIComponent((req.url || '').split('?')[0]);
      if (!caminho.startsWith('/js/')) return next();
      const arquivo = normalize(resolve(raiz, '.' + caminho));
      if (!arquivo.startsWith(raiz)) return next();
      try {
        const corpo = await readFile(arquivo);
        const tipo = arquivo.endsWith('.css') ? 'text/css' : 'text/javascript';
        res.setHeader('Content-Type', `${tipo}; charset=utf-8`);
        res.end(corpo);
      } catch {
        next();
      }
    });
  },
};

export default defineConfig({
  root: 'site',
  appType: 'mpa',
  publicDir: false,
  server: { host: '0.0.0.0', port: 4321, strictPort: true },
  plugins: [vendorCru],
});
