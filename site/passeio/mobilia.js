// Móveis, plantas, banners e fachadas da Clínica Dias.
// Posições lidas na "planta layout" das folhas 01/05 (térreo) e 02/05 (1º pav.), com grade de 1 m
// (blender/grade_layout.py), e acabamentos das fotos de 2026-11-06 e das fachadas em site/v2/img/.
// Convenção (ver blender/moveis.py): frente = +z local; vira 0 = encostado na parede norte,
// 90 = parede oeste, -90 = parede leste, 180 = parede sul.

const T = 0, N_REC = 3.35, N_ANT = 3.79;
const t = (x, z) => [x, T, z];
const a = (x, z) => [x, N_ANT, z];
const r = (x, z) => [x, N_REC, z];

export const mobilia = [
  // ═════════════ TÉRREO ═════════════
  // sala de indução e recuperação anestésica
  { tipo: 'poltrona', nome: 'm-inducao-1', pos: t(0.95, 1.0), vira: 0, reclina: true },
  { tipo: 'poltrona', nome: 'm-inducao-2', pos: t(1.95, 1.0), vira: 0, reclina: true },
  { tipo: 'maca', nome: 'm-inducao-maca', pos: t(3.25, 1.15), vira: 0 },
  { tipo: 'lavatorio', nome: 'm-inducao-lav', pos: t(0.45, 2.75), vira: 90 },
  // sala de comando e tomografia
  { tipo: 'mesa', nome: 'm-comando', pos: t(5.3, 1.0), vira: 90, larg: 1.3, prof: 0.6, pacientes: 0 },
  { tipo: 'tomografo', nome: 'm-tomografo', pos: t(9.6, 2.25), vira: -23 },
  { tipo: 'armario', nome: 'm-tomo-arm', min: [10.9, T, 0.25], max: [11.75, T + 2.0, 0.8] },
  // trocador, oftalmo 4,7 m², DML
  { tipo: 'poltrona', nome: 'm-trocador', pos: t(0.55, 3.75), vira: 90, mat: 'estofado-claro' },
  { tipo: 'cadeira-oftalmo', nome: 'm-oftalmo-a', pos: t(1.1, 5.05), vira: 90 },
  { tipo: 'pia', nome: 'm-dml', pos: t(0.45, 6.5), vira: 90 },
  // ponta dos guichês: armário branco baixo, com gavetas (f38–f39, vídeo 0:12); não tem pia
  { tipo: 'bancada', nome: 'm-armario-guiches', min: [3.2, T, 7.19], max: [5.3, T, 7.6], pia: 0, tampo: 'branco', gavetas: true },
  // posto de enfermagem (térreo)
  { tipo: 'lavatorio', nome: 'm-posto-lav', pos: t(3.4, 5.2), vira: 90 },
  { tipo: 'poltrona', nome: 'm-posto-poltrona', pos: t(5.45, 6.35), vira: -90 },
  { tipo: 'cadeira-escritorio', nome: 'm-posto-cad', pos: t(4.4, 6.6), vira: 0 },
  // teste ergométrico
  { tipo: 'esteira', nome: 'm-esteira', pos: t(10.0, 6.75), vira: 0 },
  { tipo: 'sofa', nome: 'm-ergo-sofa', pos: t(10.2, 4.95), vira: 0, lugares: 3, mat: 'estofado-claro' },
  { tipo: 'mesa', nome: 'm-ergo-mesa', pos: t(11.2, 7.25), vira: 0, larg: 0.9, prof: 0.5, pacientes: 0 },
  { tipo: 'lavatorio', nome: 'm-ergo-lav', pos: t(11.55, 5.15), vira: -90 },
  // banheiros PNE e oftalmo 9,8 m²
  { tipo: 'vaso', nome: 'm-ispne-f', pos: t(0.45, 8.75), vira: 90 },
  { tipo: 'vaso', nome: 'm-ispne-m', pos: t(0.45, 9.95), vira: 90 },
  { tipo: 'lavatorio', nome: 'm-ispne-lf', pos: t(1.6, 8.6), vira: 0 },
  { tipo: 'lavatorio', nome: 'm-ispne-lm', pos: t(1.6, 10.35), vira: 180 },
  { tipo: 'cadeira-oftalmo', nome: 'm-oftalmo-b1', pos: t(0.6, 12.45), vira: 90 },
  { tipo: 'cadeira-oftalmo', nome: 'm-oftalmo-b2', pos: t(0.6, 13.95), vira: 90 },
  // consultórios do corredor (térreo)
  { tipo: 'mesa', nome: 'm-cons-t1', pos: t(12.87, 2.6), vira: 90, larg: 1.15, prof: 0.6 },
  { tipo: 'maca', nome: 'm-cons-t1-maca', pos: t(13.9, 0.6), vira: 90 },
  { tipo: 'lavatorio', nome: 'm-cons-t1-lav', pos: t(12.25, 0.55), vira: 90 },
  { tipo: 'mesa', nome: 'm-cons-t2', pos: t(12.87, 5.6), vira: 90, larg: 1.15, prof: 0.6 },
  { tipo: 'maca', nome: 'm-cons-t2-maca', pos: t(14.6, 3.7), vira: 90 },
  { tipo: 'lavatorio', nome: 'm-cons-t2-lav', pos: t(15.6, 4.6), vira: -90 },
  // repouso e endoscopia
  { tipo: 'leito', nome: 'm-repouso', pos: t(13.95, 10.45), vira: 0 },
  { tipo: 'poltrona', nome: 'm-repouso-pol', pos: t(14.0, 8.95), vira: 180, mat: 'estofado-claro' },
  { tipo: 'maca', nome: 'm-endo-maca', pos: t(14.45, 13.4), vira: 0 },
  { tipo: 'carrinho', nome: 'm-endo-torre', pos: t(13.4, 14.0), vira: 0 },
  { tipo: 'bancada', nome: 'm-endo-bancada', min: [15.0, T, 12.5], max: [15.75, T, 13.6], pia: 1 },
  // I.S. paciente, guarda de materiais, cadeiras do corredor do bloco
  { tipo: 'vaso', nome: 'm-ispac', pos: t(18.1, 8.75), vira: 0 },
  { tipo: 'lavatorio', nome: 'm-ispac-lav', pos: t(17.3, 8.7), vira: 0 },
  { tipo: 'armario', nome: 'm-materiais', min: [18.4, T, 1.95], max: [21.4, T + 2.0, 2.4] },
  { tipo: 'cadeiras', nome: 'm-bloco-cadeiras', de: [17.15, T, 2.05], n: 6, passo: [0, 0, 0.58], vira: 90, cor: 'preto' },
  // bloco cirúrgico
  { tipo: 'mesa-cirurgica', nome: 'm-cirurgia', pos: t(26.45, 3.6), vira: 90 },
  { tipo: 'bancada', nome: 'm-escovacao', min: [24.2, T, 5.75], max: [26.0, T, 6.2], pia: 2, tampo: 'inox' },
  { tipo: 'carrinho', nome: 'm-cirurgia-anest', pos: t(27.6, 2.6), vira: 0 },
  { tipo: 'bancada', nome: 'm-posto-bloco', min: [29.1, T, 1.9], max: [29.65, T, 5.4], pia: 1 },
  { tipo: 'leito', nome: 'm-rpa-1', pos: t(33.2, 3.4), vira: -90 },
  { tipo: 'leito', nome: 'm-rpa-2', pos: t(33.2, 5.3), vira: -90 },
  { tipo: 'leito', nome: 'm-rpa-3', pos: t(33.2, 7.25), vira: -90 },
  { tipo: 'cortina', nome: 'm-rpa-c1', de: [32.2, 4.35], ate: [34.15, 4.35], y: T },
  { tipo: 'cortina', nome: 'm-rpa-c2', de: [32.2, 6.3], ate: [34.15, 6.3], y: T },

  // recepção 1: logo oficial na parede de mármore, banners da espera
  { tipo: 'decal', nome: 'logo-marmore-r1', imagem: 'logo', centro: [3.49, T + 1.95, 11.65], larg: 2.6, alt: 0.975, vira: 90 },
  // banners reais, recortados das fotos f45 e f49 com a perspectiva corrigida (blender/decais)
  // "Nossa missão": parede do fundo da espera, de frente para os guichês (f43–f45, confirmado em 11/11)
  { tipo: 'caixa', nome: 'painel-missao', min: [11.99, T + 0.98, 9.94], max: [12.12, T + 2.82, 12.96], mat: 'branco' },
  { tipo: 'decal', nome: 'banner-missao', imagem: 'banner-missao', centro: [11.985, T + 1.9, 11.45], larg: 2.9, alt: 1.66, vira: -90 },
  // quadro bege com as placas dos médicos na parede da ergometria (vídeo 0:14–0:17, f42 e f48)
  { tipo: 'quadro-medicos', nome: 'placas-medicos', centro: [10.55, T, 7.78], larg: 1.45, alt: 2.45, vira: 0 },
  // "Pós Consulta": cartaz na parede do canto, antes do corredor do Bloco, com mesinha preta e cadeira (f48–f49)
  { tipo: 'decal', nome: 'banner-pos', imagem: 'banner-pos', centro: [13.395, T + 1.08, 9.07], larg: 1.36, alt: 1.95, vira: -90 },
  { tipo: 'mesinha-preta', nome: 'mesa-pos-consulta', pos: t(13.12, 9.25), vira: -90 },
  { tipo: 'cadeiras', nome: 'cadeira-pos', de: [12.55, T, 9.2], n: 1, passo: [0, 0, 0], vira: 90, cor: 'preto' },
  { tipo: 'planta-vaso', nome: 'planta-r1-a', pos: t(11.55, 13.9), altura: 1.4 },
  { tipo: 'planta-vaso', nome: 'planta-r1-b', pos: t(3.8, 13.9), altura: 1.2 },

  // fachada da Rua 128 (como site/v2/img/fachada-recepcao1.webp)
  { tipo: 'caixa', nome: 'painel-creme-r1', min: [-0.05, T, 14.57], max: [3.3, T + 2.9, 14.66], mat: 'creme' },
  { tipo: 'decal', nome: 'logo-fachada-r1', imagem: 'logo', centro: [1.62, T + 1.55, 14.67], larg: 2.7, alt: 1.01, vira: 0 },
  { tipo: 'cobogo', nome: 'cobogo-r1', min: [7.55, T + 0.35, 14.66], max: [11.95, T + 2.85, 14.74] },
  { tipo: 'caixa', nome: 'jardineira-r1', min: [7.55, T, 14.76], max: [11.95, T + 0.35, 15.2], mat: 'concreto' },
  { tipo: 'touceira', nome: 'capim-r1', min: [7.65, T + 0.35, 14.85], max: [11.85, T + 0.95, 15.12], folhas: 70 },
  { tipo: 'porta-vidro', nome: 'porta-escada-r1', min: [12.5, T, 14.6], max: [14.3, T + 2.6, 14.66] },
  { tipo: 'caixa', nome: 'revest-escuro-r1', min: [14.3, T, 14.57], max: [19.25, T + 2.9, 14.64], mat: 'fachada-escura' },
  { tipo: 'caixa', nome: 'marquise-r1', min: [-0.2, T + 2.9, 14.4], max: [19.3, T + 3.65, 15.75], mat: 'fachada-clara' },
  ...[1.2, 4.6, 6.7, 8.8, 10.9, 13.0, 15.2, 17.4].map((x, i) => ({ tipo: 'caixa', nome: `spot-marquise-r1-${i}`, min: [x - 0.09, T + 2.88, 15.1], max: [x + 0.09, T + 2.9, 15.28], mat: 'luz' })),
  { tipo: 'letras', nome: 'letreiro-r1', texto: 'CLÍNICA DIAS', centro: [7.4, T + 4.0, 15.15], tamanho: 0.62, mat: 'branco', vira: 0, prof: 0.1 },
  { tipo: 'letras', nome: 'telefone-r1', texto: '3849.6156', centro: [1.9, T + 3.27, 15.76], tamanho: 0.34, mat: 'branco', vira: 0, prof: 0.02 },
  // pele de vidro na frente da parede do 1º andar (antes ficava atrás e o andar de dentro aparecia)
  { tipo: 'caixilho', nome: 'pele-vidro-r1', min: [-0.05, T + 3.65, 14.66], max: [16.3, T + 9.7, 14.72], modulo: 1.3, eixo: 'x' },
  { tipo: 'caixa', nome: 'vaga-pne', min: [6.3, T - 0.015, 16.6], max: [7.5, T + 0.006, 17.6], mat: 'azul' },
  ...[1.1, 3.7, 6.85, 9.4, 12.0].map((x, i) => ({ tipo: 'caixa', nome: `batente-vaga-${i}`, min: [x - 0.45, T, 15.35], max: [x + 0.45, T + 0.1, 15.5], mat: 'amarelo' })),

  // carros simples nas vagas da Rua 128, extintores, lixeiras, totem de senha (fotos f39, f45, f14)
  // (os carros saíram em 11/11: o modelo simples ficava tosco na frente da fachada)
  { tipo: 'extintor', nome: 'ext-r1', pos: t(12.1, 13.55), vira: -90 }, // à direita do painel "Nossa missão" (f45)
  { tipo: 'extintor', nome: 'ext-bloco', pos: t(14.7, 6.29), vira: 0 }, // na parede sul do corredor (antes flutuava no meio)
  { tipo: 'lixeira', nome: 'lix-r1b', pos: t(11.85, 14.05), vira: 0, pedal: true },
  // totem branco "Retire sua Senha" na ponta dos guichês, ao lado do armário branco (f37–f39, vídeo 0:12)
  { tipo: 'totem-senha', nome: 'totem-senha-r1', pos: t(5.57, 7.83), vira: 0 },

  // ═════════════ 1º PAVIMENTO ═════════════
  // prédio antigo (+3,79)
  { tipo: 'maca', nome: 'm-c178-maca', pos: a(0.62, 1.1), vira: 0 },
  { tipo: 'mesa', nome: 'm-c178', pos: a(1.15, 3.75), vira: 0, larg: 1.6 },
  { tipo: 'vaso', nome: 'm-is39', pos: a(4.4, 0.45), vira: 0 },
  { tipo: 'sofa', nome: 'm-c10-sofa', pos: a(5.1, 2.05), vira: 0, lugares: 3, mat: 'estofado-claro' },
  { tipo: 'mesa', nome: 'm-c10', pos: a(4.95, 3.95), vira: -90, larg: 1.2 },
  { tipo: 'vaso', nome: 'm-ispne-1p', pos: a(6.9, 0.5), vira: 0 },
  { tipo: 'mesa', nome: 'm-oftalmo-1p', pos: a(8.65, 2.7), vira: 90, larg: 1.1, prof: 0.6 },
  { tipo: 'cadeira-oftalmo', nome: 'm-oftalmo-1p-cad', pos: a(11.6, 1.3), vira: -90 },
  { tipo: 'sofa', nome: 'm-pediatria-sofa', pos: a(8.9, 4.85), vira: 0, lugares: 3, mat: 'estofado-azul' },
  { tipo: 'mesa', nome: 'm-pediatria', pos: a(8.5, 6.85), vira: -90, larg: 1.4, prof: 0.6 },
  // as duas salinhas de banheiro da planta viraram um consultório (f31: janela e ar-condicionado)
  { tipo: 'mesa', nome: 'm-cons-pav1-oeste', pos: a(1.3, 6.85), vira: 0, larg: 1.3, prof: 0.6 },
  { tipo: 'mesa', nome: 'm-c141', pos: a(1.05, 9.95), vira: 180, larg: 1.6, prof: 0.6 },
  { tipo: 'sofa', nome: 'm-c141-sofa', pos: a(3.65, 10.95), vira: 180, lugares: 3, mat: 'estofado-claro' },
  { tipo: 'mesa', nome: 'm-gineco', pos: a(1.45, 12.4), vira: 90, larg: 1.2, prof: 0.6 },
  { tipo: 'maca', nome: 'm-gineco-maca', pos: a(2.55, 13.75), vira: 90, cor: 'estofado-azul' },
  { tipo: 'sofa', nome: 'm-gineco-sofa', pos: a(2.0, 14.25), vira: 180, lugares: 3, mat: 'estofado-claro' },
  { tipo: 'mesa', nome: 'm-c87', pos: a(6.85, 10.55), vira: 180, larg: 1.2, prof: 0.6 },
  { tipo: 'sofa', nome: 'm-c87-sofa', pos: a(8.9, 9.6), vira: 0, lugares: 3, mat: 'estofado-claro' },
  { tipo: 'mesa', nome: 'm-c108', pos: a(8.5, 12.35), vira: -90, larg: 1.4, prof: 0.6 },
  { tipo: 'sofa', nome: 'm-c108-sofa', pos: a(8.55, 14.25), vira: 180, lugares: 3, mat: 'estofado-claro' },
  { tipo: 'mesa', nome: 'm-c143', pos: a(10.9, 11.25), vira: 180, larg: 1.6, prof: 0.6 },
  { tipo: 'sofa', nome: 'm-c143-sofa', pos: a(13.1, 9.6), vira: 0, lugares: 3, mat: 'estofado-claro' },
  { tipo: 'mesa', nome: 'm-adm', pos: a(11.3, 13.85), vira: 90, larg: 1.2, prof: 0.6 },
  { tipo: 'poltrona', nome: 'm-coleta-1', pos: a(15.6, 1.45), vira: -90 },
  { tipo: 'poltrona', nome: 'm-coleta-2', pos: a(15.6, 2.4), vira: -90 },
  { tipo: 'bancada', nome: 'm-coleta-bancada', min: [12.6, N_ANT, 0.2], max: [14.6, N_ANT, 0.75], pia: 1 },
  // espera 18,4 m²: rebaixo de gesso com spots (forro, some na maquete)
  { tipo: 'caixa', nome: 'teto-sanca-n', min: [10.02, N_ANT + 2.5, 4.55], max: [14.21, N_ANT + 2.75, 5.1], mat: 'teto', teto: true },
  { tipo: 'caixa', nome: 'teto-sanca-s', min: [10.02, N_ANT + 2.5, 8.45], max: [14.21, N_ANT + 2.75, 9.03], mat: 'teto', teto: true },
  { tipo: 'caixa', nome: 'teto-sanca-o', min: [10.02, N_ANT + 2.5, 5.1], max: [10.55, N_ANT + 2.75, 8.45], mat: 'teto', teto: true },
  { tipo: 'caixa', nome: 'teto-sanca-l', min: [13.7, N_ANT + 2.5, 5.1], max: [14.21, N_ANT + 2.75, 8.45], mat: 'teto', teto: true },
  // prédio novo (+3,35)
  { tipo: 'maca', nome: 'm-eletro-maca', pos: r(18.4, 2.95), vira: 0, comp: 1.8 },
  { tipo: 'carrinho', nome: 'm-eletro-ecg', pos: r(19.45, 2.3), vira: -90 },
  { tipo: 'mesa', nome: 'm-c75', pos: r(20.75, 2.75), vira: 0, larg: 1.2, prof: 0.6 },
  { tipo: 'maca', nome: 'm-c75-maca', pos: r(22.25, 3.4), vira: 0, comp: 1.8 },
  { tipo: 'bancada', nome: 'm-ester-odonto', min: [23.0, N_REC, 1.65], max: [24.3, N_REC, 2.2], pia: 1 },
  { tipo: 'cadeira-odonto', nome: 'm-odonto-1', pos: r(28.6, 2.75), vira: 140 },
  { tipo: 'bancada', nome: 'm-odonto-1-banc', min: [26.72, N_REC, 1.65], max: [27.25, N_REC, 3.4], pia: 1 },
  { tipo: 'cadeira-odonto', nome: 'm-odonto-2', pos: r(32.0, 2.75), vira: 140 },
  { tipo: 'bancada', nome: 'm-odonto-2-banc', min: [30.1, N_REC, 1.65], max: [30.63, N_REC, 3.4], pia: 1 },
  { tipo: 'extintor', nome: 'ext-r2', pos: r(22.62, 4.45), vira: 0 }, // na parede do corredor, antes das cadeiras (f14)
  { tipo: 'lixeira', nome: 'lix-espera', pos: a(12.45, 8.84), vira: 180, pedal: true }, // embaixo da prateleira (f24)
  // como nas fotos: purificadores de água na parede, split na recepção 2, DEA vermelho na espera
  { tipo: 'purificador', nome: 'pur-r1', pos: t(13.6, 6.29), vira: 0 },
  { tipo: 'purificador', nome: 'pur-r2-a', pos: r(24.53, 4.05), vira: 90 },
  { tipo: 'purificador', nome: 'pur-r2-b', pos: r(24.53, 4.7), vira: 90 },
  { tipo: 'ar-split', nome: 'split-r2-a', pos: r(27.8, 4.45), vira: 0 },
  { tipo: 'ar-split', nome: 'split-r2-b', pos: r(31.2, 4.45), vira: 0 },
  { tipo: 'dea', nome: 'dea-espera', pos: a(13.05, 9.03), vira: 180 },
  { tipo: 'vaso', nome: 'm-isfunc-1p', pos: r(25.1, 1.95), vira: 0 },
  { tipo: 'vaso', nome: 'm-ispne-pac-1p', pos: r(24.95, 7.55), vira: 90 },
];
