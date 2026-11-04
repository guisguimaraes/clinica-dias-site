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
  const heroTitle = document.querySelector('.hero-card h1');
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

  // Frase que vai acendendo, letra por letra
  const statement = document.querySelector('[data-fill]');
  const statementChars = statement ? split(statement) : [];

  const drawStatement = (vh) => {
    if (!statement) return;
    const rect = statement.getBoundingClientRect();
    if (rect.bottom < -100 || rect.top > vh + 100) return;
    const t = clamp((vh * 0.85 - rect.top) / (vh * 0.62 + rect.height * 0.4));
    const lit = t * (statementChars.length + 12);
    statementChars.forEach((char, index) => {
      char.style.opacity = String(0.14 + 0.86 * clamp((lit - index) / 12));
    });
  };

  // Faixas de texto correndo em sentidos opostos
  const kinetic = document.querySelector('.kinetic');
  const kineticLines = kinetic ? [...kinetic.querySelectorAll('.kinetic-line')] : [];

  const drawKinetic = (vh) => {
    if (!kinetic) return;
    const rect = kinetic.getBoundingClientRect();
    if (rect.bottom < -50 || rect.top > vh + 50) return;
    const moved = vh - rect.top;
    kineticLines.forEach((line, index) => {
      const direction = index % 2 ? 1 : -1;
      line.style.transform = `translate3d(${direction * moved * 0.32 - (index % 2 ? 900 : 100)}px, 0, 0)`;
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
  const heroBg = document.querySelector('.hero-bg');
  const heroCard = document.querySelector('.hero-card');
  const heroChips = document.querySelector('.hero-chips');

  const drawHero = (scroll) => {
    if (!heroPanel) return;
    const wide = window.innerWidth > 1280;
    const s = wide ? Math.min(scroll, heroPanel.offsetHeight + 100) : 0;
    heroBg.style.transform = wide ? `translate3d(0, ${s * 0.24}px, 0)` : '';
    heroCard.style.transform = wide ? `translate3d(0, ${s * -0.09}px, 0)` : '';
    heroChips.style.transform = wide ? `translate3d(0, ${s * -0.16}px, 0)` : '';
  };

  // Gaveta de pastas: fica presa na tela e cada pasta sobe com a rolagem
  const archive = document.querySelector('[data-archive]');
  const stage = archive && archive.querySelector('.archive-stage');
  const drawer = archive && archive.querySelector('.folders');
  const folders = archive ? [...archive.querySelectorAll('.folder')] : [];
  const pinQuery = window.matchMedia('(min-width: 861px) and (min-height: 680px)');

  const folderTitles = folders.map((folder) => split(folder.querySelector('h3')));

  const clearFolders = () => {
    folders.forEach((folder, index) => {
      folder.style.transform = '';
      folder.querySelector('.folder-body').inert = false;
      folder.querySelector('.folder-tab').setAttribute('aria-expanded', 'true');
      folder.querySelector('.folder-sheet').style.transform = '';
      folderTitles[index].forEach((char) => {
        char.style.transform = '';
        char.style.opacity = '';
      });
    });
  };

  const drawArchive = () => {
    if (!archive) return;
    const pinned = pinQuery.matches;
    if (root.classList.contains('archive-pinned') !== pinned) {
      root.classList.toggle('archive-pinned', pinned);
      if (!pinned) clearFolders();
    }
    if (!pinned) return;

    const room = archive.offsetHeight - stage.offsetHeight;
    const progress = clamp(-archive.getBoundingClientRect().top / room) * (folders.length - 1);
    const height = drawer.offsetHeight;
    const active = Math.round(progress);

    folders.forEach((folder, index) => {
      const t = index === 0 ? 1 : easeOut(clamp(progress - index + 1));
      const y = height + (index * 10 - height) * t;
      const isActive = index === active;
      folder.style.transform = `translate3d(0, ${y}px, 0)`;
      folder.querySelector('.folder-body').inert = !isActive;
      folder.querySelector('.folder-tab').setAttribute('aria-expanded', String(isActive));
      folder.classList.toggle('is-active', isActive);
      folder.querySelector('.folder-sheet').style.transform = `translate3d(${(1 - t) * 90}px, ${(1 - t) * 140}px, 0) rotate(${3 + (1 - t) * 14}deg)`;
      const chars = folderTitles[index];
      chars.forEach((char, c) => {
        const local = easeOut(clamp(t * 1.5 - (c / chars.length) * 0.5));
        char.style.transform = `translateY(${(1 - local) * 70}%)`;
        char.style.opacity = String(local);
      });
    });
  };

  folders.forEach((folder, index) => {
    folder.querySelector('.folder-tab').addEventListener('click', () => {
      if (!pinQuery.matches) return;
      const room = archive.offsetHeight - stage.offsetHeight;
      const top = archive.getBoundingClientRect().top + window.scrollY - stage.offsetTop;
      window.scrollTo({ top: top + (room / (folders.length - 1)) * index + 1, behavior: 'smooth' });
    });
  });

  let queued = false;
  const draw = () => {
    queued = false;
    const vh = window.innerHeight;
    const headerHeight = document.querySelector('[data-header]')?.offsetHeight ?? 0;
    drawHero(window.scrollY);
    drawKinetic(vh);
    drawStatement(vh);
    drawRise(vh);
    drawArchive();
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
