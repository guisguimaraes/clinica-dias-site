// Clínica Dias v2: menu do celular, painel das especialidades e anos de clínica.
(() => {
  // menu do celular
  const botaoMenu = document.querySelector('[data-menu]');
  const menu = document.getElementById('menu');
  if (botaoMenu && menu) {
    const alterna = (abrir) => {
      botaoMenu.setAttribute('aria-expanded', String(abrir));
      menu.classList.toggle('aberto', abrir);
    };
    botaoMenu.addEventListener('click', () => alterna(botaoMenu.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) alterna(false); });
  }

  // anos de clínica a partir de 2010
  document.querySelectorAll('[data-desde]').forEach((el) => {
    el.textContent = String(new Date().getFullYear() - Number(el.dataset.desde));
  });


  // privacidade: destaca no índice a seção que está na tela
  const indice = document.querySelector('[data-indice]');
  if (indice && 'IntersectionObserver' in window) {
    const links = [...indice.querySelectorAll('a[href^="#"]')];
    const alvo = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const obs = new IntersectionObserver((itens) => {
      itens.forEach((it) => {
        if (it.isIntersecting) {
          links.forEach((a) => a.classList.remove('ativo'));
          alvo.get(it.target.id)?.classList.add('ativo');
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    alvo.forEach((_, id) => { const el = document.getElementById(id); if (el) obs.observe(el); });
  }

  // galeria de Timóteo: arrastar com o mouse ou o dedo, setas e contador
  document.querySelectorAll('[data-galeria]').forEach((g) => {
    const trilho = g.querySelector('[data-galeria-trilho]');
    const conta = g.querySelector('[data-galeria-conta]');
    const total = trilho.children.length;
    const atual = () => Math.round(trilho.scrollLeft / trilho.clientWidth);
    const vai = (i) => trilho.scrollTo({ left: Math.max(0, Math.min(total - 1, i)) * trilho.clientWidth, behavior: 'smooth' });
    trilho.addEventListener('scroll', () => { conta.textContent = `${atual() + 1} / ${total}`; }, { passive: true });
    g.querySelectorAll('[data-galeria-passo]').forEach((b) => b.addEventListener('click', () => {
      const i = atual() + Number(b.dataset.galeriaPasso);
      vai(i >= total ? 0 : i < 0 ? total - 1 : i);
    }));
    trilho.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); vai(atual() + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); vai(atual() - 1); }
    });
    // arrastar com o mouse (no toque o navegador já rola sozinho)
    let inicio = null;
    trilho.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      inicio = { x: e.clientX, s: trilho.scrollLeft, i: atual() };
      trilho.classList.add('arrastando');
      trilho.setPointerCapture(e.pointerId);
    });
    trilho.addEventListener('pointermove', (e) => { if (inicio) trilho.scrollLeft = inicio.s - (e.clientX - inicio.x); });
    const solta = (e) => {
      if (!inicio) return;
      const dx = e.clientX - inicio.x;
      trilho.classList.remove('arrastando');
      vai(Math.abs(dx) > trilho.clientWidth * 0.15 ? inicio.i + (dx < 0 ? 1 : -1) : inicio.i);
      inicio = null;
    };
    trilho.addEventListener('pointerup', solta);
    trilho.addEventListener('pointercancel', solta);
  });

  // especialidades: o nome abre o painel no canto (mesmo desenho dos pontos do passeio 3D)
  const explicacoes = {
    'Anestesiologia': 'Cuida da anestesia antes, durante e depois de cirurgias e exames, para que o paciente não sinta dor e fique seguro. O anestesista avalia a saúde de cada pessoa e escolhe o tipo de anestesia mais indicado.',
    'Cardiologia': 'Cuida do coração e dos vasos sanguíneos. Previne, investiga e trata problemas como pressão alta, arritmia, colesterol alto e insuficiência cardíaca, e avalia quem vai passar por cirurgia ou começar atividade física.',
    'Cirurgia Vascular': 'Cuida das veias e artérias. Trata varizes, má circulação nas pernas, tromboses e outras doenças que dificultam a passagem do sangue pelo corpo.',
    'Clínica Geral': 'É a porta de entrada do cuidado. O clínico geral avalia a saúde como um todo, trata as doenças mais comuns, pede exames de rotina e, quando precisa, encaminha para a especialidade certa.',
    'Coloproctologia': 'Cuida do intestino grosso, do reto e do ânus. Trata hemorroidas, fissuras, prisão de ventre e outras queixas intestinais, e participa da prevenção do câncer de intestino.',
    'Dermatologia': 'Cuida da pele, dos cabelos e das unhas. Trata acne, manchas, alergias, micoses e queda de cabelo, e acompanha pintas e lesões que precisam de atenção.',
    'Endocrinologia': 'Cuida dos hormônios e do metabolismo. Trata diabetes, problemas de tireoide, obesidade, colesterol alto e outras alterações hormonais.',
    'Endoscopia': 'Exame que usa uma câmera fina e flexível para ver por dentro o esôfago, o estômago e o começo do intestino. Ajuda a investigar azia, dor no estômago, gastrite, úlcera e outras queixas digestivas.',
    'Fonoaudiologia': 'Cuida da fala, da voz, da audição, da linguagem e da deglutição. Atende crianças com atraso na fala, adultos com rouquidão ou dificuldade para engolir e pessoas com perda auditiva.',
    'Gastroenterologia': 'Cuida de todo o sistema digestivo: esôfago, estômago, intestino, fígado e pâncreas. Trata refluxo, gastrite, intestino irritável, problemas no fígado e outras queixas da digestão.',
    'Geriatria': 'Cuida da saúde da pessoa idosa. Acompanha várias doenças ao mesmo tempo, organiza os remédios e ajuda a manter a memória, o equilíbrio e a independência no dia a dia.',
    'Ginecologia e Obstetrícia': 'Cuida da saúde da mulher em todas as fases da vida. A ginecologia faz os exames preventivos e trata questões do útero, dos ovários e das mamas; a obstetrícia acompanha a gravidez, o parto e o pós-parto.',
    'Hematologia': 'Cuida do sangue e dos órgãos que o produzem. Investiga e trata anemias, alterações nas plaquetas e na coagulação e outras doenças do sangue.',
    'Infectologia': 'Cuida das doenças causadas por vírus, bactérias, fungos e parasitas. Trata infecções que se repetem ou são difíceis de curar e orienta sobre vacinas e prevenção.',
    'Mastologia': 'Cuida das mamas. Faz a prevenção e o diagnóstico precoce do câncer de mama e avalia nódulos, dores e outras alterações nas mamas.',
    'Nefrologia': 'Cuida dos rins. Trata pedras nos rins, infecções urinárias que se repetem e pressão alta ligada aos rins, e acompanha quem tem doença renal crônica.',
    'Neurologia': 'Cuida do cérebro, da medula e dos nervos. Trata dor de cabeça, enxaqueca, tontura, convulsões, problemas de memória, AVC e formigamentos.',
    'Nutrição': 'Ajuda a organizar a alimentação de acordo com a rotina, os objetivos e a saúde de cada pessoa. O nutricionista monta o plano alimentar para emagrecer, ganhar massa, controlar doenças ou comer melhor.',
    'Nutrologia': 'Especialidade médica que cuida da relação entre a alimentação e a saúde. O nutrólogo investiga falta de vitaminas e minerais, trata obesidade e desnutrição e pode pedir exames e receitar suplementos ou remédios.',
    'Odontologia': 'Cuida da saúde da boca e dos dentes. Faz limpeza, restaurações, tratamento de canal e prevenção de cáries e de problemas na gengiva.',
    'Oftalmologia': 'Cuida dos olhos e da visão. Avalia o grau dos óculos e trata catarata, glaucoma, conjuntivite, olho seco e outras doenças dos olhos.',
    'Ortopedia e Traumatologia': 'Cuida dos ossos, músculos, articulações e coluna. Trata dores nas costas, no joelho e no ombro, lesões do esporte, fraturas e torções.',
    'Pediatria Geral': 'Cuida da saúde de crianças e adolescentes. Acompanha o crescimento e o desenvolvimento, orienta sobre vacinas e alimentação e trata as doenças da infância.',
    'Pneumologia': 'Cuida dos pulmões e da respiração. Trata asma, bronquite, falta de ar, tosse que não passa, apneia do sono e outras doenças respiratórias.',
    'Psicanálise': 'Forma de terapia pela fala. Ajuda a pessoa a entender seus sentimentos, conflitos e padrões de comportamento, olhando com calma para a própria história.',
    'Psicologia': 'Cuida da saúde emocional. O psicólogo ajuda a lidar com ansiedade, tristeza, estresse, luto, relacionamentos e momentos difíceis por meio da psicoterapia.',
    'Psicopedagogia': 'Cuida da forma como a pessoa aprende. Ajuda crianças, jovens e adultos com dificuldade de leitura, escrita, atenção e aprendizado na escola ou no trabalho.',
    'Psiquiatria': 'Especialidade médica que cuida da saúde mental. Diagnostica e trata depressão, ansiedade, insônia, transtorno bipolar, TDAH e outras condições, e receita remédios quando é preciso.',
    'Reumatologia': 'Cuida das articulações, dos músculos e do sistema de defesa do corpo. Trata artrite, artrose, gota, fibromialgia, lúpus e outras doenças que causam dor e inflamação.',
  };

  const botoes = [...document.querySelectorAll('[data-especialidades] button')];
  const painel = document.getElementById('painel');
  if (!painel || !botoes.length) return;
  const titulo = painel.querySelector('#painel-titulo');
  const texto = painel.querySelector('#painel-texto');
  let atual = -1;
  let origem = null;

  function abre(i, focar = true) {
    atual = (i + botoes.length) % botoes.length;
    const nome = botoes[atual].textContent.trim();
    titulo.textContent = nome;
    texto.textContent = explicacoes[nome] || '';
    botoes.forEach((b, k) => b.setAttribute('aria-pressed', String(k === atual)));
    painel.hidden = false;
    requestAnimationFrame(() => painel.classList.add('aberto'));
    if (focar) painel.querySelector('[data-painel-fechar]').focus({ preventScroll: true });
  }
  function fecha() {
    painel.classList.remove('aberto');
    botoes.forEach((b) => b.setAttribute('aria-pressed', 'false'));
    setTimeout(() => { if (!painel.classList.contains('aberto')) painel.hidden = true; }, 400);
    if (origem) origem.focus({ preventScroll: true });
    atual = -1;
  }

  botoes.forEach((b, i) => {
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-controls', 'painel');
    b.addEventListener('click', () => { origem = b; atual === i ? fecha() : abre(i); });
  });
  painel.querySelector('[data-painel-fechar]').addEventListener('click', fecha);
  painel.querySelectorAll('[data-passo]').forEach((b) => {
    b.addEventListener('click', () => abre(atual + Number(b.dataset.passo), false));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !painel.hidden) fecha();
  });
})();

// CardFácil: a carteirinha flutua em diagonal (como a referência), balança de leve e, a cada 8 s, vira para mostrar o verso
// (nunca fica parada de lado). Arrastar gira com a mão; ao soltar, ela assenta no lado mais perto.
// Para quem pede menos movimento, fica parada de frente (o arrasto continua).
(() => {
  const palco = document.querySelector('[data-cf-palco]');
  if (!palco) return;
  const giro = palco.querySelector('[data-cf-giro]');
  const cena = palco.querySelector('.cf-cena');
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const VIRA_A_CADA = 8, BASE_X = 18;
  let lado = 0, ang = -24, t = 0, desdeVirada = 0, arrasto = null, inclX = BASE_X, alvoX = BASE_X, visivel = false, ant = 0, quadro = 0;

  const desenha = () => {
    giro.style.transform = `rotateY(${ang}deg)`;
    const flutua = reduzido ? 0 : Math.sin(t * 0.9) * 10;
    cena.style.transform = `translateY(${flutua}px) rotateX(${inclX}deg) rotateZ(-26deg)`;
    const r = (ang * Math.PI) / 180;
    giro.style.setProperty('--brilho', `${Math.sin(r * 2 + t * 0.6) * -40}%`);
    palco.style.setProperty('--sombra', (0.5 + 0.5 * Math.abs(Math.cos(r))).toFixed(3));
  };
  const passo = (now) => {
    const dt = Math.min((now - (ant || now)) / 1000, 0.05);
    ant = now;
    if (!arrasto) {
      t += dt;
      desdeVirada += dt;
      if (!reduzido && desdeVirada > VIRA_A_CADA) { lado += 180; desdeVirada = 0; }
      const balanco = reduzido ? -24 : Math.sin(t * 0.8) * 10 - 24;
      ang += (lado + balanco - ang) * (1 - Math.exp(-dt * 2.6));
    }
    inclX += (alvoX - inclX) * (1 - Math.exp(-dt * 6));
    desenha();
    quadro = visivel ? requestAnimationFrame(passo) : 0;
  };
  const liga = () => { if (!quadro) { ant = 0; quadro = requestAnimationFrame(passo); } };
  new IntersectionObserver(([e]) => { visivel = e.isIntersecting; if (visivel) liga(); }).observe(palco);

  palco.addEventListener('pointerdown', (e) => {
    arrasto = { x: e.clientX };
    palco.setPointerCapture(e.pointerId);
  });
  palco.addEventListener('pointermove', (e) => {
    const caixa = palco.getBoundingClientRect();
    alvoX = BASE_X - ((e.clientY - caixa.top) / caixa.height - 0.5) * 14;
    if (!arrasto) return;
    ang += (e.clientX - arrasto.x) * 0.5;
    arrasto.x = e.clientX;
    liga();
  });
  const solta = () => {
    if (!arrasto) return;
    arrasto = null;
    lado = Math.round(ang / 180) * 180; // assenta na frente ou no verso, o que estiver mais perto
    desdeVirada = 0;
  };
  palco.addEventListener('pointerup', solta);
  palco.addEventListener('pointercancel', solta);
  palco.addEventListener('pointerleave', () => { alvoX = BASE_X; });
  desenha();
})();

// Avaliações do Google: a seção só aparece com avaliações reais, puxadas da API do Google Places
// (chave em data-chave do #avaliacoes). Guarda a resposta por 12 h para não gastar a cota.
(() => {
  const av = document.querySelector('[data-avaliacoes]');
  if (!av) return;
  const lista = av.querySelector('[data-av-lista]');
  const nota = av.querySelector('[data-av-nota]');
  const link = av.querySelector('[data-av-link]');
  const chave = (av.dataset.chave || '').trim();
  const NS = 'http://www.w3.org/2000/svg';

  const estrelas = (n) => {
    const box = document.createElement('span');
    box.className = 'av-estrelas';
    box.setAttribute('aria-label', `${n} de 5 estrelas`);
    for (let i = 1; i <= 5; i++) {
      const s = document.createElementNS(NS, 'svg');
      s.setAttribute('viewBox', '0 0 24 24');
      s.setAttribute('aria-hidden', 'true');
      if (i > Math.round(n)) s.classList.add('apagada');
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', 'M12 2.5l2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 17.2l-5.9 3.3 1.4-6.6-5-4.5 6.6-.7z');
      s.append(p);
      box.append(s);
    }
    return box;
  };
  const logoG = () => {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 48 48');
    s.setAttribute('class', 'av-g');
    s.setAttribute('aria-hidden', 'true');
    [['#4285F4', 'M45 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8a10 10 0 0 1-4.4 6.6v5.5h7.1C42.6 36.8 45 31.2 45 24.5z'],
     ['#34A853', 'M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7A22 22 0 0 0 24 46z'],
     ['#FBBC05', 'M11.8 28.2a13 13 0 0 1 0-8.4v-5.7H4.5a22 22 0 0 0 0 19.8z'],
     ['#EA4335', 'M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3A22 22 0 0 0 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z']]
      .forEach(([c, d]) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('fill', c); p.setAttribute('d', d); s.append(p); });
    return s;
  };
  const iniciais = (nome) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

  const cartao = (r, exemplo) => {
    const li = document.createElement('li');
    li.className = 'av-card' + (exemplo ? ' exemplo' : '');
    const quem = document.createElement('div');
    quem.className = 'av-quem';
    let foto;
    if (r.foto) {
      foto = document.createElement('img');
      foto.src = r.foto; foto.alt = ''; foto.loading = 'lazy'; foto.referrerPolicy = 'no-referrer';
    } else {
      foto = document.createElement('span');
      foto.textContent = iniciais(r.nome);
      foto.setAttribute('aria-hidden', 'true');
    }
    foto.classList.add('av-foto');
    const nome = document.createElement('div');
    nome.className = 'av-nome';
    const b = document.createElement('b');
    b.textContent = r.nome;
    nome.append(b, estrelas(r.nota));
    quem.append(foto, nome, logoG());
    const texto = document.createElement('p');
    texto.className = 'av-texto';
    texto.textContent = r.texto;
    const quando = document.createElement('p');
    quando.className = 'av-quando';
    quando.textContent = r.quando || '';
    li.append(quem, texto, quando);
    return li;
  };

  const mostra = ({ nota: media, total, itens, url }, exemplo = false) => {
    if (!itens.length) return;
    lista.replaceChildren(...itens.map((r) => cartao(r, exemplo)));
    nota.replaceChildren();
    if (media) {
      const b = document.createElement('b');
      b.textContent = media.toFixed(1).replace('.', ',');
      const t = document.createElement('span');
      t.textContent = total ? `${total} avaliações no Google` : 'no Google';
      nota.append(b, estrelas(media), t);
    } else {
      const t = document.createElement('span');
      t.textContent = 'Avaliações reais de pacientes no Google';
      nota.append(estrelas(5), t);
    }
    if (url) link.href = url;
    av.hidden = false;
    document.dispatchEvent(new CustomEvent('avaliacoes:prontas')); // anima.js monta a seção com os cartões novos
  };

  // sem chave: as avaliações copiadas do Google que estão no HTML
  const fixas = (() => { try { return JSON.parse(av.querySelector('[data-av-fixas]')?.textContent || '[]'); } catch (e) { return []; } })();
  if (!chave) {
    mostra({ itens: fixas.map((r) => ({ ...r, quando: r.quando || 'Avaliação no Google' })) });
    return;
  }

  const CACHE = 'clinicadias-avaliacoes-v1';
  try {
    const salvo = JSON.parse(localStorage.getItem(CACHE) || 'null');
    if (salvo && Date.now() - salvo.em < 12 * 3600e3) { mostra(salvo.dados); return; }
  } catch (e) { /* sem armazenamento: busca de novo */ }

  fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': chave,
      'X-Goog-FieldMask': 'places.rating,places.userRatingCount,places.reviews,places.googleMapsUri',
    },
    body: JSON.stringify({ textQuery: av.dataset.busca, languageCode: 'pt-BR' }),
  })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((j) => {
      const lugar = j.places && j.places[0];
      if (!lugar) return;
      const itens = (lugar.reviews || [])
        .filter((r) => r.rating >= 4 && (r.text?.text || r.originalText?.text))
        .map((r) => ({
          nome: r.authorAttribution?.displayName || 'Paciente',
          foto: r.authorAttribution?.photoUri || '',
          nota: r.rating,
          texto: r.text?.text || r.originalText?.text,
          quando: r.relativePublishTimeDescription || '',
        }));
      const dados = { nota: lugar.rating, total: lugar.userRatingCount, itens, url: lugar.googleMapsUri };
      try { localStorage.setItem(CACHE, JSON.stringify({ em: Date.now(), dados })); } catch (e) { /* ok */ }
      mostra(dados);
    })
    .catch((e) => {
      console.warn('[avaliações] Google não respondeu', e);
      mostra({ itens: fixas.map((r) => ({ ...r, quando: r.quando || 'Avaliação no Google' })) });
    });
})();
