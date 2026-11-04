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
        button.textContent = 'Número copiado';
      } catch {
        button.textContent = button.dataset.copy;
      }
      clearTimeout(timer);
      timer = setTimeout(() => { button.textContent = label; }, 2500);
    });
  });

  // Aberto ou fechado, sempre no horário de Timóteo: segunda a sexta, das 8h às 18h
  const clinicStatus = (date) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type).value;
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    const minutes = Number(get('hour')) * 60 + Number(get('minute'));
    const weekday = day >= 1 && day <= 5;

    if (weekday && minutes >= 480 && minutes < 1080) {
      return { open: true, label: 'Aberto agora', text: 'Estamos atendendo agora, até as 18h.' };
    }
    let next = 'amanhã às 8h';
    if (weekday && minutes < 480) next = 'hoje às 8h';
    else if (day === 6 || (day === 5 && minutes >= 1080)) next = 'segunda-feira às 8h';
    return { open: false, label: 'Fechado agora', text: `Estamos fechados agora. Voltamos ${next}.` };
  };

  const statusBox = document.querySelector('[data-status]');
  if (statusBox) {
    const updateStatus = () => {
      const status = clinicStatus(new Date());
      statusBox.dataset.state = status.open ? 'open' : 'closed';
      statusBox.querySelector('[data-status-label]').textContent = status.label;
      document.querySelector('[data-status-text]').textContent = status.text;
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
