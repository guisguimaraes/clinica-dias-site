/* Agendamento on-line da Clínica Dias.
   Passos: especialidade → médico → unidade → dia e hora → pagamento → seus dados → confirmar.
   Ao lado, a "ficha" da consulta vai sendo preenchida; tocar numa linha volta àquele passo.
   Fala com a ponte do Feegow em agenda.clinicadias.com (endereço em <html data-agenda-api="...">);
   a chave do Feegow fica só na ponte. Pagamento: sempre na clínica, no dia da consulta (não há cobrança pelo site).
   Qualquer elemento com data-agenda abre a janela; data-especialidade="Cardiologia" já abre na especialidade.
   No computador (127.0.0.1) usa a ponte local em http://127.0.0.1:3100. Sem ponte: ?demo=1. */
(function () {
  "use strict";

  var root = document.documentElement;
  var API = (root.getAttribute("data-agenda-api") || "").replace(/\/?$/, "/");
  if (/^(127\.0\.0\.1|localhost)$/.test(location.hostname)) API = "http://127.0.0.1:3100/api/";
  var DEMO = /[?&]demo=1\b/.test(location.search);
  if (!API && !DEMO) return;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TEL = "(31) 3849-6156";
  var TEL_LINK = '<a href="tel:+553138496156">' + TEL + "</a>";

  var PASSOS = [
    { id: "esp", rotulo: "Especialidade", titulo: "Qual especialidade?" },
    { id: "med", rotulo: "Médico", titulo: "Com quem você quer consultar?" },
    { id: "uni", rotulo: "Unidade", titulo: "Em qual unidade?" },
    { id: "hor", rotulo: "Dia e hora", titulo: "Escolha o dia e o horário" },
    { id: "pag", rotulo: "Pagamento", titulo: "Como você vai pagar?" },
    { id: "dad", rotulo: "Paciente", titulo: "Quem vai ser atendido?" },
    { id: "rev", rotulo: "Confirmar", titulo: "Confira antes de marcar" },
  ];
  var ESP = 0, MED = 1, UNI = 2, HOR = 3, PAG = 4, DAD = 5, REV = 6;

  var MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  var MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  var SEMANA_LONGA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

  /* Fotos dos médicos: o Feegow não manda foto. Ficam em img/medicos/<nome-sem-acento>.jpg (200 px de largura);
     para pôr a de outro médico, salve o arquivo com esse nome e acrescente o nome aqui. Sem foto, as iniciais. */
  var FOTOS = ["davidson-lourenco-dias", "diego-lourenco-dias", "eduardo-de-abreu-borges", "felipe-ferreira-lopes"];

  /* O Feegow tem especialidades com os mesmos médicos; na tela fica uma só e a outra vira palavra de busca. */
  var JUNTAR = { 271: 128, 254: 299, 157: 299, 242: 299, 158: 299, 295: 126 };
  var NOMES = { 299: "Odontologia", 128: "Ginecologia e Obstetrícia" };

  /* O que levar (o mesmo da página Atendimento) */
  var LEVAR = ["Documento oficial com foto", "Pedidos e exames anteriores, se tiver", "A lista dos remédios que você usa"];

  /* ------------------------------------------------------------ janela */

  var modal = document.createElement("div");
  modal.id = "agenda";
  modal.className = "ag";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "ag-titulo");
  modal.hidden = true;
  modal.innerHTML =
    '<div class="ag-fundo" data-aclose></div>' +
    '<div class="ag-janela">' +
    '<aside class="ag-ficha" aria-label="Sua consulta">' +
    '<img class="ag-ficha__contorno" src="/img/contornos.svg" alt="" aria-hidden="true">' +
    '<p class="ag-ficha__marca"><img src="/img/logo-branco.svg" alt="Clínica Dias" width="120" height="45"></p>' +
    '<p class="ag-ficha__rotulo">Sua consulta</p>' +
    '<p class="ag-ficha__dica">Cada escolha aparece aqui. Toque numa linha para trocar.</p>' +
    '<ol class="ag-ficha__linhas"></ol>' +
    '<p class="ag-ficha__pe">Pagamento na clínica, no dia da consulta.<br>Dúvidas? ' + TEL_LINK + "</p>" +
    "</aside>" +
    '<div class="ag-principal">' +
    '<div class="ag-barra" aria-hidden="true"><span></span></div>' +
    '<header class="ag-cabeca">' +
    '<div><p class="ag-passo"></p><h2 id="ag-titulo" tabindex="-1"></h2><p class="ag-resumo"></p></div>' +
    '<button type="button" class="ag-fechar" data-aclose aria-label="Fechar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
    "</header>" +
    '<p class="ag-aviso-teste" hidden></p>' +
    '<div class="ag-corpo" aria-live="polite"></div>' +
    '<footer class="ag-pe"><button type="button" class="ag-voltar">Voltar</button><button type="button" class="botao botao-laranja ag-seguir">Continuar</button>' +
    '<div class="ag-pe__feito"><button type="button" class="ag-feito__fechar" data-aclose>Fechar</button>' +
    '<a class="botao botao-linha" href="/agendamentos.html">Meus agendamentos</a>' +
    '<button type="button" class="botao botao-laranja" data-ics>Salvar no calendário</button></div></footer>' +
    "</div>" +
    "</div>";
  document.body.appendChild(modal);

  var corpo = modal.querySelector(".ag-corpo");
  var titulo = modal.querySelector("#ag-titulo");
  var passoTxt = modal.querySelector(".ag-passo");
  var resumoTxt = modal.querySelector(".ag-resumo");
  var barra = modal.querySelector(".ag-barra span");
  var linhas = modal.querySelector(".ag-ficha__linhas");
  var pe = modal.querySelector(".ag-pe");
  var voltarBtn = modal.querySelector(".ag-voltar");
  var seguirBtn = modal.querySelector(".ag-seguir");
  var avisoTeste = modal.querySelector(".ag-aviso-teste");
  var peFeito = modal.querySelector(".ag-pe__feito");
  peFeito.querySelector("[data-ics]").addEventListener("click", function () {
    baixarCalendario();
  });

  var DATA = null;
  var MARCACAO_REAL = null; // vem de /api/saude
  var S = null;
  var lastTrigger = null;
  var pedidoInicial = null;
  var PRECOS = {}; // "med:uni:esp" -> resposta de /api/precos | "carregando" | "erro"
  var CONV = {}; // "med:esp" -> lista | "carregando"

  function reset() {
    S = { step: ESP, esp: null, medico: null, unidade: null, slots: null, dia: null, slot: null, pag: null, convenio: null,
      dados: {}, cad: null, cpfBuscado: null, enviando: false, feito: null, busca: "", convErro: "" };
  }

  /* ------------------------------------------------------------ utilidades */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function normal(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }
  function parseData(iso) {
    var p = iso.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function dataLonga(iso) {
    var d = parseData(iso);
    return SEMANA_LONGA[d.getDay()] + ", " + d.getDate() + " de " + MESES_LONGOS[d.getMonth()];
  }
  function dataCurta(iso) {
    var d = parseData(iso);
    return SEMANA[d.getDay()] + ", " + d.getDate() + " " + MESES[d.getMonth()];
  }
  function hora(h) {
    return h.slice(0, 5).replace(":", "h");
  }
  function slug(nome) {
    return normal(String(nome || "").replace(/^(Dra?|Sra?)\.\s*/i, "")).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  function iniciais(nome) {
    var p = String(nome || "").replace(/^Dra?\.\s*/i, "").split(/\s+/).filter(Boolean);
    return ((p[0] || "")[0] || "") + ((p.length > 1 ? p[p.length - 1] : "")[0] || "");
  }
  function avatar(m, classe) {
    var s = slug(m.nome);
    var c = "ag-foto" + (classe ? " " + classe : "");
    if (FOTOS.indexOf(s) >= 0) return '<span class="' + c + '" aria-hidden="true"><img src="/img/medicos/' + s + '.jpg" alt="" loading="lazy" width="200" height="250"></span>';
    return '<span class="' + c + ' ag-foto--sigla" aria-hidden="true">' + esc(iniciais(m.nome)) + "</span>";
  }
  function unidade(id) {
    return (DATA && DATA.unidades[id]) || { nome: "", endereco: "" };
  }
  /* "Timóteo · Portaria I", "Timóteo · Portaria II", "Ipatinga" -> "Timóteo e Ipatinga" */
  function cidades(ids) {
    var vistas = [];
    ids.forEach(function (id) {
      var c = unidade(id).nome.split(" · ")[0];
      if (c && vistas.indexOf(c) < 0) vistas.push(c);
    });
    return vistas.length > 1 ? vistas.slice(0, -1).join(", ") + " e " + vistas[vistas.length - 1] : vistas[0] || "";
  }
  function faixa(m) {
    var min = m.idade_minima, max = m.idade_maxima;
    if (max != null && max <= 18) return "Atende até " + max + " anos";
    if (min != null && min >= 12) return "Atende a partir de " + min + " anos";
    return "";
  }
  function idadeEm(nasc, iso) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(nasc || "");
    if (!m) return null;
    var d = parseData(iso);
    var idade = d.getFullYear() - +m[3];
    if (d.getMonth() + 1 < +m[2] || (d.getMonth() + 1 === +m[2] && d.getDate() < +m[1])) idade--;
    return idade;
  }
  function chavePreco() {
    return S.medico.id + ":" + S.unidade + ":" + S.esp.id;
  }
  function chaveConv() {
    return S.medico.id + ":" + S.esp.id;
  }
  function getJSON(path) {
    return fetch(API + path, { headers: { Accept: "application/json" } }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || j.erro) throw new Error(j.erro || "http " + r.status);
        return j;
      });
    });
  }
  function post(path, data) {
    return fetch(API + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data),
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || j.erro) throw new Error(j.erro || "Não conseguimos marcar agora. Ligue para " + TEL + ".");
        return j;
      });
    });
  }
  function carregando(texto) {
    return '<div class="ag-carregando"><span class="ag-gira" aria-hidden="true"></span>' + texto + "</div>";
  }

  /* ------------------------------------------------------------ catálogo */

  function agrupar(lista) {
    var porId = {};
    lista.forEach(function (e) {
      porId[e.id] = e;
      e.busca = e.nome;
    });
    return lista.filter(function (e) {
      var destino = porId[JUNTAR[e.id]];
      if (destino) {
        destino.busca += " " + e.nome;
        return false;
      }
      if (NOMES[e.id]) e.nome = NOMES[e.id];
      return true;
    });
  }

  var carregandoCat = null;
  function carregarMedicos() {
    if (DATA || carregandoCat) return;
    if (DEMO) {
      DATA = dadosDemo();
      MARCACAO_REAL = false;
      return;
    }
    getJSON("saude").then(function (j) {
      MARCACAO_REAL = !!j.marcacao_real;
      if (!modal.hidden) atualizarAvisoTeste();
    }).catch(function () {});
    carregandoCat = getJSON("medicos")
      .then(function (j) {
        if (!j.especialidades || !j.especialidades.length) throw new Error("vazio");
        j.especialidades = agrupar(j.especialidades).sort(function (a, b) {
          return a.nome.localeCompare(b.nome, "pt-BR");
        });
        DATA = j;
        if (S && !modal.hidden && S.step === ESP) aplicarPedido(pedidoInicial);
      })
      .catch(function () {
        DATA = { falhou: true, especialidades: [], unidades: {} };
      })
      .then(function () {
        carregandoCat = null;
        if (!modal.hidden) render();
      });
  }

  function carregarPrecos() {
    var k = chavePreco();
    if (PRECOS[k]) return;
    if (DEMO) {
      PRECOS[k] = precosDemo();
      return;
    }
    PRECOS[k] = "carregando";
    getJSON("precos?profissional_id=" + S.medico.id + "&unidade_id=" + S.unidade + "&especialidade_id=" + S.esp.id)
      .then(function (j) {
        PRECOS[k] = j;
      })
      .catch(function () {
        PRECOS[k] = "erro";
      })
      .then(function () {
        if (!modal.hidden && S.medico && chavePreco() === k && (S.step === PAG || S.step === REV)) render();
        else desenharFicha();
      });
  }

  function carregarConvenios() {
    var k = chaveConv();
    if (CONV[k]) return;
    if (DEMO) {
      CONV[k] = [{ id: 1, nome: "Unimed (exemplo)" }, { id: 2, nome: "Cassi (exemplo)" }];
      return;
    }
    CONV[k] = "carregando";
    getJSON("convenios?profissional_id=" + S.medico.id + "&especialidade_id=" + S.esp.id)
      .then(function (j) {
        CONV[k] = j.convenios || [];
      })
      .catch(function () {
        CONV[k] = [];
      })
      .then(function () {
        if (!modal.hidden && S.medico && chaveConv() === k && S.step === PAG) render();
      });
  }

  /* ------------------------------------------------------------ escolhas */

  function espPorNome(nome) {
    if (!DATA || !nome) return null;
    var n = normal(nome);
    var lista = DATA.especialidades;
    for (var i = 0; i < lista.length; i++) if (normal(lista[i].nome) === n) return lista[i];
    for (var j = 0; j < lista.length; j++) {
      var m = normal(lista[j].nome);
      if (m.indexOf(n) === 0 || n.indexOf(m) === 0) return lista[j];
    }
    return null;
  }
  function aplicarPedido(p) {
    if (!p || !p.especialidade) return;
    var e = espPorNome(p.especialidade);
    if (e) escolherEsp(e);
  }
  function limparDepois(passo) {
    if (passo <= MED) S.medico = null;
    if (passo <= UNI) S.unidade = null;
    if (passo <= HOR) {
      S.slots = null;
      S.slot = null;
      S.dia = null;
    }
    if (passo <= PAG) {
      S.pag = null;
      S.convenio = null;
      S.convErro = "";
    }
  }
  function escolherEsp(e) {
    if (!S.esp || S.esp.id !== e.id) limparDepois(MED);
    S.esp = e;
    S.step = MED;
    if (e.medicos.length === 1) escolherMedico(e.medicos[0]);
  }
  function escolherMedico(m) {
    if (!S.medico || S.medico.id !== m.id) limparDepois(UNI);
    S.medico = m;
    if (m.unidades.length === 1) escolherUnidade(m.unidades[0]);
    else S.step = UNI;
  }
  function escolherUnidade(id) {
    if (S.unidade !== id) limparDepois(HOR);
    S.unidade = id;
    S.step = HOR;
    // os preços e os convênios demoram no Feegow: já começam a vir enquanto a pessoa escolhe o horário
    carregarPrecos();
    carregarConvenios();
  }
  function pulaUnidade() {
    return S.medico && S.medico.unidades.length === 1;
  }
  function pulaMedico() {
    return S.esp && S.esp.medicos.length === 1;
  }

  /* ------------------------------------------------------------ abrir e fechar */

  function open(trigger) {
    lastTrigger = trigger;
    reset();
    pedidoInicial = { especialidade: trigger && trigger.getAttribute("data-especialidade") };
    modal.hidden = false;
    root.style.overflow = "hidden";
    requestAnimationFrame(function () {
      modal.classList.add("is-open");
    });
    carregarMedicos();
    if (DATA && !DATA.falhou) aplicarPedido(pedidoInicial);
    render();
    modal.querySelector(".ag-fechar").focus();
  }
  function close() {
    modal.classList.remove("is-open");
    root.style.overflow = "";
    setTimeout(function () {
      if (!modal.classList.contains("is-open")) modal.hidden = true;
    }, reduceMotion ? 0 : 320);
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-agenda]");
    if (t) {
      e.preventDefault();
      var painel = document.getElementById("painel");
      if (painel && !painel.hidden) {
        var pf = painel.querySelector("[data-painel-fechar]");
        if (pf) pf.click();
      }
      var menuBtn = document.querySelector("[data-menu][aria-expanded=true]");
      if (menuBtn) menuBtn.click();
      open(t);
      return;
    }
    if (e.target.closest("[data-aclose]") && modal.contains(e.target)) close();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) close();
  });
  ["pointerover", "focusin", "touchstart"].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      if (e.target.closest && e.target.closest("[data-agenda]")) carregarMedicos();
    }, { passive: true });
  });

  voltarBtn.addEventListener("click", function () {
    var s = S.step - 1;
    if (s === UNI && pulaUnidade()) s--;
    if (s === MED && pulaMedico()) s--;
    irPara(Math.max(ESP, s));
  });
  seguirBtn.addEventListener("click", function () {
    if (S.step === PAG && !validarPagamento()) return;
    if (S.step === DAD && !validarDados()) return;
    if (S.step === REV) return confirmar();
    S.step++;
    render();
  });
  function irPara(passo) {
    S.step = passo;
    render();
  }

  /* ------------------------------------------------------------ desenho geral */

  function atualizarAvisoTeste() {
    var teste = DEMO || MARCACAO_REAL === false;
    avisoTeste.hidden = !teste;
    avisoTeste.textContent = DEMO
      ? "Demonstração com médicos e horários de exemplo. Nada é marcado."
      : "Modo de teste: os horários são reais, mas nada é gravado na agenda.";
  }

  function render() {
    modal.classList.toggle("is-feito", !!S.feito);
    modal.classList.toggle("is-rev", S.step === REV);
    atualizarAvisoTeste();
    desenharFicha();
    if (S.feito) return renderFeito();
    var total = PASSOS.length;
    passoTxt.textContent = "Passo " + (S.step + 1) + " de " + total + " · " + PASSOS[S.step].rotulo;
    titulo.textContent = PASSOS[S.step].titulo;
    barra.style.transform = "scaleX(" + (S.step + 1) / total + ")";
    resumoTxt.textContent = resumoCurto();
    pe.hidden = S.step === ESP || (DATA && DATA.falhou);
    peFeito.hidden = true;
    voltarBtn.hidden = S.step === ESP;
    seguirBtn.hidden = S.step <= UNI;
    seguirBtn.textContent = S.step === REV ? (MARCACAO_REAL === false || DEMO ? "Testar marcação" : "Marcar consulta") : "Continuar";
    [renderEsp, renderMedico, renderUnidade, renderHorario, renderPagamento, renderDados, renderRevisao][S.step]();
    atualizarSeguir();
    corpo.scrollTop = 0;
  }

  function atualizarSeguir() {
    var ok = [!!S.esp, !!S.medico, S.unidade != null, !!S.slot, true, S.cad !== "buscando", !S.enviando][S.step];
    seguirBtn.disabled = !ok;
  }

  /* resumo de uma linha, para o celular (onde a ficha lateral não aparece) */
  function resumoCurto() {
    var p = [];
    if (S.esp && S.step > ESP) p.push(S.esp.nome);
    if (S.medico && S.step > MED) p.push(S.medico.nome);
    if (S.slot && S.step > HOR) p.push(dataCurta(S.slot.data) + ", " + hora(S.slot.horario));
    return p.join(" · ");
  }

  function textoPagamento() {
    if (!S.pag) return null;
    if (S.pag === "convenio") return { titulo: "Convênio" + (S.convenio ? " " + S.convenio.nome : ""), valor: "Pelo plano" };
    var pr = PRECOS[chavePreco()];
    var forma = S.pag === "cartao" ? "cartao" : "dinheiro_pix";
    var valor = pr && pr.particular && pr.particular[forma] ? pr.particular[forma].valor : "";
    return { titulo: "Particular · " + (forma === "cartao" ? "cartão" : "dinheiro ou PIX"), valor: valor };
  }

  function desenharFicha() {
    if (!S) return;
    var u = S.unidade != null ? unidade(S.unidade) : null;
    var pg = textoPagamento();
    var itens = [
      { passo: ESP, rot: "Especialidade", val: S.esp && esc(S.esp.nome) },
      { passo: MED, rot: "Médico", val: S.medico && '<span class="ag-ficha__med">' + avatar(S.medico, "ag-foto--p") + esc(S.medico.nome) + "</span>" },
      { passo: UNI, rot: "Unidade", val: u && u.nome ? esc(u.nome) + "<small>" + esc(u.endereco) + "</small>" : null },
      { passo: HOR, rot: "Dia e hora", val: S.slot && esc(dataLonga(S.slot.data)) + "<small>às " + hora(S.slot.horario) + "</small>" },
      { passo: PAG, rot: "Pagamento", val: pg && esc(pg.titulo) + (pg.valor ? '<small class="ag-ficha__valor">' + esc(pg.valor) + "</small>" : "") },
    ];
    linhas.innerHTML = itens.map(function (it) {
      var atual = !S.feito && (S.step === it.passo || (it.passo === UNI && S.step === UNI));
      var pode = !S.feito && it.val && it.passo < S.step;
      var conteudo = '<span class="ag-ficha__k">' + it.rot + '</span><span class="ag-ficha__v">' + (it.val || '<i aria-hidden="true">—</i>') + "</span>";
      return (
        '<li class="' + (atual ? "is-atual" : "") + (it.val ? " is-feito" : "") + '">' +
        (pode ? '<button type="button" data-ir="' + it.passo + '" aria-label="Trocar ' + it.rot.toLowerCase() + '">' + conteudo + '<span class="ag-ficha__trocar">Trocar</span></button>' : '<div>' + conteudo + "</div>") +
        "</li>"
      );
    }).join("");
    linhas.querySelectorAll("[data-ir]").forEach(function (b) {
      b.addEventListener("click", function () {
        irPara(+b.getAttribute("data-ir"));
      });
    });
  }

  /* ------------------------------------------------------------ passos */

  function renderEsp() {
    if (!DATA) {
      corpo.innerHTML = carregando("Buscando as especialidades com horário livre…");
      return;
    }
    if (DATA.falhou) {
      corpo.innerHTML =
        '<div class="ag-vazio"><strong>O agendamento on-line está fora do ar agora.</strong><p>Ligue para ' + TEL_LINK +
        ", de segunda a sexta, das 8h às 18h. A recepção marca a sua consulta.</p></div>";
      return;
    }
    corpo.innerHTML =
      '<label class="ag-busca"><span class="so-leitor">Procurar especialidade ou médico</span>' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>' +
      '<input type="search" name="busca" value="' + esc(S.busca) + '" placeholder="Especialidade ou nome do médico" autocomplete="off" enterkeyhint="search"></label>' +
      '<div class="ag-esp-lista"></div>' +
      '<p class="ag-nota">Não achou? Algumas especialidades e exames só são marcados pelo telefone: ' + TEL_LINK + ".</p>";
    var input = corpo.querySelector("[name=busca]");
    var lista = corpo.querySelector(".ag-esp-lista");
    function desenhar() {
      var q = normal(S.busca);
      var itens = DATA.especialidades.filter(function (e) {
        if (!q) return true;
        if (normal(e.busca || e.nome).indexOf(q) >= 0) return true;
        return e.medicos.some(function (m) {
          return normal(m.nome).indexOf(q) >= 0;
        });
      });
      if (!itens.length) {
        lista.innerHTML = '<p class="ag-nota">Nada encontrado para "' + esc(S.busca) + '". Tente outro nome ou ligue para ' + TEL_LINK + ".</p>";
        return;
      }
      lista.innerHTML =
        '<ul class="ag-esps">' +
        itens.map(function (e) {
          var sel = S.esp && S.esp.id === e.id;
          var porNome = q && normal(e.busca || e.nome).indexOf(q) < 0;
          var meds = porNome
            ? e.medicos.filter(function (m) { return normal(m.nome).indexOf(q) >= 0; })
            : e.medicos;
          // só fotos de verdade na lista (iniciais pequenas viram ruído)
          var fotos = meds.filter(function (m) { return FOTOS.indexOf(slug(m.nome)) >= 0; }).slice(0, 4).map(function (m) { return avatar(m, "ag-foto--mini"); }).join("");
          var sub = porNome ? meds.map(function (m) { return m.nome; }).join(", ") : e.medicos.length + (e.medicos.length === 1 ? " médico" : " médicos") + " com horário";
          return (
            '<li><button type="button" class="ag-esp' + (sel ? " is-sel" : "") + '" data-id="' + e.id + '" aria-pressed="' + sel + '">' +
            '<span class="ag-esp__nome">' + esc(e.nome) + "<small>" + esc(sub) + "</small></span>" +
            '<span class="ag-esp__fotos" aria-hidden="true">' + fotos + "</span>" +
            '<span class="ag-seta" aria-hidden="true"></span></button></li>'
          );
        }).join("") +
        "</ul>";
      lista.querySelectorAll(".ag-esp").forEach(function (b) {
        b.addEventListener("click", function () {
          var id = +b.getAttribute("data-id");
          escolherEsp(DATA.especialidades.filter(function (e) { return e.id === id; })[0]);
          render();
        });
      });
    }
    input.addEventListener("input", function () {
      S.busca = input.value;
      desenhar();
    });
    desenhar();
  }

  function renderMedico() {
    var html = '<ul class="ag-meds">';
    S.esp.medicos.forEach(function (m) {
      var sel = S.medico && S.medico.id === m.id;
      var unidades = cidades(m.unidades);
      var fx = faixa(m);
      html +=
        '<li><button type="button" class="ag-med' + (sel ? " is-sel" : "") + '" data-id="' + m.id + '" aria-pressed="' + sel + '">' +
        avatar(m) +
        '<span class="ag-med__txt"><strong>' + esc(m.nome) + "</strong><small>" + esc(unidades) + "</small>" +
        (fx ? '<em>' + esc(fx) + "</em>" : "") + "</span>" +
        '<span class="ag-seta" aria-hidden="true"></span></button></li>';
    });
    corpo.innerHTML = html + "</ul>" + '<p class="ag-nota">Não achou o médico? Ele pode estar sem vaga on-line agora. Ligue para ' + TEL_LINK + ".</p>";
    corpo.querySelectorAll(".ag-med").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = +b.getAttribute("data-id");
        escolherMedico(S.esp.medicos.filter(function (m) { return m.id === id; })[0]);
        render();
      });
    });
  }

  function renderUnidade() {
    var html = '<ul class="ag-unis">';
    S.medico.unidades.forEach(function (uid) {
      var u = unidade(uid);
      var sel = S.unidade === uid;
      html +=
        '<li><button type="button" class="ag-uni' + (sel ? " is-sel" : "") + '" data-id="' + uid + '" aria-pressed="' + sel + '">' +
        '<span class="ag-uni__pino" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg></span>' +
        '<span class="ag-uni__txt"><strong>' + esc(u.nome) + "</strong><small>" + esc(u.endereco) + "</small></span>" +
        '<span class="ag-seta" aria-hidden="true"></span></button></li>';
    });
    corpo.innerHTML = html + "</ul>";
    corpo.querySelectorAll(".ag-uni").forEach(function (b) {
      b.addEventListener("click", function () {
        escolherUnidade(+b.getAttribute("data-id"));
        render();
      });
    });
  }

  function renderHorario() {
    if (!S.slots) {
      corpo.innerHTML = carregando("Buscando os horários livres de " + esc(S.medico.nome) + "…");
      carregarHorarios();
      return;
    }
    var u = unidade(S.unidade);
    if (S.slots === "erro") {
      corpo.innerHTML = '<div class="ag-vazio"><strong>Não conseguimos buscar os horários agora.</strong><p>Tente de novo em instantes, ou ligue para ' + TEL_LINK + ".</p></div>";
      return;
    }
    if (!S.slots.length) {
      corpo.innerHTML =
        '<div class="ag-vazio"><strong>Sem horário livre nos próximos 30 dias.</strong><p>' + esc(S.medico.nome) + " não tem vaga on-line em " + esc(u.nome) +
        ". Volte e escolha outra unidade ou outro médico, ou ligue para " + TEL_LINK + ".</p></div>";
      return;
    }
    var dias = [], porDia = {};
    S.slots.forEach(function (s) {
      if (!porDia[s.data]) {
        porDia[s.data] = [];
        dias.push(s.data);
      }
      porDia[s.data].push(s);
    });
    dias.sort();
    if (!S.dia || !porDia[S.dia]) S.dia = dias[0];

    var ini = parseData(dias[0]);
    ini.setDate(ini.getDate() - ini.getDay());
    var fim = parseData(dias[dias.length - 1]);
    fim.setDate(fim.getDate() + (6 - fim.getDay()));
    var m1 = parseData(dias[0]).getMonth(), m2 = parseData(dias[dias.length - 1]).getMonth();
    var tituloCal = MESES_LONGOS[m1] + (m2 !== m1 ? " e " + MESES_LONGOS[m2] : "");

    var cal = '<div class="ag-cal"><p class="ag-cal__mes">' + tituloCal + '</p><div class="ag-cal__grade">' +
      ["D", "S", "T", "Q", "Q", "S", "S"].map(function (w) { return '<span class="ag-cal__sem" aria-hidden="true">' + w + "</span>"; }).join("");
    for (var dt = new Date(ini); dt <= fim; dt.setDate(dt.getDate() + 1)) {
      var iso = dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
      var rot = dt.getDate() === 1 ? "<small>" + MESES[dt.getMonth()] + "</small>" : "";
      if (porDia[iso]) {
        var on = iso === S.dia;
        cal += '<button type="button" class="ag-dia' + (on ? " is-sel" : "") + '" data-dia="' + iso + '" aria-pressed="' + on + '" aria-label="' + dataLonga(iso) + ", " +
          porDia[iso].length + (porDia[iso].length === 1 ? " horário" : " horários") + '">' + rot + dt.getDate() + "</button>";
      } else {
        cal += '<span class="ag-dia ag-dia--off" aria-hidden="true">' + rot + dt.getDate() + "</span>";
      }
    }
    cal += "</div></div>";

    var grupos = [["Manhã", []], ["Tarde", []]];
    porDia[S.dia].forEach(function (s, i) {
      grupos[+s.horario.slice(0, 2) >= 12 ? 1 : 0][1].push([s, i]);
    });
    var n = porDia[S.dia].length;
    var horas = '<div class="ag-horas"><p class="ag-horas__dia">' + dataLonga(S.dia) + "<small>" + n + (n === 1 ? " horário livre" : " horários livres") + " · " + esc(u.nome) + "</small></p>" +
      grupos.filter(function (g) { return g[1].length; }).map(function (g) {
        return '<div class="ag-horas__grupo"><p>' + g[0] + '</p><div class="ag-horas__lista">' +
          g[1].map(function (p) {
            var s = p[0];
            var sel = S.slot && S.slot.data === s.data && S.slot.horario === s.horario;
            return '<button type="button" class="ag-hora' + (sel ? " is-sel" : "") + '" data-i="' + p[1] + '" aria-pressed="' + !!sel + '">' + hora(s.horario) + "</button>";
          }).join("") + "</div></div>";
      }).join("") + "</div>";

    corpo.innerHTML = '<div class="ag-hor">' + cal + horas + "</div>";
    corpo.querySelectorAll(".ag-dia[data-dia]").forEach(function (b) {
      b.addEventListener("click", function () {
        S.dia = b.getAttribute("data-dia");
        S.slot = null;
        render();
        var h = corpo.querySelector(".ag-horas");
        if (h && window.matchMedia("(max-width: 719px)").matches) h.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      });
    });
    corpo.querySelectorAll(".ag-hora").forEach(function (b) {
      b.addEventListener("click", function () {
        S.slot = porDia[S.dia][+b.getAttribute("data-i")];
        corpo.querySelectorAll(".ag-hora").forEach(function (x) {
          x.classList.toggle("is-sel", x === b);
          x.setAttribute("aria-pressed", x === b);
        });
        desenharFicha();
        resumoTxt.textContent = resumoCurto();
        atualizarSeguir();
      });
    });
  }

  function carregarHorarios() {
    var pedido = chavePreco();
    S._pedido = pedido;
    if (DEMO) {
      S.slots = horariosDemo();
      return render();
    }
    getJSON("horarios?profissional_id=" + S.medico.id + "&unidade_id=" + S.unidade + "&especialidade_id=" + S.esp.id)
      .then(function (j) {
        if (S._pedido !== pedido) return;
        S.slots = j.horarios || [];
        render();
      })
      .catch(function () {
        if (S._pedido !== pedido) return;
        S.slots = "erro";
        render();
      });
  }

  /* Pagamento: o preço de cada forma, direto do Feegow. Paga-se na clínica, no dia. */
  function renderPagamento() {
    carregarPrecos();
    carregarConvenios();
    var pr = PRECOS[chavePreco()];
    var conv = CONV[chaveConv()];
    function preco(forma) {
      if (pr === "carregando" || !pr) return '<span class="ag-preco ag-preco--carregando" aria-label="carregando o valor"></span>';
      if (pr === "erro" || !pr.particular || !pr.particular[forma]) return '<span class="ag-preco ag-preco--na">valor na recepção</span>';
      return '<span class="ag-preco">' + esc(pr.particular[forma].valor) + "</span>";
    }
    function opcao(valor, nome, detalhe, direita) {
      var on = S.pag === valor;
      return '<label class="ag-opcao' + (on ? " is-sel" : "") + '"><input type="radio" name="pag" value="' + valor + '"' + (on ? " checked" : "") + ">" +
        '<span class="ag-opcao__txt"><strong>' + nome + "</strong>" + (detalhe ? "<small>" + detalhe + "</small>" : "") + "</span>" + direita + "</label>";
    }
    var convSel = "";
    if (S.pag === "convenio") {
      if (conv === "carregando" || !conv) convSel = carregando("Buscando os convênios que " + esc(S.medico.nome) + " atende…");
      else if (!conv.length) convSel = '<p class="ag-nota">Não conseguimos carregar os convênios agora. Para marcar pelo convênio, ligue para ' + TEL_LINK + ".</p>";
      else convSel =
        '<label class="ag-campo ag-campo--conv"><span>Qual é o seu convênio?</span><select name="convenio"><option value="">Escolha na lista</option>' +
        conv.map(function (c) {
          return '<option value="' + c.id + '"' + (S.convenio && S.convenio.id === c.id ? " selected" : "") + ">" + esc(c.nome) + "</option>";
        }).join("") +
        '</select><small>Só aparecem os convênios que este médico atende. Não achou o seu? Ligue para ' + TEL_LINK + ".</small>" +
        '<em class="ag-erro-campo">' + esc(S.convErro) + "</em></label>";
    }
    var descontos = pr && pr.descontos && pr.descontos.length
      ? '<p class="ag-nota ag-nota--desc">Tem CardFácil ou outro cartão de desconto? O valor é menor. Ligue para ' + TEL_LINK + " e marque pela recepção.</p>"
      : "";
    corpo.innerHTML =
      '<p class="ag-lead">Valores da consulta com ' + esc(S.medico.nome) + " em " + esc(unidade(S.unidade).nome) + ".</p>" +
      '<fieldset class="ag-opcoes"><legend class="so-leitor">Forma de pagamento</legend>' +
      '<p class="ag-opcoes__grupo">Particular</p>' +
      opcao("dinheiro_pix", "Dinheiro ou PIX", "", preco("dinheiro_pix")) +
      opcao("cartao", "Cartão", "", preco("cartao")) +
      '<p class="ag-opcoes__grupo">Plano de saúde</p>' +
      opcao("convenio", "Convênio", "Leve a carteirinha no dia", '<span class="ag-preco ag-preco--plano">pago pelo plano</span>') +
      "</fieldset>" +
      convSel +
      '<p class="ag-erro" role="alert" hidden></p>' +
      '<div class="ag-paga"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18v11H3z M3 11h18 M7 15h3"/></svg>' +
      "<p><strong>Você paga na clínica, no dia da consulta.</strong> O site não cobra nada e não pede cartão.</p></div>" +
      descontos;
    corpo.querySelectorAll("[name=pag]").forEach(function (r) {
      r.addEventListener("change", function () {
        S.pag = r.value;
        if (S.pag !== "convenio") S.convenio = null;
        S.convErro = "";
        render();
      });
    });
    var sel = corpo.querySelector("[name=convenio]");
    if (sel) sel.addEventListener("change", function () {
      var id = +sel.value;
      S.convenio = (CONV[chaveConv()] || []).filter(function (c) { return c.id === id; })[0] || null;
      S.convErro = "";
      var e = corpo.querySelector(".ag-erro-campo");
      if (e) e.textContent = "";
      desenharFicha();
    });
  }

  function validarPagamento() {
    var err = corpo.querySelector(".ag-erro");
    if (!S.pag) {
      err.hidden = false;
      err.textContent = "Escolha como você vai pagar.";
      return false;
    }
    if (S.pag === "convenio" && !S.convenio) {
      S.convErro = "Escolha o seu convênio.";
      var e = corpo.querySelector(".ag-erro-campo");
      if (e) e.textContent = S.convErro;
      else {
        err.hidden = false;
        err.textContent = "Os convênios ainda estão carregando. Espere um instante.";
      }
      return false;
    }
    return true;
  }

  /* Dados: primeiro o CPF; a ponte diz se já existe cadastro no Feegow e preenche o resto.
     A data de nascimento nunca volta do servidor (ela confirma a identidade em Meus agendamentos). */
  function renderDados() {
    var d = S.dados, c = S.cad;
    function f(name, label, attrs, dica) {
      return '<label class="ag-campo"><span>' + label + '</span><input name="' + name + '" value="' + esc(d[name] || "") + '" ' + attrs + ">" +
        (dica ? "<small>" + dica + "</small>" : "") + '<em class="ag-erro-campo"></em></label>';
    }
    var html = '<form class="ag-form" novalidate><div class="ag-cpf">' +
      f("cpf", "CPF de quem vai ser atendido", 'inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" maxlength="14" required', c ? "" : "Com o CPF a gente procura o cadastro na Clínica Dias.") +
      '<button type="button" class="botao botao-linha ag-cpf__btn"' + (c === "buscando" ? " disabled" : "") + ">" + (c === "buscando" ? "Procurando…" : c ? "Trocar CPF" : "Procurar") + "</button></div>";
    if (c === "buscando") html += carregando("Procurando o cadastro…");
    else if (c) {
      html += c.encontrado
        ? '<p class="ag-cad ag-cad--ok"><strong>' + (c.primeiro_nome ? "Olá, " + esc(c.primeiro_nome) + "." : "Cadastro encontrado.") + "</strong> Puxamos os dados do seu cadastro. Confira e corrija se algo mudou.</p>"
        : '<p class="ag-cad"><strong>Primeira vez na Clínica Dias?</strong> Preencha os dados abaixo e o cadastro é feito junto com a consulta.</p>';
      html +=
        f("nome", "Nome completo", 'autocomplete="name" required') +
        '<div class="ag-dupla">' +
        f("nascimento", "Data de nascimento", 'inputmode="numeric" placeholder="dd/mm/aaaa" maxlength="10" required') +
        f("celular", "Celular com DDD", 'type="tel" inputmode="tel" autocomplete="tel-national" placeholder="(31) 90000-0000" maxlength="15" required') +
        "</div><div class=\"ag-dupla\">" +
        '<fieldset class="ag-campo ag-campo--radio"><legend>Sexo</legend><div>' +
        ["F", "M"].map(function (v) {
          return '<label><input type="radio" name="sexo" value="' + v + '"' + (d.sexo === v ? " checked" : "") + "> " + (v === "F" ? "Feminino" : "Masculino") + "</label>";
        }).join("") + '</div><em class="ag-erro-campo"></em></fieldset>' +
        f("email", "E-mail (opcional)", 'type="email" autocomplete="email"') +
        "</div>" +
        '<label class="ag-aceite"><input type="checkbox" name="lgpd"' + (d.lgpd ? " checked" : "") + '> <span>Autorizo a Clínica Dias a usar estes dados para marcar a consulta, conforme a <a href="/privacidade.html" target="_blank" rel="noopener">política de privacidade</a>.</span></label>' +
        '<em class="ag-erro-campo ag-erro-campo--lgpd"></em>';
    }
    corpo.innerHTML = html + "</form>";

    var form = corpo.querySelector("form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!S.cad) buscarCadastro();
    });
    mask(form.cpf, function (v) {
      v = v.replace(/\D/g, "").slice(0, 11);
      return v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    });
    if (form.nascimento) mask(form.nascimento, function (v) {
      v = v.replace(/\D/g, "").slice(0, 8);
      return v.replace(/(\d{2})(\d)/, "$1/$2").replace(/(\d{2})(\d)/, "$1/$2");
    });
    if (form.celular) mask(form.celular, function (v) {
      v = v.replace(/\D/g, "").slice(0, 11);
      if (v.length > 10) return v.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
      return v.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/^\((\d{0,2})\) ?-?$/, "$1");
    });
    form.querySelector(".ag-cpf__btn").addEventListener("click", function () {
      if (S.cad && S.cad !== "buscando") {
        S.cad = null;
        S.dados = { cpf: S.dados.cpf };
        render();
        corpo.querySelector("[name=cpf]").focus();
        return;
      }
      buscarCadastro();
    });
    form.cpf.addEventListener("input", function () {
      if (!S.cad && cpfValido(form.cpf.value)) buscarCadastro();
      else if (S.cad && S.cad !== "buscando" && form.cpf.value.replace(/\D/g, "") !== S.cpfBuscado) {
        S.cad = null;
        S.dados = { cpf: form.cpf.value };
        render();
        var el = corpo.querySelector("[name=cpf]");
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
    function limpar(e) {
      lerDados();
      var box = e.target.closest(".ag-campo");
      if (box) {
        box.classList.remove("tem-erro");
        var er = box.querySelector(".ag-erro-campo");
        if (er) er.textContent = "";
      }
      if (e.target.name === "lgpd") form.querySelector(".ag-erro-campo--lgpd").textContent = "";
    }
    form.addEventListener("input", limpar);
    form.addEventListener("change", limpar);
    if (c && c !== "buscando") {
      var first = form.querySelector(c.encontrado ? "[name=lgpd]" : "[name=nome]");
      if (first && (c.encontrado || !first.value)) first.focus({ preventScroll: true });
    }
  }

  function buscarCadastro() {
    var form = corpo.querySelector("form");
    var cpf = form.cpf.value;
    var box = form.cpf.closest(".ag-campo");
    if (!cpfValido(cpf)) {
      box.classList.add("tem-erro");
      box.querySelector(".ag-erro-campo").textContent = "Confira o CPF: os números não batem.";
      form.cpf.focus();
      return;
    }
    S.dados = { cpf: cpf };
    S.cpfBuscado = cpf.replace(/\D/g, "");
    S.cad = "buscando";
    render();
    var pedido = S.cpfBuscado;
    function pronto(res) {
      if (S.cpfBuscado !== pedido || S.step !== DAD) return;
      S.cad = res;
      if (res && res.encontrado && res.dados) S.dados = Object.assign({ cpf: S.dados.cpf }, res.dados);
      render();
    }
    if (DEMO) return pronto({ encontrado: false });
    post("paciente", { cpf: cpf }).then(pronto).catch(function () {
      pronto({ encontrado: false, falhou: true });
    });
  }

  function mask(input, fn) {
    input.addEventListener("input", function () {
      input.value = fn(input.value);
    });
  }
  function lerDados() {
    var form = corpo.querySelector("form");
    if (!form) return;
    function v(n) {
      return form[n] && form[n].value != null ? form[n].value.trim() : "";
    }
    var sexo = form.querySelector("[name=sexo]:checked");
    S.dados = { cpf: form.cpf.value, nome: v("nome"), nascimento: v("nascimento"), celular: v("celular"), sexo: sexo ? sexo.value : "", email: v("email"), lgpd: form.lgpd ? form.lgpd.checked : false };
  }
  function cpfValido(c) {
    c = c.replace(/\D/g, "");
    if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
    for (var t = 9; t < 11; t++) {
      var s = 0;
      for (var i = 0; i < t; i++) s += +c[i] * (t + 1 - i);
      if (((s * 10) % 11) % 10 !== +c[t]) return false;
    }
    return true;
  }
  function nascimentoValido(v) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
    if (!m) return false;
    var d = new Date(+m[3], +m[2] - 1, +m[1]);
    return d.getDate() === +m[1] && d < new Date() && +m[3] > 1900;
  }

  function validarDados() {
    if (!S.cad || S.cad === "buscando") {
      buscarCadastro();
      return false;
    }
    lerDados();
    var form = corpo.querySelector("form");
    var d = S.dados;
    var cel = d.celular.replace(/\D/g, "");
    var erros = {
      nome: d.nome.split(/\s+/).length < 2 ? "Escreva nome e sobrenome." : "",
      nascimento: !nascimentoValido(d.nascimento) ? "Use dia/mês/ano, por exemplo 05/03/1958." : "",
      celular: cel.length < 10 ? "Informe o celular com DDD." : "",
      sexo: !d.sexo ? "Escolha uma opção." : "",
    };
    var idade = nascimentoValido(d.nascimento) ? idadeEm(d.nascimento, S.slot.data) : null;
    var mi = S.medico.idade_minima, ma = S.medico.idade_maxima;
    if (idade != null && ((mi != null && idade < mi) || (ma != null && idade > ma))) {
      erros.nascimento = S.medico.nome + " atende pacientes " + (ma != null && idade > ma ? "até " + ma : "a partir de " + mi) + " anos. Volte e escolha outro médico.";
    }
    var primeiro = null;
    Object.keys(erros).forEach(function (k) {
      var el = form.querySelector("[name=" + k + "]");
      if (!el) return;
      var box = el.closest(".ag-campo");
      box.classList.toggle("tem-erro", !!erros[k]);
      box.querySelector(".ag-erro-campo").textContent = erros[k];
      if (erros[k] && !primeiro) primeiro = el;
    });
    form.querySelector(".ag-erro-campo--lgpd").textContent = d.lgpd ? "" : "Para marcar pelo site, marque a autorização acima.";
    if (!d.lgpd && !primeiro) primeiro = form.lgpd;
    if (primeiro) {
      primeiro.focus();
      return false;
    }
    return true;
  }

  /* Comprovante: usado na confirmação e na tela final */
  function comprovante() {
    var u = unidade(S.unidade);
    var d = parseData(S.slot.data);
    var pg = textoPagamento() || { titulo: "", valor: "" };
    var levar = LEVAR.slice();
    if (S.pag === "convenio") levar.splice(1, 0, "Carteirinha do convênio");
    return (
      '<div class="ag-comp">' +
      '<div class="ag-comp__data"><span class="ag-comp__dia">' + d.getDate() + '</span><span class="ag-comp__mes">' + MESES[d.getMonth()] + '</span><span class="ag-comp__sem">' + SEMANA[d.getDay()] + "</span>" +
      '<span class="ag-comp__hora">' + hora(S.slot.horario) + "</span></div>" +
      '<div class="ag-comp__corpo">' +
      '<p class="ag-comp__quando">' + esc(dataLonga(S.slot.data)) + ", às " + hora(S.slot.horario) + "</p>" +
      '<div class="ag-comp__med">' + avatar(S.medico) + "<p><strong>" + esc(S.medico.nome) + "</strong><small>Consulta de " + esc(S.esp.nome.toLowerCase()) + "</small></p></div>" +
      "<dl>" +
      "<div><dt>Onde</dt><dd>" + esc(u.nome) + "<small>" + esc(u.endereco) + "</small></dd></div>" +
      "<div><dt>Paciente</dt><dd>" + esc(S.dados.nome) + "<small>CPF " + esc(S.dados.cpf) + (S.dados.celular ? " · " + esc(S.dados.celular) : "") + "</small></dd></div>" +
      "</dl>" +
      "</div>" +
      "</div>" +
      '<div class="ag-pagar">' +
      '<p class="ag-pagar__rot">Pagamento na clínica, no dia da consulta</p>' +
      '<p class="ag-pagar__linha"><span>' + esc(pg.titulo) + '</span><strong class="ag-pagar__valor">' + esc(pg.valor || (S.pag === "convenio" ? "" : "valor na recepção")) + "</strong></p>" +
      (S.pag === "convenio" ? '<p class="ag-pagar__obs ag-conv-status">Conferindo se o convênio cobre esta consulta…</p>' : '<p class="ag-pagar__obs">Nada é cobrado pelo site.</p>') +
      "</div>" +
      '<div class="ag-levar"><p>Leve no dia</p><ul>' + levar.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>"
    );
  }

  function renderRevisao() {
    corpo.innerHTML = comprovante() +
      '<p class="ag-nota">Precisa remarcar ou cancelar depois? Use <a href="/agendamentos.html">Meus agendamentos</a> ou ligue para ' + TEL_LINK + ".</p>" +
      '<p class="ag-marcando" role="status" hidden><span class="ag-gira" aria-hidden="true"></span>Marcando na agenda da clínica. Pode levar até um minuto, não feche esta janela.</p>' +
      '<p class="ag-erro" role="alert" hidden></p>';
    if (S.pag === "convenio" && !DEMO) {
      var el = corpo.querySelector(".ag-conv-status");
      post("valor", { profissional_id: S.medico.id, unidade_id: S.unidade, especialidade_id: S.esp.id, pagamento: "convenio", convenio_id: S.convenio.id })
        .then(function () {
          if (el) el.textContent = "O convênio cobre esta consulta. Leve a carteirinha.";
        })
        .catch(function (err) {
          if (el) {
            el.classList.add("is-erro");
            el.textContent = (err && err.message) || "Não conseguimos conferir o convênio.";
          }
        });
    } else if (S.pag === "convenio") {
      var el2 = corpo.querySelector(".ag-conv-status");
      if (el2) el2.textContent = "Leve a carteirinha.";
    }
  }

  function confirmar() {
    if (S.enviando) return;
    var errEl = corpo.querySelector(".ag-erro");
    if (DEMO) {
      S.feito = { demo: true };
      return render();
    }
    S.enviando = true;
    seguirBtn.disabled = true;
    seguirBtn.textContent = "Marcando…";
    errEl.hidden = true;
    var marcando = corpo.querySelector(".ag-marcando");
    if (marcando) {
      marcando.hidden = false;
      marcando.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    }
    post("agendar", {
      profissional_id: S.medico.id, unidade_id: S.unidade, especialidade_id: S.esp.id,
      data: S.slot.data, horario: S.slot.horario,
      nome: S.dados.nome, cpf: S.dados.cpf, nascimento: S.dados.nascimento, celular: S.dados.celular, sexo: S.dados.sexo, email: S.dados.email,
      pagamento: S.pag, convenio_id: S.pag === "convenio" && S.convenio ? S.convenio.id : "",
    })
      .then(function (j) {
        S.feito = j;
        try {
          sessionStorage.setItem("cd-cpf", S.dados.cpf);
        } catch (e) {
          /* sem armazenamento: a pessoa digita o CPF de novo */
        }
        render();
      })
      .catch(function (err) {
        S.enviando = false;
        if (marcando) marcando.hidden = true;
        seguirBtn.textContent = "Tentar de novo";
        seguirBtn.disabled = false;
        errEl.hidden = false;
        errEl.textContent = (err && err.message) || "Não conseguimos marcar agora. Tente de novo ou ligue para " + TEL + ".";
      });
  }

  function renderFeito() {
    var simulado = S.feito.demo || S.feito.simulado;
    passoTxt.textContent = simulado ? "Teste concluído" : "Consulta marcada";
    titulo.textContent = simulado ? "Tudo certo no teste" : "Pronto, sua consulta está marcada";
    resumoTxt.textContent = "";
    barra.style.transform = "scaleX(1)";
    pe.hidden = false;
    voltarBtn.hidden = true;
    seguirBtn.hidden = true;
    peFeito.hidden = false;
    corpo.innerHTML =
      '<div class="ag-feito">' +
      comprovante().replace('<p class="ag-pagar__obs ag-conv-status">Conferindo se o convênio cobre esta consulta…</p>', '<p class="ag-pagar__obs">Leve a carteirinha do convênio.</p>') +
'<p class="ag-nota">Para remarcar ou cancelar, entre em Meus agendamentos com o CPF e a data de nascimento, ou ligue para ' + TEL_LINK + ".</p>" +
      "</div>";
    corpo.scrollTop = 0;
    titulo.focus({ preventScroll: true });
  }

  /* Arquivo .ics para o celular ou o computador guardar a consulta na agenda */
  function baixarCalendario() {
    var u = unidade(S.unidade);
    var p = S.slot.data.replace(/-/g, "");
    var h = S.slot.horario.slice(0, 5).replace(":", "");
    var ini = new Date(+p.slice(0, 4), +p.slice(4, 6) - 1, +p.slice(6, 8), +h.slice(0, 2), +h.slice(2, 4));
    var fim = new Date(ini.getTime() + 30 * 60000);
    function fmt(d) {
      return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0") + "T" + String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0") + "00";
    }
    function txt(s) {
      return String(s || "").replace(/[\\,;]/g, function (c) { return "\\" + c; }).replace(/\n/g, "\\n");
    }
    var pg = textoPagamento() || { titulo: "", valor: "" };
    var ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Clinica Dias//Agendamento//PT-BR", "BEGIN:VEVENT",
      "UID:" + Date.now() + "@clinicadias.com", "DTSTAMP:" + fmt(new Date()),
      "DTSTART;TZID=America/Sao_Paulo:" + fmt(ini), "DTEND;TZID=America/Sao_Paulo:" + fmt(fim),
      "SUMMARY:" + txt("Consulta de " + S.esp.nome.toLowerCase() + " · " + S.medico.nome),
      "LOCATION:" + txt("Clínica Dias " + u.nome + ", " + u.endereco),
      "DESCRIPTION:" + txt("Pagamento na clínica, no dia: " + pg.titulo + (pg.valor ? " " + pg.valor : "") + ". Leve documento com foto. Dúvidas: " + TEL),
      "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:Consulta na Clínica Dias", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = "consulta-clinica-dias.ics";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }

  /* ------------------------------------------------------------ demonstração (?demo=1) */

  function dadosDemo() {
    var u = {
      0: { nome: "Timóteo · Portaria I", endereco: "Rua Doutor Tadeu Damásio dos Reis, 450, loja 1, Santa Maria" },
      1: { nome: "Coronel Fabriciano", endereco: "Rua Pedro Nolasco, 107, Centro" },
      8: { nome: "Ipatinga", endereco: "Avenida Brasil, 700, loja 1, Iguaçu" },
    };
    function esp(id, nome, meds) {
      return { id: id, nome: nome, medicos: meds.map(function (m, i) { return { id: id * 10 + i, nome: m[0], unidades: m[1] }; }) };
    }
    return { unidades: u, especialidades: [
      esp(96, "Cardiologia", [["Dr. Exemplo Cardiologista", [0, 1]], ["Dra. Exemplo Arritmia", [0]]]),
      esp(227, "Clínica Geral", [["Dra. Exemplo Clínica", [0, 1, 8]]]),
      esp(126, "Oftalmologia", [["Dr. Exemplo Oftalmo", [0, 1, 8]]]),
    ] };
  }
  function precosDemo() {
    return { particular: { dinheiro_pix: { valor: "R$ 500,00" }, cartao: { valor: "R$ 560,00" } }, descontos: [] };
  }
  function horariosDemo() {
    var out = [], d = new Date(), n = 0;
    while (out.length < 40 && n < 30) {
      d.setDate(d.getDate() + 1);
      n++;
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      var iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      ["08:00", "08:40", "09:20", "10:00", "14:00", "14:40", "15:20", "16:00"].forEach(function (h, i) {
        if ((i + n) % 3 !== 0) out.push({ data: iso, horario: h });
      });
    }
    return out;
  }
})();
