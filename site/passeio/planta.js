// Planta da Clínica Dias (Timóteo) com os dois andares de atendimento, para o passeio 3D.
//
// Fontes (projeto de Lígia Araujo, aprovado na Vigilância em 26/09/2025):
//   PAV.TÉRREO (folha 01/05)  → Recepção 1, entrada pela Rua Cento e Vinte e Oito (estacionamento)
//   PLANTA 1º PAV (folha 02/05) → Recepção 2, entrada pela Avenida Treze (Portaria 2)
// As paredes vêm do vetor das plantas cotadas (blender/extrai_paredes_svg.py → paredes-*.js).
// Móveis e acabamentos: planta layout + fotos de 2026-11-06 (imersao-flow/trabalho/fotos-originais).
//
// Coordenadas em metros, iguais para os dois andares:
//   x = da face oeste do prédio para leste (Av. Treze em x ≈ 35,9)
//   z = da face norte para o sul (estacionamento e Rua 128 em z > 14,6)
//   y = altura real: térreo 0,00 · 1º pav. prédio novo +3,35 · 1º pav. prédio antigo +3,79
// O mesmo arquivo alimenta o navegador e o script do Blender (blender/planta_json.mjs).
import paredesTerreo from './paredes-terreo.js';
import paredesPav1 from './paredes-pav1.js';

const T = 0;          // térreo
const N_REC = 3.35;   // 1º pav., prédio novo (Recepção 2, corredor)
const N_ANT = 3.79;   // 1º pav., prédio antigo (espera 18,4 m², consultórios)
const N_RUA2 = 2.84;  // calçada da Av. Treze (3 degraus abaixo da recepção 2)
const PE = 2.75;      // pé-direito do 1º pav.
const FORRO_T = 2.9;  // forro do térreo
const X_DIVISA = 16.3; // divisa prédio antigo / novo

export const nivel = { terreo: T, rec2: N_REC, antigo: N_ANT, rua2: N_RUA2 };
export const andares = [
  { id: 'terreo', nome: 'Térreo', y: T },
  { id: 'pav1', nome: '1º pavimento', y: N_REC },
];

// ───────────── paredes extraídas → caixas, com portas e janelas nos vãos
const toca = (w, r) => w.x0 < r[2] && w.x1 > r[0] && w.z0 < r[3] && w.z1 > r[1];

// tira um retângulo (em planta) de cada parede que ele corta
function abre(paredes, r) {
  const out = [];
  for (const w of paredes) {
    if (!toca(w, r)) { out.push(w); continue; }
    if (w.o === 'h') {
      if (w.x0 < r[0]) out.push({ ...w, x1: r[0] });
      if (w.x1 > r[2]) out.push({ ...w, x0: r[2] });
    } else {
      if (w.z0 < r[1]) out.push({ ...w, z1: r[1] });
      if (w.z1 > r[3]) out.push({ ...w, z0: r[3] });
    }
  }
  return out;
}

function paredesDoAndar(lista, opc) {
  const { base, topo, externa, nome } = opc;
  const pecas = [];
  // agrupa trechos na mesma linha (mesma orientação, eixo central a até 7 cm) para achar os vãos
  const centro = (w) => (w.o === 'h' ? (w.z0 + w.z1) / 2 : (w.x0 + w.x1) / 2);
  const linhas = [];
  for (const o of ['h', 'v']) {
    const ws = lista.filter((w) => w.o === o).sort((a, b) => centro(a) - centro(b));
    let atual = null;
    for (const w of ws) {
      if (atual && Math.abs(centro(w) - atual.c) < 0.07) { atual.ws.push(w); atual.c = (atual.c * (atual.ws.length - 1) + centro(w)) / atual.ws.length; }
      else { atual = { c: centro(w), ws: [w] }; linhas.push(atual); }
    }
  }
  let n = 0;
  for (const { ws } of linhas) {
    const h = ws[0].o === 'h';
    ws.sort((a, b) => (h ? a.x0 - b.x0 : a.z0 - b.z0));
    let fim = -1e9;
    ws.forEach((w, i) => {
      const cx = (w.x0 + w.x1) / 2;
      const y0 = base(cx, (w.z0 + w.z1) / 2) - 0.12;
      const y1 = topo(cx, (w.z0 + w.z1) / 2);
      pecas.push({ tipo: 'caixa', nome: `${nome}-p${n++}`, min: [w.x0, y0, w.z0], max: [w.x1, y1, w.z1], mat: 'parede' });
      fim = Math.max(fim, h ? w.x1 : w.z1);
      const prox = ws[i + 1];
      if (!prox) return;
      const a = fim, b = h ? prox.x0 : prox.z0;
      const vao = b - a;
      if (vao < 0.55 || vao > 2.6) return;
      // vão: verga sempre; porta fechada se for porta comum; janela se for parede externa
      const mid = (a + b) / 2;
      const px = h ? mid : (w.x0 + w.x1) / 2, pz = h ? (w.z0 + w.z1) / 2 : mid;
      const yb = base(px, pz);
      const caixaVao = (ya, yb2, mat, tag) => pecas.push({
        tipo: 'caixa', nome: `${nome}-${tag}${n++}`, mat,
        min: h ? [a, ya, w.z0] : [w.x0, ya, a], max: h ? [b, yb2, w.z1] : [w.x1, yb2, b],
      });
      if (externa(w)) {
        caixaVao(yb - 0.12, yb + 1.0, 'parede', 'peitoril');
        caixaVao(yb + 2.2, y1, 'parede', 'verga');
        pecas.push({ tipo: 'vidro', nome: `vidro-${nome}-j${n++}`,
          min: h ? [a, yb + 1.0, pz - 0.02] : [px - 0.02, yb + 1.0, a], max: h ? [b, yb + 2.2, pz + 0.02] : [px + 0.02, yb + 2.2, b] });
      } else {
        caixaVao(yb + 2.1, y1, 'parede', 'verga');
        if (vao <= 1.0) pecas.push({ tipo: 'porta', nome: `${nome}-porta${n++}`, centro: [px, yb, pz], vira: h ? 0 : 90, largura: vao });
      }
    });
  }
  return pecas;
}

// portas achadas pelo arco de abertura (extrai_paredes_svg.py) + portas do caminho, à mão
function comPortas(paredes, portas, base, nome) {
  let ws = paredes;
  const pecas = [];
  portas.forEach((d, i) => {
    const r = d.o === 'h' ? [d.a, d.c - 0.2, d.b, d.c + 0.2] : [d.c - 0.2, d.a, d.c + 0.2, d.b];
    ws = abre(ws, r);
    const m = (d.a + d.b) / 2;
    const cx = d.o === 'h' ? m : d.c, cz = d.o === 'h' ? d.c : m;
    const y = base(cx, cz);
    const e = 0.075;
    pecas.push({ tipo: 'caixa', nome: `${nome}-vergaporta${i}`, mat: 'parede',
      min: d.o === 'h' ? [d.a, y + 2.1, d.c - e] : [d.c - e, y + 2.1, d.a], max: d.o === 'h' ? [d.b, y + (d.topo || 2.75), d.c + e] : [d.c + e, y + (d.topo || 2.75), d.b] });
    if (!d.aberta) pecas.push({ tipo: 'porta', nome: `${nome}-porta-a${i}`, centro: [cx, y, cz], vira: d.o === 'h' ? 0 : 90, largura: d.b - d.a, placa: d.placa });
  });
  return { ws, pecas };
}

// térreo: o vidro da fachada da Recepção 1 vira vitrine (montada à mão abaixo)
const filtroT = paredesTerreo.paredes.filter((w) => !(w.o === 'h' && w.z0 > 14.25 && w.x0 > 3.2 && w.x1 < 12.2));
const portasT = [
  ...paredesTerreo.portas,
  { o: 'v', c: 17.53, a: 6.75, b: 7.65 },              // troca de macas → Bloco Cirúrgico (fotos f51–f52)
  { o: 'v', c: 17.53, a: 7.65, b: 8.05 , aberta: true },
];
const rT = comPortas(filtroT, portasT, () => T, 'terreo');

// 1º pav.: a rampa entra no prédio antigo; a espera é aberta para a coluna de cadeiras (fotos f22–f27);
// as portas da passagem das faixas coloridas ficam abertas no passeio
let pPav1 = abre(paredesPav1.paredes, [16.1, 6.42, 16.5, 7.97]);
pPav1 = abre(pPav1, [14.15, 4.7, 14.45, 8.9]);
pPav1 = abre(pPav1, [9.8, 7.92, 10.1, 9.03]);
pPav1 = abre(pPav1, [6.0, 7.92, 6.35, 9.03]);
const rP1 = comPortas(pPav1, paredesPav1.portas, (x) => (x < X_DIVISA ? N_ANT : N_REC), 'pav1');
const pTerreo = rT.ws;

const baseT = () => T;
const topoT = (x) => (x < X_DIVISA ? N_ANT - 0.12 : N_REC - 0.12);
const baseP1 = (x) => (x < X_DIVISA ? N_ANT : N_REC);
const topoP1 = (x) => baseP1(x) + PE;
const extT = (w) => (w.o === 'h' ? w.z1 < 0.3 || w.z0 > 14.25 : w.x1 < 0.35 || w.x0 > 34.1);
const extP1 = (w) => (w.o === 'h' ? w.z1 < 0.3 || (w.z0 > 14.3 && w.x1 < 16.4) : w.x1 < 0.35);

// ───────────── peças
export const pecas = [
  // ════════ TÉRREO ════════
  // estacionamento (5 vagas) e Rua Cento e Vinte e Oito
  { tipo: 'caixa', nome: 'rua-128', min: [-6, T - 0.2, 21.2], max: [40, T - 0.05, 30], mat: 'asfalto' },
  { tipo: 'caixa', nome: 'estacionamento', min: [-6, T - 0.15, 14.6], max: [19.3, T - 0.02, 21.2], mat: 'calcada' },
  { tipo: 'faixas-vaga', nome: 'vagas', de: [0.4, T, 15.2], n: 5, passo: 2.6, fundo: 5.0 },
  { tipo: 'caixa', nome: 'calcada-128', min: [-6, T - 0.15, 20.4], max: [40, T, 21.2], mat: 'calcada' },
  { tipo: 'caixa', nome: 'jardim', min: [19.3, T - 0.15, 9.6], max: [34.4, T + 0.1, 21.2], mat: 'grama' },

  // fachada da Recepção 1: vitrine 284×290 + porta de vidro + vitrine 478×290 (folha 01/05)
  { tipo: 'vidro', nome: 'vitrine-r1-a', min: [3.31, T, 14.38], max: [6.14, T + 2.9, 14.44] },
  { tipo: 'porta-vidro', nome: 'porta-r1', min: [6.14, T, 14.38], max: [7.34, T + 2.6, 14.44], texto: 'EMPURRE' },
  { tipo: 'caixa', nome: 'verga-porta-r1', min: [6.14, T + 2.6, 14.35], max: [7.34, T + 3.23, 14.57], mat: 'fachada' },
  { tipo: 'vidro', nome: 'vitrine-r1-b', min: [7.34, T, 14.38], max: [12.11, T + 2.9, 14.44] },
  { tipo: 'caixa', nome: 'faixa-r1', min: [3.2, T + 2.9, 14.35], max: [12.2, T + 3.35, 14.6], mat: 'fachada' },
  { tipo: 'caixa', nome: 'marquise-r1', min: [2.8, T + 3.0, 14.57], max: [12.6, T + 3.15, 15.6], mat: 'concreto' },
  { tipo: 'letreiro', nome: 'logo-r1', centro: [7.6, T + 3.85, 14.62], largura: 2.8, vira: 0, texto: 'CLÍNICA DIAS', sub: '' },
  { tipo: 'caixa', nome: 'volume-sup-r1', min: [-0.05, N_ANT - 0.12, 14.4], max: [16.3, N_ANT + PE + 3.2, 14.62], mat: 'fachada', teto: true },
  // recepção 1: 5 guichês junto à parede de "mármore" com o logo (fotos f35–f39)
  { tipo: 'painel-marmore', nome: 'parede-logo-r1', min: [3.41, T, 9.0], max: [3.47, T + 2.6, 14.3], vira: 90, logo: true },
  { tipo: 'balcao', nome: 'guiches-r1', min: [4.35, T, 9.2], max: [4.95, T + 1.05, 13.9], guiches: 5, eixo: 'z', marmore: true },
  { tipo: 'tv', nome: 'tv-r1', centro: [3.5, T + 2.3, 11.6], largura: 1.0, vira: 90 },
  // espera 87,8 m²: fileiras viradas para o painel "Nossa missão: Fazer história" (parede norte)
  { tipo: 'banner', nome: 'banner-missao', min: [8.9, T + 0.3, 7.78], max: [11.8, T + 2.6, 7.82], texto: ['Nossa missão:', 'Fazer história'] },
  ...[9.4, 10.2, 11.8, 12.6, 13.4].map((z, i) => ({ tipo: 'cadeiras', nome: `espera-r1-${i}`, de: [8.1, T, z], n: 6, passo: [0.55, 0, 0], vira: 180, cor: 'cinza' })),
  { tipo: 'caixa', nome: 'pilar-r1', min: [7.44, T, 10.84], max: [7.62, T + FORRO_T, 11.19], mat: 'parede' },
  { tipo: 'cadeiras', nome: 'espera-r1-parede', de: [11.8, T, 10.2], n: 6, passo: [0, 0, 0.55], vira: -90, cor: 'cinza' },
  // corredor até o Bloco Cirúrgico (z 6,3–8,3), entrada pela troca de macas (fotos f49–f52)
  { tipo: 'caixa', nome: 'mureta-jardim', min: [19.2, T, 9.55], max: [34.3, T + 1.0, 9.7], mat: 'parede' },
  { tipo: 'vidro', nome: 'vidro-jardim', min: [19.2, T + 1.0, 9.6], max: [34.3, T + 2.8, 9.65] },
  { tipo: 'cadeiras', nome: 'cadeiras-bloco', de: [12.7, T, 6.6], n: 5, passo: [0.55, 0, 0], vira: 0, cor: 'preto' },
  { tipo: 'placa', nome: 'placa-bloco', centro: [17.4, T + 2.35, 7.2], texto: 'BLOCO CIRÚRGICO', vira: -90 },
  // forro do térreo (some na maquete)
  { tipo: 'caixa', nome: 'teto-terreo-a', min: [0, FORRO_T, 0], max: [34.36, FORRO_T + 0.08, 8.45], mat: 'teto', teto: true },
  { tipo: 'caixa', nome: 'teto-terreo-b', min: [0, FORRO_T, 8.45], max: [19.2, FORRO_T + 0.08, 14.57], mat: 'teto', teto: true },
  { tipo: 'caixa', nome: 'teto-corredor-bloco', min: [19.2, FORRO_T, 8.45], max: [34.36, FORRO_T + 0.08, 9.7], mat: 'teto', teto: true },
  // pisos do térreo
  { tipo: 'caixa', nome: 'piso-terreo-a', min: [0, T - 0.12, 0], max: [34.36, T, 8.45], mat: 'granito' },
  { tipo: 'caixa', nome: 'piso-terreo-b', min: [0, T - 0.12, 8.45], max: [19.2, T, 14.57], mat: 'granito' },
  { tipo: 'caixa', nome: 'piso-corredor-bloco', min: [19.2, T - 0.12, 8.45], max: [34.36, T, 9.7], mat: 'granito' },
  ...rT.pecas,
  ...paredesDoAndar(pTerreo, { base: baseT, topo: topoT, externa: extT, nome: 'terreo' }),

  // ════════ 1º PAVIMENTO ════════
  // Av. Treze: calçada, 3 degraus, rampa externa, fachada (fotos f01–f07)
  { tipo: 'caixa', nome: 'rua-treze', min: [38.6, N_RUA2 - 0.2, -6], max: [48, N_RUA2 - 0.05, 16], mat: 'asfalto' },
  { tipo: 'caixa', nome: 'calcada-treze', min: [35.86, N_RUA2 - 0.15, -6], max: [38.6, N_RUA2, 16], mat: 'calcada' },
  { tipo: 'caixa', nome: 'arrimo-treze', min: [34.36, T, -6], max: [35.86, N_RUA2 - 0.15, 16], mat: 'concreto' },
  { tipo: 'degraus', nome: 'escada-treze', min: [35.86, N_RUA2, 4.05], max: [36.86, N_REC, 6.65], n: 3, eixo: 'x' },
  { tipo: 'corrimao', nome: 'corrimao-escada', de: [36.86, N_RUA2 + 0.9, 5.36], ate: [35.95, N_REC + 0.9, 5.36] },
  { tipo: 'caixa', nome: 'patamar-rampa', min: [29.2, N_RUA2 - 0.15, 8.23], max: [35.86, N_REC - 0.02, 9.5], mat: 'concreto' },
  { tipo: 'guarda-vidro', nome: 'guarda-rampa-ext', de: [29.2, N_REC, 9.5], ate: [35.86, N_REC, 9.5] },
  // parede leste: janelão ao norte (direita de quem chega), porta de correr 220×210 no meio
  { tipo: 'caixa', nome: 'leste-norte', min: [35.72, N_REC - 0.12, 0.17], max: [35.86, N_REC + PE, 1.95], mat: 'parede' },
  { tipo: 'caixa', nome: 'leste-peitoril', min: [35.72, N_REC - 0.12, 1.95], max: [35.86, N_REC + 0.9, 4.1], mat: 'parede' },
  { tipo: 'caixa', nome: 'leste-verga-jan', min: [35.72, N_REC + 2.4, 1.95], max: [35.86, N_REC + PE, 4.1], mat: 'parede' },
  { tipo: 'caixa', nome: 'leste-entre', min: [35.72, N_REC - 0.12, 4.1], max: [35.86, N_REC + PE, 4.24], mat: 'parede' },
  { tipo: 'caixa', nome: 'leste-verga-porta', min: [35.72, N_REC + 2.1, 4.24], max: [35.86, N_REC + PE, 6.48], mat: 'parede' },
  { tipo: 'caixa', nome: 'leste-sul', min: [35.72, N_REC - 0.12, 6.48], max: [35.86, N_REC + PE, 8.23], mat: 'parede' },
  { tipo: 'caixa', nome: 'fachada-alto', min: [35.86, N_REC + 2.4, 0.17], max: [36.05, N_REC + 4.4, 8.23], mat: 'fachada' },
  { tipo: 'caixa', nome: 'fachada-norte', min: [35.86, N_RUA2, -0.2], max: [36.05, N_REC + 4.4, 1.95], mat: 'fachada' },
  { tipo: 'caixa', nome: 'fachada-base-norte', min: [35.86, N_RUA2, 1.95], max: [36.05, N_REC + 0.9, 4.1], mat: 'fachada' },
  { tipo: 'vidro', nome: 'janelao', min: [35.8, N_REC + 0.9, 1.95], max: [35.86, N_REC + 2.4, 4.1] },
  { tipo: 'caixa', nome: 'jardineira', min: [36.05, N_RUA2, 1.95], max: [36.85, N_RUA2 + 0.55, 4.0], mat: 'concreto' },
  { tipo: 'plantas', nome: 'jardineira-plantas', min: [36.1, N_RUA2 + 0.55, 2.0], max: [36.8, N_RUA2 + 1.3, 3.95] },
  { tipo: 'caixa', nome: 'fachada-sul', min: [35.86, N_RUA2, 6.48], max: [36.05, N_REC + 2.4, 8.23], mat: 'fachada' },
  { tipo: 'caixa', nome: 'marquise', min: [35.86, N_REC + 2.35, 3.9], max: [37.0, N_REC + 2.5, 6.8], mat: 'concreto' },
  { tipo: 'porta-vidro', nome: 'portaria-2', min: [35.76, N_REC, 4.24], max: [35.82, N_REC + 2.1, 6.48], eixo: 'x', texto: 'PORTARIA 2' },
  { tipo: 'letreiro', nome: 'logo-fachada', centro: [36.07, N_REC + 1.45, 7.4], largura: 1.6, vira: 90 },
  { tipo: 'caixa', nome: 'volume-2pav', min: [16.3, N_REC + PE + 0.1, 0], max: [36.05, N_REC + PE + 3.3, 8.23], mat: 'fachada', teto: true },
  { tipo: 'caixa', nome: 'volume-2pav-antigo', min: [-0.05, N_ANT + PE + 0.1, -0.05], max: [16.3, N_ANT + PE + 3.0, 14.62], mat: 'fachada', teto: true },

  // recepção 2 (46,54 m²): 6 guichês junto à parede sul, atendentes do lado sul
  { tipo: 'balcao', nome: 'guiches-r2', min: [27.45, N_REC, 6.3], max: [34.2, N_REC + 1.05, 6.9], guiches: 6 },
  { tipo: 'cadeiras', nome: 'cadeiras-rec-leste', de: [35.3, N_REC, 1.9], n: 5, passo: [0, 0, 0.5], vira: -90 },
  { tipo: 'cadeiras', nome: 'cadeiras-rec-bloco', de: [33.75, N_REC, 2.0], n: 3, passo: [0, 0, 0.55], vira: 90 },
  { tipo: 'cadeiras', nome: 'cadeiras-alcova', de: [24.85, N_REC, 2.2], n: 4, passo: [0, 0, 0.5], vira: 90 },

  // rampa interna: 5,28 m, i = 8,33%, sobe para oeste até o prédio antigo
  { tipo: 'rampa', nome: 'rampa', min: [16.36, N_REC, 6.42], max: [21.68, N_ANT, 7.97], sobe: '-x' },
  { tipo: 'guarda-vidro', nome: 'vidro-rampa', de: [21.68, N_REC, 6.42], ate: [16.36, N_REC, 6.42] },
  { tipo: 'corrimao', nome: 'corrimao-rampa', de: [21.68, N_REC + 0.9, 7.88], ate: [16.36, N_ANT + 0.9, 7.88], preso: [0, 0, 0.06] },
  { tipo: 'cadeiras', nome: 'cadeiras-vidro', de: [20.7, N_REC, 6.1], n: 4, passo: [-0.55, 0, 0], vira: 180 },
  { tipo: 'totem', nome: 'totem', centro: [16.9, N_REC, 5.0] },
  { tipo: 'planta', nome: 'planta-corredor', centro: [16.9, N_REC, 6.05] },

  // espera 18,4 m² (prédio antigo): painel de ripas + TV na parede oeste
  { tipo: 'ripado', nome: 'painel-madeira', min: [10.02, N_ANT, 4.7], max: [10.08, N_ANT + PE - 0.25, 7.6], eixo: 'z' },
  { tipo: 'tv', nome: 'tv-espera', centro: [10.11, N_ANT + 1.75, 6.5], largura: 1.1, vira: 90 },
  { tipo: 'quadro', nome: 'quadro-espera', centro: [10.11, N_ANT + 1.65, 5.3], largura: 0.5, altura: 0.6, vira: 90 },
  ...[11.4, 12.3, 13.2].map((x, i) => ({ tipo: 'cadeiras', nome: `espera-r2-${i}`, de: [x, N_ANT, 5.0], n: 6, passo: [0, 0, 0.55], vira: -90 })),
  { tipo: 'cadeiras', nome: 'espera-coluna', de: [15.8, N_ANT, 4.9], n: 3, passo: [0, 0, 0.55], vira: -90 },
  { tipo: 'faixa-piso', nome: 'contorno-espera', min: [10.6, N_ANT, 4.75], max: [14.0, N_ANT, 8.7] },
  { tipo: 'faixas-cores', nome: 'faixas', de: [14.0, N_ANT + 0.002, 8.45], ate: [5.0, N_ANT + 0.002, 8.45], eixo: 'x' },
  { tipo: 'faixas-cores', nome: 'faixas-circ', de: [5.3, N_ANT + 0.002, 8.6], ate: [5.3, N_ANT + 0.002, 12.4], eixo: 'z' },

  // pisos e forros do 1º pav.
  { tipo: 'caixa', nome: 'piso-antigo', min: [0, N_ANT - 0.12, 0], max: [X_DIVISA, N_ANT, 14.59], mat: 'granito' },
  { tipo: 'caixa', nome: 'piso-novo-a', min: [X_DIVISA, N_REC - 0.12, 0.17], max: [35.86, N_REC, 6.42], mat: 'granito' },
  { tipo: 'caixa', nome: 'piso-novo-b', min: [21.68, N_REC - 0.12, 6.42], max: [35.86, N_REC, 8.23], mat: 'granito' },
  { tipo: 'caixa', nome: 'teto-antigo', min: [0, N_ANT + PE, 0], max: [X_DIVISA, N_ANT + PE + 0.08, 14.59], mat: 'teto', teto: true },
  { tipo: 'caixa', nome: 'teto-novo', min: [X_DIVISA, N_REC + PE, 0.17], max: [35.86, N_REC + PE + 0.08, 8.23], mat: 'teto', teto: true },
  ...rP1.pecas,
  ...paredesDoAndar(rP1.ws, { base: baseP1, topo: topoP1, externa: extP1, nome: 'pav1' }),
];

// Cores de base (o Blender usa as mesmas antes de calcular a luz).
export const materiais = {
  asfalto: '#3d3d40',
  calcada: '#b9b4ab',
  grama: '#6f8a4e',
  fachada: '#8a8d92',
  concreto: '#9a9ca0',
  parede: '#e6e2dc',
  teto: '#f2f1ef',
  granito: '#d9d6cf',
  rampa: '#3a3b3e',
  madeira: '#c9ab84',
  branco: '#f5f5f3',
  preto: '#1b1b1d',
  inox: '#c4c7cb',
  porta: '#efede8',
  laranja: '#F7922D',
  vidro: '#cfe3e6',
  planta: '#3f6b3a',
  vaso: '#d8c8a8',
};

// ───────────── caminhos da câmera (olho a 1,6 m do piso)
const o1 = T + 1.6;
const oR = N_REC + 1.6, oA = N_ANT + 1.6, oF = N_RUA2 + 1.65;
export const caminhos = {
  // Recepção 1: estacionamento → porta de vidro → guichês → espera → corredor do Bloco Cirúrgico
  r1: {
    nome: 'Recepção 1',
    olho: [
      [6.74, o1 + 0.1, 24.5], [6.74, o1, 19.0], [6.74, o1, 15.6], [6.74, o1, 13.4],
      [7.0, o1, 11.8], [7.4, o1, 9.6], [10.6, o1, 8.6], [12.6, o1, 8.3],
      [13.6, o1, 7.3], [15.2, o1, 7.25], [16.5, o1, 7.2],
    ],
    alvo: [
      [6.74, o1 + 1.2, 14.4], [6.74, o1 + 0.6, 14.4], [6.74, o1, 11.0], [4.4, o1 - 0.1, 11.6],
      [4.0, o1 - 0.1, 10.6], [10.3, o1 - 0.05, 7.8], [12.6, o1 - 0.1, 8.0], [15.0, o1 - 0.1, 7.3],
      [17.5, o1 - 0.05, 7.2], [17.6, o1, 7.2], [17.7, o1, 7.2],
    ],
  },
  // Recepção 2: Av. Treze → Portaria 2 → recepção → rampa → espera do painel → consultórios
  r2: {
    nome: 'Recepção 2',
    olho: [
      [45.0, oF, 5.36], [41.0, oF, 5.36], [37.6, oF + 0.2, 5.36], [35.0, oR, 5.36],
      [32.5, oR, 5.0], [28.5, oR, 5.3], [25.2, oR, 5.65], [21.9, oR, 7.2],
      [18.8, (oR + oA) / 2, 7.2], [16.0, oA, 7.2], [14.6, oA, 6.9], [12.4, oA, 7.6],
      [9.6, oA, 8.45], [6.2, oA, 8.45], [5.3, oA, 10.0], [5.3, oA, 12.0],
    ],
    alvo: [
      [36, oF + 0.6, 5.36], [36, oF + 0.4, 5.36], [34, oR, 5.36], [30, oR - 0.15, 5.6],
      [26, oR - 0.15, 5.6], [22, oR - 0.2, 6.3], [19, oR - 0.15, 7.1], [16, oA - 0.1, 7.2],
      [12, oA - 0.15, 7.0], [10.1, oA - 0.1, 6.5], [10.1, oA - 0.05, 6.3], [7.0, oA - 0.1, 8.45],
      [5.2, oA - 0.1, 8.5], [5.3, oA - 0.1, 10.5], [5.3, oA - 0.1, 14.0], [5.3, oA - 0.1, 16.0],
    ],
  },
};

// ───────────── áreas (cada uma vira uma maquete, como os andares do ICG)
// caminho/inicio: onde o "Entrar" começa; corte: altura acima da qual as paredes da frente somem
export const areas = [
  { id: 'r1_entrada', andar: 'terreo', nome: 'Entrada pela Rua 128', caixa: { min: [-0.5, -0.3, 12.8], max: [19.6, 4.6, 21.5] }, caminho: 'r1', inicio: 0 },
  { id: 'r1_recepcao', andar: 'terreo', nome: 'Recepção 1', caixa: { min: [2.9, -0.3, 7.0], max: [12.7, 3.2, 14.75] }, caminho: 'r1', inicio: 0.24, corte: 1.3 },
  { id: 'r1_exames', andar: 'terreo', nome: 'Exames e consultórios', caixa: { min: [-0.2, -0.3, -0.2], max: [16.4, 3.2, 7.9] }, caminho: 'r1', inicio: 0.62, corte: 1.3, topo: 2.2 },
  { id: 'r1_bloco', andar: 'terreo', nome: 'Bloco Cirúrgico', caixa: { min: [12.6, -0.3, -0.2], max: [34.6, 3.2, 9.9] }, caminho: 'r1', inicio: 0.74, corte: 1.3, topo: 2.2 },
  { id: 'r2_entrada', andar: 'pav1', nome: 'Entrada pela Av. Treze', caixa: { min: [33.5, 2.5, -0.5], max: [39.5, 7.9, 10.0] }, caminho: 'r2', inicio: 0 },
  { id: 'r2_recepcao', andar: 'pav1', nome: 'Recepção 2', caixa: { min: [24.2, 3.25, 0.0], max: [36.0, 6.3, 8.4] }, caminho: 'r2', inicio: 0.16, corte: 4.6 },
  { id: 'r2_rampa', andar: 'pav1', nome: 'Corredor e rampa', caixa: { min: [16.0, 3.25, 0.0], max: [26.8, 6.3, 8.4] }, caminho: 'r2', inicio: 0.36, corte: 4.6 },
  { id: 'r2_espera', andar: 'pav1', nome: 'Sala de espera', caixa: { min: [6.0, 3.68, -0.2], max: [16.45, 6.7, 9.4] }, caminho: 'r2', inicio: 0.56, corte: 5.1 },
  { id: 'r2_consultorios', andar: 'pav1', nome: 'Consultórios', caixa: { min: [-0.2, 3.68, -0.2], max: [10.2, 6.7, 14.8] }, caminho: 'r2', inicio: 0.78, corte: 5.1, topo: 6.0 },
];

// ───────────── pontos com olho (só dados reais: planta, fotos, site aprovado, parecer da Vigilância)
export const pontos = [
  // Recepção 1
  { caminho: 'r1', pos: [7.6, T + 3.85, 14.7], ate: 0.08, titulo: 'Clínica Dias', sub: 'Recepção 1 · Rua Cento e Vinte e Oito',
    texto: 'Entrada pelo estacionamento. Atendimento de segunda a sexta, das 8h às 18h.' },
  { caminho: 'r1', pos: [4.65, T + 1.4, 11.6], ate: 0.33, titulo: 'Recepção', sub: 'Cinco guichês de atendimento',
    texto: 'Agende pelo telefone (31) 3849-6156.', link: { texto: 'Ligar agora', href: 'tel:+553138496156' } },
  { caminho: 'r1', pos: [10.35, T + 1.9, 7.85], ate: 0.52, titulo: 'Sala de espera', sub: 'Nossa missão: fazer história',
    texto: 'Consultas em diversas especialidades, exames de imagem, endoscopia, ergometria e oftalmologia.' },
  { caminho: 'r1', pos: [17.45, T + 2.2, 7.2], ate: 0.95, titulo: 'Bloco Cirúrgico', sub: 'Sala cirúrgica e recuperação',
    texto: 'Cirurgias oftalmológicas de baixa complexidade e procedimentos cirúrgicos ambulatoriais.',
    link: { texto: 'Conhecer o site', href: '../v2/' } },
  // Recepção 2
  { caminho: 'r2', pos: [36.15, N_REC + 1.9, 7.4], ate: 0.1, titulo: 'Clínica Dias', sub: 'Portaria 2 · Avenida Treze',
    texto: 'Entrada com escada e rampa de acesso. Atendimento de segunda a sexta, das 8h às 18h.' },
  { caminho: 'r2', pos: [30.8, N_REC + 1.35, 6.6], ate: 0.27, titulo: 'Recepção', sub: 'Seis guichês de atendimento',
    texto: 'Agende pelo telefone (31) 3849-6156.', link: { texto: 'Ligar agora', href: 'tel:+553138496156' } },
  { caminho: 'r2', pos: [18.8, N_REC + 1.2, 7.2], ate: 0.47, titulo: 'Acessibilidade', sub: 'Rampa com corrimão e guarda-corpo de vidro',
    texto: 'O caminho até os consultórios do prédio antigo é feito sem degraus.' },
  { caminho: 'r2', pos: [10.15, N_ANT + 1.75, 6.5], ate: 0.66, titulo: 'Sala de espera', sub: 'Chamada pelo painel',
    texto: 'Os pacientes são chamados pela TV do painel de madeira.' },
  { caminho: 'r2', pos: [5.3, N_ANT + 2.3, 12.6], ate: 0.97, titulo: 'Consultórios', sub: 'Siga a cor da sua especialidade',
    texto: 'As faixas coloridas no piso levam até cada consultório.', link: { texto: 'Conhecer o site', href: '../v2/' } },
];
