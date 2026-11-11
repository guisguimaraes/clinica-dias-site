// Página "A clínica": animações com GSAP + ScrollTrigger + SplitText (vendor/).
// Sem GSAP ou com "menos movimento" ligado, tudo aparece parado e completo (o HTML já vem pronto).
(() => {
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!window.gsap || !window.ScrollTrigger || reduzido) return;
  gsap.registerPlugin(ScrollTrigger);
  if (window.SplitText) gsap.registerPlugin(SplitText);
  const suave = 'power3.out';

  // linha do tempo: a linha colorida cresce com a rolagem; o marco da vez acende e troca o ano grande
  const tempo = document.querySelector('[data-ac-tempo]');
  if (tempo) {
    const marcos = tempo.querySelector('.ac-marcos');
    const ano = tempo.querySelector('[data-ac-ano]');
    gsap.fromTo(marcos, { '--progresso': 0 }, {
      '--progresso': 1, ease: 'none',
      scrollTrigger: { trigger: marcos, start: 'top 65%', end: 'bottom 60%', scrub: 0.6 },
    });
    tempo.querySelectorAll('.ac-marco').forEach((m) => {
      gsap.from(m.querySelector('.ac-marco-corpo'), {
        y: 60, opacity: 0, duration: 1, ease: suave,
        scrollTrigger: { trigger: m, start: 'top 82%' },
      });
      gsap.from(m.querySelectorAll('.ac-foto img, .ac-unidades img'), {
        scale: 1.18, duration: 1.6, ease: suave, stagger: 0.12,
        scrollTrigger: { trigger: m, start: 'top 82%' },
      });
      ScrollTrigger.create({
        trigger: m, start: 'top 55%', end: 'bottom 45%',
        onToggle: (st) => {
          m.classList.toggle('ativo', st.isActive);
          if (st.isActive && ano && ano.textContent !== m.dataset.ano) {
            gsap.timeline()
              .to(ano, { yPercent: -30, opacity: 0, duration: 0.22, ease: 'power2.in' })
              .add(() => { ano.textContent = m.dataset.ano; })
              .fromTo(ano, { yPercent: 30, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: suave });
          }
        },
      });
    });
  }

  // missão: foto com profundidade e frase entrando palavra por palavra
  const foto = document.querySelector('[data-ac-paralaxe]');
  if (foto) {
    gsap.fromTo(foto, { yPercent: -10 }, {
      yPercent: 6, ease: 'none',
      scrollTrigger: { trigger: '.ac-missao', start: 'top bottom', end: 'bottom top', scrub: true },
    });
  }
  const frase = document.querySelector('[data-ac-frase]');
  if (frase) {
    const alvo = window.SplitText ? new SplitText(frase, { type: 'words' }).words : [frase];
    gsap.from(alvo, {
      yPercent: 70, opacity: 0, rotateX: -40, transformOrigin: '50% 100%',
      duration: 0.9, ease: suave, stagger: 0.07,
      scrollTrigger: { trigger: frase, start: 'top 80%' },
    });
    gsap.from('.ac-missao cite, .ac-missao .sobretitulo', {
      y: 20, opacity: 0, duration: 0.8, ease: suave, stagger: 0.1,
      scrollTrigger: { trigger: frase, start: 'top 80%' },
    });
  }

  // fundador: a foto aproxima devagar e a ficha sobe por cima dela
  const zoom = document.querySelector('[data-ac-zoom]');
  if (zoom) {
    gsap.fromTo(zoom, { scale: 1.15 }, {
      scale: 1, ease: 'none',
      scrollTrigger: { trigger: '.ac-fundador', start: 'top bottom', end: 'center center', scrub: true },
    });
  }
  const ficha = document.querySelector('[data-ac-sobe]');
  if (ficha) {
    gsap.from(ficha, { y: 90, opacity: 0, duration: 1.1, ease: suave, scrollTrigger: { trigger: ficha, start: 'top 85%' } });
    gsap.from(ficha.querySelectorAll('.ac-ficha-dados div'), {
      y: 24, opacity: 0, duration: 0.7, ease: suave, stagger: 0.08,
      scrollTrigger: { trigger: ficha, start: 'top 70%' },
    });
  }

  // símbolo: entra girando dentro dos anéis; as faixas de cor se pintam da esquerda para a direita
  const simbolo = document.querySelector('[data-ac-simbolo]');
  if (simbolo) {
    gsap.from(simbolo, {
      scale: 0.6, rotate: -25, opacity: 0, duration: 1.4, ease: 'back.out(1.6)',
      scrollTrigger: { trigger: '.ac-simbolo', start: 'top 70%' },
    });
    gsap.from('.ac-anel', {
      scale: 0.7, opacity: 0, duration: 1.2, ease: suave, stagger: 0.12,
      scrollTrigger: { trigger: '.ac-simbolo', start: 'top 70%' },
    });
    gsap.to(simbolo, { y: -10, duration: 3, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }
  gsap.from('.ac-cor', {
    scaleX: 0, duration: 0.9, ease: 'power2.out', stagger: 0.15,
    scrollTrigger: { trigger: '.ac-cores', start: 'top 85%' },
  });

  // números: contam do zero até o valor quando aparecem
  document.querySelectorAll('[data-ac-conta]').forEach((el) => {
    const fim = Number(el.textContent) || 0;
    const obj = { v: 0 };
    el.textContent = '0';
    gsap.to(obj, {
      v: fim, duration: 1.8, ease: 'power2.out',
      onUpdate: () => { el.textContent = String(Math.round(obj.v)); },
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
  });
  gsap.from('.ac-numeros li', {
    y: 40, opacity: 0, duration: 0.9, ease: suave, stagger: 0.12,
    scrollTrigger: { trigger: '.ac-numeros', start: 'top 85%' },
  });
})();
