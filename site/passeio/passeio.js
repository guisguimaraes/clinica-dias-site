// Passeio 3D pela Clínica Dias, na linha do ICG Gallery:
// entrada → maquetes por área dos dois andares (setas + Entrar) → caminho preso à rolagem/arrasto
// com pontos que abrem painéis. Geometria e luz vêm do Blender (modelos/clinica.glb).
//
// Para não pesar em notebook fraco: desenha só quando algo muda (nada de 60 quadros parados),
// sombra só na maquete (mapa 1024), resolução no máx. 1,5×. Com ?leve=1 tira sombra e antialias.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import gsap from 'gsap';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { areas, pontos, caminhos, andares } from './planta.js';

const $ = (s) => document.querySelector(s);
const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
const q = new URLSearchParams(location.search);
const LEVE = q.has('leve');

// ───────────────────────── renderizador
const canvas = $('#cena');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LEVE, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(LEVE ? 1 : Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.localClippingEnabled = true;
renderer.shadowMap.enabled = !LEVE;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Paleta oficial (Manual da Marca): laranja #F7922D, petróleo #5C95A4, azul noite #101E44,
// pêssego #FDE0C9, cinzas #A8A9AC / #828386. Fundo claro #F5F4F2.
const COR_FUNDO = new THREE.Color('#E9E2D7'); // fundo bege das maquetes (como o ICG)
const COR_BASE = new THREE.Color('#DDD3C5');  // base da maquete: argila um tom abaixo
const COR_BARRO = new THREE.Color('#E8DCCB'); // tudo da maquete em argila; só logos e placas ficam com cor
// cores dos materiais do Blender trocadas pela paleta da marca (nome do material → cor)
const PALETA = {
  teal: '#5C95A4', 'faixa-azul': '#5C95A4', laranja: '#F7922D', roxo: '#101E44',
  'faixa-branca': '#F5F4F2', banner: '#FDE0C9', quadro: '#828386',
};
const scene = new THREE.Scene();
scene.background = COR_FUNDO.clone();

const camera = new THREE.PerspectiveCamera(22, 1, 0.05, 400);
const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

// ───────────────────────── pós-processamento do passeio (desligado com ?leve=1)
// tom quente e contraste suave + vinheta discreta + FXAA (antialias barato, bom para GPU integrada)
const TomVinheta = {
  uniforms: { tDiffuse: { value: null }, quente: { value: 0.035 }, contraste: { value: 1.06 }, vinheta: { value: 0.32 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float quente, contraste, vinheta; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      c.rgb = (c.rgb - 0.5) * contraste + 0.5;
      c.rgb += vec3(quente, quente * 0.4, -quente * 0.6);
      float d = distance(vUv, vec2(0.5));
      c.rgb *= mix(1.0, smoothstep(0.85, 0.25, d), vinheta);
      gl_FragColor = c;
    }`,
};
let composer = null, fxaa = null;
if (!LEVE) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());            // tom (AgX) e sRGB antes dos efeitos de tela
  composer.addPass(new ShaderPass(TomVinheta));
  fxaa = new ShaderPass(FXAAShader);
  composer.addPass(fxaa);
}

// desenho sob demanda: cada mudança "acorda" o laço por alguns quadros
let quadros = 2;
const acorda = (n = 90) => { quadros = Math.max(quadros, n); };

// luz para a maquete (barro) e para o rascunho sem luz calculada
const pmrem = new THREE.PMREMGenerator(renderer);
const ambiente = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const hemi = new THREE.HemisphereLight('#fff7ee', '#d9d1c6', 1.5);
const sol = new THREE.DirectionalLight('#ffe9d2', 1.15);
sol.castShadow = !LEVE;
sol.shadow.mapSize.set(1024, 1024);
sol.shadow.bias = -0.0005;
sol.shadow.normalBias = 0.03;
sol.shadow.radius = 9;
sol.shadow.blurSamples = 16;
scene.add(hemi, sol, sol.target);

// ───────────────────────── recorte da maquete (caixa da área, com fundo: esconde o andar de baixo)
const corte = { min: new THREE.Vector3(), max: new THREE.Vector3() };
const planos = [0, 1, 2, 3, 4, 5].map(() => new THREE.Plane());
function atualizaPlanos() {
  planos[0].set(new THREE.Vector3(1, 0, 0), -corte.min.x);
  planos[1].set(new THREE.Vector3(-1, 0, 0), corte.max.x);
  planos[2].set(new THREE.Vector3(0, 0, 1), -corte.min.z);
  planos[3].set(new THREE.Vector3(0, 0, -1), corte.max.z);
  planos[4].set(new THREE.Vector3(0, -1, 0), corte.max.y);
  planos[5].set(new THREE.Vector3(0, 1, 0), -corte.min.y);
}

// corte de casa de bonecas: só as paredes de fora do lado da câmera (leste e sul da área)
// somem acima da altura do corte; as divisórias de dentro ficam inteiras (como no ICG)
const uCorte = {
  uMax: { value: new THREE.Vector2(0, 0) },
  uAltura: { value: 1.2 },
  uTopo: { value: 99 },   // corta TODAS as paredes acima disto (áreas cheias de salas)
  uAtivo: { value: 1 },
};
function comCorte(mat) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uCorte);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMundo;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMundo;\nuniform vec2 uMax; uniform float uAltura; uniform float uTopo; uniform float uAtivo;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (uAtivo > 0.5 && ((vMundo.y > uAltura && (vMundo.x > uMax.x - 0.55 || vMundo.z > uMax.y - 0.55)) || vMundo.y > uTopo)) discard;')
      // miolo das paredes cortadas: cor de corte clara e lisa (como as maquetes do ICG), nunca preto
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\nif (uAtivo > 0.5 && !gl_FrontFacing) gl_FragColor = vec4(0.86, 0.83, 0.79, 1.0);');
  };
  mat.customProgramCacheKey = () => 'corte';
  return mat;
}

// maquete colorida: cada material do modelo vira uma versão "maquete" com as cores e texturas reais,
// sol com sombra suave + luz ambiente, recorte da área e corte das paredes da frente
const matVidroMaq = comCorte(new THREE.MeshStandardMaterial({
  color: '#f6f2ec', roughness: 0.08, metalness: 0, transparent: true, opacity: 0.3,
  clippingPlanes: planos, depthWrite: false, envMapIntensity: 0.8,
}));
const maqCache = new Map();
function materialMaquete(src, aoMap = null, decal = false) {
  const chave = src.uuid + (aoMap ? aoMap.uuid : '') + (decal ? 'd' : '');
  if (maqCache.has(chave)) return maqCache.get(chave);
  const m = comCorte(new THREE.MeshStandardMaterial({
    aoMap, aoMapIntensity: 0.8,
    transparent: decal, alphaTest: decal ? 0.35 : 0, polygonOffset: decal, polygonOffsetFactor: -2,
    // maquete em argila (como o ICG): uma cor só; logos e placas (decalques) ficam com a imagem
    color: decal ? (src.color ? src.color.clone() : new THREE.Color('#ffffff')) : COR_BARRO.clone(),
    map: decal ? (src.map || null) : null,
    roughness: Math.min(src.roughness ?? 0.8, 0.9),
    metalness: 0,
    emissive: new THREE.Color(0),
    envMap: ambiente, envMapIntensity: 0.35,
    clippingPlanes: planos, clipShadows: true, side: decal ? THREE.FrontSide : THREE.DoubleSide,
  }));
  maqCache.set(chave, m);
  return m;
}
const sombraBarro = comCorte(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, clippingPlanes: planos }));

// base e linhas finas em volta da maquete
const base = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: COR_BASE, roughness: 0.95 }));
base.receiveShadow = true;
const linhas = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
  new THREE.LineBasicMaterial({ color: '#A8A9AC', transparent: true, opacity: 0.75 }),
);
scene.add(base, linhas);

function posicionaBase() {
  const sx = corte.max.x - corte.min.x, sz = corte.max.z - corte.min.z;
  const cx = (corte.min.x + corte.max.x) / 2, cz = (corte.min.z + corte.max.z) / 2;
  const fundo = corte.min.y + 0.15;
  base.scale.set(sx + 0.02, 0.18, sz + 0.02);
  base.position.set(cx, fundo - 0.09, cz);
  const altura = Math.max(3.2, corte.max.y - fundo);
  linhas.scale.set(sx + 0.6, altura, sz + 0.6);
  linhas.position.set(cx, fundo + altura / 2, cz);
  // sombra cobre só a área da maquete
  const r = Math.max(sx, sz) / 2 + 2;
  const sc = sol.shadow.camera;
  if (Math.abs(sc.right - r) > 0.01) {
    Object.assign(sc, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 90 });
    sc.updateProjectionMatrix();
  }
  sol.target.position.set(cx, fundo, cz);
  sol.position.set(cx - 14, fundo + 22, cz + 12);
}

// ───────────────────────── modelo
const malhas = []; // { mesh, real, teto, vidro }
const portas = []; // { obj, sinal, giro0, aberta, centro }
let carregado = false;

const draco = new DRACOLoader().setDecoderPath('./draco/');
const loader = new GLTFLoader().setDRACOLoader(draco);
const texLoader = new THREE.TextureLoader();

// luz.json só existe quando o Blender calculou a luz (modo "luz").
// Cada mapa de luz é carregado ANTES de montar os materiais; o grupo cujo mapa falhar
// (404, arquivo velho, ?semluz) fica com luz em tempo real — nunca preto.
let luz = null;
let temAO = false;
const lightmaps = {};
const aomaps = {};
const luzPronta = (q.has('semluz') ? Promise.resolve(null) : fetch('./modelos/luz.json').then((r) => (r.ok ? r.json() : null)).catch(() => null))
  .then(async (j) => {
    if (!j || !j.k || !Array.isArray(j.grupos)) return;
    luz = j;
    await Promise.all((j.ao || []).map((g) => texLoader.loadAsync(`./modelos/ao_${g}.${j.ext || 'png'}`)
      .then((t) => { t.flipY = false; t.channel = 1; aomaps[g] = t; temAO = true; })
      .catch(() => console.warn('[passeio] sem oclusão para', g))));
    await Promise.all(j.grupos.map((g) => texLoader.loadAsync(`./modelos/luz_${g}.${j.ext || 'png'}`)
      .then((t) => {
        t.flipY = false;
        t.channel = 1;
        t.colorSpace = THREE.SRGBColorSpace;
        lightmaps[g] = t;
      })
      .catch(() => console.warn('[passeio] sem mapa de luz para', g, '— usando luz em tempo real'))));
  });
const PLASTICO = new Set(['plastico', 'tubo', 'preto-brilho', 'vidro-escuro']);
function folhaPorta(o) {
  for (let n = o; n; n = n.parent) if (n.userData?.abre != null && n.userData?.visita) return true;
  return false;
}
function grupoDe(o) {
  for (let n = o; n; n = n.parent) {
    const m = /^luz_(\w+?)(?:_\d+)?$/.exec(n.name || '');
    if (m) return m[1];
  }
  return null;
}

luzPronta.then(() => loader.load(
  './modelos/clinica.glb',
  (gltf) => {
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      let nomes = '';
      for (let n = o; n; n = n.parent) nomes += ' ' + (n.name || '');
      // some na maquete vista de cima (forros, luminárias e volumes dos andares de cima)
      const teto = /teto|luminaria|volume/i.test(nomes);
      // vidro pelo material ou por nome de peça que COMEÇA com vidro (não por pedaço de nome herdado)
      const vidro = o.material?.name === 'vidro' || o.material?.transmission > 0 || /(^|\s)vidro/i.test(nomes);
      const decal = /decal_/i.test(nomes);
      if (o.material && PALETA[o.material.name]) o.material.color.set(PALETA[o.material.name]);
      if (o.material?.map) o.material.map.anisotropy = ANISO; // ripado e granito sem moiré de longe
      const g = grupoDe(o);
      const maq = vidro ? matVidroMaq : materialMaquete(o.material, (g && aomaps[g]) || null, decal);
      let real = o.material;
      if (decal) {
        // banner, logo e faixas: imagem com fundo transparente, um pouco à frente da parede
        real = new THREE.MeshBasicMaterial({ map: real.map, transparent: true, alphaTest: 0.35, polygonOffset: true, polygonOffsetFactor: -2, color: '#e9e9e9' });
      } else if (o.material?.name === 'vidro' && luz && g && lightmaps[g]) {
        // vidro dentro dos móveis = espelho dos lavatórios: assado ele vira mancha preta, então reflete o ambiente
        real = new THREE.MeshStandardMaterial({ color: '#c9d3d6', metalness: 1, roughness: 0.04, envMap: ambiente, envMapIntensity: 1.1 });
      } else if (real && real.name === 'vidro-fachada') {
        // pele de vidro da fachada: espelho azulado refletindo o céu de fim de tarde
        real = new THREE.MeshStandardMaterial({ color: '#5f7d9c', metalness: 0.6, roughness: 0.14, envMap: ambiente, envMapIntensity: 1.25, emissive: '#22344a', emissiveIntensity: 0.6 });
      } else if (real && PLASTICO.has(real.name)) {
        // plástico e tubo pretos (cadeiras, longarina): mapa de luz + reflexo do ambiente, senão viram borrões marrons
        real = new THREE.MeshStandardMaterial({
          color: real.color, roughness: { tubo: 0.32, 'preto-brilho': 0.18, 'vidro-escuro': 0.05 }[real.name] ?? 0.5,
          // tela de vidro da máquina de café: cinza que reflete o corredor (f19), não um bloco preto
          metalness: real.name === 'vidro-escuro' ? 0.45 : 0,
          lightMap: (luz && g && lightmaps[g]) || null, lightMapIntensity: luz ? luz.k * Math.PI * 0.6 : 1,
          envMap: ambiente, envMapIntensity: real.name === 'vidro-escuro' ? 1.8 : real.name === 'preto-brilho' ? 1.3 : 0.9,
        });
      } else if (luz && g && lightmaps[g]) {
        // luz calculada no Blender: cor/textura × lightmap, sem luz em tempo real
        real = new THREE.MeshBasicMaterial({
          color: real.color, map: real.map,
          lightMap: lightmaps[g], lightMapIntensity: luz.k * Math.PI,
        });
      } else if (vidro) {
        real = new THREE.MeshBasicMaterial({ color: '#dfeef0', transparent: true, opacity: 0.16, depthWrite: false });
      } else if (folhaPorta(o) && real) {
        // folha de porta que abre na visita: fica fora do mapa de luz; cor chapada no tom das portas assadas
        real = new THREE.MeshBasicMaterial({ color: real.color.clone().multiplyScalar(0.84), map: real.map });
      } else if (real) {
        real.envMap = ambiente;
        real.envMapIntensity = 0.6;
      }
      o.castShadow = !vidro && !decal;
      o.receiveShadow = true;
      o.matrixAutoUpdate = false; // nada se mexe: economiza cálculo por quadro
      o.updateMatrix();
      malhas.push({ mesh: o, real, maq, teto, vidro });
    });
    scene.add(gltf.scene);
    // folhas das portas de vidro (origem na dobradiça; "abre" diz o sentido do giro para dentro)
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (o.userData?.abre == null) return;
      o.matrixAutoUpdate = true;
      const caixa = new THREE.Box3().setFromObject(o);
      portas.push({ obj: o, sinal: Math.sign(o.userData.abre), giro0: o.rotation.y, aberta: 0, centro: caixa.getCenter(new THREE.Vector3()), visita: !!o.userData.visita });
    });
    window.__passeio = { malhas, scene, camera, portas }; // para conferência no console
    // conferência: __passeio.olha([x,y,z], [x,y,z]) põe a câmera parada num ponto qualquer (fora do caminho)
    window.__passeio.olha = (o, a, fov = 70) => {
      modo = 'livre';
      $('#maquetes').hidden = true;
      escondeImagem(0);
      camera.clearViewOffset();
      camera.zoom = 1;
      modoBarro(false);
      camera.fov = fov;
      camera.updateProjectionMatrix();
      camera.position.set(...o);
      camera.lookAt(...a);
      acorda(10);
    };
    carregado = true;
    pronto();
  },
  (ev) => { if (ev.total) $('#barra').style.transform = `scaleX(${(ev.loaded / ev.total) * 0.95})`; },
  (err) => {
    console.error('[passeio] modelo não carregou', err);
    $('.entrada-marca p').innerHTML = 'Modelo 3D ainda<br>não gerado';
  },
));

// céu de fim de tarde atrás das fachadas (só no passeio)
const ceu = (() => {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#5d6a8f');
  grad.addColorStop(0.55, '#b9a7b8');
  grad.addColorStop(1, '#e8c3a0');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

function modoBarro(sim) {
  for (const m of malhas) {
    m.mesh.material = sim ? m.maq : m.real;
    m.mesh.customDepthMaterial = sim ? sombraBarro : undefined;
    m.mesh.visible = sim ? !m.teto : true;
  }
  base.visible = false; // sem base: a maquete fica solta no fundo, como no ICG
  linhas.visible = false; // sem a caixa de linhas: a maquete fica solta no fundo, como no ICG
  hemi.intensity = sim ? (temAO ? 1.75 : 1.45) : 0.9;
  sol.intensity = sim ? 1.15 : 0.0;
  // sombra de contato vem do mapa de oclusão (AO); sem AO, sombra macia de raio grande
  sol.castShadow = sim && !LEVE && !temAO;
  scene.background = sim ? null : ceu; // maquete: fundo transparente (a página é #F5F4F2 e a imagem pronta fica por baixo)
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = sim ? 1.05 : 1.15;
  acorda(4);
}

// ───────────────────────── caminhos (um por recepção)
const curvas = {};
for (const [id, c] of Object.entries(caminhos)) {
  curvas[id] = {
    olho: new THREE.CatmullRomCurve3(c.olho.map((p) => new THREE.Vector3(...p)), false, 'centripetal'),
    alvo: new THREE.CatmullRomCurve3(c.alvo.map((p) => new THREE.Vector3(...p)), false, 'centripetal'),
  };
}
let caminhoAtual = areas[0].caminho;
const tmpO = new THREE.Vector3(), tmpA = new THREE.Vector3();
function poseNoCaminho(p, olho = tmpO, alvo = tmpA, id = caminhoAtual) {
  const cv = curvas[id];
  const t = cv.olho.getUtoTmapping(THREE.MathUtils.clamp(p, 0, 1));
  cv.olho.getPoint(t, olho);
  cv.alvo.getPoint(t, alvo);
  return { olho, alvo };
}

// salas: o ponto aparece no trecho do caminho mais perto da porta, e a maquete da sala entra por ali
function trechoMaisPerto(id, pos) {
  const alvoV = new THREE.Vector3(...pos), o = new THREE.Vector3(), a = new THREE.Vector3();
  let melhor = 0, d = Infinity;
  for (let k = 0; k <= 400; k++) {
    poseNoCaminho(k / 400, o, a, id);
    const dk = o.distanceToSquared(alvoV);
    if (dk < d) { d = dk; melhor = k / 400; }
  }
  return melhor;
}
for (const pt of pontos) if (pt.ate == null) pt.ate = trechoMaisPerto(pt.caminho, pt.sala ? pt.sala.olhos[0] : pt.pos);
for (const a of areas) if (a.sala) a.inicio = pontos.find((pt) => pt.id === a.sala)?.ate ?? 0;

// ───────────────────────── estado
let modo = 'carregando';
let areaAtual = 0;
const vista = { alvo: new THREE.Vector3(), dist: 30, fov: 22 }; // câmera da maquete
const tmpDir = new THREE.Vector3();
const DIR_ISO = new THREE.Vector3(1.05, 1.0, 1.15).normalize();
// cada área tem o seu ângulo (vista.dir na planta): mais baixo e de lado, como os recortes do ICG
const dirDe = (i) => (areas[i]?.vista?.dir ? new THREE.Vector3(...areas[i].vista.dir) : DIR_ISO.clone()).normalize();
vista.dir = dirDe(0);
const passeio = { p: 0, alvoP: 0, foco: 0, focoPos: new THREE.Vector3(), olhar: new THREE.Quaternion() };
const nomeAndar = Object.fromEntries(andares.map((a) => [a.id, a.nome]));

function enquadra(i) {
  const c = areas[i].caixa;
  const min = new THREE.Vector3(...c.min), max = new THREE.Vector3(...c.max);
  const centro = min.clone().add(max).multiplyScalar(0.5);
  const raio = min.distanceTo(max) / 2;
  const aspecto = Math.min(camera.aspect, 1.6);
  const dist = (raio / Math.sin(THREE.MathUtils.degToRad(vista.fov / 2))) * (aspecto < 1 ? 1.05 / aspecto : 0.9) * (areas[i].zoom ?? 1); // igual a blender/render_maquetes.py
  return { min, max, centro, dist };
}

// quanto a maquete sobe na tela (fração da altura): mais no celular, para não ficar atrás do título
const deslocamento = () => (innerWidth < innerHeight ? 0.16 : 0.1);
// tamanho da maquete na tela: no computador ela fica menor, inteira entre o topo e o nome da área
// (camera.zoom amplia em volta do alvo, igual à imagem pronta, então as duas continuam batendo)
const escalaMaq = () => (innerWidth < innerHeight ? 1 : 0.8);

function aplicaVista() {
  camera.fov = vista.fov;
  camera.position.copy(vista.alvo).addScaledVector(tmpDir.copy(vista.dir).normalize(), vista.dist);
  camera.lookAt(vista.alvo);
  // sobe a maquete um pouco para não encostar no nome da área
  camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * deslocamento(), innerWidth, innerHeight);
  camera.zoom = escalaMaq();
  camera.updateProjectionMatrix();
  uCorte.uMax.value.set(corte.max.x, corte.max.z);
}

function rotuloSeta(j) {
  const a = areas[j];
  if (!a) return '';
  return a.nome;
}

// ───────────────────────── maquetes pré-renderizadas (Cycles, como as iso_* do ICG)
// A imagem pronta fica por baixo do canvas, com a mesma câmera; o 3D ao vivo só aparece nas transições.
const imgMaq = $('#maq-img');
const temImagem = {};
function arquivoMaquete(i) {
  const cel = innerHeight > innerWidth;
  return `./modelos/maquetes/maq_${areas[i].id}${cel ? '_cel' : ''}.webp`;
}
function preCarrega(i) {
  if (!areas[i] || temImagem[arquivoMaquete(i)] !== undefined) return;
  const src = arquivoMaquete(i);
  temImagem[src] = null;
  const im = new Image();
  im.onload = () => { temImagem[src] = true; if (i === areaAtual && modo === 'maquetes') mostraImagem(i); };
  im.onerror = () => { temImagem[src] = false; };
  im.src = src;
}
function malhasVisiveis(sim) {
  for (const m of malhas) m.mesh.visible = sim && !m.teto;
  base.visible = false; // sem base: a maquete fica solta no fundo, como no ICG
  acorda(3);
}
// a render (blender/render_maquetes.py) sai com o conteúdo 10% da altura ABAIXO do centro;
// aqui a imagem é posicionada para o conteúdo cair exatamente onde o 3D ao vivo desenha
function posicionaImagem() {
  const vw = innerWidth, vh = innerHeight;
  const retrato = vw < vh;
  const [iw, ih] = retrato ? [720, 1560] : [1600, 900];
  let w, h;
  if (retrato) { w = vw; h = vw * ih / iw; } else { h = vh; w = vh * iw / ih; }
  const s = escalaMaq();
  w *= s; h *= s;
  const left = (vw - w) / 2;
  const top = vh * (0.5 - deslocamento()) - h * 0.6;
  Object.assign(imgMaq.style, { width: `${w}px`, height: `${h}px`, left: `${left}px`, top: `${top}px` });
}

function mostraImagem(i, dur = 0.5) {
  const src = arquivoMaquete(i);
  // girou o celular ou a imagem da orientação nova ainda não chegou: volta ao 3D ao vivo até ela carregar
  if (!temImagem[src] && imgMaq.getAttribute('src') && !imgMaq.src.endsWith(src.slice(1))) escondeImagem(0);
  if (!temImagem[src] || modo !== 'maquetes' || gsap.isTweening(vista)) return;
  posicionaImagem();
  imgMaq.src = src;
  gsap.to(imgMaq, { opacity: 1, duration: dur, ease: 'power2.out', onComplete: () => { if (areaAtual === i && modo === 'maquetes') malhasVisiveis(false); } });
}
function escondeImagem(dur = 0.25) {
  malhasVisiveis(true);
  gsap.to(imgMaq, { opacity: 0, duration: dur, ease: 'power2.in' });
}

function mostraArea(i, imediato = false) {
  areaAtual = i;
  preCarrega(i); preCarrega(i - 1); preCarrega(i + 1);
  const e = enquadra(i);
  $('#area-nome').textContent = areas[i].nome;
  $('#area-andar').textContent = nomeAndar[areas[i].andar];
  $('#area-sub').textContent = areas[i].sub || '';
  document.querySelectorAll('#passos button').forEach((b, k) => b.setAttribute('aria-current', k === i ? 'true' : 'false'));
  const esq = $('#seta-esq'), dir = $('#seta-dir');
  esq.disabled = i === 0;
  dir.disabled = i === areas.length - 1;
  $('#seta-ant2').disabled = i === 0;
  $('#seta-prox2').disabled = i === areas.length - 1;
  $('#seta-ant2').setAttribute('aria-label', rotuloSeta(i - 1) ? `Área anterior: ${rotuloSeta(i - 1)}` : 'Área anterior');
  $('#seta-prox2').setAttribute('aria-label', rotuloSeta(i + 1) ? `Próxima área: ${rotuloSeta(i + 1)}` : 'Próxima área');
  $('#seta-ant2').title = rotuloSeta(i - 1);
  $('#seta-prox2').title = rotuloSeta(i + 1);
  for (const [b, j, txt] of [[esq, i - 1, 'Área anterior'], [dir, i + 1, 'Próxima área']]) {
    const r = rotuloSeta(j);
    b.querySelector('.nav-nome').textContent = r;
    b.title = r;
    b.setAttribute('aria-label', r ? `${txt}: ${r}` : txt);
  }
  const dur = imediato || reduzido ? 0 : 1.4;
  gsap.to(corte.min, { x: e.min.x, y: e.min.y, z: e.min.z, duration: dur, ease: 'power3.inOut' });
  gsap.to(corte.max, { x: e.max.x, y: e.max.y, z: e.max.z, duration: dur, ease: 'power3.inOut' });
  gsap.to(vista.alvo, { x: e.centro.x, y: e.centro.y - 0.6, z: e.centro.z, duration: dur, ease: 'power3.inOut' });
  const nd = dirDe(i);
  gsap.to(vista.dir, { x: nd.x, y: nd.y, z: nd.z, duration: dur, ease: 'power3.inOut' });
  if (dur) {
    // voo em arco: afasta um pouco no meio da troca e aproxima na área nova
    const longe = Math.max(vista.dist, e.dist) * 1.22;
    gsap.timeline()
      .to(vista, { dist: longe, duration: dur * 0.5, ease: 'power2.out' })
      .to(vista, { dist: e.dist, duration: dur * 0.5, ease: 'power2.inOut' });
  } else gsap.to(vista, { dist: e.dist, duration: 0 });
  gsap.to(uCorte.uAltura, { value: areas[i].corte ?? 99, duration: dur, ease: 'power3.inOut' });
  gsap.to(uCorte.uTopo, { value: areas[i].topo ?? 99, duration: dur, ease: 'power3.inOut' });
  gsap.fromTo('#area-titulo', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: dur ? 0.8 : 0, delay: dur ? 0.5 : 0, ease: 'power2.out' });
  acorda(Math.ceil(dur * 144) + 10); // quadros, não segundos: cobre telas de até 144 Hz
  // troca: 3D ao vivo durante o voo, imagem pronta da área nova ao chegar
  if (dur) escondeImagem();
  gsap.delayedCall(dur + 0.05, () => mostraImagem(i));
}

function pronto() {
  $('#barra').style.transform = 'scaleX(1)';
  modoBarro(true);
  mostraArea(0, true);
  setTimeout(() => {
    document.body.classList.remove('carregando');
    irParaMaquetes(true);
  }, 600);
}

function irParaMaquetes(primeira = false) {
  if (visita) { ultimaSala = botoes[visita.i].pt.id; visita.tl?.kill(); gsap.killTweensOf(visita); visita = null; }
  modo = 'maquetes';
  document.body.classList.add('modo-maquetes');
  fechaPainel();
  document.body.classList.remove('modo-dentro');
  $('#dentro').hidden = true;
  $('#maquetes').hidden = false;
  acorda(10);
  if (!primeira) {
    const veu = $('#veu');
    gsap.timeline()
      .to(veu, { opacity: 1, duration: 0.45, ease: 'power2.in' })
      .add(() => { modoBarro(true); vista.fov = 22; mostraArea(areaMaisPerto(), true); })
      .to(veu, { opacity: 0, duration: 0.8, ease: 'power2.out' });
  } else {
    // primeira vez: a imagem pronta pode ter chegado ainda na tela de carregamento, quando não podia aparecer
    gsap.delayedCall(0.1, () => mostraImagem(areaAtual, 0.8));
  }
}

// "Conhecer os consultórios": troca de caminho com um véu (fim da Recepção 2 → começo dos Consultórios)
function trocaCaminho(id) {
  if (modo !== 'dentro' || !curvas[id]) return;
  if (passeio.foco > 0) fechaPainel();
  const veu = $('#veu');
  som.clique();
  gsap.timeline()
    .to(veu, { opacity: 1, duration: reduzido ? 0 : 0.5, ease: 'power2.in' })
    .add(() => {
      caminhoAtual = id;
      const k = areas.findIndex((a) => !a.sala && a.caminho === id);
      if (k >= 0) areaAtual = k;
      passeio.p = passeio.alvoP = 0;
      passeio.foco = 0;
      const { olho, alvo } = poseNoCaminho(0, new THREE.Vector3(), new THREE.Vector3());
      camera.position.copy(olho);
      camera.lookAt(alvo);
      passeio.olhar.copy(camera.quaternion);
      acorda(30);
    })
    .to(veu, { opacity: 0, duration: reduzido ? 0 : 0.8, ease: 'power2.out' });
}

function areaMaisPerto() {
  let melhor = areaAtual;
  if (ultimaSala) {
    const k = areas.findIndex((a) => a.sala === ultimaSala);
    ultimaSala = null;
    if (k >= 0) return k;
  }
  areas.forEach((a, i) => { if (!a.sala && a.caminho === caminhoAtual && passeio.p >= a.inicio - 0.02) melhor = i; });
  return melhor;
}

function entrar() {
  if (modo !== 'maquetes') return;
  modo = 'entrando';
  document.body.classList.remove('modo-maquetes');
  caminhoAtual = areas[areaAtual].caminho;
  const p0 = areas[areaAtual].inicio;
  const { olho, alvo } = poseNoCaminho(p0, new THREE.Vector3(), new THREE.Vector3());
  // voa da vista de cima até perto do ponto de partida, ainda em barro
  const de = { pos: camera.position.clone(), alvo: vista.alvo.clone(), fov: camera.fov };
  const meio = olho.clone().add(new THREE.Vector3(0, 4, 0)).addScaledVector(tmpDir.copy(vista.dir).normalize(), 3);
  const estado = { t: 0 };
  const veu = $('#veu');
  $('#maquetes').hidden = true;
  escondeImagem(0.3);
  camera.clearViewOffset();
  const zoom0 = camera.zoom;
  acorda(200);
  gsap.timeline()
    .to(estado, {
      t: 1, duration: reduzido ? 0 : 1.5, ease: 'power3.in',
      onUpdate() {
        const k = estado.t;
        camera.position.lerpVectors(de.pos, meio, k);
        const a = de.alvo.clone().lerp(olho, k);
        camera.fov = THREE.MathUtils.lerp(de.fov, 50, k);
        camera.zoom = THREE.MathUtils.lerp(zoom0, 1, k);
        camera.updateProjectionMatrix();
        camera.lookAt(a);
      },
    })
    .to(veu, { opacity: 1, duration: 0.35, ease: 'power1.in' }, '-=0.35')
    .add(() => {
      modoBarro(false);
      passeio.p = passeio.alvoP = p0;
      camera.fov = 60;
      camera.updateProjectionMatrix();
      camera.position.copy(olho);
      camera.lookAt(alvo);
      passeio.olhar.copy(camera.quaternion);
      document.body.classList.add('modo-dentro');
      $('#dentro').hidden = false;
      modo = 'dentro';
      acorda(60);
    })
    .to(veu, { opacity: 0, duration: 0.9, ease: 'power2.out' })
    .add(() => {
      // maquete de uma sala: já entra nela
      const k = botoes.findIndex((b) => b.pt.id && b.pt.id === areas[areaAtual].sala);
      if (k >= 0) { abrePainel(k); gsap.delayedCall(reduzido ? 0 : 0.9, () => entraSala(k)); }
    });
}

// ───────────────────────── entrada de rolagem/arrasto
const TOTAL_PX = 9000; // rolagem total para atravessar um caminho inteiro
function empurra(px) {
  if (modo !== 'dentro' || passeio.foco > 0.01) return;
  passeio.alvoP = THREE.MathUtils.clamp(passeio.alvoP + px / TOTAL_PX, 0, 1);
  escondeDica();
  acorda(10);
}
addEventListener('wheel', (e) => {
  if (modo !== 'dentro') return;
  e.preventDefault();
  const px = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
  empurra(px);
}, { passive: false });

let arrasto = null;
canvas.addEventListener('pointerdown', (e) => { arrasto = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!arrasto) return;
  const dx = e.clientX - arrasto.x, dy = e.clientY - arrasto.y;
  arrasto = { x: e.clientX, y: e.clientY };
  if (visita) {
    // dentro da sala: arrastar olha para os lados
    if (visita.k > 0.98) {
      if (visita.tl) { visita.tl.kill(); visita.tl = null; visita.k = 1; } // a pessoa assumiu: para o giro automático
      visita.giro = THREE.MathUtils.clamp(visita.giro + dx * 0.004, -1.0, 1.0); acorda(3);
    }
    return;
  }
  // arrastar para cima ou para a esquerda anda para frente
  empurra((-dy - dx) * 3.2);
});
addEventListener('pointerup', () => { arrasto = null; });
addEventListener('pointercancel', () => { arrasto = null; });
addEventListener('keydown', (e) => {
  if (modo === 'dentro') {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') empurra(e.key === 'ArrowDown' ? 260 : -260);
    if (e.key === 'Escape') passeio.foco > 0 ? fechaPainel() : irParaMaquetes();
  } else if (modo === 'maquetes') {
    if (e.key === 'ArrowRight' && areaAtual < areas.length - 1) mostraArea(areaAtual + 1);
    if (e.key === 'ArrowLeft' && areaAtual > 0) mostraArea(areaAtual - 1);
    if (e.key === 'Enter' && !e.target.closest?.('button, a')) { som.aoEntrar(); entrar(); }
  }
});

let dicaFechada = false;
function escondeDica() {
  if (dicaFechada) return;
  dicaFechada = true;
  $('#dica').classList.add('some');
}
$('#dica-fechar').addEventListener('click', escondeDica);

// ───────────────────────── pontos e painel
const camadaPontos = $('#pontos');
const icone = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>';
const botoes = pontos.map((pt, i) => {
  const b = document.createElement('button');
  b.className = 'ponto';
  b.type = 'button';
  b.innerHTML = icone + (pt.rotulo ? `<span class="ponto-rotulo">${pt.rotulo}</span>` : '');
  b.setAttribute('aria-label', pt.rotulo ? `${pt.rotulo}: ${pt.titulo}` : pt.titulo);
  b.addEventListener('click', () => {
    if (pt.vaiPara) { trocaCaminho(pt.vaiPara); return; }
    abrePainel(i);
    // sala com "Ver por dentro": o clique no olhinho já abre a porta e entra
    if (pt.sala) gsap.delayedCall(reduzido ? 0 : 0.9, () => entraSala(i));
  });
  camadaPontos.appendChild(b);
  return { b, pos: new THREE.Vector3(...pt.pos), pt };
});

function abrePainel(i) {
  const { pt, pos } = botoes[i];
  $('#painel-titulo').textContent = pt.titulo;
  $('#painel-sub').textContent = pt.sub || '';
  $('#painel-texto').textContent = pt.texto || '';
  const link = $('#painel-link');
  link.hidden = !pt.link;
  if (pt.link) { link.textContent = pt.link.texto; link.href = pt.link.href; }
  const bSala = $('#painel-sala');
  bSala.hidden = !pt.sala;
  bSala.textContent = 'Ver por dentro';
  bSala.dataset.i = i;
  // vídeo curto real da clínica (recorte do 0522.mp4), só carrega quando o painel abre
  const video = $('#painel-video');
  if (pt.video && !LEVE) {
    video.src = pt.video;
    video.hidden = false;
    video.play().catch(() => {});
  } else {
    video.pause();
    video.removeAttribute('src');
    video.hidden = true;
  }
  const painel = $('#painel');
  painel.hidden = false;
  requestAnimationFrame(() => painel.classList.add('aberto'));
  passeio.focoPos.copy(pos);
  passeio.alvoP = passeio.p; // para de andar
  gsap.to(passeio, { foco: 1, duration: reduzido ? 0 : 1.1, ease: 'power3.inOut', onUpdate: () => acorda(2) });
  som.clique();
}
function fechaPainel() {
  if (visita) { saiSala(fechaPainel); return; } // sai da sala antes de fechar
  const painel = $('#painel');
  painel.classList.remove('aberto');
  const video = $('#painel-video');
  video.pause();
  setTimeout(() => { if (!painel.classList.contains('aberto')) painel.hidden = true; }, 500);
  gsap.to(passeio, { foco: 0, duration: reduzido ? 0 : 0.9, ease: 'power3.inOut', onUpdate: () => acorda(2) });
}
$('#painel-fechar').addEventListener('click', fechaPainel);

// ───────────────────────── ver a sala por dentro
// a câmera sai do caminho, passa pela porta (pt.sala.olhos/alvos) e para dentro da sala; volta pelo mesmo trajeto
let visita = null, ultimaSala = null;
function entraSala(i) {
  const { pt } = botoes[i];
  if (!pt.sala || visita || modo !== 'dentro') return;
  const v3 = (p) => new THREE.Vector3(...p);
  // começa exatamente na pose do caminho com o foco no ponto (a mesma em que a volta termina)
  gsap.killTweensOf(passeio, 'foco');
  passeio.foco = 1;
  passeio.focoPos.copy(botoes[i].pos);
  const { olho: o0 } = poseNoCaminho(passeio.p, new THREE.Vector3(), new THREE.Vector3());
  o0.lerp(passeio.focoPos, 0.18);
  visita = {
    i, k: 0, giro: 0,
    olho: new THREE.CatmullRomCurve3([o0, ...pt.sala.olhos.map(v3)], false, 'centripetal'),
    alvo: new THREE.CatmullRomCurve3([passeio.focoPos.clone(), ...pt.sala.alvos.map(v3)], false, 'centripetal'),
  };
  $('#painel-sala').textContent = 'Voltar ao corredor';
  escondeDica();
  // devagar: chega na porta (ela abre), para um instante olhando a sala, entra e gira de um lado ao outro
  // para mostrar a sala inteira; arrastar a tela interrompe o giro e a pessoa olha por conta própria
  const anda = { onUpdate: () => acorda(2) };
  if (reduzido) visita.k = 1;
  else {
    visita.tl = gsap.timeline()
      .to(visita, { k: 0.34, duration: 2.6, ease: 'power2.inOut', ...anda })
      .to(visita, { k: 1, duration: 3.8, ease: 'sine.inOut', ...anda }, '+=0.9')
      .to(visita, { giro: -0.95, duration: 3.4, ease: 'sine.inOut', ...anda })
      .to(visita, { giro: 0.95, duration: 6.0, ease: 'sine.inOut', ...anda })
      .to(visita, { giro: 0, duration: 3.4, ease: 'sine.inOut', ...anda });
  }
  acorda(2);
  som.clique();
}
function saiSala(depois) {
  const v = visita;
  if (!v) { depois?.(); return; }
  v.tl?.kill();
  gsap.killTweensOf(v);
  gsap.to(v, {
    k: 0, giro: 0, duration: reduzido ? 0 : 2.4, ease: 'power2.inOut', onUpdate: () => acorda(2),
    onComplete: () => { if (visita === v) visita = null; $('#painel-sala').textContent = 'Ver por dentro'; acorda(4); depois?.(); },
  });
}
$('#painel-sala').addEventListener('click', (e) => {
  if (visita) saiSala();
  else entraSala(Number(e.currentTarget.dataset.i));
});

const proj = new THREE.Vector3();
function atualizaPontos() {
  const w = innerWidth, h = innerHeight;
  for (const { b, pos, pt } of botoes) {
    let ver = modo === 'dentro' && !visita && pt.caminho === caminhoAtual && Math.abs(passeio.p - pt.ate) < 0.16;
    if (ver) {
      proj.copy(pos).project(camera);
      ver = proj.z < 1 && Math.abs(proj.x) < 0.92 && Math.abs(proj.y) < 0.85;
      if (ver) b.style.translate = `${((proj.x + 1) / 2) * w}px ${((1 - proj.y) / 2) * h}px`;
    }
    if (b.classList.contains('visivel') !== ver) {
      b.classList.toggle('visivel', ver);
      b.tabIndex = ver ? 0 : -1;
    }
  }
}

// ───────────────────────── som: música do passeio (audio/musica.mp3) em repetição; sem o arquivo, pad gerado na hora
const som = (() => {
  // música lofi tocando baixinho em repetição, só no 3D; se o arquivo não carregar, volta o pad de acordes
  // lentos com ruído de sala. Clique suave nos pontos. Começa no "Entrar" (o navegador só deixa tocar depois de um clique).
  const MUSICA = './audio/musica.mp3';
  let ctx, mestre, reverb, ligado = false, timer = null, musica = null, temMusica = true, ruidoGanho = null;
  const ACORDES = [[174.61, 220.0, 261.63, 329.63], [155.56, 196.0, 233.08, 293.66], [130.81, 196.0, 246.94, 329.63], [146.83, 220.0, 261.63, 349.23]];
  function impulso(seg = 3.2) {
    const n = ctx.sampleRate * seg;
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6);
    }
    return b;
  }
  function nota(f, t0, dur) {
    for (const det of [-4, 3]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.detune.value = det;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.018, t0 + dur * 0.35);
      g.gain.linearRampToValueAtTime(0, t0 + dur);
      o.connect(g).connect(reverb);
      o.start(t0); o.stop(t0 + dur + 0.1);
    }
  }
  function acorde(k) {
    const t0 = ctx.currentTime + 0.05;
    ACORDES[k % ACORDES.length].forEach((f, i) => nota(f, t0 + i * 0.35, 10));
  }
  function inicia() {
    ctx = new AudioContext();
    mestre = ctx.createGain();
    mestre.gain.value = 0;
    mestre.connect(ctx.destination);
    reverb = ctx.createConvolver();
    reverb.buffer = impulso();
    const molhado = ctx.createGain();
    molhado.gain.value = 0.9;
    reverb.connect(molhado).connect(mestre);
    // ruído de sala (marrom, filtrado): presença discreta
    const n = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let ult = 0;
    for (let i = 0; i < n; i++) { ult = (ult + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = ult * 3.5; }
    const ruido = ctx.createBufferSource();
    ruido.buffer = buf; ruido.loop = true;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass'; filtro.frequency.value = 420;
    const gr = ctx.createGain(); gr.gain.value = 0;
    ruidoGanho = gr;
    ruido.connect(filtro).connect(gr).connect(mestre);
    ruido.start();
    // música: passa pelo mesmo volume geral, para entrar e sair devagar
    musica = new Audio(MUSICA);
    musica.loop = true;
    musica.preload = 'auto';
    musica.addEventListener('error', () => { temMusica = false; if (ligado) pad(true); });
    const gm = ctx.createGain(); gm.gain.value = 0.6;
    ctx.createMediaElementSource(musica).connect(gm).connect(mestre);
  }
  let k = 0;
  function pad(sim) {
    clearInterval(timer);
    ruidoGanho.gain.setTargetAtTime(sim ? 0.05 : 0, ctx.currentTime, 0.5);
    if (sim) { acorde(k++); timer = setInterval(() => acorde(k++), 8000); }
  }
  function liga(sim) {
    if (!ctx) inicia();
    if (sim === ligado) return ligado;
    ligado = sim;
    if (ligado) {
      ctx.resume();
      if (temMusica) musica.play().catch(() => { temMusica = false; pad(true); });
      else pad(true);
    } else {
      pad(false);
      setTimeout(() => { if (!ligado && musica) musica.pause(); }, 3000);
    }
    mestre.gain.setTargetAtTime(ligado ? 0.7 : 0, ctx.currentTime, 0.8);
    $('#btn-som').setAttribute('aria-pressed', String(ligado));
    $('#btn-som').setAttribute('aria-label', ligado ? 'Desligar o som' : 'Ligar o som');
    return ligado;
  }
  let mexeu = false; // a pessoa já ligou/desligou no botão: o "Entrar" não liga mais sozinho
  return {
    alterna() { mexeu = true; return liga(!ligado); },
    aoEntrar() { if (!mexeu) liga(true); },
    clique() {
      if (!ligado) return;
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(660, t0);
      o.frequency.exponentialRampToValueAtTime(990, t0 + 0.08);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      o.connect(g); g.connect(mestre); g.connect(reverb);
      o.start(t0); o.stop(t0 + 0.55);
    },
  };
})();
$('#btn-som').addEventListener('click', () => som.alterna());
$('#btn-entrar').addEventListener('click', () => som.aoEntrar());

// ───────────────────────── botões
for (const [k, a] of areas.entries()) {
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('aria-label', a.nome);
  b.title = a.nome;
  b.addEventListener('click', () => k !== areaAtual && mostraArea(k));
  li.append(b);
  $('#passos').append(li);
}
$('#seta-esq').addEventListener('click', () => areaAtual > 0 && mostraArea(areaAtual - 1));
$('#seta-dir').addEventListener('click', () => areaAtual < areas.length - 1 && mostraArea(areaAtual + 1));
$('#seta-ant2').addEventListener('click', () => areaAtual > 0 && mostraArea(areaAtual - 1));
$('#seta-prox2').addEventListener('click', () => areaAtual < areas.length - 1 && mostraArea(areaAtual + 1));
$('#btn-entrar').addEventListener('click', entrar);
$('#btn-areas').addEventListener('click', () => irParaMaquetes());
$('#btn-areas-topo').addEventListener('click', () => modo === 'dentro' && irParaMaquetes());

// ───────────────────────── tamanho e laço
function redimensiona() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  if (composer) {
    composer.setSize(w, h);
    fxaa.uniforms.resolution.value.set(1 / (w * renderer.getPixelRatio()), 1 / (h * renderer.getPixelRatio()));
  }
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (modo === 'maquetes') { mostraArea(areaAtual, true); posicionaImagem(); }
  acorda(4);
}
addEventListener('resize', redimensiona);
redimensiona();

const relogio = new THREE.Clock();
const qAlvo = new THREE.Quaternion();
const mAux = new THREE.Matrix4();
const olharFoco = new THREE.Vector3();
const EIXO_Y = new THREE.Vector3(0, 1, 0);

// portas de vidro: as duas folhas abrem sozinhas quando a câmera chega perto e fecham quando ela se afasta
const ABERTURA = THREE.MathUtils.degToRad(84);
function abrePortas(dt) {
  if (!portas.length) return;
  for (const pt of portas) {
    const d = modo === 'dentro' ? Math.hypot(camera.position.x - pt.centro.x, camera.position.z - pt.centro.z) : 99;
    const perto = modo === 'dentro' && Math.abs(camera.position.y - pt.centro.y) < 2.5;
    // porta de sala: só abre durante o "Ver por dentro" (e mais rápido, a câmera passa logo por ela);
    // porta de vidro da entrada: abre quando a câmera chega perto
    const alvo = pt.visita ? (perto && visita && d < 4.5 ? 1 : 0) : (perto ? 1 - THREE.MathUtils.smoothstep(d, 2.4, 4.8) : 0);
    const k = 1 - Math.exp(-dt * (pt.visita ? 5.5 : 3.2));
    const antes = pt.aberta;
    pt.aberta += (alvo - pt.aberta) * k;
    if (Math.abs(pt.aberta - antes) > 1e-4) {
      pt.obj.rotation.y = pt.giro0 + pt.sinal * ABERTURA * pt.aberta;
      acorda(2);
    }
  }
}

renderer.setAnimationLoop(() => {
  const dt = Math.min(relogio.getDelta(), 0.05);
  if (modo === 'maquetes') {
    if (quadros > 0) {
      atualizaPlanos();
      posicionaBase();
      aplicaVista();
    }
  } else if (modo === 'dentro') {
    // amortecimento: anda até o alvo e desliza um pouco no fim
    const falta = passeio.alvoP - passeio.p;
    passeio.p += falta * (1 - Math.exp(-dt * 2.6));
    const { olho, alvo } = poseNoCaminho(passeio.p);
    if (passeio.foco > 0) {
      olharFoco.lerpVectors(alvo, passeio.focoPos, passeio.foco);
      olho.lerp(passeio.focoPos, passeio.foco * 0.18); // chega um pouco mais perto do ponto
    } else olharFoco.copy(alvo);
    if (visita && visita.k > 0) {
      visita.olho.getPointAt(visita.k, olho);
      visita.alvo.getPointAt(visita.k, olharFoco);
      if (visita.giro) olharFoco.sub(olho).applyAxisAngle(EIXO_Y, visita.giro * visita.k).add(olho);
    }
    // lente mais aberta dentro das salas (como foto de interiores): 60° no corredor, 74° na sala
    const fovAlvo = 60 + 14 * (visita ? visita.k : 0);
    if (Math.abs(camera.fov - fovAlvo) > 0.01) { camera.fov = fovAlvo; camera.updateProjectionMatrix(); }
    camera.position.copy(olho);
    mAux.lookAt(olho, olharFoco, camera.up);
    qAlvo.setFromRotationMatrix(mAux);
    const ang = passeio.olhar.angleTo(qAlvo);
    passeio.olhar.slerp(qAlvo, 1 - Math.exp(-dt * 5));
    camera.quaternion.copy(passeio.olhar);
    if (Math.abs(falta) > 1e-5 || ang > 1e-4) acorda(2);
    $('#progresso').style.transform = `scaleX(${passeio.p})`;
  }
  abrePortas(dt);
  if (!carregado || quadros <= 0) return;
  quadros--;
  atualizaPontos();
  // dentro: pós-processamento leve (tom, vinheta, FXAA); maquete e ?leve=1: render direto
  if (composer && modo === 'dentro') composer.render();
  else renderer.render(scene, camera);
});

// atalhos para conferir: ?area=2 entra direto; ?ver=4 só mostra a maquete 4
if (q.has('area') || q.has('ver')) {
  gsap.ticker.lagSmoothing(0); // conferência no Chrome invisível (quadros lentos): animações seguem o relógio real
  const i =Number(q.get('area') ?? q.get('ver')) || 0;
  const espera = setInterval(() => {
    if (modo === 'maquetes') {
      clearInterval(espera);
      mostraArea(i, true);
      if (q.has('area')) setTimeout(entrar, 300);
    }
  }, 100);
}
