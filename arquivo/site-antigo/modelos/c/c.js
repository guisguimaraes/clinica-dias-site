// Modelo 3: um dia na clínica. A hora e o céu andam com a rolagem.
document.fonts.ready.then(() => {
  const { gsap, ScrollTrigger, SplitText, Clinica } = window;
  gsap.registerPlugin(ScrollTrigger, SplitText);
  const lenis = Clinica.smooth();
  Clinica.anchors(lenis);
  const root = document.documentElement;

  // Situação real de agora
  const agora = document.querySelector('[data-agora]');
  const atualiza = () => {
    const s = Clinica.now();
    agora.classList.toggle('aberto', s.open);
    agora.textContent = s.open ? `Aberto agora, por mais ${Clinica.duration(s.left)}` : `Fechado agora, voltamos ${s.next}`;
  };
  atualiza();
  setInterval(atualiza, 60000);

  // Especialidades abrem com um clique
  const botoes = [...document.querySelectorAll('[data-areas] button')];
  botoes.forEach((botao) => {
    botao.addEventListener('click', () => {
      const abrir = botao.getAttribute('aria-expanded') !== 'true';
      botoes.forEach((b) => b.setAttribute('aria-expanded', 'false'));
      botao.setAttribute('aria-expanded', String(abrir));
    });
  });

  // Simulador: escolha um dia e uma hora e veja se a clínica está aberta
  const dias = [...document.querySelectorAll('[data-dia]')];
  const campoHora = document.querySelector('[data-hora-campo]');
  const resposta = document.querySelector('[data-resposta]');
  const nomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  let dia = 2;
  const simula = () => {
    const hora = Number(campoHora.value);
    dias.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.dia) === dia)));
    campoHora.setAttribute('aria-valuetext', `${hora} horas`);
    const horario = Clinica.hoursOf(dia);
    const r = Clinica.check(dia, hora * 60);
    if (!horario) resposta.textContent = 'Domingo a clínica fecha. Segunda abrimos às 7h.';
    else if (r.open) resposta.textContent = `${nomes[dia]} às ${hora}h: pode vir, estamos abertos até as ${r.closes}h.`;
    else if (hora * 60 < horario[0]) resposta.textContent = `${nomes[dia]} às ${hora}h ainda é cedo. Abrimos às ${horario[0] / 60}h.`;
    else resposta.textContent = `${nomes[dia]} às ${hora}h já fechamos. O atendimento vai até as ${horario[1] / 60}h.`;
  };
  dias.forEach((b) => b.addEventListener('click', () => { dia = Number(b.dataset.dia); simula(); }));
  campoHora.addEventListener('input', simula);
  simula();

  // Céu: cada momento do dia tem sua cor
  const momentos = gsap.utils.toArray('[data-ceu]');
  const pintar = (el) => {
    const props = { '--ceu': el.dataset.ceu, '--tinta': el.dataset.tinta };
    if (Clinica.reduce) Object.entries(props).forEach(([k, v]) => root.style.setProperty(k, v));
    else gsap.to(root, { ...props, duration: 0.7, ease: 'power1.out', overwrite: 'auto' });
  };
  momentos.forEach((el) => {
    ScrollTrigger.create({
      trigger: el,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: (self) => { if (self.isActive) pintar(el); },
    });
  });

  // A hora anda das 7h às 22h, parando nas marcas de cada momento
  const relogio = document.querySelector('[data-relogio]');
  const trilho = document.querySelector('[data-trilho]');
  const marcas = gsap.utils.toArray('[data-hora]');
  const minutos = (texto) => { const [h, m] = texto.split(':').map(Number); return h * 60 + m; };
  const desenhaRelogio = () => {
    const meio = window.scrollY + window.innerHeight * 0.55;
    const pontos = marcas.map((m) => ({ y: m.getBoundingClientRect().top + window.scrollY, t: minutos(m.textContent) }));
    let t = pontos[0].t;
    for (let i = 0; i < pontos.length; i += 1) {
      const a = pontos[i];
      const b = pontos[i + 1];
      if (meio >= a.y) t = b ? a.t + (b.t - a.t) * gsap.utils.clamp(0, 1, (meio - a.y) / (b.y - a.y)) : a.t;
    }
    const arredondado = Math.round(t / 5) * 5;
    relogio.textContent = `${String(Math.floor(arredondado / 60)).padStart(2, '0')}:${String(arredondado % 60).padStart(2, '0')}`;
    gsap.set(trilho, { scaleY: (t - 420) / 900 });
  };
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: desenhaRelogio });
  desenhaRelogio();

  // Abertura: a fachada mora dentro de uma cruz, que cresce com a rolagem
  const janela = document.querySelector('[data-janela]');
  const palco = document.querySelector('[data-palco]');
  const cruz = (p) => {
    const w = palco.clientWidth;
    const h = palco.clientHeight;
    const estreito = w < 800;
    const cx = (estreito ? 0.5 : 0.72) * w + (0.5 - (estreito ? 0.5 : 0.72)) * w * p;
    const cy = (estreito ? 0.78 : 0.5) * h + (0.5 - (estreito ? 0.78 : 0.5)) * h * p;
    const inicio = Math.min(w, h) * (estreito ? 0.13 : 0.16);
    const fim = Math.hypot(w, h);
    const braco = inicio + (fim - inicio) * p ** 2.1;
    const ponta = braco * 2.35;
    const pts = [[-braco, -ponta], [braco, -ponta], [braco, -braco], [ponta, -braco], [ponta, braco], [braco, braco], [braco, ponta], [-braco, ponta], [-braco, braco], [-ponta, braco], [-ponta, -braco], [-braco, -braco]];
    return `polygon(${pts.map(([x, y]) => `${(cx + x).toFixed(1)}px ${(cy + y).toFixed(1)}px`).join(',')})`;
  };
  const progresso = { p: 0 };
  const aplicar = () => { janela.style.clipPath = cruz(progresso.p); };
  aplicar();
  window.addEventListener('resize', aplicar);

  if (Clinica.reduce) {
    progresso.p = 0.35;
    aplicar();
    return;
  }

  gsap.to(progresso, {
    p: 1,
    ease: 'none',
    onUpdate: aplicar,
    scrollTrigger: { trigger: '.abertura', start: 'top top', end: 'bottom bottom', scrub: true },
  });

  // Títulos sobem por linha
  document.querySelectorAll('[data-linhas]').forEach((el) => {
    const naAbertura = Boolean(el.closest('.abertura'));
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      autoSplit: true,
      onSplit: (self) => gsap.from(self.lines, {
        yPercent: 110,
        duration: 1.1,
        ease: 'power4.out',
        stagger: 0.1,
        delay: naAbertura ? 0.15 : 0,
        scrollTrigger: naAbertura ? undefined : { trigger: el, start: 'top 88%' },
      }),
    });
  });

  // A frase gigante desliza atrás da equipe, que sobe
  gsap.fromTo('[data-desliza]', { x: '6vw' }, { x: '-46vw', ease: 'none', scrollTrigger: { trigger: '.equipe', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.from('[data-sobe-foto]', { y: 120, ease: 'none', scrollTrigger: { trigger: '.equipe-palco', start: 'top bottom', end: 'top 25%', scrub: true } });

  gsap.from(botoes, { y: 30, autoAlpha: 0, duration: 0.7, stagger: 0.05, ease: 'power3.out', scrollTrigger: { trigger: '[data-areas]', start: 'top 85%' } });
  gsap.from('[data-simula] > *', { y: 24, autoAlpha: 0, duration: 0.7, stagger: 0.06, ease: 'power3.out', scrollTrigger: { trigger: '[data-simula]', start: 'top 85%' } });
});
