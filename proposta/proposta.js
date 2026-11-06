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
  const partes = document.querySelectorAll('[data-sobe], [data-convenios]');

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

  // Mapa: mostra a unidade escolhida, com rota, Waze e telefone
  const unidades = [
    {
      nome: 'Timóteo',
      endereco: 'Rua Cento e Vinte e Oito, 14 · Santa Maria',
      busca: 'Rua Cento e Vinte e Oito, 14 - Santa Maria, Timóteo - MG',
      tel: '+553138496156',
      quadro: 'https://www.google.com/maps/embed?origin=mfe&pb=!1m3!3m2!1m1!4s4223650061861704008',
    },
    {
      nome: 'Coronel Fabriciano',
      endereco: 'Rua Pedro Nolasco, 107 · Centro',
      busca: 'Rua Pedro Nolasco, 107 - Centro, Coronel Fabriciano - MG',
      tel: '+5531997600755',
    },
    {
      nome: 'Ipatinga',
      endereco: 'Avenida Brasil, 700 · Iguaçu',
      busca: 'Avenida Brasil, 700 - Iguaçu, Ipatinga - MG',
      tel: '+5531997454281',
    },
  ];

  const mapaBotoes = [...document.querySelectorAll('[data-mapa]')];
  const mapaQuadro = document.querySelector('[data-mapa-quadro]');
  const mapaCartao = document.querySelector('.mapa-cartao');

  const mostrarUnidade = (indice) => {
    const unidade = unidades[indice];
    const busca = encodeURIComponent(unidade.busca);
    mapaBotoes.forEach((botao, i) => botao.setAttribute('aria-pressed', String(i === indice)));
    mapaQuadro.src = unidade.quadro || `https://www.google.com/maps?q=${busca}&output=embed`;
    mapaQuadro.title = `Mapa da Clínica Dias em ${unidade.nome}`;
    mapaCartao.querySelector('[data-mapa-cidade]').textContent = unidade.nome;
    mapaCartao.querySelector('[data-mapa-endereco]').textContent = unidade.endereco;
    mapaCartao.querySelector('[data-mapa-rota]').href = `https://www.google.com/maps/dir/?api=1&destination=${busca}`;
    mapaCartao.querySelector('[data-mapa-waze]').href = `https://waze.com/ul?q=${busca}&navigate=yes`;
    mapaCartao.querySelector('[data-mapa-tel]').href = `tel:${unidade.tel}`;
    mapaCartao.classList.remove('trocou');
    void mapaCartao.offsetWidth;
    mapaCartao.classList.add('trocou');
  };

  mapaBotoes.forEach((botao, indice) => botao.addEventListener('click', () => mostrarUnidade(indice)));
  document.querySelectorAll('[data-ver-unidade]').forEach((link) => {
    link.addEventListener('click', () => mostrarUnidade(Number(link.dataset.verUnidade)));
  });

  // Especialidades: os nomes acendem um a um conforme a página rola
  const parede = document.querySelector('[data-parede]');

  if (parede) {
    const nomes = [...parede.children];
    const semMovimentoParede = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (semMovimentoParede) {
      nomes.forEach((nome) => nome.classList.add('acesa'));
    } else {
      let pedido = 0;
      const acender = () => {
        pedido = 0;
        const caixa = parede.getBoundingClientRect();
        const altura = window.innerHeight;
        // Começa quando o topo da parede entra na tela e termina quando o fim dela aparece
        const inicio = altura * 0.9;
        const percurso = Math.max(1, caixa.height + inicio - altura * 0.92);
        const progresso = Math.min(1, Math.max(0, (inicio - caixa.top) / percurso));
        const quantas = Math.round(progresso * nomes.length);
        nomes.forEach((nome, i) => nome.classList.toggle('acesa', i < quantas));
      };
      const pedir = () => {
        if (!pedido) pedido = requestAnimationFrame(acender);
      };
      window.addEventListener('scroll', pedir, { passive: true });
      window.addEventListener('resize', pedir);
      acender();
    }
  }

  // Especialidades: clicar no nome abre a explicação
  const modal = document.querySelector('[data-esp-modal]');

  if (modal && typeof modal.showModal === 'function') {
    const explicacoes = {
      "Anestesiologia": "Cuida da anestesia antes, durante e depois de cirurgias e exames, para que o paciente não sinta dor e fique seguro. O anestesista avalia a saúde de cada pessoa e escolhe o tipo de anestesia mais indicado.",
      "Cardiologia": "Cuida do coração e dos vasos sanguíneos. Previne, investiga e trata problemas como pressão alta, arritmia, colesterol alto e insuficiência cardíaca, e avalia quem vai passar por cirurgia ou começar atividade física.",
      "Cirurgia Vascular": "Cuida das veias e artérias. Trata varizes, má circulação nas pernas, tromboses e outras doenças que dificultam a passagem do sangue pelo corpo.",
      "Clínica Geral": "É a porta de entrada do cuidado. O clínico geral avalia a saúde como um todo, trata as doenças mais comuns, pede exames de rotina e, quando precisa, encaminha para a especialidade certa.",
      "Coloproctologia": "Cuida do intestino grosso, do reto e do ânus. Trata hemorroidas, fissuras, prisão de ventre e outras queixas intestinais, e participa da prevenção do câncer de intestino.",
      "Dermatologia": "Cuida da pele, dos cabelos e das unhas. Trata acne, manchas, alergias, micoses e queda de cabelo, e acompanha pintas e lesões que precisam de atenção.",
      "Endocrinologia": "Cuida dos hormônios e do metabolismo. Trata diabetes, problemas de tireoide, obesidade, colesterol alto e outras alterações hormonais.",
      "Endoscopia": "Exame que usa uma câmera fina e flexível para ver por dentro o esôfago, o estômago e o começo do intestino. Ajuda a investigar azia, dor no estômago, gastrite, úlcera e outras queixas digestivas.",
      "Fonoaudiologia": "Cuida da fala, da voz, da audição, da linguagem e da deglutição. Atende crianças com atraso na fala, adultos com rouquidão ou dificuldade para engolir e pessoas com perda auditiva.",
      "Gastroenterologia": "Cuida de todo o sistema digestivo: esôfago, estômago, intestino, fígado e pâncreas. Trata refluxo, gastrite, intestino irritável, problemas no fígado e outras queixas da digestão.",
      "Geriatria": "Cuida da saúde da pessoa idosa. Acompanha várias doenças ao mesmo tempo, organiza os remédios e ajuda a manter a memória, o equilíbrio e a independência no dia a dia.",
      "Ginecologia e Obstetrícia": "Cuida da saúde da mulher em todas as fases da vida. A ginecologia faz os exames preventivos e trata questões do útero, dos ovários e das mamas; a obstetrícia acompanha a gravidez, o parto e o pós-parto.",
      "Hematologia": "Cuida do sangue e dos órgãos que o produzem. Investiga e trata anemias, alterações nas plaquetas e na coagulação e outras doenças do sangue.",
      "Infectologia": "Cuida das doenças causadas por vírus, bactérias, fungos e parasitas. Trata infecções que se repetem ou são difíceis de curar e orienta sobre vacinas e prevenção.",
      "Mastologia": "Cuida das mamas. Faz a prevenção e o diagnóstico precoce do câncer de mama e avalia nódulos, dores e outras alterações nas mamas.",
      "Nefrologia": "Cuida dos rins. Trata pedras nos rins, infecções urinárias que se repetem e pressão alta ligada aos rins, e acompanha quem tem doença renal crônica.",
      "Neurologia": "Cuida do cérebro, da medula e dos nervos. Trata dor de cabeça, enxaqueca, tontura, convulsões, problemas de memória, AVC e formigamentos.",
      "Nutrição": "Ajuda a organizar a alimentação de acordo com a rotina, os objetivos e a saúde de cada pessoa. O nutricionista monta o plano alimentar para emagrecer, ganhar massa, controlar doenças ou comer melhor.",
      "Nutrologia": "Especialidade médica que cuida da relação entre a alimentação e a saúde. O nutrólogo investiga falta de vitaminas e minerais, trata obesidade e desnutrição e pode pedir exames e receitar suplementos ou remédios.",
      "Odontologia": "Cuida da saúde da boca e dos dentes. Faz limpeza, restaurações, tratamento de canal e prevenção de cáries e de problemas na gengiva.",
      "Oftalmologia": "Cuida dos olhos e da visão. Avalia o grau dos óculos e trata catarata, glaucoma, conjuntivite, olho seco e outras doenças dos olhos.",
      "Ortopedia e Traumatologia": "Cuida dos ossos, músculos, articulações e coluna. Trata dores nas costas, no joelho e no ombro, lesões do esporte, fraturas e torções.",
      "Pediatria Geral": "Cuida da saúde de crianças e adolescentes. Acompanha o crescimento e o desenvolvimento, orienta sobre vacinas e alimentação e trata as doenças da infância.",
      "Pneumologia": "Cuida dos pulmões e da respiração. Trata asma, bronquite, falta de ar, tosse que não passa, apneia do sono e outras doenças respiratórias.",
      "Psicanálise": "Forma de terapia pela fala. Ajuda a pessoa a entender seus sentimentos, conflitos e padrões de comportamento, olhando com calma para a própria história.",
      "Psicologia": "Cuida da saúde emocional. O psicólogo ajuda a lidar com ansiedade, tristeza, estresse, luto, relacionamentos e momentos difíceis por meio da psicoterapia.",
      "Psicopedagogia": "Cuida da forma como a pessoa aprende. Ajuda crianças, jovens e adultos com dificuldade de leitura, escrita, atenção e aprendizado na escola ou no trabalho.",
      "Psiquiatria": "Especialidade médica que cuida da saúde mental. Diagnostica e trata depressão, ansiedade, insônia, transtorno bipolar, TDAH e outras condições, e receita remédios quando é preciso.",
      "Reumatologia": "Cuida das articulações, dos músculos e do sistema de defesa do corpo. Trata artrite, artrose, gota, fibromialgia, lúpus e outras doenças que causam dor e inflamação."
    };
    const nomeModal = modal.querySelector('[data-esp-modal-nome]');
    const textoModal = modal.querySelector('[data-esp-modal-texto]');
    const posicaoModal = modal.querySelector('[data-esp-modal-posicao]');
    const caixaModal = modal.querySelector('.esp-modal-caixa');
    const botoesNome = [...document.querySelectorAll('.esp-nome')];
    let atual = 0;

    const mostrar = (indice, direcao) => {
      atual = (indice + botoesNome.length) % botoesNome.length;
      const nome = botoesNome[atual].textContent.trim();
      nomeModal.textContent = nome;
      textoModal.textContent = explicacoes[nome] || '';
      posicaoModal.textContent = `${String(atual + 1).padStart(2, '0')} de ${botoesNome.length}`;
      if (direcao) {
        caixaModal.style.setProperty('--troca-de', `${direcao * 28}px`);
        caixaModal.classList.remove('trocando');
        void caixaModal.offsetWidth;
        caixaModal.classList.add('trocando');
      }
    };

    botoesNome.forEach((botao, indice) => {
      botao.addEventListener('click', () => {
        mostrar(indice);
        modal.showModal();
      });
    });

    modal.querySelectorAll('[data-esp-passo]').forEach((seta) => {
      seta.addEventListener('click', () => {
        const passo = Number(seta.dataset.espPasso);
        mostrar(atual + passo, passo);
      });
    });

    // Setas do teclado também passam de uma para outra
    modal.addEventListener('keydown', (evento) => {
      if (evento.key === 'ArrowRight') mostrar(atual + 1, 1);
      if (evento.key === 'ArrowLeft') mostrar(atual - 1, -1);
    });

    modal.querySelector('[data-esp-fechar]').addEventListener('click', () => modal.close());

    // Devolve o foco ao nome que estava aberto por último
    modal.addEventListener('close', () => botoesNome[atual].focus({ preventScroll: true }));

    // Clicar fora da caixa fecha
    modal.addEventListener('click', (evento) => {
      if (evento.target === modal) modal.close();
    });
  }

  // Especialidades: o 29 conta a partir do zero quando aparece
  const contador = document.querySelector('[data-contador]');

  if (contador && 'IntersectionObserver' in window
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const total = Number(contador.dataset.contador);
    contador.textContent = '0';
    const vigia = new IntersectionObserver((entradas) => {
      if (!entradas[0].isIntersecting) return;
      vigia.disconnect();
      const inicio = performance.now();
      const duracao = 1400;
      const passo = (agora) => {
        const t = Math.min(1, (agora - inicio) / duracao);
        const suave = 1 - Math.pow(1 - t, 3);
        contador.textContent = String(Math.round(suave * total));
        if (t < 1) requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    }, { threshold: 0.3 });
    vigia.observe(contador);
  }

  // Card Fácil: o cartão chega girando e depois se inclina conforme a rolagem
  const palcoCartao = document.querySelector('[data-card-facil]');

  if (palcoCartao) {
    const semMovimentoCartao = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (semMovimentoCartao || !('IntersectionObserver' in window)) {
      palcoCartao.classList.add('visivel');
    } else {
      new IntersectionObserver((entradas, vigia) => {
        if (!entradas[0].isIntersecting) return;
        vigia.disconnect();
        palcoCartao.classList.add('visivel');
        setTimeout(() => palcoCartao.classList.add('pronto'), 1250);
      }, { threshold: 0.35 }).observe(palcoCartao);

      const cartao = palcoCartao.querySelector('.cartao-inclina');
      let pedidoCartao = 0;
      const inclinar = () => {
        pedidoCartao = 0;
        const caixa = palcoCartao.getBoundingClientRect();
        // -1 quando está embaixo da tela, 1 quando está saindo por cima
        const posicao = 1 - (caixa.top + caixa.height / 2) / (window.innerHeight / 2);
        const p = Math.max(-1, Math.min(1, posicao));
        cartao.style.setProperty('--inclina-x', `${(10 - p * 8).toFixed(2)}deg`);
        cartao.style.setProperty('--inclina-y', `${(-18 + p * 22).toFixed(2)}deg`);
      };
      window.addEventListener('scroll', () => {
        if (!pedidoCartao) pedidoCartao = requestAnimationFrame(inclinar);
      }, { passive: true });
      inclinar();
    }
  }
})();
