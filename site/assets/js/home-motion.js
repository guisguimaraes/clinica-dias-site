// Movimento da home: tudo responde à rolagem e só usa transform e opacity.
// Quem pediu menos movimento no sistema vê a página parada e completa.
(() => {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const root = document.documentElement;
  root.classList.add('motion');

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const easeOut = (t) => 1 - (1 - t) ** 3;

  // Quebra o texto em letras, sem deixar a palavra partir no meio
  const split = (el) => {
    const text = el.textContent.trim().replace(/\s+/g, ' ');
    el.setAttribute('aria-label', text);
    el.textContent = '';
    const chars = [];
    text.split(' ').forEach((word, index, words) => {
      const box = document.createElement('span');
      box.className = 'word';
      box.setAttribute('aria-hidden', 'true');
      [...word].forEach((letter) => {
        const char = document.createElement('span');
        char.className = 'ch';
        char.textContent = letter;
        box.append(char);
        chars.push(char);
      });
      el.append(box);
      if (index < words.length - 1) el.append(' ');
    });
    return chars;
  };

  // Abertura: as letras do título entram ao carregar
  const heroTitle = document.querySelector('.hero-side h1');
  if (heroTitle) {
    split(heroTitle).forEach((char, index) => {
      char.style.animationDelay = `${150 + index * 18}ms`;
      char.classList.add('ch-in');
    });
  }

  // Títulos: letras entram por baixo e saem por cima conforme a rolagem
  const letterItems = [...document.querySelectorAll('[data-letters]')].map((el) => ({ el, chars: split(el) }));

  const drawLetters = ({ el, chars }, vh, top) => {
    const rect = el.getBoundingClientRect();
    if (rect.bottom < -80 || rect.top > vh + 80) return;
    const enter = clamp((vh * 0.96 - rect.top) / (vh * 0.34));
    const leave = clamp((top + 30 - rect.top) / 170);
    chars.forEach((char, index) => {
      const at = index / chars.length;
      const inT = easeOut(clamp(enter * 1.6 - at * 0.6));
      const outT = clamp(leave * 1.6 - at * 0.6);
      char.style.transform = `translateY(${(1 - inT) * 90 - outT * 70}%)`;
      char.style.opacity = String(inT * (1 - outT));
    });
  };

  // Blocos sobem e entram na tela
  const riseItems = [...document.querySelectorAll('[data-rise]')];

  const drawRise = (vh) => {
    riseItems.forEach((el) => {
      if (el.dataset.riseDone) return;
      const rect = el.parentElement.getBoundingClientRect();
      const delay = Number(el.dataset.rise || 0);
      const t = easeOut(clamp((vh * 0.98 - rect.top) / (vh * 0.34) - delay));
      el.style.transform = `translate3d(0, ${(1 - t) * 70}px, 0) scale(${0.97 + t * 0.03})`;
      el.style.opacity = String(t);
    });
  };

  // Parallax da abertura. A fachada anda mais devagar que a página.
  const heroPanel = document.querySelector('.hero-panel');
  const heroBg = document.querySelector('.hero-slides');

  const drawHero = (scroll) => {
    if (!heroPanel) return;
    const wide = window.innerWidth > 1280;
    const s = wide ? Math.min(scroll, heroPanel.offsetHeight + 100) : 0;
    heroBg.style.transform = wide ? `translate3d(0, ${s * 0.24}px, 0)` : '';
  };

  // Especialidades: letras do título da coluna que abre
  document.querySelectorAll('.spec-panel h3').forEach((title) => {
    split(title).forEach((char, index) => char.style.setProperty('--c', index));
  });

  let queued = false;
  const draw = () => {
    queued = false;
    const vh = window.innerHeight;
    const headerHeight = document.querySelector('[data-header]')?.offsetHeight ?? 0;
    drawHero(window.scrollY);
    drawRise(vh);
    letterItems.forEach((item) => drawLetters(item, vh, headerHeight));
  };
  const request = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(draw);
  };

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  draw();
})();
