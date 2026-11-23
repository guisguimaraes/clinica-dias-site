/* Adaptado do site do COD para a Clínica Dias (todas as especialidades).
   "Meus agendamentos": a pessoa entra com CPF + data de nascimento (os mesmos do cadastro
   na Clínica Dias) e vê as próximas consultas e o histórico. Consultas podem ser canceladas
   ou remarcadas aqui; exames e cirurgias, só pelo telefone.
   A sessão (um código aleatório do servidor) fica no sessionStorage: some ao fechar a aba
   e expira sozinha em 30 minutos sem uso. */
(function () {
  "use strict";

  var root = document.querySelector("[data-meus]");
  if (!root) return;

  var API = (document.documentElement.getAttribute("data-agenda-api") || "").replace(/\/?$/, "/");
  if (/^(127\.0\.0\.1|localhost)$/.test(location.hostname)) API = "http://127.0.0.1:3100/api/";
  // nomes das unidades vêm da ponte (GET /api/unidades); sem ela, fica o nome que vier na consulta
  var DATA = { medicos: [], unidades: {} };
  fetch(API + "unidades", { headers: { Accept: "application/json" } })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      var u = j.unidades || {};
      if (Array.isArray(u)) u.forEach(function (x) { DATA.unidades[String(x.id)] = x; });
      else DATA.unidades = u;
      if (S.proximas) render();
    })
    .catch(function () {});
  var CHAVE = "cd-meus";
  var MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  var MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var SEMANA_LONGA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  var SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  var TEL = '<a href="tel:+553138496156">(31) 3849-6156</a>';

  var S = { sessao: ler(), proximas: null, historico: null, erroLista: "", aviso: null, aberto: null, desde: 0, animar: false };
  var relogio = null;

  /* Etapas que o servidor faz de verdade, na ordem. O tempo de cada uma é o que o Feegow costuma levar. */
  var ETAPAS = [
    { ate: 0, texto: "Cadastro conferido" },
    { ate: 9, texto: "Procurando na agenda dos próximos 6 meses" },
    { ate: 14, texto: "Conferindo a unidade de cada consulta" },
    { ate: Infinity, texto: "Colocando em ordem de data" },
  ];
  var reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- utilidades ---------- */
  function ler() {
    try {
      return JSON.parse(sessionStorage.getItem(CHAVE) || "null");
    } catch (e) {
      return null;
    }
  }
  function gravar(v) {
    try {
      if (v) sessionStorage.setItem(CHAVE, JSON.stringify(v));
      else sessionStorage.removeItem(CHAVE);
    } catch (e) {
      /* navegador sem armazenamento: a sessão vale só enquanto a página estiver aberta */
    }
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function parseData(iso) {
    var p = String(iso).split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function dataLonga(iso) {
    var d = parseData(iso);
    return SEMANA_LONGA[d.getDay()] + ", " + d.getDate() + " de " + MESES_LONGOS[d.getMonth()];
  }
  function hora(h) {
    return String(h || "").slice(0, 5);
  }
  function medico(a) {
    return a.medico;
  }
  function unidade(a) {
    var u = a.unidade_id != null ? DATA.unidades[String(a.unidade_id)] : null;
    return u ? { nome: u.nome, endereco: u.endereco } : { nome: a.unidade, endereco: "" };
  }

  function pedir(metodo, caminho, corpo) {
    var h = { Accept: "application/json" };
    if (corpo) h["Content-Type"] = "application/json";
    if (S.sessao) h.Authorization = "Bearer " + S.sessao.token;
    return fetch(API + caminho, { method: metodo, headers: h, body: corpo ? JSON.stringify(corpo) : undefined }).then(
      function (r) {
        return r
          .json()
          .catch(function () {
            return { erro: "A agenda está fora do ar agora. Tente mais tarde ou ligue para " + "(31) 3849-6156." };
          })
          .then(function (j) {
            if (r.status === 401 && S.sessao) {
              sairLocal("Sua sessão terminou. Entre de novo para ver as suas consultas.");
              throw new Error("sessao");
            }
            if (!r.ok || j.erro) throw new Error(j.erro || "Algo deu errado. Tente de novo.");
            return j;
          });
      }
    );
  }

  function mascara(input, fn) {
    input.addEventListener("input", function () {
      input.value = fn(input.value.replace(/\D/g, ""));
    });
  }
  function fmtCpf(d) {
    d = d.slice(0, 11);
    return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  function fmtData(d) {
    d = d.slice(0, 8);
    return d.replace(/^(\d{2})(\d)/, "$1/$2").replace(/^(\d{2})\/(\d{2})(\d)/, "$1/$2/$3");
  }

  /* ---------- entrar ---------- */
  function telaEntrar(msg) {
    var cpf = "";
    try {
      cpf = sessionStorage.getItem("cd-cpf") || "";
    } catch (e) {
      /* sem armazenamento */
    }
    root.innerHTML =
      '<div class="meus__login">' +
      '<div class="meus__intro">' +
      '<p class="sobretitulo">Acesso do paciente</p>' +
      '<h2 class="meus__h" tabindex="-1">Entre com o CPF e a data de nascimento</h2>' +
      "<p>São os dados do seu cadastro na Clínica Dias. Não precisa criar senha.</p>" +
      '<ul class="meus__perks">' +
      "<li>Veja as próximas consultas, com dia, hora, médico e unidade.</li>" +
      "<li>Remarque ou cancele uma consulta sem precisar ligar.</li>" +
      "<li>Confira o histórico dos últimos 12 meses.</li>" +
      "</ul>" +
      "</div>" +
      '<form class="meus__form" novalidate>' +
      '<label class="afield"><span>CPF do paciente</span><input name="cpf" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" maxlength="14" value="' + esc(fmtCpf(cpf.replace(/\D/g, ""))) + '" required /></label>' +
      '<label class="afield"><span>Data de nascimento</span><input name="nascimento" inputmode="numeric" placeholder="dd/mm/aaaa" maxlength="10" autocomplete="bday" required /></label>' +
      '<p class="agenda__error" role="alert"' + (msg ? "" : " hidden") + ">" + esc(msg || "") + "</p>" +
      '<button type="submit" class="botao botao-laranja meus__entrar">Ver minhas consultas </button>' +
      '<p class="meus__note">O acesso fica aberto só neste navegador e fecha sozinho depois de 30 minutos sem uso.</p>' +
      "</form>" +
      "</div>";
    var form = root.querySelector("form");
    var err = form.querySelector(".agenda__error");
    var btn = form.querySelector("button");
    mascara(form.cpf, fmtCpf);
    mascara(form.nascimento, fmtData);
    (form.cpf.value ? form.nascimento : form.cpf).focus({ preventScroll: true });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var cpf = form.cpf.value.replace(/\D/g, "");
      var nasc = form.nascimento.value;
      if (cpf.length !== 11 || !/^\d{2}\/\d{2}\/\d{4}$/.test(nasc)) {
        err.hidden = false;
        err.textContent = cpf.length !== 11 ? "Digite os 11 números do CPF." : "Digite a data de nascimento como dia/mês/ano, por exemplo 05/03/1958.";
        return;
      }
      err.hidden = true;
      btn.disabled = true;
      btn.firstChild.textContent = "Conferindo… ";
      pedir("POST", "meus/entrar", { cpf: cpf, nascimento: nasc })
        .then(function (j) {
          S.sessao = { token: j.token, nome: j.primeiro_nome };
          gravar(S.sessao);
          carregar();
        })
        .catch(function (e2) {
          btn.disabled = false;
          btn.firstChild.textContent = "Ver minhas consultas ";
          err.hidden = false;
          err.textContent = e2.message;
        });
    });
  }

  function sairLocal(msg) {
    clearInterval(relogio);
    S.sessao = null;
    S.proximas = S.historico = null;
    gravar(null);
    telaEntrar(msg);
  }

  /* ---------- lista ---------- */
  function carregar() {
    S.proximas = S.historico = null;
    S.erroLista = "";
    S.aberto = null;
    S.desde = Date.now();
    render();
    clearInterval(relogio);
    relogio = setInterval(atualizarEtapas, 400);
    pedir("GET", "meus/agendamentos?periodo=proximos")
      .then(function (j) {
        S.proximas = j.agendamentos;
        S.animar = !reduz;
        clearInterval(relogio);
        render();
        S.animar = false;
      })
      .catch(function (e) {
        clearInterval(relogio);
        if (e.message === "sessao") return;
        S.erroLista = e.message;
        S.proximas = [];
        render();
      });
    pedir("GET", "meus/agendamentos?periodo=historico")
      .then(function (j) {
        S.historico = j.agendamentos;
        atualizarHistorico();
      })
      .catch(function (e) {
        if (e.message === "sessao") return;
        S.historico = [];
        atualizarHistorico();
      });
  }

  function render() {
    if (!S.sessao) return telaEntrar();
    var nome = S.sessao.nome;
    var html =
      '<div class="meus__head">' +
      "<div>" +
      '<p class="sobretitulo">' + (nome ? "Olá, " + esc(nome) : "Acesso do paciente") + "</p>" +
      '<h2 class="meus__h" tabindex="-1">Suas consultas</h2>' +
      "</div>" +
      '<div class="meus__head-actions">' +
      '<button type="button" class="botao botao-laranja" data-agenda>Agendar consulta</button>' +
      '<button type="button" class="meus__sair">Sair</button>' +
      "</div>" +
      "</div>";

    if (S.aviso) html += '<p class="meus__aviso meus__aviso--' + S.aviso.tipo + '" role="status">' + S.aviso.texto + "</p>";

    html += '<h3 class="meus__title">Próximas</h3>';
    if (S.proximas === null) {
      html += carregando();
    } else if (S.erroLista) {
      html += '<p class="agenda__error">' + esc(S.erroLista) + "</p>";
    } else {
      var ativas = S.proximas.filter(function (a) {
        return a.ativa;
      });
      html += ativas.length
        ? '<ul class="meus__list' + (S.animar ? " is-entrando" : "") + '">' + ativas.map(cartao).join("") + "</ul>"
        : '<div class="agenda__empty"><strong>Você não tem consultas marcadas.</strong><p>Para marcar, use o botão Agendar consulta ou ligue para ' + TEL + ".</p></div>";
    }

    html += '<h3 class="meus__title">Histórico <small>últimos 12 meses</small></h3>';
    html += '<div class="meus__histbox">' + historico() + "</div>";
    html += '<p class="agenda__hint">Exames e cirurgias só podem ser alterados pelo telefone: ' + TEL + ".</p>";

    var inicio = S.proximas === null && S.historico === null; // acabou de entrar: leva o foco ao título
    root.innerHTML = html;
    if (inicio) root.querySelector(".meus__h").focus({ preventScroll: true });
    if (S.aberto) abrirPainel(S.aberto.id, S.aberto.tipo, true);
  }

  /* O histórico chega separado das próximas: troca só a caixa dele, sem redesenhar o resto
     (não corta a entrada dos cartões nem a animação de carregamento). */
  function atualizarHistorico() {
    var box = root.querySelector(".meus__histbox");
    if (box) box.innerHTML = historico();
    else render();
  }

  function historico() {
    var html = "";
    if (S.historico === null) {
      html += '<ul class="meus__hist" aria-hidden="true">' + new Array(3).join('<li class="mhist mhist--skel"><span></span><span></span></li>') + "</ul>" +
        '<p class="so-leitor" role="status">Carregando o histórico.</p>';
    } else {
      var hist = S.historico.concat(
        (S.proximas || []).filter(function (a) {
          return !a.ativa;
        })
      );
      hist.sort(function (a, b) {
        return (b.data + b.hora).localeCompare(a.data + a.hora);
      });
      html += hist.length
        ? '<ul class="meus__hist">' + hist.map(linha).join("") + "</ul>"
        : '<p class="meus__vazio">Nenhuma consulta nos últimos 12 meses.</p>';
    }
    return html;
  }

  function segundos() {
    return (Date.now() - S.desde) / 1000;
  }

  function etapaAtual(t) {
    for (var i = 1; i < ETAPAS.length; i++) if (t < ETAPAS[i].ate) return i;
    return ETAPAS.length - 1;
  }

  function listaEtapas(t) {
    var atual = etapaAtual(t);
    return ETAPAS.map(function (e, i) {
      return '<li class="' + (i < atual ? "is-done" : i === atual ? "is-current" : "") + '">' + e.texto + "</li>";
    }).join("");
  }

  /* Tela de carregamento: um olho no exame de lâmpada de fenda. O feixe de luz passa e a pupila
     contrai, como acontece no consultório. As animações recebem um atraso negativo igual ao tempo
     já passado, então continuam do mesmo ponto quando a tela é redesenhada (ex.: o histórico chegou). */
  function carregando() {
    var t = segundos();
    var esqueleto =
      '<li class="mcard mcard--skel"><span class="mcard__date"></span><span class="mskel"><i></i><i></i><i></i><i></i></span></li>';
    return (
      '<div class="mload" style="--t: -' + t.toFixed(2) + 's">' +
      '<span class="agenda__spin mload__spin" aria-hidden="true"></span>' +
      '<div class="mload__info">' +
      '<p class="mload__title" role="status">Buscando as suas consultas na agenda da Clínica Dias</p>' +
      '<ol class="mload__steps">' + listaEtapas(t) + "</ol>" +
      '<div class="mload__bar" aria-hidden="true"><span></span></div>' +
      '<p class="mload__time">Costuma levar uns 15 segundos.</p>' +
      "</div>" +
      "</div>" +
      '<ul class="meus__list" aria-hidden="true">' + esqueleto + esqueleto + "</ul>"
    );
  }

  function atualizarEtapas() {
    var ol = root.querySelector(".mload__steps");
    if (!ol || S.proximas !== null) return clearInterval(relogio);
    var t = segundos();
    var atual = etapaAtual(t);
    Array.prototype.forEach.call(ol.children, function (li, i) {
      li.className = i < atual ? "is-done" : i === atual ? "is-current" : "";
    });
    if (t > 25) root.querySelector(".mload__time").textContent = "Está demorando mais que o normal. Aguarde mais um pouco.";
  }

  function chip(a) {
    var tipo = a.status_id === 7 || a.status_id === 3 ? "ok" : a.status_id === 1 ? "neutro" : "off";
    return '<span class="mchip mchip--' + tipo + '">' + esc(a.status) + "</span>";
  }

  function cartao(a) {
    var d = parseData(a.data);
    var u = unidade(a);
    var acoes = a.pode_cancelar
      ? '<div class="mcard__actions">' +
        (a.pode_remarcar ? '<button type="button" class="botao botao-linha mcard__btn" data-acao="remarcar" data-id="' + a.id + '">Remarcar</button>' : "") +
        '<button type="button" class="mcard__cancel" data-acao="cancelar" data-id="' + a.id + '">Cancelar consulta</button>' +
        "</div>" +
        (a.pode_remarcar ? "" : '<p class="mcard__phone">Para remarcar, ligue para ' + TEL + ".</p>")
      : '<p class="mcard__phone">Para alterar, ligue para ' + TEL + ".</p>";
    return (
      '<li class="mcard" data-id="' + a.id + '">' +
      '<div class="mcard__date" aria-hidden="true"><span class="mcard__day">' + d.getDate() + '</span><span class="mcard__mon">' + MESES[d.getMonth()] + "</span></div>" +
      '<div class="mcard__body">' +
      '<p class="mcard__when"><span>' + dataLonga(a.data) + ", às " + hora(a.hora) + "</span>" + chip(a) + "</p>" +
      '<h4 class="mcard__what">' + esc(a.procedimento) + "</h4>" +
      '<p class="mcard__who">' + esc(medico(a)) + (a.especialidade ? " · " + esc(a.especialidade) : "") + "</p>" +
      (u.nome ? '<p class="mcard__where">' + esc(u.nome) + (u.endereco ? "<small>" + esc(u.endereco) + "</small>" : "") + "</p>" : "") +
      acoes +
      '<div class="mcard__panel" hidden></div>' +
      "</div>" +
      "</li>"
    );
  }

  function linha(a) {
    var d = parseData(a.data);
    return (
      '<li class="mhist">' +
      '<span class="mhist__date">' + d.getDate() + " " + MESES[d.getMonth()] + " " + d.getFullYear() + "</span>" +
      '<span class="mhist__what">' + esc(a.procedimento) + "<small>" + esc(medico(a)) + "</small></span>" +
      chip(a) +
      "</li>"
    );
  }

  /* ---------- cancelar e remarcar ---------- */
  function achar(id) {
    var l = S.proximas || [];
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }

  function abrirPainel(id, tipo, reabrindo) {
    var a = achar(id);
    var li = root.querySelector('.mcard[data-id="' + id + '"]');
    if (!a || !li) return;
    root.querySelectorAll(".mcard__panel").forEach(function (p) {
      p.hidden = true;
      p.innerHTML = "";
    });
    S.aberto = { id: id, tipo: tipo, dia: reabrindo && S.aberto ? S.aberto.dia : null, slot: reabrindo && S.aberto ? S.aberto.slot : null, slots: reabrindo && S.aberto ? S.aberto.slots : null };
    var p = li.querySelector(".mcard__panel");
    p.hidden = false;
    if (tipo === "cancelar") {
      p.innerHTML =
        '<p class="mpanel__q">Cancelar a consulta de <strong>' + dataLonga(a.data) + ", às " + hora(a.hora) + "</strong>?</p>" +
        "<p>O horário fica livre para outro paciente.</p>" +
        '<p class="agenda__error" hidden></p>' +
        '<div class="mpanel__actions">' +
        '<button type="button" class="botao mpanel__danger" data-confirma="cancelar">Sim, cancelar</button>' +
        '<button type="button" class="mpanel__back" data-fechar>Manter a consulta</button>' +
        "</div>";
      p.querySelector("[data-confirma]").focus({ preventScroll: true });
      return;
    }
    painelRemarcar(a, p);
  }

  function painelRemarcar(a, p) {
    var A = S.aberto;
    if (!A.slots) {
      p.innerHTML = '<div class="agenda__loading"><span class="agenda__spin" aria-hidden="true"></span>Procurando horários livres com o mesmo médico, na mesma unidade…</div>';
      fetch(API + "horarios?profissional_id=" + a.medico_id + "&unidade_id=" + a.unidade_id + (a.especialidade_id ? "&especialidade_id=" + a.especialidade_id : ""), { headers: { Accept: "application/json" } })
        .then(function (r) {
          return r.json();
        })
        .then(function (j) {
          if (!S.aberto || S.aberto.id !== a.id) return;
          if (j.erro) throw new Error(j.erro);
          S.aberto.slots = j.horarios || [];
          painelRemarcar(a, p);
        })
        .catch(function () {
          p.innerHTML = '<p class="agenda__error">Não conseguimos buscar os horários agora. Ligue para ' + TEL + '.</p><button type="button" class="mpanel__back" data-fechar>Fechar</button>';
        });
      return;
    }
    var dias = [];
    var porDia = {};
    A.slots.forEach(function (s) {
      if (!porDia[s.data]) {
        porDia[s.data] = [];
        dias.push(s.data);
      }
      porDia[s.data].push(s);
    });
    if (!dias.length) {
      p.innerHTML =
        '<div class="agenda__empty"><strong>Sem horários livres nos próximos 30 dias.</strong><p>Ligue para ' + TEL + " que a recepção procura um encaixe.</p></div>" +
        '<button type="button" class="mpanel__back" data-fechar>Fechar</button>';
      return;
    }
    if (!A.dia || !porDia[A.dia]) A.dia = dias[0];
    var html =
      '<p class="mpanel__q">Escolha o novo dia e horário</p>' +
      '<div class="mpanel__days" role="group" aria-label="Dias com horário livre">' +
      dias
        .map(function (d) {
          var x = parseData(d);
          return (
            '<button type="button" class="mday' + (d === A.dia ? " is-selected" : "") + '" data-dia="' + d + '" aria-pressed="' + (d === A.dia) + '">' +
            "<small>" + SEMANA[x.getDay()] + "</small><strong>" + x.getDate() + "</strong><small>" + MESES[x.getMonth()] + "</small></button>"
          );
        })
        .join("") +
      "</div>" +
      '<p class="mpanel__daylabel">' + dataLonga(A.dia) + "</p>" +
      '<div class="agenda__times mpanel__times" role="group" aria-label="Horários livres">' +
      porDia[A.dia]
        .map(function (s) {
          var on = A.slot && A.slot.data === s.data && A.slot.horario === s.horario;
          return '<button type="button" class="atime' + (on ? " is-selected" : "") + '" data-slot="' + esc(s.horario) + '" aria-pressed="' + !!on + '">' + hora(s.horario) + "</button>";
        })
        .join("") +
      "</div>" +
      '<p class="agenda__error" hidden></p>' +
      '<div class="mpanel__actions">' +
      '<button type="button" class="botao" data-confirma="remarcar"' + (A.slot ? "" : " disabled") + ">" +
      (A.slot ? "Remarcar para " + hora(A.slot.horario) : "Escolha um horário") +
      "</button>" +
      '<button type="button" class="mpanel__back" data-fechar>Voltar</button>' +
      "</div>";
    p.innerHTML = html;
  }

  function confirmar(tipo, botao) {
    var A = S.aberto;
    var a = A && achar(A.id);
    if (!a) return;
    var p = root.querySelector('.mcard[data-id="' + a.id + '"] .mcard__panel');
    var err = p.querySelector(".agenda__error");
    botao.disabled = true;
    botao.textContent = tipo === "cancelar" ? "Cancelando…" : "Remarcando…";
    var corpo = { agendamento_id: a.id };
    if (tipo === "remarcar") {
      corpo.data = A.slot.data;
      corpo.horario = A.slot.horario;
    }
    pedir("POST", "meus/" + tipo, corpo)
      .then(function (j) {
        var quando = tipo === "remarcar" ? dataLonga(A.slot.data) + ", às " + hora(A.slot.horario) : "";
        S.aviso = j.simulado
          ? { tipo: "teste", texto: "Modo de teste: nada foi alterado na agenda. No site no ar, a consulta seria " + (tipo === "cancelar" ? "cancelada." : "remarcada para " + quando + ".") }
          : { tipo: "ok", texto: tipo === "cancelar" ? "Consulta cancelada. O horário já foi liberado na agenda da clínica." : "Pronto, sua consulta foi remarcada para " + quando + "." };
        S.aberto = null;
        if (j.simulado) render();
        else carregar();
        var av = root.querySelector(".meus__aviso");
        if (av) av.scrollIntoView({ block: "nearest", behavior: "smooth" });
      })
      .catch(function (e) {
        if (e.message === "sessao") return;
        botao.disabled = false;
        botao.textContent = tipo === "cancelar" ? "Sim, cancelar" : "Tentar de novo";
        err.hidden = false;
        err.textContent = e.message;
      });
  }

  root.addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t || !root.contains(t)) return;
    if (t.classList.contains("meus__sair")) {
      pedir("POST", "meus/sair", {}).catch(function () {});
      S.aviso = null;
      return sairLocal();
    }
    if (t.dataset.acao) return abrirPainel(+t.dataset.id, t.dataset.acao);
    if (t.hasAttribute("data-fechar")) {
      var id = S.aberto && S.aberto.id;
      S.aberto = null;
      var p = t.closest(".mcard__panel");
      p.hidden = true;
      p.innerHTML = "";
      var volta = id && root.querySelector('.mcard[data-id="' + id + '"] [data-acao]');
      if (volta) volta.focus();
      return;
    }
    if (t.dataset.dia) {
      S.aberto.dia = t.dataset.dia;
      S.aberto.slot = null;
      return painelRemarcar(achar(S.aberto.id), t.closest(".mcard__panel"));
    }
    if (t.dataset.slot) {
      S.aberto.slot = { data: S.aberto.dia, horario: t.dataset.slot };
      painelRemarcar(achar(S.aberto.id), t.closest(".mcard__panel"));
      var c = root.querySelector('[data-confirma="remarcar"]');
      if (c) c.focus({ preventScroll: true });
      return;
    }
    if (t.dataset.confirma) return confirmar(t.dataset.confirma, t);
  });

  if (S.sessao) carregar();
  else telaEntrar();
})();
