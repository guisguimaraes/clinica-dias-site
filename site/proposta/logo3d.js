// Símbolo da Clínica Dias em 3D. As formas foram traçadas sobre assets/img/logo.png.
import * as THREE from './vendor/three.module.min.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const palco = document.querySelector('[data-logo3d]');

const criarRenderizador = () => {
  try {
    return new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null;
  }
};

const renderizador = palco && criarRenderizador();

if (renderizador) {
  const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  palco.append(renderizador.domElement);
  palco.classList.add('ativo');

  const LARGURA = 6.2;
  const ALTURA = 6.2;

  const ajustar = () => {
    const { clientWidth: w, clientHeight: h } = palco;
    if (!w || !h) return;
    renderizador.setSize(w, h, false);
    camera.aspect = w / h;
    const tangente = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.z = Math.max(ALTURA / 2 / tangente, LARGURA / 2 / (tangente * camera.aspect));
    camera.updateProjectionMatrix();
    desenhar();
  };

  // Rotação: posição de repouso levemente virada, arrasto e giro a cada área escolhida
  const REPOUSO = { x: -0.12, y: -0.42 };
  const atual = { x: REPOUSO.x, y: REPOUSO.y };
  const alvo = { x: REPOUSO.x, y: REPOUSO.y };
  let arrastando = null;
  let visivel = false;
  let quadro = 0;
  let tempo = 0;

  function desenhar() {
    logo.rotation.set(atual.x, atual.y, 0);
    renderizador.render(cena, camera);
  }

  const animar = () => {
    quadro = visivel ? requestAnimationFrame(animar) : 0;
    tempo += 1 / 60;
    const balanco = arrastando ? 0 : Math.sin(tempo * 0.7) * 0.1;
    atual.x += (alvo.x - atual.x) * 0.08;
    atual.y += (alvo.y + balanco - atual.y) * 0.08;
    desenhar();
  };

  const ligar = () => {
    if (semMovimento) {
      atual.x = alvo.x;
      atual.y = alvo.y;
      desenhar();
    } else if (visivel && !quadro) {
      quadro = requestAnimationFrame(animar);
    }
  };

  new IntersectionObserver(([entrada]) => {
    visivel = entrada.isIntersecting;
    ligar();
  }).observe(palco);

  new ResizeObserver(ajustar).observe(palco);

  palco.addEventListener('pointerdown', (evento) => {
    arrastando = { x: evento.clientX, y: evento.clientY, rx: alvo.x, ry: alvo.y };
    palco.setPointerCapture(evento.pointerId);
    palco.classList.add('arrastando');
  });

  palco.addEventListener('pointermove', (evento) => {
    if (!arrastando) return;
    alvo.y = arrastando.ry + (evento.clientX - arrastando.x) * 0.012;
    alvo.x = THREE.MathUtils.clamp(arrastando.rx + (evento.clientY - arrastando.y) * 0.008, -0.8, 0.8);
    ligar();
  });

  const soltar = () => {
    arrastando = null;
    palco.classList.remove('arrastando');
  };
  palco.addEventListener('pointerup', soltar);
  palco.addEventListener('pointercancel', soltar);

  document.addEventListener('area-escolhida', () => {
    const voltas = Math.round((alvo.y - REPOUSO.y) / (Math.PI * 2));
    alvo.y = REPOUSO.y + (voltas + 1) * Math.PI * 2;
    alvo.x = REPOUSO.x;
    ligar();
  });

  ajustar();
}
