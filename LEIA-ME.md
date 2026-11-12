# Site da Clínica Dias

## Pastas

- `site/`: é o que sobe para a VPS. O conteúdo dela vai na raiz do domínio.
  - `index.html`, `a-clinica.html`, `atendimento.html`, `exames.html`, `privacidade.html`: as páginas.
  - `css/site.css`: o estilo de todas as páginas.
  - `js/`: `site.js` (menu, especialidades, avaliações, fotos e mapa), `anima.js` (animações), `a-clinica.js` e `vendor/` (GSAP).
  - `img/` e `fonts/`: imagens e a fonte Jost.
  - `passeio/`: o passeio 3D (`modelos/` é gerado pelo Blender, não mexer à mão).
  - `_previa/`: páginas de teste (ideias e links da bio). **Não sobe para a VPS.**
- `blender/`: gera o modelo 3D e as maquetes a partir de `site/passeio/planta.js`.
  - `roda.ps1`, `roda_render.ps1`, `roda_final.ps1` e `roda_todas.ps1`: rodam tudo. Veja o uso na primeira linha de cada um.
  - `scripts/`: os scripts que o `roda*.ps1` chama.
  - `avulsos/`: scripts usados de vez em quando (placas, paredes da planta).
  - `dados/`: o `planta.json`, gerado do `planta.js`.
  - `texturas/`: as texturas e as placas.
  - `logs/` e `temp/`: arquivos gerados, fora do git.
- `ferramentas/mapa/`: gera `site/img/mapa-vale-do-aco.webp`, o desenho que aparece enquanto o mapa do "Como chegar" carrega (ou se o navegador não tiver WebGL). O mapa de verdade é o MapLibre (`site/js/vendor/maplibre/`, copiado do pacote `maplibre-gl`) com o estilo gratuito do OpenFreeMap. Para refazer: `python -I baixa_tiles.py <pasta>` e depois `python -I desenha.py <pasta> saida.webp saida.json`. O JSON traz a posição dos pinos.
- `imersao-flow/`: fotos reais da clínica (f01–f52) e o material do vídeo. Fica só no PC.
- `arquivo/`: o que não é mais usado: o site antigo, os modelos de site, a proposta e as versões anteriores.

## Rodar no PC

`npm run dev` e abrir http://localhost:4321/. No celular, na mesma rede, use o IP do PC na porta 4321.
