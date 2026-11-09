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
import { areas, pontos, caminhos, andares } from './planta.js';

const $ = (s) => document.querySelector(s);
const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
const q = new URLSearchParams(location.search);
const LEVE = q.has('leve');

// ───────────────────────── renderizador
const canvas = $('#cena');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LEVE, powerPreference: 'high-performance' });
renderer.setPixelRatio(LEVE ? 1 : Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.localClippingEnabled = true;
renderer.shadowMap.enabled = !LEVE;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Paleta oficial (Manual da Marca): laranja #F7922D, petróleo #5C95A4, azul noite #101E44,
// pêssego #FDE0C9, cinzas #A8A9AC / #828386. Fundo claro #F5F4F2.
const COR_FUNDO = new THREE.Color('#F5F4F2');
const COR_BASE = new THREE.Color('#D3DAE0'); // base da maquete: cinza-azulado suave
// cores dos materiais do Blender trocadas pela paleta da marca (nome do material → cor)
const PALETA = {
  teal: '#5C95A4', 'faixa-azul': '#5C95A4', laranja: '#F7922D', roxo: '#101E44',
  'faixa-branca': '#F5F4F2', banner: '#FDE0C9', quadro: '#828386',
};
const scene = new THREE.Scene();
scene.background = COR_FUNDO.clone();

const camera = new THREE.PerspectiveCamera(22, 1, 0.05, 400);

// desenho sob demanda: cada mudança "acorda" o laço por alguns quadros
let quadros = 2;
const acorda = (n = 90) => { quadros = Math.max(quadros, n); };

// luz para a maquete (barro) e para o rascunho sem luz calculada
const pmrem = new THREE.PMREMGenerator(renderer);
const ambiente = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const hemi = new THREE.HemisphereLight('#ffffff', '#c9cfd6', 1.15);
const sol = new THREE.DirectionalLight('#fff3e4', 2.6);
sol.castShadow = !LEVE;
sol.shadow.mapSize.set(1024, 1024);
sol.shadow.bias = -0.0005;
sol.shadow.normalBias = 0.03;
sol.shadow.radius = 4;
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
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (uAtivo > 0.5 && ((vMundo.y > uAltura && (vMundo.x > uMax.x - 0.55 || vMundo.z > uMax.y - 0.55)) || vMundo.y > uTopo)) discard;');
  };
  mat.customProgramCacheKey = () => 'corte';
  return mat;
}

// maquete colorida: cada material do modelo vira uma versão "maquete" com as cores e texturas reais,
// sol com sombra suave + luz ambiente, recorte da área e corte das paredes da frente
const matVidroMaq = comCorte(new THREE.MeshStandardMaterial({
  color: '#bfe0ea', roughness: 0.08, metalness: 0, transparent: true, opacity: 0.35,
  clippingPlanes: planos, depthWrite: false, envMapIntensity: 0.8,
}));
const maqCache = new Map();
function materialMaquete(src) {
  if (maqCache.has(src)) return maqCache.get(src);
  const m = comCorte(new THREE.MeshStandardMaterial({
    color: src.color ? src.color.clone() : new THREE.Color('#e6e2dc'),
    map: src.map || null,
    roughness: Math.min(src.roughness ?? 0.8, 0.9),
    metalness: src.metalness ?? 0,
    emissive: src.emissive ? src.emissive.clone() : new THREE.Color(0),
    emissiveIntensity: src.emissiveIntensity ?? 1,
    envMap: ambiente, envMapIntensity: 0.35,
    clippingPlanes: planos, clipShadows: true, side: THREE.DoubleSide,
  }));
  maqCache.set(src, m);
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
let carregado = false;

const draco = new DRACOLoader().setDecoderPath('./draco/');
const loader = new GLTFLoader().setDRACOLoader(draco);
const texLoader = new THREE.TextureLoader();

// luz.json só existe quando o Blender calculou a luz (modo "luz").
// Cada mapa de luz é carregado ANTES de montar os materiais; o grupo cujo mapa falhar
// (404, arquivo velho, ?semluz) fica com luz em tempo real — nunca preto.
let luz = null;
const lightmaps = {};
const luzPronta = (q.has('semluz') ? Promise.resolve(null) : fetch('./modelos/luz.json').then((r) => (r.ok ? r.json() : null)).catch(() => null))
  .then(async (j) => {
    if (!j || !j.k || !Array.isArray(j.grupos)) return;
    luz = j;
    await Promise.all(j.grupos.map((g) => texLoader.loadAsync(`./modelos/luz_${g}.${j.ext || 'png'}`)
      .then((t) => {
        t.flipY = false;
        t.channel = 1;
        t.colorSpace = THREE.SRGBColorSpace;
        lightmaps[g] = t;
      })
      .catch(() => console.warn('[passeio] sem mapa de luz para', g, '— usando luz em tempo real'))));
  });
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
      const vidro = /vidro/i.test(nomes) || o.material?.transmission > 0;
      if (o.material && PALETA[o.material.name]) o.material.color.set(PALETA[o.material.name]);
      const maq = vidro ? matVidroMaq : materialMaquete(o.material);
      let real = o.material;
      const g = grupoDe(o);
      if (luz && g && lightmaps[g]) {
        // luz calculada no Blender: cor/textura × lightmap, sem luz em tempo real
        real = new THREE.MeshBasicMaterial({
          color: real.color, map: real.map,
          lightMap: lightmaps[g], lightMapIntensity: luz.k * Math.PI,
        });
      } else if (vidro) {
        real = new THREE.MeshBasicMaterial({ color: '#dfeef0', transparent: true, opacity: 0.16, depthWrite: false });
      } else if (real) {
        real.envMap = ambiente;
        real.envMapIntensity = 0.6;
      }
      o.castShadow = !vidro;
      o.receiveShadow = true;
      o.matrixAutoUpdate = false; // nada se mexe: economiza cálculo por quadro
      o.updateMatrix();
      malhas.push({ mesh: o, real, maq, teto, vidro });
    });
    scene.add(gltf.scene);
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
  base.visible = linhas.visible = sim;
  hemi.intensity = sim ? 1.15 : 0.9;
  sol.intensity = sim ? 2.6 : 0.0;
  sol.castShadow = sim && !LEVE; // sem sombra em tempo real dentro (a luz já vem calculada)
  scene.background = sim ? COR_FUNDO : ceu;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = sim ? 1.1 : 1.15;
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

// ───────────────────────── estado
let modo = 'carregando';
let areaAtual = 0;
const vista = { alvo: new THREE.Vector3(), dist: 30, fov: 22 }; // câmera da maquete
const DIR_ISO = new THREE.Vector3(1.05, 1.0, 1.15).normalize();
const passeio = { p: 0, alvoP: 0, foco: 0, focoPos: new THREE.Vector3(), olhar: new THREE.Quaternion() };
const nomeAndar = Object.fromEntries(andares.map((a) => [a.id, a.nome]));

function enquadra(i) {
  const c = areas[i].caixa;
  const min = new THREE.Vector3(...c.min), max = new THREE.Vector3(...c.max);
  const centro = min.clone().add(max).multiplyScalar(0.5);
  const raio = min.distanceTo(max) / 2;
  const aspecto = Math.min(camera.aspect, 1.6);
  const dist = (raio / Math.sin(THREE.MathUtils.degToRad(vista.fov / 2))) * (aspecto < 1 ? 1.35 / aspecto : 1.08);
  return { min, max, centro, dist };
}

function aplicaVista() {
  camera.fov = vista.fov;
  camera.position.copy(vista.alvo).addScaledVector(DIR_ISO, vista.dist);
  camera.lookAt(vista.alvo);
  // sobe a maquete um pouco para não encostar no nome da área
  camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * 0.1, innerWidth, innerHeight);
  camera.updateProjectionMatrix();
  uCorte.uMax.value.set(corte.max.x, corte.max.z);
}

function rotuloSeta(j) {
  const a = areas[j];
  if (!a) return '';
  return a.andar !== areas[areaAtual].andar ? `${nomeAndar[a.andar]} · ${a.nome}` : a.nome;
}

function mostraArea(i, imediato = false) {
  areaAtual = i;
  const e = enquadra(i);
  $('#area-nome').textContent = areas[i].nome;
  $('#area-andar').textContent = nomeAndar[areas[i].andar];
  const esq = $('#seta-esq'), dir = $('#seta-dir');
  esq.disabled = i === 0;
  dir.disabled = i === areas.length - 1;
  esq.querySelector('span').textContent = rotuloSeta(i - 1);
  dir.querySelector('span').textContent = rotuloSeta(i + 1);
  const dur = imediato || reduzido ? 0 : 1.4;
  gsap.to(corte.min, { x: e.min.x, y: e.min.y, z: e.min.z, duration: dur, ease: 'power3.inOut' });
  gsap.to(corte.max, { x: e.max.x, y: e.max.y, z: e.max.z, duration: dur, ease: 'power3.inOut' });
  gsap.to(vista.alvo, { x: e.centro.x, y: e.centro.y - 0.6, z: e.centro.z, duration: dur, ease: 'power3.inOut' });
  gsap.to(vista, { dist: e.dist, duration: dur, ease: 'power3.inOut' });
  gsap.to(uCorte.uAltura, { value: areas[i].corte ?? 99, duration: dur, ease: 'power3.inOut' });
  gsap.to(uCorte.uTopo, { value: areas[i].topo ?? 99, duration: dur, ease: 'power3.inOut' });
  gsap.fromTo('#area-titulo', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: dur ? 0.8 : 0, delay: dur ? 0.5 : 0, ease: 'power2.out' });
  acorda(dur * 60 + 10);
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
  modo = 'maquetes';
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
  }
}

function areaMaisPerto() {
  let melhor = areaAtual;
  areas.forEach((a, i) => { if (a.caminho === caminhoAtual && passeio.p >= a.inicio - 0.02) melhor = i; });
  return melhor;
}

function entrar() {
  if (modo !== 'maquetes') return;
  modo = 'entrando';
  caminhoAtual = areas[areaAtual].caminho;
  const p0 = areas[areaAtual].inicio;
  const { olho, alvo } = poseNoCaminho(p0, new THREE.Vector3(), new THREE.Vector3());
  // voa da vista de cima até perto do ponto de partida, ainda em barro
  const de = { pos: camera.position.clone(), alvo: vista.alvo.clone(), fov: camera.fov };
  const meio = olho.clone().add(new THREE.Vector3(0, 4, 0)).addScaledVector(DIR_ISO, 3);
  const estado = { t: 0 };
  const veu = $('#veu');
  $('#maquetes').hidden = true;
  camera.clearViewOffset();
  acorda(200);
  gsap.timeline()
    .to(estado, {
      t: 1, duration: reduzido ? 0 : 1.5, ease: 'power3.in',
      onUpdate() {
        const k = estado.t;
        camera.position.lerpVectors(de.pos, meio, k);
        const a = de.alvo.clone().lerp(olho, k);
        camera.fov = THREE.MathUtils.lerp(de.fov, 50, k);
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
    .to(veu, { opacity: 0, duration: 0.9, ease: 'power2.out' });
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
  // arrastar para cima ou para a esquerda anda para frente
  empurra((-dy - dx) * 3.2);
});
addEventListener('pointerup', () => { arrasto = null; });
addEventListener('keydown', (e) => {
  if (modo === 'dentro') {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') empurra(e.key === 'ArrowDown' ? 260 : -260);
    if (e.key === 'Escape') passeio.foco > 0 ? fechaPainel() : irParaMaquetes();
  } else if (modo === 'maquetes') {
    if (e.key === 'ArrowRight' && areaAtual < areas.length - 1) mostraArea(areaAtual + 1);
    if (e.key === 'ArrowLeft' && areaAtual > 0) mostraArea(areaAtual - 1);
    if (e.key === 'Enter') entrar();
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
  b.innerHTML = icone;
  b.setAttribute('aria-label', pt.titulo);
  b.addEventListener('click', () => abrePainel(i));
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
  const painel = $('#painel');
  painel.hidden = false;
  requestAnimationFrame(() => painel.classList.add('aberto'));
  passeio.focoPos.copy(pos);
  passeio.alvoP = passeio.p; // para de andar
  gsap.to(passeio, { foco: 1, duration: reduzido ? 0 : 1.1, ease: 'power3.inOut', onUpdate: () => acorda(2) });
  som.clique();
}
function fechaPainel() {
  const painel = $('#painel');
  painel.classList.remove('aberto');
  setTimeout(() => { if (!painel.classList.contains('aberto')) painel.hidden = true; }, 500);
  gsap.to(passeio, { foco: 0, duration: reduzido ? 0 : 0.9, ease: 'power3.inOut', onUpdate: () => acorda(2) });
}
$('#painel-fechar').addEventListener('click', fechaPainel);

const proj = new THREE.Vector3();
function atualizaPontos() {
  const w = innerWidth, h = innerHeight;
  for (const { b, pos, pt } of botoes) {
    let ver = modo === 'dentro' && pt.caminho === caminhoAtual && Math.abs(passeio.p - pt.ate) < 0.16;
    if (ver) {
      proj.copy(pos).project(camera);
      ver = proj.z < 1 && Math.abs(proj.x) < 0.92 && Math.abs(proj.y) < 0.85;
      if (ver) b.style.transform = `translate(${((proj.x + 1) / 2) * w}px, ${((1 - proj.y) / 2) * h}px)`;
    }
    if (b.classList.contains('visivel') !== ver) {
      b.classList.toggle('visivel', ver);
      b.tabIndex = ver ? 0 : -1;
    }
  }
}

// ───────────────────────── som (gerado na hora, desligado por padrão)
const som = (() => {
  let ctx, mestre, ligado = false;
  function inicia() {
    ctx = new AudioContext();
    mestre = ctx.createGain();
    mestre.gain.value = 0;
    mestre.connect(ctx.destination);
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 900;
    filtro.connect(mestre);
    [174.6, 220, 261.6, 329.6].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'sine' : 'triangle';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.035;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.03;
      const lg = ctx.createGain();
      lg.gain.value = 0.02;
      lfo.connect(lg).connect(g.gain);
      o.connect(g).connect(filtro);
      o.start(); lfo.start();
    });
  }
  return {
    alterna() {
      if (!ctx) inicia();
      ligado = !ligado;
      mestre.gain.setTargetAtTime(ligado ? 0.6 : 0, ctx.currentTime, 0.6);
      return ligado;
    },
    clique() {
      if (!ligado) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.3);
    },
  };
})();
$('#btn-som').addEventListener('click', (e) => {
  const on = som.alterna();
  e.currentTarget.setAttribute('aria-pressed', String(on));
  e.currentTarget.setAttribute('aria-label', on ? 'Desligar o som' : 'Ligar o som');
});

// ───────────────────────── botões
$('#seta-esq').addEventListener('click', () => areaAtual > 0 && mostraArea(areaAtual - 1));
$('#seta-dir').addEventListener('click', () => areaAtual < areas.length - 1 && mostraArea(areaAtual + 1));
$('#btn-entrar').addEventListener('click', entrar);
$('#btn-areas').addEventListener('click', () => irParaMaquetes());
$('#btn-areas-topo').addEventListener('click', () => modo === 'dentro' && irParaMaquetes());

// ───────────────────────── tamanho e laço
function redimensiona() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (modo === 'maquetes') mostraArea(areaAtual, true);
  acorda(4);
}
addEventListener('resize', redimensiona);
redimensiona();

const relogio = new THREE.Clock();
const qAlvo = new THREE.Quaternion();
const mAux = new THREE.Matrix4();
const olharFoco = new THREE.Vector3();
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
    camera.position.copy(olho);
    mAux.lookAt(olho, olharFoco, camera.up);
    qAlvo.setFromRotationMatrix(mAux);
    const ang = passeio.olhar.angleTo(qAlvo);
    passeio.olhar.slerp(qAlvo, 1 - Math.exp(-dt * 5));
    camera.quaternion.copy(passeio.olhar);
    if (Math.abs(falta) > 1e-5 || ang > 1e-4) acorda(2);
    $('#progresso').style.transform = `scaleX(${passeio.p})`;
  }
  if (!carregado || quadros <= 0) return;
  quadros--;
  atualizaPontos();
  renderer.render(scene, camera);
});

// atalhos para conferir: ?area=2 entra direto; ?ver=4 só mostra a maquete 4
if (q.has('area') || q.has('ver')) {
  const i = Number(q.get('area') ?? q.get('ver')) || 0;
  const espera = setInterval(() => {
    if (modo === 'maquetes') {
      clearInterval(espera);
      mostraArea(i, true);
      if (q.has('area')) setTimeout(entrar, 300);
    }
  }, 100);
}
