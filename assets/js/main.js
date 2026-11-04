(() => {
  'use strict';

  document.documentElement.classList.add('js');

  const header = document.querySelector('[data-header]');
  const toggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');

  const setMenuOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.sr-only').textContent = open ? 'Fechar menu' : 'Abrir menu';
    nav.classList.toggle('is-open', open);
  };

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      setMenuOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        setMenuOpen(false);
        toggle.focus();
      }
    });

    document.addEventListener('click', (event) => {
      if (nav.classList.contains('is-open') && !nav.contains(event.target) && !toggle.contains(event.target)) {
        setMenuOpen(false);
      }
    });

    window.matchMedia('(min-width: 1081px)').addEventListener('change', (event) => {
      if (event.matches) {
        setMenuOpen(false);
      }
    });
  }

  if (header) {
    const updateHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });
  }

  // Abas: painel do topo e áreas de atendimento
  document.querySelectorAll('[role="tablist"]').forEach((list) => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];

    const selectTab = (tab, focus) => {
      tabs.forEach((item) => {
        const active = item === tab;
        item.setAttribute('aria-selected', String(active));
        item.tabIndex = active ? 0 : -1;
        document.getElementById(item.getAttribute('aria-controls')).classList.toggle('is-active', active);
      });
      if (focus) tab.focus();
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => selectTab(tab));
      tab.addEventListener('keydown', (event) => {
        const last = tabs.length - 1;
        const next = index === last ? 0 : index + 1;
        const previous = index === 0 ? last : index - 1;
        const target = { ArrowRight: next, ArrowDown: next, ArrowLeft: previous, ArrowUp: previous, Home: 0, End: last }[event.key];
        if (target === undefined) return;
        event.preventDefault();
        selectTab(tabs[target], true);
      });
    });
  });

  // Especialidades: abre a coluna ao clicar, ou ao passar o mouse no computador
  document.querySelectorAll('[data-spec]').forEach((spec) => {
    const panels = [...spec.querySelectorAll('.spec-panel')];
    const hoverQuery = window.matchMedia('(hover: hover) and (min-width: 861px)');
    let lastX = null;
    let lastY = null;

    const open = (panel) => {
      if (panel.classList.contains('is-open')) return;
      panels.forEach((item) => {
        const active = item === panel;
        item.classList.toggle('is-open', active);
        item.querySelector('.spec-tab').setAttribute('aria-expanded', String(active));
      });
    };

    panels.forEach((panel) => {
      panel.querySelector('.spec-tab').addEventListener('click', () => open(panel));
      // Só quando o mouse anda: com a página rolando e o mouse parado, nada abre sozinho
      panel.addEventListener('pointermove', (event) => {
        const moved = event.clientX !== lastX || event.clientY !== lastY;
        lastX = event.clientX;
        lastY = event.clientY;
        if (event.pointerType === 'mouse' && hoverQuery.matches && moved) open(panel);
      });
    });
  });

  // Foto do topo: arrastar troca a fachada pela equipe. Uma cruz, a do logo,
  // nasce no ponto onde a pessoa pegou e cresce até tomar o quadro.
  const slides = document.querySelector('[data-slides]');
  if (slides) {
    const team = slides.querySelector('[data-team]');
    const cross = slides.querySelector('[data-cross]');
    const facade = slides.querySelector('.hero-bg');
    const photo = slides.querySelector('.team-photo');
    const word = slides.querySelector('.team-word');
    const toggle = document.querySelector('[data-slides-toggle]');
    const label = document.querySelector('[data-slides-label]');
    const sub = document.querySelector('[data-slides-sub]');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const clamp01 = (value) => Math.min(1, Math.max(0, value));

    let progress = 0;
    let target = 0;
    let originX = 0.36;
    let originY = 0.55;
    let frame = null;

    const crossShape = (cx, cy, arm, length, angle) => {
      const points = [
        [-arm, -length], [arm, -length], [arm, -arm], [length, -arm], [length, arm], [arm, arm],
        [arm, length], [-arm, length], [-arm, arm], [-length, arm], [-length, -arm], [-arm, -arm],
      ];
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const list = points.map(([x, y]) => `${(cx + x * cos - y * sin).toFixed(1)}px ${(cy + x * sin + y * cos).toFixed(1)}px`);
      return `polygon(${list.join(',')})`;
    };

    const render = () => {
      const p = progress;
      const shown = p > 0.001;
      const full = p > 0.999;
      team.hidden = !shown;
      cross.hidden = !shown || full;
      facade.style.transform = shown ? `scale(${1 + p * 0.08})` : '';
      if (shown) {
        const rest = 1 - p;
        photo.style.transform = `translateX(calc(-50% + ${rest * 70}px)) scale(${1.08 - p * 0.08})`;
        word.style.transform = `translateX(calc(-50% - ${rest * 190}px))`;
        word.style.opacity = String(Math.min(1, p * 1.4));
      }
      if (!shown) return;
      if (full) {
        team.style.clipPath = 'none';
        return;
      }
      const { width, height } = slides.getBoundingClientRect();
      const cx = originX * width;
      const cy = originY * height;
      const reach = Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy));
      const arm = reach * p ** 1.9;
      const length = arm * 2.4 + 18 * p;
      const angle = (1 - p) * 0.9;
      const edge = 9 * (1 - p);
      team.style.clipPath = crossShape(cx, cy, arm, length, angle);
      cross.style.clipPath = crossShape(cx, cy, arm + edge, length + edge, angle);
    };

    const settle = (to) => {
      target = to;
      toggle.setAttribute('aria-pressed', String(to === 1));
      label.textContent = 'Arraste a foto';
      sub.textContent = to === 1 ? 'para voltar à fachada' : 'para conhecer a equipe';
      cancelAnimationFrame(frame);
      if (calm.matches) {
        progress = to;
        render();
        return;
      }
      const from = progress;
      const distance = Math.abs(to - from);
      const duration = 350 + 550 * distance;
      const start = performance.now();
      const step = (now) => {
        const t = clamp01((now - start) / duration);
        progress = from + (to - from) * (1 - (1 - t) ** 3);
        render();
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };

    toggle.addEventListener('click', () => {
      toggle.classList.add('is-used');
      if (target === 0) {
        originX = 0.36;
        originY = 0.55;
      }
      settle(target === 1 ? 0 : 1);
    });

    let drag = null;

    slides.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const rect = slides.getBoundingClientRect();
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, from: target, width: rect.width, rect, active: false };
    });

    window.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.active) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
          drag = null;
          return;
        }
        if (Math.abs(dx) < 8) return;
        drag.active = true;
        cancelAnimationFrame(frame);
        slides.classList.add('is-dragging');
        toggle.classList.add('is-used');
        if (drag.from === 0) {
          originX = clamp01((drag.x - drag.rect.left) / drag.rect.width);
          originY = clamp01((drag.y - drag.rect.top) / drag.rect.height);
        }
      }
      const moved = Math.abs(dx) / (drag.width * 0.42);
      progress = clamp01(drag.from === 0 ? moved : 1 - moved);
      render();
    });

    const release = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const { active, from } = drag;
      drag = null;
      slides.classList.remove('is-dragging');
      if (!active) return;
      settle((from === 0 ? progress > 0.3 : progress > 0.7) ? 1 : 0);
    };

    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('resize', render);
  }

  // Como funciona: a etapa aberta troca a foto ao lado
  document.querySelectorAll('[data-steps]').forEach((box) => {
    const steps = [...box.querySelectorAll('.step')];
    const photos = [...box.querySelectorAll('.journey-photos img')];
    photos.forEach((photo) => { photo.loading = 'eager'; });
    steps.forEach((step, index) => {
      step.querySelector('.step-tab').addEventListener('click', () => {
        steps.forEach((item, i) => {
          item.classList.toggle('is-open', i === index);
          item.querySelector('.step-tab').setAttribute('aria-expanded', String(i === index));
          photos[i].classList.toggle('is-active', i === index);
        });
      });
    });
  });

  // Como chegar: o botão de rota acompanha o jeito que a pessoa vem
  const routeGroup = document.querySelector('[data-route]');
  if (routeGroup) {
    const link = document.querySelector('[data-route-link]');
    const text = document.querySelector('[data-route-text]');
    const waze = document.querySelector('[data-route-waze]');
    const modes = [...routeGroup.querySelectorAll('[data-mode]')];
    modes.forEach((mode) => {
      mode.addEventListener('click', () => {
        modes.forEach((item) => item.setAttribute('aria-pressed', String(item === mode)));
        const url = new URL(link.href);
        url.searchParams.set('travelmode', mode.dataset.mode);
        link.href = url.href;
        text.textContent = `Traçar rota ${mode.dataset.word}`;
        waze.hidden = mode.dataset.mode !== 'driving';
      });
    });
  }

  const copyText = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.append(field);
    field.select();
    const ok = document.execCommand('copy');
    field.remove();
    if (!ok) throw new Error('copy failed');
  };

  document.querySelectorAll('[data-copy]').forEach((button) => {
    const label = button.textContent;
    let timer;
    button.addEventListener('click', async () => {
      try {
        await copyText(button.dataset.copy);
        button.textContent = button.dataset.copied || 'Número copiado';
      } catch {
        button.textContent = button.dataset.copy;
      }
      clearTimeout(timer);
      timer = setTimeout(() => { button.textContent = label; }, 2500);
    });
  });

  // Aberto ou fechado, sempre no horário de Timóteo: seg. a sex. das 7h às 22h, sábado das 8h às 19h
  const clinicStatus = (date) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type).value;
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    const minutes = Number(get('hour')) * 60 + Number(get('minute'));
    const opens = day === 0 ? null : day === 6 ? 480 : 420;
    const closes = day === 6 ? 1140 : 1320;

    if (opens !== null && minutes >= opens && minutes < closes) {
      return { open: true, day, left: closes - minutes, label: 'Aberto agora', text: `Estamos atendendo agora, até as ${closes / 60}h.` };
    }
    let next = 'amanhã às 7h';
    if (opens !== null && minutes < opens) next = `hoje às ${opens / 60}h`;
    else if (day === 6) next = 'segunda-feira às 7h';
    else if (day === 5) next = 'amanhã às 8h';
    return { open: false, day, next, label: 'Fechado agora', text: `Estamos fechados agora. Voltamos ${next}.` };
  };

  const statusBox = document.querySelector('[data-status]');
  if (statusBox) {
    const updateStatus = () => {
      const status = clinicStatus(new Date());
      statusBox.dataset.state = status.open ? 'open' : 'closed';
      statusBox.querySelector('[data-status-label]').textContent = status.label;
      document.querySelector('[data-status-text]').textContent = status.text;

      const visitStatus = document.querySelector('[data-visit-status]');
      if (visitStatus) {
        const hours = Math.floor((status.left || 0) / 60);
        const rest = (status.left || 0) % 60;
        const time = [hours ? `${hours}h` : '', rest ? `${rest}min` : ''].filter(Boolean).join(' ');
        visitStatus.textContent = status.open ? `Aberto agora. Fecha em ${time}.` : `Fechado agora. Voltamos ${status.next}.`;
        document.querySelectorAll('.visit-week li').forEach((item) => {
          item.classList.toggle('is-today', Number(item.dataset.day) === status.day);
        });
      }
    };
    updateStatus();
    setInterval(updateStatus, 60000);
  }

  const revealItems = document.querySelectorAll('.reveal');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!('IntersectionObserver' in window) || reduceMotion) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );

  revealItems.forEach((item) => observer.observe(item));
})();
