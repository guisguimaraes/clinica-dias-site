// Animações do site inteiro (GSAP + ScrollTrigger + SplitText, em vendor/):
// - títulos e sobretítulos entram letra por letra, da esquerda para a direita, como se a página se montasse;
// - textos, botões, listas e fotos aparecem em sequência conforme a página desce;
// - as avaliações se montam em etapas: título, estrelas, botões e cada cartão voando até o lugar.
// Sem GSAP ou com "reduzir movimento" ligado, tudo fica parado e completo (o HTML já vem pronto).
(() => {
  const raiz = document.documentElement;
  const libera = () => raiz.classList.remove('anima');
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!window.gsap || !window.ScrollTrigger || reduzido) { libera(); return; }
  window.__anima = true;
  gsap.registerPlugin(ScrollTrigger);
  const temSplit = !!window.SplitText;
  if (temSplit) gsap.registerPlugin(SplitText);
  const suave = 'power3.out';
  const celular = matchMedia('(max-width: 720px)').matches;

  // partes que já têm animação própria (página A clínica) ou que não devem mexer
  const PROPRIAS = '.ac-missao, [data-ac-tempo], .ac-fundador, .ac-simbolo, .ac-hoje, .av, .cf, [data-sem-anima]';
  const livre = (el) => !el.closest(PROPRIAS);

  // letras entrando da esquerda para a direita
  const letras = (el, opc = {}) => {
    if (!temSplit) { gsap.set(el, { visibility: 'visible' }); return gsap.from(el, { opacity: 0, x: -20, duration: 0.7, ease: suave, ...opc }); }
    const s = new SplitText(el, { type: 'words,chars', charsClass: 'letra' });
    gsap.set(el, { visibility: 'visible' });
    return gsap.from(s.chars, {
      opacity: 0, x: -26,
      duration: 0.62, ease: suave, stagger: { each: el.matches('.sobretitulo') ? 0.012 : 0.02 }, ...opc,
    });
  };
  const aoAparecer = (gatilho, inicio = 'top 86%') => ({ trigger: gatilho, start: inicio, once: true });

  // ── títulos e sobretítulos
  document.querySelectorAll('main :is(h1, h2, h3, .sobretitulo)').forEach((el) => {
    if (!livre(el)) { gsap.set(el, { visibility: 'visible' }); return; }
    const t = letras(el, { paused: true });
    ScrollTrigger.create({ ...aoAparecer(el), onEnter: () => t.play() });
  });

  // ── textos, botões, itens de lista e cartões: sobem e aparecem em sequência
  const blocos = [...document.querySelectorAll('main :is(p, .botao, .acoes > a, ul > li, ol > li, dl > div, blockquote, figure)')]
    .filter((el) => livre(el) && !el.matches('.sobretitulo') && !el.closest('nav, .topo, .so-leitor'));
  // só o de fora anima (um parágrafo dentro de um item que já sobe não sobe de novo)
  const conjunto = new Set(blocos);
  const soltos = blocos.filter((el) => { for (let p = el.parentElement; p; p = p.parentElement) if (conjunto.has(p)) return false; return true; });
  blocos.length = 0; blocos.push(...soltos);
  gsap.set(blocos, { opacity: 0, y: 28 });
  ScrollTrigger.batch(blocos, {
    start: 'top 90%', once: true,
    onEnter: (lote) => gsap.to(lote, { opacity: 1, y: 0, duration: 0.8, ease: suave, stagger: 0.08, overwrite: true }),
  });

  // ── fotos: abrem da esquerda para a direita, como uma cortina
  const fotos = [...document.querySelectorAll('main img')]
    .filter((im) => livre(im) && !im.closest('.botao, .av, .cf, .convenios, [class*="logo"]') && (im.width || 0) > 120);
  fotos.forEach((im) => {
    gsap.fromTo(im, { clipPath: 'inset(0 100% 0 0)', scale: 1.08 }, {
      clipPath: 'inset(0 0% 0 0)', scale: 1, duration: 1.3, ease: 'power3.inOut', scrollTrigger: aoAparecer(im, 'top 88%'),
      clearProps: 'clipPath,transform',
    });
  });

  // ── avaliações: a seção se monta em etapas (a linha do tempo é montada já escondida e toca quando a seção aparece)
  const av = document.querySelector('[data-avaliacoes]');
  if (av) {
    const titulo = av.querySelector('.av-titulo');
    const sobre = av.querySelector('.sobretitulo');
    let tl = null, visivel = false;
    const prepara = () => {
      const cartoes = [...av.querySelectorAll('.av-card')];
      if (tl || !cartoes.length) return;
      tl = gsap.timeline({ paused: true, defaults: { ease: suave } });
      tl.from(av.querySelector('.av-fundo'), { xPercent: 18, opacity: 0, duration: 1.6, ease: 'power2.out' }, 0);
      if (sobre) tl.add(letras(sobre), 0.05);
      if (titulo) tl.add(letras(titulo, { stagger: { each: 0.024 } }), 0.2);
      const risco = av.querySelector('.av-risco path');
      if (risco) tl.fromTo(risco, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, '>-0.3');
      tl.from(av.querySelectorAll('.av-nota .av-estrelas svg'), { scale: 0, rotate: -90, opacity: 0, duration: 0.45, ease: 'back.out(2.6)', stagger: 0.08 }, '-=0.5')
        .from(av.querySelectorAll('.av-nota > span:not(.av-estrelas), .av-nota > b'), { x: -14, opacity: 0, duration: 0.5 }, '-=0.2')
        .from(av.querySelector('.av-apoio'), { y: 18, opacity: 0, duration: 0.6 }, '-=0.3')
        .from(av.querySelectorAll('.av-acoes .botao'), { y: 24, opacity: 0, duration: 0.6, stagger: 0.12 }, '-=0.35');
      // cada cartão chega de um lado, girando, e encaixa na inclinação dele; depois o miolo se preenche
      cartoes.forEach((c, i) => {
        const giro = parseFloat(getComputedStyle(c).getPropertyValue('--giro')) || 0;
        const lado = i % 2 ? 1 : -1;
        const em = 0.9 + i * 0.28;
        c.style.animationPlayState = 'paused';
        tl.fromTo(c, { x: lado * (celular ? 90 : 220), y: 120, rotation: lado * 14, scale: 0.82, opacity: 0 },
          { x: 0, y: 0, rotation: giro, scale: 1, opacity: 1, duration: 1.0, ease: 'back.out(1.35)', immediateRender: true,
            onComplete: () => { gsap.set(c, { clearProps: 'transform,opacity' }); c.style.animationPlayState = ''; } }, em);
        tl.from(c.querySelector('.av-foto'), { scale: 0, duration: 0.5, ease: 'back.out(2.4)' }, em + 0.45)
          .from(c.querySelector('.av-nome b'), { x: -16, opacity: 0, duration: 0.45 }, em + 0.55)
          .from(c.querySelectorAll('.av-nome .av-estrelas svg'), { scale: 0, opacity: 0, duration: 0.35, ease: 'back.out(2.6)', stagger: 0.06 }, em + 0.62)
          .from(c.querySelector('.av-g'), { rotate: -180, scale: 0, duration: 0.6, ease: 'back.out(2)' }, em + 0.6);
        const texto = c.querySelector('.av-texto');
        if (texto && temSplit) {
          const linhas = new SplitText(texto, { type: 'lines', linesClass: 'av-linha' }).lines;
          tl.from(linhas, { y: 14, opacity: 0, duration: 0.5, stagger: 0.07 }, em + 0.7);
        } else if (texto) tl.from(texto, { opacity: 0, duration: 0.5 }, em + 0.7);
        tl.from(c.querySelector('.av-quando'), { opacity: 0, duration: 0.4 }, em + 1.1);
      });
      tl.from(av.querySelector('.av-balao'), { scale: 0, rotate: -40, opacity: 0, duration: 0.7, ease: 'elastic.out(1, 0.5)' }, '-=0.6')
        .from(av.querySelector('.av-bolha'), { scale: 0.3, opacity: 0, duration: 1.2, ease: 'power2.out' }, '<');
      if (visivel) tl.play();
    };
    // sem cartões ainda (vindo do Google), segura o título escondido até eles chegarem
    if (!av.querySelector('.av-card')) gsap.set([titulo, sobre], { autoAlpha: 0 });
    document.addEventListener('avaliacoes:prontas', () => { gsap.set([titulo, sobre], { autoAlpha: 1 }); prepara(); });
    prepara();
    ScrollTrigger.create({ trigger: av, start: 'top 72%', once: true, onEnter: () => { visivel = true; tl?.play(); } });
  }

  libera();
  // fontes e imagens mudam a altura da página: recalcula os pontos de disparo quando terminar de carregar
  addEventListener('load', () => ScrollTrigger.refresh());
})();
