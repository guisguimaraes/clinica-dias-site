// Modelo 1: movimento guiado pela rolagem normal da página
document.fonts.ready.then(() => {
  const { gsap, ScrollTrigger, SplitText, Clinica } = window;
  gsap.registerPlugin(ScrollTrigger, SplitText);
  const lenis = Clinica.smooth();
  Clinica.anchors(lenis);

  // Especialidades: o nome no centro da tela troca o fundo e o texto ao lado
  const roda = document.querySelector('[data-roda]');
  const nomes = [...roda.querySelectorAll('.roda-nomes li')];
  const camadas = [...roda.querySelectorAll('.roda-camada')];
  const nomeLado = roda.querySelector('[data-roda-nome]');
  const textoLado = roda.querySelector('[data-roda-texto]');
  const ativar = (index) => {
    nomes.forEach((item, i) => item.classList.toggle('is-on', i === index));
    camadas.forEach((item, i) => item.classList.toggle('is-on', i === index));
    nomeLado.textContent = nomes[index].firstChild.textContent;
    textoLado.textContent = nomes[index].dataset.texto;
  };
  let ativo = 0;
  ScrollTrigger.create({
    trigger: ".roda-nomes",
    start: "top bottom",
    end: "bottom top",
    onUpdate: () => {
      const linha = window.innerHeight * 0.55;
      let perto = 0;
      let menor = Infinity;
      nomes.forEach((item, i) => {
        const r = item.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - linha);
        if (d < menor) { menor = d; perto = i; }
      });
      if (perto !== ativo) { ativo = perto; ativar(perto); }
    },
  });

  if (Clinica.reduce) return;

  // Títulos sobem linha por linha
  document.querySelectorAll('[data-linhas]').forEach((el) => {
    const naAbertura = Boolean(el.closest('.hero'));
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      autoSplit: true,
      onSplit: (self) => gsap.from(self.lines, {
        yPercent: 110,
        duration: 1,
        ease: 'power4.out',
        stagger: 0.09,
        delay: naAbertura ? 0.15 : 0,
        scrollTrigger: naAbertura ? undefined : { trigger: el, start: 'top 88%' },
      }),
    });
  });

  // Blocos sobem ao entrar
  gsap.utils.toArray('[data-sobe]').forEach((el) => {
    gsap.from(el, { y: 40, autoAlpha: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 94%' } });
  });

  // A foto da equipe cresce ao rolar
  gsap.from('[data-hero-foto]', { scale: 0.86, y: 40, autoAlpha: 0, duration: 1.2, ease: 'power3.out', delay: 0.2 });
  gsap.to('[data-hero-foto] img', { scale: 1.12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  // Palavras enormes vão acendendo
  gsap.utils.toArray('[data-pinta] li').forEach((item) => {
    gsap.fromTo(item, { opacity: 0.12 }, { opacity: 1, ease: 'none', scrollTrigger: { trigger: item, start: 'top 90%', end: 'top 55%', scrub: true } });
  });

  // Cada bloco abre até tomar a tela e o anterior recua
  gsap.utils.toArray('[data-abre]').forEach((caso, index, todos) => {
    gsap.fromTo(caso, { clipPath: 'inset(9% 7% 0% 7% round 28px)' }, {
      clipPath: 'inset(0% 0% 0% 0% round 28px)',
      ease: 'none',
      scrollTrigger: { trigger: caso, start: 'top 95%', end: 'top 15%', scrub: true },
    });
    const proximo = todos[index + 1];
    if (proximo) {
      gsap.to(caso, { scale: 0.94, ease: 'none', scrollTrigger: { trigger: proximo, start: 'top bottom', end: 'top top', scrub: true } });
    }
  });
  gsap.fromTo('.caso-gigante', { xPercent: 14 }, { xPercent: -6, ease: 'none', scrollTrigger: { trigger: '.caso-equipe', start: 'top bottom', end: 'bottom top', scrub: true } });

  // Cruzes flutuam em velocidades diferentes
  gsap.utils.toArray('[data-flutua]').forEach((cruz) => {
    gsap.to(cruz, { y: Number(cruz.dataset.flutua), rotate: 40, ease: 'none', scrollTrigger: { trigger: '.passos', start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // O número da nota sobe de 0 até 4,8
  gsap.utils.toArray('[data-conta]').forEach((el) => {
    const alvo = Number(el.dataset.conta);
    const valor = { n: 0 };
    gsap.to(valor, {
      n: alvo,
      duration: 1.8,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 92%' },
      onUpdate: () => { el.textContent = valor.n.toFixed(1).replace('.', ','); },
    });
  });

  // Morros do rodapé
  gsap.from('[data-morros] path', { yPercent: 40, stagger: 0.08, ease: 'none', scrollTrigger: { trigger: '.morros', start: 'top bottom', end: 'bottom bottom', scrub: true } });
});
