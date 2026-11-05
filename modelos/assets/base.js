// Base comum aos três modelos: horário real da clínica, rolagem suave e fotos reservadas
(() => {
  'use strict';
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const parts = (date) => {
    const list = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type) => list.find((part) => part.type === type).value;
    return {
      day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')),
      minutes: Number(get('hour')) * 60 + Number(get('minute')),
    };
  };

  // Segunda a sexta 7h às 22h, sábado 8h às 19h, domingo fechado
  const hoursOf = (day) => (day === 0 ? null : day === 6 ? [480, 1140] : [420, 1320]);

  const check = (day, minutes) => {
    const hours = hoursOf(day);
    const open = Boolean(hours) && minutes >= hours[0] && minutes < hours[1];
    if (open) return { open, left: hours[1] - minutes, closes: hours[1] / 60 };
    let next = 'amanhã às 7h';
    if (hours && minutes < hours[0]) next = `hoje às ${hours[0] / 60}h`;
    else if (day === 6) next = 'segunda-feira às 7h';
    else if (day === 5) next = 'amanhã às 8h';
    return { open, next };
  };

  const duration = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return [h ? `${h}h` : '', m ? `${m}min` : ''].filter(Boolean).join(' ');
  };

  const now = () => {
    const { day, minutes } = parts(new Date());
    return { day, minutes, ...check(day, minutes) };
  };

  // Rolagem suave, ligada ao ScrollTrigger
  const smooth = () => {
    if (reduce || !window.Lenis || !window.gsap) return null;
    const lenis = new window.Lenis({ lerp: 0.12 });
    lenis.on('scroll', window.ScrollTrigger.update);
    window.gsap.ticker.add((time) => lenis.raf(time * 1000));
    window.gsap.ticker.lagSmoothing(0);
    return lenis;
  };

  // Links internos passam pela rolagem suave
  const anchors = (lenis) => {
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (event) => {
        const target = document.querySelector(link.getAttribute('href'));
        if (!target) return;
        event.preventDefault();
        if (lenis) lenis.scrollTo(target, { offset: -70 });
        else target.scrollIntoView();
      });
    });
  };

  // Desenha as fotos reservadas: <div class="foto-vaga" data-foto="Título" data-dica="o que fotografar">
  const icon = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6l1.5-2.5h5L16 6"/><circle cx="12" cy="13" r="3.5"/></svg>';
  document.querySelectorAll('.foto-vaga').forEach((box) => {
    box.innerHTML = `${icon}<strong>${box.dataset.foto || 'Foto'}</strong><span>${box.dataset.dica || ''}</span>`;
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', `Espaço reservado para foto: ${box.dataset.foto || ''}`);
  });

  window.Clinica = { reduce, hoursOf, check, duration, now, smooth, anchors };
})();
