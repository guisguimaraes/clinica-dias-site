import { defineConfig } from 'vite';

// Servidor local da cópia do site. Os arquivos ficam em site/ e a tela
// atualiza sozinha quando um deles muda. --host libera o acesso pelo celular.
export default defineConfig({
  root: 'site',
  appType: 'mpa',
  publicDir: false,
  server: { host: '0.0.0.0', port: 4321, strictPort: true },
});
