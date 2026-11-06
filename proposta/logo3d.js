// Símbolo da Clínica Dias em 3D. As formas foram traçadas sobre assets/img/logo.png.
import * as THREE from './vendor/three.module.min.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const canto = document.querySelector('[data-logo3d-canto]');
const noModal = document.querySelector('[data-logo3d-modal]');
const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const criarRenderizador = () => {
  try {
    return new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null;
  }
};

const criarLogo = () => {

  // Coordenadas em pixels da logo ampliada: x para a direita, y para baixo
  const CENTRO = { x: 288, y: 260 };
  const ESCALA = 1 / 100;
  const px = (x, y) => [(x - CENTRO.x) * ESCALA, (CENTRO.y - y) * ESCALA];

  const tracar = (alvo, passos) => {
    passos.forEach(([tipo, ...v]) => {
      if (tipo === 'M') alvo.moveTo(...px(v[0], v[1]));
      if (tipo === 'L') alvo.lineTo(...px(v[0], v[1]));
      if (tipo === 'Q') alvo.quadraticCurveTo(...px(v[0], v[1]), ...px(v[2], v[3]));
      if (tipo === 'C') alvo.bezierCurveTo(...px(v[0], v[1]), ...px(v[2], v[3]), ...px(v[4], v[5]));
    });
    return alvo;
  };

  const CRUZ = [
    ['M', 215, 28], ['Q', 215, 5, 238, 5], ['L', 372, 5], ['Q', 395, 5, 395, 28],
    ['L', 395, 148], ['Q', 395, 168, 415, 168], ['L', 538, 168], ['Q', 562, 168, 562, 192],
    ['L', 562, 326], ['Q', 562, 350, 538, 350], ['L', 400, 350], ['L', 385, 358],
    ['C', 345, 325, 300, 295, 288, 255], ['C', 275, 215, 250, 180, 215, 165], ['L', 215, 28],
  ];

  const FRISO = [
    ['M', 232, 42], ['Q', 232, 22, 252, 22], ['L', 358, 22], ['Q', 378, 22, 378, 42],
    ['L', 378, 165], ['Q', 378, 184, 397, 184], ['L', 526, 184], ['Q', 546, 184, 546, 204],
    ['L', 546, 314], ['Q', 546, 333, 526, 333], ['L', 388, 333], ['L', 382, 337],
    ['C', 350, 310, 318, 285, 305, 250], ['C', 292, 210, 268, 172, 232, 150], ['L', 232, 42],
  ];

  const BASE = [
    ['M', 300, 292], ['L', 390, 372], ['Q', 398, 380, 398, 392], ['L', 398, 492],
    ['Q', 398, 517, 373, 517], ['L', 238, 517], ['Q', 213, 517, 213, 492], ['L', 213, 452],
    ['L', 232, 464], ['L', 232, 482], ['Q', 232, 498, 248, 498], ['L', 364, 498],
    ['Q', 380, 498, 380, 482], ['L', 380, 396], ['Q', 380, 386, 372, 379], ['L', 292, 308], ['L', 300, 292],
  ];

  const CANTO = [
    ['M', 47, 240], ['L', 65, 254], ['L', 65, 314], ['Q', 65, 332, 83, 332], ['L', 134, 332],
    ['L', 162, 350], ['L', 73, 350], ['Q', 47, 350, 47, 324], ['L', 47, 240],
  ];

  const FOLHA_GRANDE = [
    ['M', 14, 196], ['C', 90, 160, 190, 158, 240, 215], ['C', 262, 245, 272, 285, 282, 322],
    ['C', 205, 340, 105, 290, 14, 196],
  ];
  const VEIO_GRANDE = [['M', 88, 204], ['C', 150, 215, 215, 255, 268, 312], ['C', 205, 268, 145, 232, 88, 204]];

  const FOLHA_PEQUENA = [
    ['M', 116, 468], ['C', 135, 410, 185, 345, 240, 336], ['C', 262, 334, 280, 342, 288, 354],
    ['C', 292, 385, 225, 435, 116, 468],
  ];
  const VEIO_PEQUENO = [['M', 150, 432], ['C', 195, 398, 235, 382, 282, 372], ['C', 238, 390, 195, 408, 150, 432]];

  // O degradê vem de uma textura: assim ele fica liso em qualquer formato de peça
  const gradiente = (paradas) => {
    const inicio = paradas[0][0];
    const fim = paradas[paradas.length - 1][0];
    const tela = document.createElement('canvas');
    tela.width = 512;
    tela.height = 2;
    const contexto = tela.getContext('2d');
    const faixa = contexto.createLinearGradient(0, 0, 512, 0);
    paradas.forEach(([x, cor]) => faixa.addColorStop((x - inicio) / (fim - inicio), cor));
    contexto.fillStyle = faixa;
    contexto.fillRect(0, 0, 512, 2);
    const textura = new THREE.CanvasTexture(tela);
    textura.colorSpace = THREE.SRGBColorSpace;
    return {
      textura,
      min: (inicio - CENTRO.x) * ESCALA,
      max: (fim - CENTRO.x) * ESCALA,
    };
  };

  const peca = (passos, { textura, min, max }, { veio, altura = 0.34, z = 0 } = {}) => {
    const forma = tracar(new THREE.Shape(), passos);
    if (veio) forma.holes.push(tracar(new THREE.Path(), veio));
    const geometria = new THREE.ExtrudeGeometry(forma, {
      depth: altura,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.035,
      bevelSegments: 5,
      curveSegments: 28,
    });
    const posicoes = geometria.attributes.position;
    const coordenadas = geometria.attributes.uv;
    for (let i = 0; i < posicoes.count; i += 1) {
      coordenadas.setXY(i, THREE.MathUtils.clamp((posicoes.getX(i) - min) / (max - min), 0, 1), 0.5);
    }
    geometria.translate(0, 0, z - altura / 2);
    return new THREE.Mesh(geometria, new THREE.MeshPhysicalMaterial({
      map: textura,
      roughness: 0.34,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.22,
    }));
  };

  const corCruz = gradiente([[215, '#e08a4e'], [300, '#a56f78'], [400, '#6b3f74'], [562, '#211c52']]);
  const corBase = gradiente([[213, '#ee8328'], [320, '#d2804f'], [398, '#8f5a70']]);
  const corFolha = gradiente([[14, '#f07f1c'], [150, '#ee8326'], [282, '#d9925c']]);

  const logo = new THREE.Group();
  logo.add(peca(CRUZ, corCruz));
  logo.add(peca(BASE, corBase, { altura: 0.22 }));
  logo.add(peca(CANTO, corFolha, { altura: 0.22 }));
  logo.add(peca(FOLHA_GRANDE, corFolha, { veio: VEIO_GRANDE, altura: 0.2, z: 0.16 }));
  logo.add(peca(FOLHA_PEQUENA, corFolha, { veio: VEIO_PEQUENO, altura: 0.2, z: 0.16 }));

  // Friso claro por dentro da cruz, como na logo
  const pontosFriso = tracar(new THREE.Path(), FRISO).getSpacedPoints(260).slice(0, -1);
  const curvaFriso = new THREE.CatmullRomCurve3(
    pontosFriso.map((p) => new THREE.Vector3(p.x, p.y, 0.235)),
    true,
  );
  logo.add(new THREE.Mesh(
    new THREE.TubeGeometry(curvaFriso, 520, 0.016, 10, true),
    new THREE.MeshPhysicalMaterial({ color: '#f4e7e0', roughness: 0.25, clearcoat: 1 }),
  ));

  return logo;
};

// Monta cena, câmera e tela num elemento; devolve o que cada palco precisa
const montar = (elemento, renderizador) => {
  const logo = criarLogo();
  const cena = new THREE.Scene();
  const ambiente = new THREE.PMREMGenerator(renderizador);
  cena.environment = ambiente.fromScene(new RoomEnvironment(), 0.04).texture;
  cena.environmentIntensity = 0.75;
  cena.add(logo);

  const luz = new THREE.DirectionalLight('#ffffff', 1.5);
  luz.position.set(-3, 5, 7);
  cena.add(luz);

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderizador.toneMapping = THREE.NeutralToneMapping;
  renderizador.domElement.setAttribute('aria-hidden', 'true');
  elemento.append(renderizador.domElement);
  elemento.classList.add('ativo');

  const LADO = 6.2;
  const ajustar = () => {
    const { clientWidth: w, clientHeight: h } = elemento;
    if (!w || !h) return false;
    renderizador.setSize(w, h, false);
    camera.aspect = w / h;
    const tangente = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.z = Math.max(LADO / 2 / tangente, LADO / 2 / (tangente * camera.aspect));
    camera.updateProjectionMatrix();
    return true;
  };

  return { logo, ajustar, desenhar: () => renderizador.render(cena, camera) };
};

const rendCanto = canto && !semMovimento && criarRenderizador();

if (rendCanto) {
  const { logo, ajustar, desenhar } = montar(canto, rendCanto);
  let giro = -0.42;
  let inclinacao = 0;
  let descida = 0;
  let ultimoY = window.scrollY;
  let velocidade = 0;
  let quadro = 0;
  let tempo = 0;

  const passo = () => {
    quadro = 0;
    const y = window.scrollY;
    const altura = window.innerHeight;
    const total = Math.max(1, document.documentElement.scrollHeight - altura);
    const progresso = Math.min(1, y / total);

    // Aparece depois do topo e some no finzinho, perto do rodapé
    canto.classList.toggle('visivel', y > altura * 0.55 && progresso < 0.985);

    // Desce do alto até perto do pé da tela ao longo da página inteira
    const tamanho = canto.clientHeight;
    const alvoDescida = altura * 0.14 + (altura * 0.72 - tamanho) * progresso;
    descida += (alvoDescida - descida) * 0.12;

    // Gira duas voltas na página toda; a velocidade da rolagem inclina o logo
    velocidade += ((y - ultimoY) - velocidade) * 0.2;
    ultimoY = y;
    const alvoGiro = -0.42 + progresso * Math.PI * 4;
    giro += (alvoGiro - giro) * 0.1;
    inclinacao += (THREE.MathUtils.clamp(velocidade * 0.012, -0.5, 0.5) - inclinacao) * 0.12;
    tempo += 1 / 60;

    canto.style.transform = `translate3d(0, ${descida.toFixed(1)}px, 0)`;
    logo.rotation.set(-0.12 + inclinacao, giro + Math.sin(tempo * 0.8) * 0.08, Math.sin(tempo * 0.6) * 0.04);
    desenhar();

    const parado = Math.abs(alvoDescida - descida) < 0.5 && Math.abs(alvoGiro - giro) < 0.002
      && Math.abs(velocidade) < 0.05;
    if (!parado || canto.classList.contains('visivel')) quadro = requestAnimationFrame(passo);
  };

  const pedir = () => {
    if (!quadro) quadro = requestAnimationFrame(passo);
  };

  window.addEventListener('scroll', pedir, { passive: true });
  window.addEventListener('resize', () => {
    ajustar();
    pedir();
  });
  ajustar();
  descida = window.innerHeight * 0.14;
  pedir();
}

// Logo da janela de especialidade: gira 360° sem parar enquanto a janela está aberta
const rendModal = noModal && criarRenderizador();

if (rendModal) {
  const janela = noModal.closest('dialog');
  const { logo, ajustar, desenhar } = montar(noModal, rendModal);
  let quadro = 0;
  let giro = 0;
  let tempo = 0;

  const girar = () => {
    quadro = janela.open ? requestAnimationFrame(girar) : 0;
    tempo += 1 / 60;
    giro += semMovimento ? 0 : 0.022;
    logo.rotation.set(-0.12 + Math.sin(tempo * 1.1) * 0.08, giro, 0);
    desenhar();
  };

  new MutationObserver(() => {
    if (janela.open && !quadro) {
      ajustar();
      quadro = requestAnimationFrame(girar);
    }
  }).observe(janela, { attributes: true, attributeFilter: ['open'] });
}
