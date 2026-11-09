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
