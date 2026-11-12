// Modelo 2: letras entram, fotos deslizam e a foto das especialidades segue o mouse
document.fonts.ready.then(() => {
  const { gsap, ScrollTrigger, SplitText, Clinica } = window;
  gsap.registerPlugin(ScrollTrigger, SplitText);
  const lenis = Clinica.smooth();
  Clinica.anchors(lenis);

  // Menu em tela cheia
  const abre = document.querySelector('[data-menu-abre]');
  const menu = document.querySelector('[data-menu]');
  const alterna = (aberto) => {
    menu.hidden = !aberto;
    abre.setAttribute('aria-expanded', String(aberto));
    abre.querySelector('.sr-only').textContent = aberto ? 'Fechar menu' : 'Abrir menu';
    if (lenis) { if (aberto) lenis.stop(); else lenis.start(); }
    if (aberto && !Clinica.reduce) gsap.from(menu.querySelectorAll('a'), { yPercent: 60, autoAlpha: 0, stagger: 0.06, duration: 0.6, ease: 'power3.out' });
  };
  abre.addEventListener('click', () => alterna(menu.hidden));
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => alterna(false)));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !menu.hidden) alterna(false); });

  // Aberto ou fechado agora
  const agora = document.querySelector('[data-agora]');
  const atualiza = () => {
    const s = Clinica.now();
    agora.textContent = s.open ? `Aberto agora, fecha em ${Clinica.duration(s.left)}` : `Fechado agora, voltamos ${s.next}`;
  };
  atualiza();
  setInterval(atualiza, 60000);

  // Foto que segue o mouse nas especialidades
  const flutua = document.querySelector('[data-flutua]');
  const linhas = [...document.querySelectorAll('.esp-lista li')];
  const fotos = [...flutua.children];
  if (window.matchMedia('(hover: hover)').matches) {
    const x = gsap.quickTo(flutua, 'x', { duration: 0.5, ease: 'power3' });
    const y = gsap.quickTo(flutua, 'y', { duration: 0.5, ease: 'power3' });
    const lista = document.querySelector('.esp-lista');
    lista.addEventListener('pointermove', (event) => {
      x(event.clientX + 24);
      y(Math.min(event.clientY - 120, window.innerHeight - flutua.offsetHeight - 20));
    });
    linhas.forEach((linha, index) => {
      linha.addEventListener('pointerenter', () => fotos.forEach((foto, i) => foto.classList.toggle('is-on', i === index)));
    });
    lista.addEventListener('pointerenter', () => gsap.to(flutua, { autoAlpha: 1, duration: 0.25 }));
    lista.addEventListener('pointerleave', () => gsap.to(flutua, { autoAlpha: 0, duration: 0.25 }));
  }

  if (Clinica.reduce) return;

  // Letras maiúsculas entram uma a uma
  document.querySelectorAll('[data-letras]').forEach((el) => {
    const split = SplitText.create(el, { type: 'chars', mask: 'chars' });
    const naAbertura = Boolean(el.closest('.abre'));
    gsap.from(split.chars, {
      yPercent: 110,
      duration: 0.9,
      ease: 'power4.out',
      stagger: 0.022,
      delay: naAbertura ? 0.2 : 0,
      scrollTrigger: naAbertura ? undefined : { trigger: el, start: 'top 90%' },
    });
  });

  gsap.utils.toArray('[data-sobe]').forEach((el) => {
    const naAbertura = Boolean(el.closest('.abre'));
    gsap.from(el, { y: 24, autoAlpha: 0, duration: 0.9, delay: naAbertura ? 0.7 : 0, ease: 'power3.out' });
  });

  // Fotos grandes abrem de baixo para cima e deslizam dentro da moldura
  gsap.utils.toArray('[data-abre-foto]').forEach((box) => {
    gsap.from(box, { clipPath: 'inset(16% 12% 0% 12%)', ease: 'none', scrollTrigger: { trigger: box, start: 'top 95%', end: 'top 35%', scrub: true } });
    gsap.fromTo(box.querySelector('img'), { yPercent: -10 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: box, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // Cartões entram em sequência
  gsap.from('[data-cartao]', { y: 70, autoAlpha: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: '.porque-cards', start: 'top 85%' } });

  // Colagem: cada foto anda em uma velocidade
  gsap.utils.toArray('[data-vel]').forEach((figura) => {
    gsap.to(figura, { y: Number(figura.dataset.vel), ease: 'none', scrollTrigger: { trigger: '.colagem', start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // Nomes das especialidades entram em cascata
  gsap.from(linhas, { y: 30, autoAlpha: 0, duration: 0.7, stagger: 0.06, ease: 'power3.out', scrollTrigger: { trigger: '.esp-lista', start: 'top 85%' } });
});
