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
import { mobilia } from './mobilia.js';

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
  const { base, topo, externa, nome, feitas = [] } = opc;
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
  for (const linha of linhas) {
    const h = linha.ws[0].o === 'h';
    linha.ws.sort((a, b) => (h ? a.x0 - b.x0 : a.z0 - b.z0));
    // junta trechos sobrepostos da mesma linha (o extrator às vezes devolve dois): sem faces duplicadas
    const ws = [];
    for (const w of linha.ws) {
      const u = ws[ws.length - 1];
      if (u && (h ? w.x0 <= u.x1 + 0.02 : w.z0 <= u.z1 + 0.02)) {
        if (h) { u.x1 = Math.max(u.x1, w.x1); u.z0 = Math.min(u.z0, w.z0); u.z1 = Math.max(u.z1, w.z1); }
        else { u.z1 = Math.max(u.z1, w.z1); u.x0 = Math.min(u.x0, w.x0); u.x1 = Math.max(u.x1, w.x1); }
      } else ws.push({ ...w });
    }
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
      // vão já tratado em comPortas (porta pelo arco ou aberta à mão): não duplica porta nem verga
      const mx = h ? (a + b) / 2 : (w.x0 + w.x1) / 2, mz = h ? (w.z0 + w.z1) / 2 : (a + b) / 2;
      if (feitas.some((r) => mx > r[0] - 0.05 && mx < r[2] + 0.05 && mz > r[1] - 0.05 && mz < r[3] + 0.05)) return;
      // fresta do vetor da planta (10 a 50 cm): parede cheia, senão vira um rasgo que deixa ver o outro lado
      if (vao > 0.004 && vao < 0.55) {
        pecas.push({ tipo: 'caixa', nome: `${nome}-fresta${n++}`, mat: 'parede',
          min: h ? [a - 0.01, y0, w.z0] : [w.x0, y0, a - 0.01], max: h ? [b + 0.01, y1, w.z1] : [w.x1, y1, b + 0.01] });
        return;
      }
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
        // até 1,15 m é porta (as de 1,06–1,10 m ficavam sem folha: salas da odonto, repouso, corredores)
        if (vao <= 1.15) pecas.push({ tipo: 'porta', nome: `${nome}-porta${n++}`, centro: [px, yb, pz], vira: h ? 0 : 90, largura: vao, placa: yb > 3 ? true : undefined, almofada: yb > 3.6 || undefined });
      }
    });
  }
  return pecas;
}

// portas achadas pelo arco de abertura (extrai_paredes_svg.py) + portas do caminho, à mão
function comPortas(paredes, portas, base, nome) {
  let ws = paredes;
  const pecas = [];
  const feitas = [];
  portas.forEach((d, i) => {
    const r = d.o === 'h' ? [d.a, d.c - 0.2, d.b, d.c + 0.2] : [d.c - 0.2, d.a, d.c + 0.2, d.b];
    ws = abre(ws, r);
    feitas.push(r);
    const m = (d.a + d.b) / 2;
    const cx = d.o === 'h' ? m : d.c, cz = d.o === 'h' ? d.c : m;
    const y = base(cx, cz);
    const e = 0.075;
    // verga até o alto da parede: no térreo o forro fica a 2,90 m e a verga de 2,75 m deixava uma fresta (parecia solta)
    const topoVerga = d.topo || (y < 1 ? 3.23 : 2.75);
    pecas.push({ tipo: 'caixa', nome: `${nome}-vergaporta${i}`, mat: 'parede',
      min: d.o === 'h' ? [d.a, y + 2.1, d.c - e] : [d.c - e, y + 2.1, d.a], max: d.o === 'h' ? [d.b, y + topoVerga, d.c + e] : [d.c + e, y + topoVerga, d.b] });
    // 1º andar: placa laranja de sala; abre/visita: a folha gira sozinha quando o "Ver por dentro" passa por ela
    if (!d.aberta) pecas.push({ tipo: 'porta', nome: `${nome}-porta-a${i}`, centro: [cx, y, cz], vira: d.o === 'h' ? 0 : 90, largura: d.b - d.a,
      placa: d.placa ?? (y > 3 ? true : undefined), placaPlana: d.placaPlana, abre: d.abre, visita: d.visita, cor: d.cor, almofada: d.almofada ?? (y > 3.6 || undefined), texto: d.texto });
  });
  return { ws, pecas, feitas };
}

// térreo: o vidro da fachada da Recepção 1 vira vitrine (montada à mão abaixo)
// salas com "Ver por dentro": a porta existe (como na clínica) e a folha abre sozinha durante a visita.
// [orientação, c, a, lado para onde a folha abre, cor]: ergometria (porta de madeira, vídeo 0:26),
// consultório indiferenciado do térreo, pediátrico do 1º pav.
const SALAS = [['h', 7.66, 8.305, 'n', 'madeira'], ['v', 15.76, 5.373, 'w'], ['h', 7.72, 6.288, 'n'],
  ['v', 6.09, 11.699, 'e'], ['v', 4.45, 13.674, 'w']]; // 2º piso: consultório do corredor das faixas e ginecologia
const abreSala = (d) => {
  const s = SALAS.find(([o, c, a]) => d.o === o && Math.abs(d.c - c) < 0.05 && Math.abs(d.a - a) < 0.05);
  return s ? { ...d, abre: s[3], visita: true, cor: s[4] } : d;
};
// parede cheia onde a planta deixou um vão que não existe na clínica (ou o recorte da porta deixou sobra)
const tapa = (nome, min, max) => ({ tipo: 'caixa', nome, min, max, mat: 'parede' });

const filtroT = paredesTerreo.paredes.filter((w) => !(w.o === 'h' && w.z0 > 14.25 && w.x0 > 3.2 && w.x1 < 12.2));
const portasT = [
  ...paredesTerreo.portas.map(abreSala),
  // fim do corredor do Bloco (fotos f51–f52, vídeo 0:56): Vestiário à esquerda, porta larga do Bloco à direita
  { o: 'v', c: 17.53, a: 6.33, b: 7.15, texto: 'Vestiário' },
  { o: 'v', c: 17.53, a: 7.15, b: 8.09 },
  // porta branca ao lado do totem de senha, na ponta dos guichês (f38, vídeo 0:12)
  { o: 'h', c: 7.67, a: 6.33, b: 7.23, placa: true, placaPlana: true },
  // porta de madeira do corredor do Bloco (f50–f51): dá no corredorzinho do consultório e abre na visita dele
  { o: 'h', c: 6.24, a: 15.98, b: 17.07, abre: 'n', visita: true, cor: 'madeira' },
];
const rT = comPortas(filtroT, portasT, () => T, 'terreo');
const tapasT = [
  tapa('tapa-totem-a', [6.08, -0.12, 7.6], [6.33, 3.67, 7.74]),
  tapa('tapa-totem-b', [7.23, -0.12, 7.6], [7.48, 3.67, 7.74]),
];

// 1º pav.: a rampa entra no prédio antigo; a espera é aberta para a coluna de cadeiras (fotos f22–f27);
// as portas da passagem das faixas coloridas ficam abertas no passeio
// a última é a entrada do Laboratório (sala 16), no canto da espera do 2º piso, com batente preto (f24, f26)
const PASSAGENS_P1 = [[16.1, 6.42, 16.5, 7.97], [14.15, 4.7, 14.45, 8.9], [9.8, 7.92, 10.1, 9.03], [6.0, 7.92, 6.35, 9.03], [13.0, 4.3, 14.12, 4.65],
  // corredor dos banheiros (planta do 1º pav.): saem os dois tocos de parede soltos que fechavam a passagem
  [3.88, 7.91, 4.2, 8.75], [1.93, 7.91, 2.15, 8.75],
  // as duas salinhas de banheiro da planta viraram um consultório só (f31: sala com janela e ar-condicionado)
  [1.93, 6.45, 2.15, 7.75]];
let pPav1 = paredesPav1.paredes;
for (const r of PASSAGENS_P1) pPav1 = abre(pPav1, r);
// salas 14 e 15 abrem direto no corredor da rampa (fotos f14–f16): sai o recuo entre as duas
const recuo1415 = (d) => d.o === 'v' && d.a > 3.6 && d.a < 3.7 && d.c > 19.9 && d.c < 20.1;
// fim do corredor das faixas (f31): duas portas lado a lado na mesma parede, com o filete do interruptor no meio;
// a da esquerda é do consultório (as duas salinhas de banheiro da planta viraram uma sala), a da direita é o
// "Banheiro" (os banheiros masculino e feminino ficam atrás dela); a porta do outro banheiro da planta some
const cantoBanheiro = (d) => {
  if (d.o !== 'h' || Math.abs(d.c - 7.83) > 0.1) return d;
  if (Math.abs(d.a - 4.111) < 0.05) return { ...d, placa: false, almofada: true, texto: 'Banheiro' };
  if (Math.abs(d.a - 3.152) < 0.05) return { ...d, placa: false, almofada: true };
  if (d.a < 1.2) return null;
  return d;
};
const portasP1 = [
  ...paredesPav1.portas.filter((d) => !recuo1415(d)).map(abreSala).map(cantoBanheiro).filter(Boolean),
  { o: 'h', c: 4.4, a: 19.3, b: 20.0, placa: 15, abre: 'n', visita: true },
  { o: 'h', c: 4.4, a: 20.14, b: 20.88, placa: 14, abre: 'n', visita: true },
  // odontologia (salas 09 e 10, fotos f08–f09 e vídeo 1:08): a 09 abre no "Ver por dentro"
  { o: 'h', c: 4.4, a: 29.0, b: 29.81, placa: '09', abre: 'n', visita: true },
  { o: 'h', c: 4.4, a: 32.41, b: 33.2, placa: 10, abre: 'n', visita: true },
  // banheiro masculino ao lado dos purificadores (f13): porta branca de almofada
  { o: 'h', c: 2.695, a: 25.61, b: 26.52, almofada: true, texto: 'Masculino', placa: false },
  // sala 18: parede da esquerda da espera do 2º piso, colada na entrada do corredor das faixas (f27)
  { o: 'h', c: 9.08, a: 9.87, b: 10.93, placa: 18, placaPlana: true, almofada: false, abre: 's', visita: true },
  // banheiro PNE da Recepção 2, do outro lado do corredor (estava sem porta)
  { o: 'h', c: 6.47, a: 25.61, b: 26.52, almofada: true, texto: 'Banheiro', placa: false },
  // salinha da esterilização da odonto, no fim do corredor
  { o: 'h', c: 4.095, a: 22.92, b: 23.73 },
];
const rP1 = comPortas(pPav1, portasP1, (x) => (x < X_DIVISA ? N_ANT : N_REC), 'pav1');
rP1.feitas.push(...PASSAGENS_P1); // passagens abertas de propósito: sem porta nem parede de fresta
// vão da planta entre as duas portas do fim do corredor das faixas: virava uma porta atravessada por cima delas
rP1.feitas.push([3.9, 6.85, 4.16, 8.08]);
// fundo dos dois banheiros: o vão entre os tocos da parede virava uma porta atravessando a divisória (é parede cheia)
rP1.feitas.push([1.55, 6.38, 2.56, 6.56]);
// a porta do antigo banheiro da esquerda vira parede (a sala agora é um consultório só)
rP1.feitas.push([0.1, 7.7, 1.1, 7.95]);
const tapasP1 = [
  tapa('tapa-1415-a', [19.19, N_REC - 0.12, 4.35], [19.3, N_REC + PE, 4.45]),
  tapa('tapa-1415-b', [20.0, N_REC - 0.12, 4.35], [20.14, N_REC + PE, 4.45]),
  tapa('tapa-1415-c', [20.88, N_REC - 0.12, 4.35], [20.94, N_REC + PE, 4.45]),
  tapa('tapa-1415-meio', [20.02, N_REC - 0.12, 3.6], [20.12, N_REC + PE, 4.36]),
  tapa('tapa-odonto-09', [29.81, N_REC - 0.12, 4.35], [30.08, N_REC + PE, 4.45]),
  tapa('tapa-odonto-10', [33.2, N_REC - 0.12, 4.35], [33.52, N_REC + PE, 4.45]),
  // banheiro PNE da Recepção 2: a planta não tinha a parede do lado leste e o vaso aparecia do corredor
  tapa('tapa-banheiro-pne-leste', [26.52, N_REC - 0.12, 6.42], [26.67, N_REC + PE, 8.03]),
  // f31: parede entre o consultório e o banheiro (filete do interruptor entre as duas portas)
  tapa('tapa-canto-banheiro', [3.95, N_ANT - 0.12, 5.2], [4.11, N_ANT + PE, 7.905]),
  tapa('parede-porta-cons-pav1', [0.12, N_ANT - 0.12, 7.755], [1.034, N_ANT + PE, 7.905]),
  // bloco dos banheiros masculino e feminino, atrás da porta "Banheiro": fechado
  tapa('parede-banheiros-sul', [4.916, N_ANT - 0.12, 7.755], [6.28, N_ANT + PE, 7.905]),
  tapa('parede-banheiros-leste', [6.14, N_ANT - 0.12, 6.909], [6.28, N_ANT + PE, 7.755]),
  // hall em frente às duas portas: parede de cada lado; o consultório de 14,1 m² abre por ele
  tapa('parede-hall-sul', [3.152, N_ANT - 0.12, 8.71], [4.108, N_ANT + PE, 8.81]),
  tapa('verga-cons-141', [3.05, N_ANT + 2.1, 7.905], [3.152, N_ANT + PE, 8.71]),
  { tipo: 'porta', nome: 'porta-cons-141', centro: [3.1, N_ANT, 8.31], vira: 90, largura: 0.78, almofada: true, placa: false },
  tapa('verga-laboratorio', [13.0, N_ANT + 2.2, 4.4], [14.12, N_ANT + PE, 4.55]),
  { tipo: 'caixa', nome: 'batente-lab-a', min: [12.94, N_ANT, 4.36], max: [13.0, N_ANT + 2.26, 4.6], mat: 'preto' },
  { tipo: 'caixa', nome: 'batente-lab-b', min: [14.12, N_ANT, 4.36], max: [14.18, N_ANT + 2.26, 4.6], mat: 'preto' },
  { tipo: 'caixa', nome: 'batente-lab-c', min: [12.94, N_ANT + 2.2, 4.36], max: [14.18, N_ANT + 2.26, 4.6], mat: 'preto' },
];
const pTerreo = rT.ws;

const baseT = () => T;
const topoT = (x) => (x < X_DIVISA ? N_ANT - 0.12 : N_REC - 0.12);
const baseP1 = (x) => (x < X_DIVISA ? N_ANT : N_REC);
const topoP1 = (x) => baseP1(x) + PE;
const extT = (w) => (w.o === 'h' ? w.z1 < 0.3 || w.z0 > 14.25 : w.x1 < 0.35 || w.x0 > 34.1);
const extP1 = (w) => (w.o === 'h' ? w.z1 < 0.3 || (w.z0 > 14.3 && w.x1 < 16.4) : w.x1 < 0.35);

// ───────────── peças
export const pecas = [
  ...mobilia,
  // ════════ TÉRREO ════════
  // estacionamento (5 vagas) e Rua Cento e Vinte e Oito
  { tipo: 'caixa', nome: 'rua-128', min: [-6, T - 0.2, 21.2], max: [40, T - 0.05, 30], mat: 'asfalto' },
  { tipo: 'caixa', nome: 'estacionamento', min: [-6, T - 0.15, 14.6], max: [19.3, T - 0.02, 21.2], mat: 'calcada' },
  { tipo: 'faixas-vaga', nome: 'vagas', de: [0.4, T, 15.2], n: 5, passo: 2.6, fundo: 5.0 },
  { tipo: 'caixa', nome: 'calcada-128', min: [-6, T - 0.15, 20.4], max: [40, T, 21.2], mat: 'calcada' },
  { tipo: 'caixa', nome: 'jardim', min: [19.3, T - 0.15, 9.7], max: [34.4, T - 0.01, 21.2], mat: 'grama' },

  // fachada da Recepção 1: vitrine 284×290 + porta de vidro + vitrine 478×290 (folha 01/05)
  { tipo: 'vidro', nome: 'vitrine-r1-a', min: [3.31, T, 14.38], max: [6.14, T + 2.9, 14.44] },
  { tipo: 'porta-vidro', nome: 'porta-r1', min: [6.14, T, 14.38], max: [7.34, T + 2.6, 14.44], texto: 'EMPURRE' },
  { tipo: 'caixa', nome: 'verga-porta-r1', min: [6.14, T + 2.6, 14.35], max: [7.34, T + 3.23, 14.57], mat: 'fachada' },
  { tipo: 'vidro', nome: 'vitrine-r1-b', min: [7.34, T, 14.38], max: [12.11, T + 2.9, 14.44] },
  // recepção 1: 5 guichês junto à parede de "mármore" com o logo (fotos f35–f39)
  { tipo: 'painel-marmore', nome: 'parede-logo-r1', min: [3.41, T, 9.0], max: [3.47, T + 2.6, 14.3], vira: 90, logo: false },
  { tipo: 'balcao', nome: 'guiches-r1', min: [4.35, T, 9.2], max: [4.95, T + 1.05, 13.9], guiches: 5, eixo: 'z', marmore: true },
  { tipo: 'tv', nome: 'tv-r1', centro: [3.5, T + 2.25, 13.55], largura: 1.0, vira: 90 },
  // espera 87,8 m²: fileiras viradas para os guichês, de costas para o painel "Nossa missão" (fotos f42–f46,
  // confirmado pelo Guilherme em 11/11); corredor livre no meio, na linha da coluna
  ...[8.2, 9.0, 9.8, 10.6, 11.45].flatMap((x, i) => [
    { tipo: 'cadeiras', nome: `espera-r1-${i}a`, de: [x, T, 9.3], n: 4, passo: [0, 0, 0.55], vira: -90, cor: 'preto' },
    { tipo: 'cadeiras', nome: `espera-r1-${i}b`, de: [x, T, 11.75], n: 4, passo: [0, 0, 0.55], vira: -90, cor: 'preto' },
  ]),
  // corredor até o Bloco Cirúrgico (z 6,3–8,3): longarina do lado direito (f51), lixeira junto do Vestiário (f52)
  { tipo: 'longarina', nome: 'longarina-bloco', pos: [16.35, T, 7.98], lugares: 3, vira: 180 },
  { tipo: 'lixeira', nome: 'lix-bloco', pos: [17.2, T, 6.55], vira: 0, pedal: true },
  // aparelho de oftalmologia com a cadeira na entrada do corredor (f50)
  { tipo: 'mesa-oftalmo', nome: 'oftalmo-corredor', pos: [12.75, T, 6.62], vira: 0 },
  { tipo: 'cadeiras', nome: 'cadeira-oftalmo-corredor', de: [12.75, T, 7.25], n: 1, passo: [0, 0, 0], vira: 180, cor: 'preto' },
  { tipo: 'placa', nome: 'placa-bloco', centro: [17.47, T + 2.42, 7.68], texto: 'BLOCO CIRÚRGICO', vira: -90 },
  ...tapasT,
  // forro do térreo (some na maquete)
  { tipo: 'caixa', nome: 'teto-terreo-a', min: [0, FORRO_T, 0], max: [34.36, FORRO_T + 0.08, 8.45], mat: 'teto', teto: true },
  { tipo: 'caixa', nome: 'teto-terreo-b', min: [0, FORRO_T, 8.45], max: [19.2, FORRO_T + 0.08, 14.57], mat: 'teto', teto: true },
  { tipo: 'caixa', nome: 'teto-corredor-bloco', min: [19.2, FORRO_T, 8.45], max: [34.36, FORRO_T + 0.08, 9.7], mat: 'teto', teto: true },
  // pisos do térreo
  { tipo: 'caixa', nome: 'piso-terreo-a', min: [0, T - 0.12, 0], max: [34.36, T, 8.45], mat: 'granito' },
  { tipo: 'caixa', nome: 'piso-terreo-b', min: [0, T - 0.12, 8.45], max: [19.2, T, 14.57], mat: 'granito' },
  { tipo: 'caixa', nome: 'piso-corredor-bloco', min: [19.2, T - 0.12, 8.45], max: [34.36, T, 9.7], mat: 'granito' },
  ...rT.pecas,
  ...paredesDoAndar(pTerreo, { base: baseT, topo: topoT, externa: extT, nome: 'terreo', feitas: rT.feitas }),

  // ════════ 1º PAVIMENTO ════════
  // Av. Treze: calçada, 3 degraus, rampa externa, fachada (fotos f01–f07)
  { tipo: 'caixa', nome: 'rua-treze', min: [38.6, N_RUA2 - 0.2, -6], max: [48, N_RUA2 - 0.05, 16], mat: 'asfalto' },
  { tipo: 'caixa', nome: 'calcada-treze', min: [35.86, N_RUA2 - 0.15, -6], max: [38.6, N_RUA2, 16], mat: 'calcada' },
  { tipo: 'caixa', nome: 'arrimo-treze', min: [34.36, T, -6], max: [35.86, N_RUA2 - 0.15, 16], mat: 'concreto' },
  { tipo: 'degraus', nome: 'escada-treze', min: [35.86, N_RUA2, 4.05], max: [36.86, N_REC, 6.65], n: 3, eixo: 'x' },
  { tipo: 'corrimao', nome: 'corrimao-escada', de: [36.86, N_RUA2 + 0.9, 5.36], ate: [35.95, N_REC + 0.9, 5.36] },
  { tipo: 'caixa', nome: 'patamar-rampa', min: [29.2, N_RUA2 - 0.15, 8.23], max: [35.86, N_REC - 0.02, 9.5], mat: 'concreto' },
  { tipo: 'gradil', nome: 'gradil-rampa-ext', de: [29.2, N_REC, 9.5], ate: [35.86, N_REC, 9.5] }, // grade preta, como nas fotos da Av. Treze
  // parede leste: janelão ao norte (direita de quem chega), porta de correr 220×210 no meio
  { tipo: 'caixa', nome: 'leste-norte', min: [35.72, N_REC - 0.12, 0.17], max: [35.86, N_REC + PE, 1.95], mat: 'parede' },
  { tipo: 'caixa', nome: 'leste-peitoril', min: [35.72, N_REC - 0.12, 1.95], max: [35.86, N_REC + 0.9, 4.1], mat: 'parede' },
  { tipo: 'caixa', nome: 'leste-verga-jan', min: [35.72, N_REC + 2.4, 1.95], max: [35.86, N_REC + PE, 4.1], mat: 'parede' },
  { tipo: 'caixa', nome: 'leste-entre', min: [35.72, N_REC - 0.12, 4.1], max: [35.86, N_REC + PE, 4.24], mat: 'parede' },
  { tipo: 'caixa', nome: 'leste-verga-porta', min: [35.72, N_REC + 2.1, 4.24], max: [35.86, N_REC + PE, 6.48], mat: 'parede' },
  { tipo: 'caixa', nome: 'leste-sul', min: [35.72, N_REC - 0.12, 6.48], max: [35.86, N_REC + PE, 8.23], mat: 'parede' },
  { tipo: 'caixa', nome: 'fachada-alto', min: [35.86, N_REC + 2.4, 1.95], max: [36.05, N_REC + 4.4, 8.23], mat: 'fachada' },
  ...[4.7, 6.0].map((z, i) => ({ tipo: 'caixa', nome: `spot-marquise-r2-${i}`, min: [36.3, N_REC + 2.33, z - 0.09], max: [36.48, N_REC + 2.35, z + 0.09], mat: 'luz' })),
  { tipo: 'caixa', nome: 'fachada-norte', min: [35.86, N_RUA2, -0.2], max: [36.05, N_REC + 4.4, 1.95], mat: 'fachada' },
  { tipo: 'caixa', nome: 'fachada-base-norte', min: [35.86, N_RUA2, 1.95], max: [36.05, N_REC + 0.9, 4.1], mat: 'fachada' },
  { tipo: 'vidro', nome: 'janelao', min: [35.8, N_REC + 0.9, 1.95], max: [35.86, N_REC + 2.4, 4.1] },
  { tipo: 'caixa', nome: 'jardineira', min: [36.05, N_RUA2, 1.95], max: [36.85, N_RUA2 + 0.55, 4.0], mat: 'concreto' },
  { tipo: 'touceira', nome: 'jardineira-plantas', min: [36.1, N_RUA2 + 0.55, 2.05], max: [36.8, N_RUA2 + 1.35, 3.9], folhas: 45 },
  { tipo: 'caixa', nome: 'fachada-sul', min: [35.86, N_RUA2, 6.48], max: [36.05, N_REC + 2.4, 8.23], mat: 'fachada' },
  { tipo: 'caixa', nome: 'marquise', min: [35.86, N_REC + 2.35, 3.9], max: [37.0, N_REC + 2.5, 6.8], mat: 'concreto' },
  { tipo: 'porta-vidro', nome: 'portaria-2', min: [35.76, N_REC, 4.24], max: [35.82, N_REC + 2.1, 6.48], eixo: 'x' },
  { tipo: 'decal', nome: 'faixa-portaria2', imagem: 'portaria2', centro: [35.87, N_REC + 2.0, 5.36], larg: 2.24, alt: 0.19, vira: 90 },
  { tipo: 'decal', nome: 'logo-fachada-r2', imagem: 'logo', centro: [36.07, N_REC + 1.55, 7.36], larg: 1.62, alt: 0.61, vira: 90 },
  // volumes de cima sem encostar nas fachadas (faces sobrepostas saíam pretas no cálculo da luz)
  { tipo: 'caixa', nome: 'volume-2pav', min: [16.3, N_REC + PE + 0.1, 0], max: [35.84, N_REC + PE + 3.3, 8.23], mat: 'fachada', teto: true },
  { tipo: 'caixa', nome: 'volume-2pav-antigo', min: [-0.05, N_ANT + PE + 0.1, -0.05], max: [16.3, N_ANT + PE + 3.0, 14.44], mat: 'fachada', teto: true },

  // recepção 2 (46,54 m²): 6 guichês junto à parede sul, atendentes do lado sul
  { tipo: 'balcao', nome: 'guiches-r2', min: [27.45, N_REC, 6.3], max: [34.2, N_REC + 1.05, 6.9], guiches: 6 },
  { tipo: 'cadeiras', nome: 'cadeiras-rec-leste', de: [35.3, N_REC, 1.9], n: 5, passo: [0, 0, 0.5], vira: -90 },
  { tipo: 'cadeiras', nome: 'cadeiras-rec-bloco', de: [33.75, N_REC, 2.0], n: 3, passo: [0, 0, 0.55], vira: 90 },
  // placa de direção na passagem da recepção para o corredor da rampa (fotos f10–f12, vídeo 1:16)
  { tipo: 'decal', nome: 'placa-2piso-r2', imagem: 'placa-2piso', centro: [24.545, N_REC + 2.42, 5.66], larg: 1.62, alt: 0.4, vira: 90 },
  ...tapasP1,

  // rampa interna: 5,28 m, i = 8,33%, sobe para oeste até o prédio antigo
  { tipo: 'rampa', nome: 'rampa', min: [16.36, N_REC, 6.42], max: [21.68, N_ANT, 7.97], sobe: '-x' },
  { tipo: 'guarda-vidro', nome: 'vidro-rampa', de: [21.68, N_REC, 6.42], ate: [16.36, N_REC, 6.42] },
  { tipo: 'corrimao', nome: 'corrimao-rampa', de: [21.68, N_REC + 0.9, 7.88], ate: [16.36, N_ANT + 0.9, 7.88], preso: [0, 0, 0.06] },
  { tipo: 'cadeiras', nome: 'cadeiras-vidro', de: [20.7, N_REC, 6.1], n: 4, passo: [-0.55, 0, 0], vira: 180 },
  // três cadeiras na parede das salas 14 e 15, entre o extintor e a porta 14 (f14–f15)
  { tipo: 'cadeiras', nome: 'cadeiras-corr-r2', de: [21.2, N_REC, 4.72], n: 3, passo: [0.55, 0, 0], vira: 0 },
  // máquina de café preta no alto do corredor, ao lado da planta (f20–f21, confirmado em 11/11)
  // colada na planta, como em f19–f21
  { tipo: 'cafeteira', nome: 'cafe-r2', pos: [16.82, N_REC, 5.48], vira: 90 },
  // mesinha de madeira com computador no começo da rampa (f17)
  { tipo: 'mesa', nome: 'mesa-rampa', pos: [24.08, N_REC, 7.1], vira: 90, larg: 1.0, prof: 0.55, pacientes: 0 },
  { tipo: 'lixeira', nome: 'lix-rampa', pos: [24.05, N_REC, 7.78], vira: 0, pedal: true },
  { tipo: 'planta-vaso', nome: 'planta-corredor', pos: [16.9, N_REC, 6.05], altura: 1.5 },

  // espera 18,4 m² (prédio antigo): painel de ripas + TV na parede oeste
  { tipo: 'ripado', nome: 'painel-madeira', min: [10.02, N_ANT, 4.7], max: [10.08, N_ANT + PE - 0.25, 7.6], eixo: 'z' },
  // painel ripado como na f27: TV alta à direita com a tela de chamadas, quadro dos idosos e aviso no meio,
  // folhas do QR code e "Comunicado" com o interruptor à esquerda (posições medidas na foto)
  { tipo: 'tv', nome: 'tv-espera', centro: [10.11, N_ANT + 1.92, 5.46], largura: 0.95, vira: 90 },
  { tipo: 'decal', nome: 'tela-chamadas', imagem: 'tela-chamadas', centro: [10.173, N_ANT + 1.92, 5.46], larg: 0.91, alt: 0.51, vira: 90 },
  { tipo: 'decal', nome: 'quadro-idoso', imagem: 'quadro-idoso', centro: [10.087, N_ANT + 1.72, 6.72], larg: 0.47, alt: 0.48, vira: 90 },
  { tipo: 'decal', nome: 'aviso-silencio', imagem: 'aviso-silencio', centro: [10.087, N_ANT + 1.75, 6.28], larg: 0.24, alt: 0.19, vira: 90 },
  { tipo: 'decal', nome: 'folha-qr', imagem: 'folha-qr', centro: [10.087, N_ANT + 1.42, 7.36], larg: 0.2, alt: 0.27, vira: 90 },
  { tipo: 'decal', nome: 'folha-comunicado', imagem: 'folha-comunicado', centro: [10.087, N_ANT + 1.42, 7.13], larg: 0.2, alt: 0.28, vira: 90 },
  { tipo: 'caixa', nome: 'interruptor-painel', min: [10.08, N_ANT + 1.04, 7.32], max: [10.1, N_ANT + 1.16, 7.4], mat: 'branco' },
  // parede da esquerda (sul): quadros de acrílico, DEA, placa de saída (f24, f25, f27); placa de direção na da direita
  { tipo: 'decal', nome: 'quadro-missao', imagem: 'quadro-missao', centro: [11.45, N_ANT + 1.65, 9.024], larg: 0.6, alt: 1.3, vira: 180 },
  { tipo: 'decal', nome: 'quadro-indicadores', imagem: 'quadro-indicadores', centro: [12.2, N_ANT + 1.65, 9.024], larg: 0.6, alt: 1.3, vira: 180 },
  { tipo: 'decal', nome: 'placa-saida-espera', imagem: 'placa-saida', centro: [13.75, N_ANT + 2.35, 9.024], larg: 0.24, alt: 0.24, vira: 180 },
  { tipo: 'decal', nome: 'placa-laboratorio', imagem: 'placa-laboratorio', centro: [12.4, N_ANT + 1.75, 4.556], larg: 0.5, alt: 0.3, vira: 0 },
  { tipo: 'caixa', nome: 'interruptor-lab', min: [12.62, N_ANT + 1.04, 4.55], max: [12.7, N_ANT + 1.16, 4.57], mat: 'branco' },
  // placa "2º PISO · siga a faixa indicativa" em cima da passagem para o corredor das faixas (f25, f27, vídeo 1:32)
  { tipo: 'decal', nome: 'placa-faixas', imagem: 'placa-faixas', centro: [10.115, N_ANT + 2.36, 8.47], larg: 1.3, alt: 0.36, vira: 90 },
  // prateleira de madeira ao lado do DEA (f25)
  { tipo: 'caixa', nome: 'prateleira-espera', min: [11.85, N_ANT + 0.93, 8.76], max: [13.25, N_ANT + 0.965, 9.03], mat: 'madeira' },
  // fileiras viradas para a parede da lixeira e dos quadros (f27, pedido de 11/11), não para a TV
  ...[5.35, 6.2, 7.05].map((z, i) => ({ tipo: 'cadeiras', nome: `espera-r2-${i}`, de: [10.95, N_ANT, z], n: 6, passo: [0.55, 0, 0], vira: 0 })),
  { tipo: 'cadeiras', nome: 'espera-coluna', de: [15.8, N_ANT, 4.9], n: 3, passo: [0, 0, 0.55], vira: -90 },
  { tipo: 'faixa-piso', nome: 'contorno-espera', min: [10.6, N_ANT, 4.75], max: [14.0, N_ANT, 8.7] },
  // faixas coloridas: saem da espera para oeste e dobram juntas para o sul em L, uma dentro da outra (vídeo 1:31–1:34)
  { tipo: 'faixas-l', nome: 'faixas', de: [14.0, N_ANT + 0.002, 8.45], canto: [5.3, 8.45], fim: 12.4 },

  // pisos e forros do 1º pav.
  { tipo: 'caixa', nome: 'piso-antigo', min: [0, N_ANT - 0.12, 0], max: [X_DIVISA, N_ANT, 14.59], mat: 'granito' },
  { tipo: 'caixa', nome: 'piso-novo-a', min: [X_DIVISA, N_REC - 0.12, 0.17], max: [35.86, N_REC, 6.42], mat: 'granito' },
  { tipo: 'caixa', nome: 'piso-novo-b', min: [21.68, N_REC - 0.12, 6.42], max: [35.86, N_REC, 8.23], mat: 'granito' },
  { tipo: 'caixa', nome: 'teto-antigo', min: [0, N_ANT + PE, 0], max: [X_DIVISA, N_ANT + PE + 0.08, 14.59], mat: 'teto', teto: true },
  { tipo: 'caixa', nome: 'teto-novo', min: [X_DIVISA, N_REC + PE, 0.17], max: [35.86, N_REC + PE + 0.08, 8.23], mat: 'teto', teto: true },
  ...rP1.pecas,
  ...paredesDoAndar(rP1.ws, { base: baseP1, topo: topoP1, externa: extP1, nome: 'pav1', feitas: rP1.feitas }),
];

// Cores de base (o Blender usa as mesmas antes de calcular a luz).
export const materiais = {
  asfalto: '#3d3d40',
  calcada: '#b9b4ab',
  grama: '#6f8a4e',
  fachada: '#8a8d92',
  concreto: '#9a9ca0',
  parede: '#d6ccc1',   // bege acinzentado (fendi) das fotos; antes quase branco
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
  // Recepção 2: Av. Treze → Portaria 2 → recepção → rampa (para no alto, olhando a espera)
  r2: {
    nome: 'Recepção 2',
    olho: [
      [45.0, oF, 5.36], [41.0, oF, 5.36], [37.6, oF + 0.2, 5.36], [35.0, oR, 5.36],
      [32.5, oR, 5.0], [28.5, oR, 5.3], [25.2, oR, 5.65], [21.9, oR, 7.2],
      [18.8, (oR + oA) / 2, 7.2], [16.0, oA, 7.2],
    ],
    alvo: [
      [36, oF + 0.6, 5.36], [36, oF + 0.4, 5.36], [34, oR, 5.36], [30, oR - 0.15, 5.6],
      [26, oR - 0.15, 5.6], [22, oR - 0.2, 6.3], [19, oR - 0.15, 7.1], [16, oA - 0.1, 7.2],
      [12, oA - 0.15, 7.0], [10.1, oA - 0.1, 6.5],
    ],
  },
  // Consultórios: alto da rampa → espera do painel → corredor das faixas coloridas
  r3: {
    nome: 'Consultórios',
    olho: [
      [18.8, (oR + oA) / 2, 7.2], [16.0, oA, 7.2], [14.6, oA, 6.9], [12.4, oA, 7.6],
      [9.6, oA, 8.45], [6.2, oA, 8.45], [5.3, oA, 10.0], [5.3, oA, 12.0],
    ],
    alvo: [
      [12, oA - 0.15, 7.0], [10.1, oA - 0.1, 6.5], [10.1, oA - 0.05, 6.3], [7.0, oA - 0.1, 8.45],
      [5.2, oA - 0.1, 8.5], [5.3, oA - 0.1, 10.5], [5.3, oA - 0.1, 14.0], [5.3, oA - 0.1, 16.0],
    ],
  },
};

// ───────────── áreas (cada uma vira uma maquete, como os andares do ICG)
// caminho/inicio: onde o "Entrar" começa; corte: altura acima da qual as paredes da frente somem
// salas: a caixa termina no MEIO das paredes da frente (o corte mostra a face clara de corte, não a face de fora)
// três partes, como os três andares do ICG: cada uma é uma maquete inteira e as salas abrem por dentro
export const areas = [
  // recortes como os andares do ICG (11/11): câmera mais baixa e de lado (vista.dir), só o pedaço que importa,
  // paredes até a altura do forro (topo) e nada de teto. Recepção 1 e 2 mostram a entrada: fachada na frente,
  // recepção logo atrás, vista pelo vidro.
  { id: 'recepcao1', andar: 'terreo', nome: 'Recepção 1', sub: 'Rua 128 · exames, consultórios e Bloco Cirúrgico',
    caixa: { min: [2.6, -0.3, 6.9], max: [13.4, 2.95, 14.95] }, vista: { dir: [0.38, 0.72, 1.0] }, caminho: 'r1', inicio: 0, topo: 2.95, zoom: 1.18 },
  { id: 'recepcao2', andar: 'pav1', nome: 'Recepção 2', sub: 'Av. Treze · recepção, odontologia e rampa',
    caixa: { min: [24.3, 2.5, -0.3], max: [36.3, 6.0, 8.4] }, vista: { dir: [1.0, 0.72, 0.42] }, caminho: 'r2', inicio: 0, topo: 6.0, zoom: 1.15 },
  { id: 'consultorios', andar: 'pav1', nome: 'Consultórios', sub: 'Sala de espera, pediatria e especialidades',
    caixa: { min: [6.0, 3.68, 4.3], max: [16.45, 6.45, 9.4] }, vista: { dir: [1.0, 0.75, 0.55] }, caminho: 'r3', inicio: 0, corte: 4.95, topo: 6.45, zoom: 1.15 },
];

// ───────────── grupos de luz (só para o Blender): cada um ganha o seu mapa de luz.
// São as caixas antigas, menores que as 3 partes: mais detalhe de luz por metro quadrado.
export const gruposLuz = [
  { id: 'r1_entrada', caixa: { min: [-0.5, -0.3, 12.8], max: [19.6, 4.6, 21.5] } },
  { id: 'r1_recepcao', caixa: { min: [2.9, -0.3, 7.0], max: [12.7, 3.2, 14.75] } },
  { id: 'r1_exames', caixa: { min: [-0.2, -0.3, -0.2], max: [16.4, 3.2, 7.9] } },
  { id: 'sala_ergometria', sala: true, caixa: { min: [7.4, -0.3, 4.15], max: [11.9, 3.2, 7.67] } },
  { id: 'sala_consultorio', sala: true, caixa: { min: [11.95, -0.3, 2.95], max: [15.9, 3.2, 6.24] } },
  { id: 'r1_bloco', caixa: { min: [12.6, -0.3, -0.2], max: [34.6, 3.2, 9.9] } },
  { id: 'r2_entrada', caixa: { min: [33.5, 2.5, -0.5], max: [39.5, 7.9, 10.0] } },
  { id: 'r2_recepcao', caixa: { min: [24.2, 3.25, 0.0], max: [36.0, 6.3, 8.4] } },
  { id: 'sala_odonto', sala: true, caixa: { min: [26.4, 3.25, 0.8], max: [29.88, 6.3, 4.4] } },
  { id: 'r2_rampa', caixa: { min: [16.0, 3.25, 0.0], max: [26.8, 6.3, 8.4] } },
  { id: 'r2_espera', caixa: { min: [6.0, 3.68, -0.2], max: [16.45, 6.7, 9.4] } },
  { id: 'sala_pediatria', sala: true, caixa: { min: [6.1, 3.68, 4.2], max: [9.95, 6.7, 7.84] } },
  { id: 'r2_consultorios', caixa: { min: [-0.2, 3.68, -0.2], max: [10.2, 6.7, 14.8] } },
];

// ───────────── visita a uma sala pela porta: a câmera para na frente, a porta abre, ela entra e olha a sala
// lado = para onde fica a sala ('n', 's', 'e', 'w'); base = nível do piso
function visitaPorta({ o, c, a, b, lado, base }) {
  const m = (a + b) / 2;
  const D = o === 'h' ? [m, c] : [c, m];
  const d = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[lado];
  const q = [d[1], -d[0]]; // de lado, para a câmera não ficar parada no meio da porta olhando a parede
  const em = (k, l = 0, y = base + 1.6) => [D[0] + d[0] * k + q[0] * l, y, D[1] + d[1] * k + q[1] * l];
  return {
    pos: em(-0.08, 0, base + 2.0),
    sala: { olhos: [em(-0.9), em(0.4), em(1.5, 0.15, base + 1.65)], alvos: [em(2.5, 0, base + 1.5), em(3.0, 0.8, base + 1.25), em(3.0, 1.6, base + 1.1)] },
  };
}
const VER = 'Ver por dentro';
const salasExtras = [
  { id: 'odonto-10', caminho: 'r2', porta: { o: 'h', c: 4.4, a: 32.41, b: 33.2, lado: 'n', base: N_REC }, titulo: 'Odontologia', sub: 'Consultório odontológico · sala 10',
    texto: 'Cadeira odontológica e bancada de apoio, ao lado da recepção.' },
  { id: 'sala-14', caminho: 'r2', porta: { o: 'h', c: 4.4, a: 20.14, b: 20.88, lado: 'n', base: N_REC }, titulo: 'Consultório', sub: 'Sala 14 · corredor da rampa',
    texto: 'Mesa, maca e lavatório.' },
  { id: 'sala-15', caminho: 'r2', porta: { o: 'h', c: 4.4, a: 19.3, b: 20.0, lado: 'n', base: N_REC }, titulo: 'Eletrocardiograma', sub: 'Sala 15 · corredor da rampa',
    texto: 'Maca e aparelho de eletrocardiograma.' },
  { id: 'sala-18', caminho: 'r3', porta: { o: 'h', c: 9.08, a: 9.87, b: 10.93, lado: 's', base: N_ANT }, titulo: 'Consultório', sub: 'Sala 18 · 2º piso',
    texto: 'Mesa e sofá, na entrada do corredor das faixas.' },
  { id: 'consultorio-faixas', caminho: 'r3', porta: { o: 'v', c: 6.09, a: 11.699, b: 12.505, lado: 'e', base: N_ANT }, titulo: 'Consultório', sub: '2º piso · corredor das faixas',
    texto: 'Mesa e sofá para a família.' },
  { id: 'ginecologia', caminho: 'r3', porta: { o: 'v', c: 4.45, a: 13.674, b: 14.479, lado: 'w', base: N_ANT }, titulo: 'Ginecologia', sub: 'Consultório ginecológico · 2º piso',
    texto: 'Mesa, maca ginecológica e sofá.' },
].map(({ porta, ...r }) => ({ ...r, ...visitaPorta(porta), rotulo: VER }));

// ───────────── pontos com olho (só dados reais: planta, fotos, site aprovado, parecer da Vigilância)
export const pontos = [
  // Recepção 1
  { caminho: 'r1', pos: [7.6, T + 3.85, 14.7], ate: 0.08, video: './videos/fachada.mp4', titulo: 'Clínica Dias', sub: 'Recepção 1 · Rua Cento e Vinte e Oito',
    texto: 'Entrada pelo estacionamento. Atendimento de segunda a sexta, das 8h às 18h.' },
  { caminho: 'r1', pos: [4.65, T + 1.4, 11.6], ate: 0.33, video: './videos/portaria.mp4', titulo: 'Recepção', sub: 'Cinco guichês de atendimento',
    texto: 'Agende pelo telefone (31) 3849-6156.', link: { texto: 'Ligar agora', href: 'tel:+553138496156' } },
  { caminho: 'r1', pos: [10.35, T + 1.9, 7.85], ate: 0.52, video: './videos/medicos.mp4', titulo: 'Sala de espera', sub: 'Nossa missão: fazer história',
    texto: 'Consultas em diversas especialidades, exames de imagem, endoscopia, ergometria e oftalmologia.' },
  // salas com "Ver por dentro": a câmera passa pela porta (olhos/alvos) e volta pelo mesmo trajeto.
  // Nomes da planta (folhas 01/05 e 02/05) e móveis da planta layout.
  { id: 'ergometria', caminho: 'r1', rotulo: VER, pos: [8.71, T + 1.9, 7.7], titulo: 'Teste ergométrico', sub: 'Esteira, sofá, mesa e lavatório',
    texto: 'Sala do teste ergométrico, com porta para a sala de espera do térreo.',
    sala: { olhos: [[8.71, o1, 8.45], [8.71, o1, 7.3], [8.6, o1 + 0.1, 5.7]], alvos: [[8.75, o1 - 0.1, 6.0], [10.0, o1 - 0.4, 5.6], [11.6, o1 - 0.6, 6.7]] } },
  { id: 'consultorio-t', caminho: 'r1', rotulo: VER, pos: [15.76, T + 1.9, 5.78], titulo: 'Consultório', sub: 'Consultório indiferenciado',
    texto: 'Mesa, maca e lavatório.',
    sala: { olhos: [[16.4, o1, 6.35], [16.3, o1, 5.78], [15.35, o1, 5.75]], alvos: [[15.4, o1 - 0.1, 5.78], [13.6, o1 - 0.3, 5.2], [12.9, o1 - 0.5, 4.3]] } },
  { caminho: 'r1', pos: [17.45, T + 2.2, 7.2], ate: 0.95, titulo: 'Bloco Cirúrgico', sub: 'Sala cirúrgica e recuperação',
    texto: 'Cirurgias oftalmológicas de baixa complexidade e procedimentos cirúrgicos ambulatoriais.',
    link: { texto: 'Conhecer o site', href: '../' } },
  // Recepção 2
  { caminho: 'r2', pos: [36.15, N_REC + 1.9, 7.4], titulo: 'Clínica Dias', sub: 'Portaria 2 · Avenida Treze',
    texto: 'Entrada com escada e rampa de acesso. Atendimento de segunda a sexta, das 8h às 18h.' },
  { caminho: 'r2', pos: [30.8, N_REC + 1.35, 6.6], titulo: 'Recepção', sub: 'Seis guichês de atendimento',
    texto: 'Agende pelo telefone (31) 3849-6156.', link: { texto: 'Ligar agora', href: 'tel:+553138496156' } },
  { id: 'odonto', caminho: 'r2', rotulo: VER, pos: [29.3, N_REC + 1.7, 4.9], video: './videos/odonto.mp4', titulo: 'Odontologia', sub: 'Dois consultórios odontológicos',
    texto: 'Consultas e tratamentos odontológicos ao lado da recepção.',
    sala: { olhos: [[29.4, oR, 4.95], [29.4, oR, 4.0], [29.45, oR, 3.7]], alvos: [[29.3, oR - 0.1, 3.3], [28.0, oR - 0.4, 2.4], [27.3, oR - 0.5, 1.9]] } },
  { caminho: 'r2', pos: [18.8, N_REC + 1.2, 7.2], titulo: 'Acessibilidade', sub: 'Rampa com corrimão e guarda-corpo de vidro',
    texto: 'O caminho até os consultórios do prédio antigo é feito sem degraus.' },
  { id: 'pediatria', caminho: 'r3', rotulo: VER, pos: [6.69, N_ANT + 1.9, 7.75], titulo: 'Consultório pediátrico', sub: '1º pavimento, prédio antigo',
    texto: 'Mesa e sofá para a família.',
    sala: { olhos: [[6.95, oA, 8.45], [6.69, oA, 7.4], [6.75, oA, 7.1]], alvos: [[6.69, oA - 0.1, 6.6], [8.3, oA - 0.4, 5.6], [9.4, oA - 0.5, 5.0]] } },
  { caminho: 'r3', pos: [10.2, N_ANT + 1.92, 5.46], titulo: 'Sala de espera', sub: 'Chamada pelo painel',
    texto: 'Os pacientes são chamados pela TV do painel de madeira.' },
  { caminho: 'r3', pos: [5.3, N_ANT + 2.3, 12.6], ate: 0.97, video: './videos/corredor.mp4', titulo: 'Consultórios', sub: 'Siga a cor da sua especialidade',
    texto: 'As faixas coloridas no piso levam até cada consultório.', link: { texto: 'Conhecer o site', href: '../' } },
  // fim da rampa: leva direto para a parte dos consultórios (pedido de 11/11)
  { caminho: 'r2', pos: [12.4, N_ANT + 1.75, 7.3], ate: 0.97, titulo: 'Consultórios', rotulo: 'Conhecer os consultórios', vaiPara: 'r3' },
  ...salasExtras,
];
