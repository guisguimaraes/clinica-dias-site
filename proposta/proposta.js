(() => {
  'use strict';

  document.documentElement.classList.add('js');

  // Menu do celular
  const menuBotao = document.querySelector('[data-menu]');
  const menuLista = document.querySelector('[data-menu-lista]');

  const definirMenu = (aberto) => {
    menuBotao.setAttribute('aria-expanded', String(aberto));
    menuBotao.querySelector('.so-leitor').textContent = aberto ? 'Fechar menu' : 'Abrir menu';
    menuLista.classList.toggle('aberto', aberto);
  };

  menuBotao.addEventListener('click', (evento) => {
    evento.stopPropagation();
    definirMenu(menuBotao.getAttribute('aria-expanded') !== 'true');
  });

  document.addEventListener('click', () => definirMenu(false));

  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && menuLista.classList.contains('aberto')) {
      definirMenu(false);
      menuBotao.focus();
    }
  });

  // Carrossel da equipe: passa sozinho, para quando a pessoa mexe
  const carrossel = document.querySelector('[data-carrossel]');
  const trilho = carrossel && carrossel.querySelector('[data-carrossel-trilho]');
  const fotos = trilho ? [...trilho.querySelectorAll('img')] : [];

  if (fotos.length > 1) {
    const pontos = carrossel.querySelector('[data-carrossel-pontos]');
    const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let atual = 0;
    let timer = null;

    const botoes = fotos.map((foto, i) => {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.setAttribute('aria-label', `Foto ${i + 1} de ${fotos.length}`);
      botao.addEventListener('click', () => irPara(i));
      pontos.append(botao);
      return botao;
    });

    const marcar = (i) => {
      atual = i;
      botoes.forEach((botao, k) => botao.setAttribute('aria-current', String(k === i)));
    };

    const irPara = (i) => {
      trilho.scrollTo({ left: trilho.clientWidth * i, behavior: semMovimento ? 'auto' : 'smooth' });
      marcar(i);
    };

    trilho.addEventListener('scroll', () => {
      marcar(Math.round(trilho.scrollLeft / trilho.clientWidth));
    }, { passive: true });

    const parar = () => { clearInterval(timer); timer = null; };
    const seguir = () => {
      if (semMovimento || timer) return;
      timer = setInterval(() => irPara((atual + 1) % fotos.length), 5000);
    };

    carrossel.addEventListener('pointerenter', parar);
    carrossel.addEventListener('pointerleave', seguir);
    carrossel.addEventListener('focusin', parar);
    carrossel.addEventListener('focusout', seguir);
    trilho.addEventListener('touchstart', parar, { passive: true });
    trilho.addEventListener('keydown', (evento) => {
      if (evento.key === 'ArrowRight') irPara(Math.min(atual + 1, fotos.length - 1));
      if (evento.key === 'ArrowLeft') irPara(Math.max(atual - 1, 0));
    });

    marcar(0);
    seguir();
  }

  // Entrada das partes de cada seção
  const partes = document.querySelectorAll('[data-sobe]');

  if ('IntersectionObserver' in window) {
    const observador = new IntersectionObserver((entradas) => {
      entradas.forEach((entrada) => {
        if (entrada.isIntersecting) {
          entrada.target.classList.add('visivel');
          observador.unobserve(entrada.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });

    partes.forEach((parte) => observador.observe(parte));
  } else {
    partes.forEach((parte) => parte.classList.add('visivel'));
  }

  // Mapa: mostra a unidade escolhida
  const unidades = [
    {
      nome: 'Timóteo',
      quadro: 'https://www.google.com/maps/embed?origin=mfe&pb=!1m3!3m2!1m1!4s4223650061861704008',
      link: 'https://www.google.com/maps/place/Cl%C3%ADnica+Dias+-+Tim%C3%B3teo/data=!4m2!3m1!1s0x0:0x3a9d6b5a78d2d148',
    },
    { nome: 'Coronel Fabriciano', endereco: 'Rua Pedro Nolasco, 107 - Centro, Coronel Fabriciano - MG' },
    { nome: 'Ipatinga', endereco: 'Avenida Brasil, 700 - Iguaçu, Ipatinga - MG' },
  ];

  const mapaBotoes = [...document.querySelectorAll('[data-mapa]')];
  const mapaQuadro = document.querySelector('[data-mapa-quadro]');
  const mapaLink = document.querySelector('[data-mapa-link]');

  const mostrarUnidade = (indice) => {
    const unidade = unidades[indice];
    const busca = unidade.endereco && encodeURIComponent(unidade.endereco);
    mapaBotoes.forEach((botao, i) => botao.setAttribute('aria-pressed', String(i === indice)));
    mapaQuadro.src = unidade.quadro || `https://www.google.com/maps?q=${busca}&output=embed`;
    mapaQuadro.title = `Mapa da Clínica Dias em ${unidade.nome}`;
    mapaLink.href = unidade.link || `https://www.google.com/maps/search/?api=1&query=${busca}`;
  };

  mapaBotoes.forEach((botao, indice) => botao.addEventListener('click', () => mostrarUnidade(indice)));
  document.querySelectorAll('[data-ver-unidade]').forEach((link) => {
    link.addEventListener('click', () => mostrarUnidade(Number(link.dataset.verUnidade)));
  });

  // Explorador: cada área mostra sua foto e seu texto, e a logo em 3D dá uma volta
  const explorador = document.querySelector('[data-explorador]');
  if (!explorador) return;

  const areas = [
    {
      nome: 'Clínica Médica',
      texto: 'Consultas para avaliação, diagnóstico e tratamento, com orientação clara sobre cada passo do cuidado.',
      foto: 'esp-clinica-geral.webp',
      alt: 'Estetoscópio sobre fundo claro (imagem ilustrativa)',
    },
    {
      nome: 'Check-up',
      texto: 'Avaliações periódicas para acompanhar sua saúde e identificar precocemente qualquer alteração.',
      foto: 'esp-cardiologia.webp',
      alt: 'Modelo anatômico de coração (imagem ilustrativa)',
    },
    {
      nome: 'Exames',
      texto: 'Solicitação e acompanhamento de exames, com resultados disponíveis online de forma prática.',
      foto: 'esp-exames.webp',
      alt: 'Laboratório de análises clínicas (imagem ilustrativa)',
    },
    {
      nome: 'Hematologia',
      texto: 'Investigação e acompanhamento de alterações do sangue com atenção especializada.',
      foto: 'esp-hematologia.webp',
      alt: 'Profissional analisando amostra ao microscópio (imagem ilustrativa)',
    },
    {
      nome: 'Prevenção',
      texto: 'Orientação e cuidados preventivos para manter a qualidade de vida em todas as idades.',
      foto: 'esp-prevencao.webp',
      alt: 'Profissional de saúde atendendo paciente idosa (imagem ilustrativa)',
    },
    {
      nome: 'Acompanhamento contínuo',
      texto: 'Seguimento próximo de tratamentos e condições crônicas, com escuta e cuidado individualizado.',
      foto: 'esp-geriatria.webp',
      alt: 'Médico acompanhando paciente em leito (imagem ilustrativa)',
    },
  ];

  const botoes = [...explorador.querySelectorAll('[data-area]')];
  const foto = explorador.querySelector('[data-painel-foto]');
  const nome = explorador.querySelector('[data-painel-nome]');
  const texto = explorador.querySelector('[data-painel-texto]');

  botoes.forEach((botao, indice) => {
    botao.addEventListener('click', () => {
      const area = areas[indice];
      botoes.forEach((outro, i) => outro.setAttribute('aria-pressed', String(i === indice)));
      foto.src = `../assets/img/${area.foto}`;
      foto.alt = area.alt;
      nome.textContent = area.nome;
      texto.textContent = area.texto;
      document.dispatchEvent(new CustomEvent('area-escolhida'));
    });
  });
})();
