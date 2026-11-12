// Prévia das ideias (12/11/2026): especialidades em lista, faixa de fotos, porta-cartão do CardFácil e mapa das unidades.
(() => {
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── ideia 1: especialidades. O nome mostra a explicação ao lado (no celular, logo abaixo do nome tocado).
  const caixa = document.querySelector('[data-esp2]');
  const painel = document.querySelector('[data-esp2-painel]');
  if (caixa && painel) {
    const textos = window.__explicacoes || {};
    const salas = {
      consultorio: ['maq_sala_consultorio', 'Consultório'],
      ergometria: ['maq_sala_ergometria', 'Sala de ergometria'],
      pediatria: ['maq_sala_pediatria', 'Consultório de pediatria'],
      odonto: ['maq_sala_odonto', 'Consultório odontológico'],
    };
    const pasta = '../passeio/modelos/maquetes/';
    Object.values(salas).forEach(([arq]) => { new Image().src = `${pasta}${arq}.webp`; });
    const $ = (s) => painel.querySelector(s);
    const foto = $('[data-esp2-foto]'), legenda = $('[data-esp2-legenda]'), conta = $('[data-esp2-conta]'), nome = $('[data-esp2-nome]'), explica = $('[data-esp2-explica]');
    const casa = painel.parentElement;
    const celular = matchMedia('(max-width: 900px)');
    const botoes = [...caixa.querySelectorAll('button')];
    let atual = -1;

    const mostra = (i) => {
      atual = i;
      const b = botoes[i];
      const n = b.textContent.trim();
      botoes.forEach((x, k) => x.setAttribute('aria-pressed', String(k === i)));
      conta.textContent = `${String(i + 1).padStart(2, '0')} / ${botoes.length}`;
      nome.textContent = n;
      explica.textContent = textos[n] || '';
      const [arq, rotulo] = salas[b.dataset.sala || 'consultorio'];
      legenda.textContent = `${rotulo} · maquete do passeio 3D`;
      if (!foto.src.endsWith(`${arq}.webp`)) {
        foto.classList.add('trocando');
        setTimeout(() => { foto.src = `${pasta}${arq}.webp`; foto.classList.remove('trocando'); }, 180);
      }
      if (celular.matches) { b.closest('li').append(painel); painel.classList.add('no-item'); }
    };
    const fecha = () => {
      botoes.forEach((x) => x.setAttribute('aria-pressed', 'false'));
      painel.classList.remove('no-item');
      atual = -1;
    };
    botoes.forEach((b, i) => {
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('mouseenter', () => { if (!celular.matches && atual !== i) mostra(i); });
      b.addEventListener('focus', () => { if (!celular.matches && atual !== i) mostra(i); });
      b.addEventListener('click', () => { if (celular.matches && atual === i) fecha(); else mostra(i); });
    });
    const ajusta = () => {
      if (celular.matches) { fecha(); return; }
      casa.append(painel);
      painel.classList.remove('no-item');
      mostra(Math.max(atual, 1));
    };
    celular.addEventListener('change', ajusta);
    if (!celular.matches) mostra(1); // abre em Cardiologia
  }

  // ── ideia 3: a carteirinha sai do porta-cartão quando a seção aparece
  const sec = document.querySelector('.cf-com-capa');
  if (!sec || !window.gsap || !window.ScrollTrigger || reduzido) return;
  const saida = sec.querySelector('[data-cf-saida]');
  const capa = sec.querySelectorAll('[data-cf-capa]');
  const chao = sec.querySelector('.cf-chao');
  const dica = sec.querySelector('.cf-dica');
  const monta = () => {
    gsap.killTweensOf([saida, ...capa, chao, dica]);
    sec.classList.add('preparada');
    gsap.set(saida, { yPercent: 19, rotation: 26, scale: 0.92 });
    gsap.set(capa, { y: 0, opacity: 1 });
    gsap.set([chao, dica], { opacity: 0 });
    return gsap.timeline({ paused: true })
      .to(saida, { yPercent: 0, rotation: 0, scale: 1, duration: 1.6, ease: 'power3.inOut' }, 0.4)
      .to(capa, { y: 90, opacity: 0, duration: 0.9, ease: 'power2.in' }, 1.15)
      .to([chao, dica], { opacity: 1, duration: 0.8 }, 1.5);
  };
  let tl = monta();
  ScrollTrigger.create({ trigger: sec, start: 'top 62%', once: true, onEnter: () => tl.play() });
  sec.querySelector('[data-cf-repete]')?.addEventListener('click', () => { tl.kill(); tl = monta(); tl.play(); });
})();
