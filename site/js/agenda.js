/* Agendamento on-line da Clínica Dias: especialidade → médico → unidade → dia e hora → dados → confirmação.
   Adaptado do site do COD (cod.clinicadias.com). Fala com a ponte do Feegow em agenda.clinicadias.com,
   o endereço vem de <html data-agenda-api="...">. A chave do Feegow fica só na ponte, nunca aqui.
   Qualquer elemento com data-agenda abre a janela; data-especialidade="Cardiologia" já abre na especialidade.
   Sem a ponte no ar, a janela mostra os telefones. Para testar sem ponte: abra a página com ?demo=1. */
(function () {
  "use strict";

  var root = document.documentElement;
  var API = (root.getAttribute("data-agenda-api") || "").replace(/\/?$/, "/");
  // no computador (python -m http.server 8080) fala com a ponte rodando em http://127.0.0.1:3100
  if (/^(127\.0\.0\.1|localhost)$/.test(location.hostname)) API = "http://127.0.0.1:3100/api/";
  var DEMO_URL = /[?&]demo=1\b/.test(location.search);
  if (!API && !DEMO_URL) return;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var TITLES = ["Escolha a especialidade", "Escolha o médico", "Escolha a unidade", "Escolha o dia e o horário", "Seus dados", "Confira e confirme"];
  var MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  var MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var SEMANA_LONGA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

  /* ------------------------------------------------------------ janela (montada aqui, vale para todas as páginas) */

  var modal = document.createElement("div");
  modal.id = "agenda";
  modal.className = "booking agenda";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "agenda-title");
  modal.hidden = true;
  modal.innerHTML =
    '<div class="booking__backdrop" data-aclose></div>' +
    '<div class="booking__panel agenda__panel">' +
    '<div class="agenda__head"><div><p class="sobretitulo">Agendamento on-line</p><h2 id="agenda-title">Escolha a especialidade</h2></div>' +
    '<button type="button" class="booking__close agenda__close" data-aclose aria-label="Fechar">' +
    '<svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" fill="none" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19" stroke-linecap="round" /></svg></button></div>' +
    '<ol class="agenda__steps" aria-label="Etapas"><li>Especialidade</li><li>Médico</li><li>Unidade</li><li>Horário</li><li>Dados</li><li>Confirmar</li></ol>' +
    '<p class="agenda__demo" hidden>Demonstração: médicos e horários de exemplo. Nada é marcado na agenda.</p>' +
    '<div class="agenda__body" aria-live="polite"></div>' +
    '<div class="agenda__foot"><button type="button" class="agenda__back" hidden>Voltar</button>' +
    '<button type="button" class="botao agenda__next">Continuar</button></div>' +
    "</div>";
  document.body.appendChild(modal);

  var body = modal.querySelector(".agenda__body");
  var title = modal.querySelector("#agenda-title");
  var backBtn = modal.querySelector(".agenda__back");
  var nextBtn = modal.querySelector(".agenda__next");
  var steps = modal.querySelectorAll(".agenda__steps li");
  var demoBar = modal.querySelector(".agenda__demo");

  var DATA = null; // {especialidades: [{id, nome, medicos: [{id, nome, sexo, unidades}]}], unidades: {id: {nome, endereco}}}
  var DEMO = DEMO_URL;
  var S = null;
  var lastTrigger = null;
  var pedidoInicial = null;

  function reset() {
    S = { step: 0, esp: null, medico: null, unidade: null, slots: null, dia: null, slot: null, dados: {}, cad: null, cpfBuscado: null, valor: null, enviando: false, feito: null, busca: "" };
  }

  function normal(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }

  function espPorNome(nome) {
    if (!DATA || !nome) return null;
    var n = normal(nome);
    var lista = DATA.especialidades;
    for (var i = 0; i < lista.length; i++) if (normal(lista[i].nome) === n) return lista[i];
    // "Ginecologia e Obstetrícia" no site × "Ginecologia" no Feegow, "Hematologia" × "Hematologia e Hemoterapia"
    for (var j = 0; j < lista.length; j++) {
      var m = normal(lista[j].nome);
      if (m.indexOf(n) === 0 || n.indexOf(m) === 0) return lista[j];
    }
    return null;
  }

  function aplicarPedido(p) {
    if (!p || !p.especialidade) return;
    var e = espPorNome(p.especialidade);
    if (!e) return;
    escolherEsp(e);
  }

  function escolherEsp(e) {
    if (!S.esp || S.esp.id !== e.id) {
      S.medico = null;
      S.unidade = null;
      S.slots = null;
      S.slot = null;
      S.dia = null;
    }
    S.esp = e;
    S.step = 1;
    if (e.medicos.length === 1) escolherMedico(e.medicos[0]);
  }

  function escolherMedico(m) {
    if (!S.medico || S.medico.id !== m.id) {
      S.unidade = m.unidades.length === 1 ? m.unidades[0] : null;
      S.slots = null;
      S.slot = null;
      S.dia = null;
    }
    S.medico = m;
    S.step = m.unidades.length === 1 ? 3 : 2;
  }

  /* O Feegow tem especialidades com os mesmos médicos (Ginecologia × Ginecologia e Obstetrícia,
     cinco de Odontologia com a mesma dentista, Oftalmologia × Oftalmologia Infantil).
     Na tela fica uma só; a outra vira palavra de busca. */
  var JUNTAR = { 271: 128, 254: 299, 157: 299, 242: 299, 158: 299, 295: 126 };
  var NOMES = { 299: "Odontologia", 128: "Ginecologia e Obstetrícia" };
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

  function faixa(m) {
    var min = m.idade_minima, max = m.idade_maxima;
    if (max != null && max <= 18) return "Atende crianças e adolescentes até " + max + " anos";
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

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function parseData(iso) {
    var p = iso.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function dataLonga(iso) {
    var d = parseData(iso);
    return SEMANA_LONGA[d.getDay()] + ", " + d.getDate() + " de " + MESES_LONGOS[d.getMonth()];
  }
  function hora(h) {
    return h.slice(0, 5).replace(":", "h");
  }
  /* Fotos dos médicos: o Feegow não manda foto, então ficam em img/medicos/<nome-sem-acento>.jpg (200 px de largura).
     Para pôr a foto de outro médico, salve o arquivo com esse nome e acrescente o nome nesta lista.
     Sem foto, aparecem as iniciais. */
  var FOTOS = ["davidson-lourenco-dias", "diego-lourenco-dias", "eduardo-de-abreu-borges", "felipe-ferreira-lopes"];
  function slug(nome) {
    return normal(String(nome || "").replace(/^(Dra?|Sra?)\.\s*/i, "")).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  function avatar(m) {
    var s = slug(m.nome);
    if (FOTOS.indexOf(s) >= 0) return '<span class="adoc__photo" aria-hidden="true"><img src="/img/medicos/' + s + '.jpg" alt="" loading="lazy" width="200" height="250" /></span>';
    return '<span class="adoc__photo adoc__photo--sigla" aria-hidden="true">' + esc(iniciais(m.nome)) + "</span>";
  }

  function iniciais(nome) {
    var p = String(nome || "").replace(/^Dra?\.\s*/i, "").split(/\s+/).filter(Boolean);
    return ((p[0] || "")[0] || "") + ((p.length > 1 ? p[p.length - 1] : "")[0] || "");
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
    if (DATA) aplicarPedido(pedidoInicial);
    render();
    modal.querySelector(".agenda__close").focus();
  }
  function close() {
    modal.classList.remove("is-open");
    root.style.overflow = "";
    setTimeout(
      function () {
        if (!modal.classList.contains("is-open")) modal.hidden = true;
      },
      reduceMotion ? 0 : 350
    );
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-agenda]");
    if (t) {
      e.preventDefault();
      // fecha o painel da especialidade e o menu do celular, se estiverem abertos
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

  backBtn.addEventListener("click", function () {
    if (S.step === 3 && S.medico && S.medico.unidades.length === 1) S.step = S.esp.medicos.length === 1 ? 0 : 1;
    else if (S.step === 2 && S.esp.medicos.length === 1) S.step = 0;
    else S.step = Math.max(0, S.step - 1);
    if (S.step < 3) S.slots = null;
    render();
  });
  nextBtn.addEventListener("click", function () {
    if (S.step === 4 && !validarDados()) return;
    if (S.step === 5) return confirmar();
    S.step++;
    render();
  });

  /* ------------------------------------------------------------ lista de médicos (da ponte, montada do Feegow) */

  var carregando = null;
  function carregarMedicos() {
    if (DATA || carregando) return;
    if (DEMO) {
      DATA = dadosDemo();
      if (S) aplicarPedido(pedidoInicial);
      return;
    }
    carregando = fetch(API + "medicos", { headers: { Accept: "application/json" } })
      .then(function (r) {
        if (!r.ok) throw new Error("http " + r.status);
        return r.json();
      })
      .then(function (j) {
        if (!j || !j.especialidades || !j.especialidades.length) throw new Error("vazio");
        j.especialidades = agrupar(j.especialidades);
        j.especialidades.sort(function (a, b) {
          return a.nome.localeCompare(b.nome, "pt-BR");
        });
        DATA = j;
        if (S && !modal.hidden && S.step === 0) aplicarPedido(pedidoInicial);
      })
      .catch(function () {
        DATA = { falhou: true, especialidades: [], unidades: {} };
      })
      .then(function () {
        carregando = null;
        if (!modal.hidden) render();
      });
  }

  /* ------------------------------------------------------------ desenho de cada passo */

  function render() {
    if (S.feito) return renderFeito();
    title.textContent = TITLES[S.step];
    Array.prototype.forEach.call(steps, function (li, i) {
      li.classList.toggle("is-done", i < S.step);
      li.classList.toggle("is-current", i === S.step);
      if (i === S.step) li.setAttribute("aria-current", "step");
      else li.removeAttribute("aria-current");
    });
    demoBar.hidden = !DEMO;
    modal.querySelector(".agenda__foot").hidden = S.step === 0;
    backBtn.hidden = S.step === 0;
    nextBtn.hidden = S.step < 3;
    nextBtn.textContent = S.step === 5 ? "Confirmar agendamento" : "Continuar";
    [renderEsp, renderMedico, renderUnidade, renderHorario, renderDados, renderRevisao][S.step]();
    atualizarNext();
    body.scrollTop = 0;
  }

  function atualizarNext() {
    var ok = [!!S.esp, !!S.medico, !!S.unidade, !!S.slot, S.cad !== "buscando", !S.enviando][S.step];
    nextBtn.disabled = !ok;
  }

  function renderEsp() {
    if (!DATA) {
      body.innerHTML = '<div class="agenda__loading"><span class="agenda__spin" aria-hidden="true"></span>Buscando as especialidades com horário livre…</div>';
      carregarMedicos();
      return;
    }
    if (DATA.falhou) {
      modal.querySelector(".agenda__foot").hidden = true;
      body.innerHTML =
        '<div class="agenda__empty"><strong>O agendamento on-line está fora do ar agora.</strong><p>Ligue para ' + telefones() +
        ", de segunda a sexta, das 8h às 18h. A equipe marca a sua consulta pelo telefone.</p></div>";
      return;
    }
    var html =
      '<label class="afield abusca"><span>Procure pela especialidade ou pelo nome do médico</span>' +
      '<input type="search" name="busca" value="' + esc(S.busca) + '" placeholder="Ex.: cardiologia, pediatria, Dr. Douglas" autocomplete="off" enterkeyhint="search" /></label>' +
      '<div class="aesp-lista"></div>' +
      '<p class="agenda__hint">Não achou a especialidade? Algumas só são marcadas pelo telefone: ' + telefones() + ".</p>";
    body.innerHTML = html;
    var input = body.querySelector("[name=busca]");
    var lista = body.querySelector(".aesp-lista");
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
        lista.innerHTML = '<p class="agenda__hint">Nada encontrado para "' + esc(S.busca) + '". Tente outro nome ou ligue para ' + telefones() + ".</p>";
        return;
      }
      lista.innerHTML =
        '<ul class="agenda__esps">' +
        itens.map(function (e) {
          var sel = S.esp && S.esp.id === e.id;
          var n = e.medicos.length;
          var porNome = q && normal(e.busca || e.nome).indexOf(q) < 0
            ? e.medicos.filter(function (m) { return normal(m.nome).indexOf(q) >= 0; }).map(function (m) { return m.nome; }).join(", ")
            : n + (n === 1 ? " médico" : " médicos") + " com horário livre";
          return (
            '<li><button type="button" class="aesp' + (sel ? " is-selected" : "") + '" data-id="' + e.id + '" aria-pressed="' + sel + '">' +
            "<strong>" + esc(e.nome) + "</strong><small>" + esc(porNome) + "</small>" +
            '<span class="aesp__seta" aria-hidden="true"></span></button></li>'
          );
        }).join("") +
        "</ul>";
      lista.querySelectorAll(".aesp").forEach(function (b) {
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
    var html = '<p class="agenda__lead">' + esc(S.esp.nome) + "<small>Escolha com quem você quer consultar.</small></p><ul class=\"agenda__docs\">";
    S.esp.medicos.forEach(function (m) {
      var sel = S.medico && S.medico.id === m.id;
      var unidades = m.unidades.map(function (u) { return (DATA.unidades[u] || {}).nome; }).filter(Boolean).join(" · ");
      var fx = faixa(m);
      html +=
        '<li><button type="button" class="adoc' + (sel ? " is-selected" : "") + '" data-id="' + m.id + '" aria-pressed="' + sel + '">' +
        avatar(m) +
        '<span class="adoc__text"><strong>' + esc(m.nome) + "</strong><small>" + esc(unidades) + "</small>" +
        (fx ? '<em class="adoc__off">' + esc(fx) + "</em>" : "") + "</span>" +
        '<span class="adoc__check" aria-hidden="true"></span></button></li>';
    });
    html += "</ul>";
    html += '<p class="agenda__hint">Não achou o médico? Ele pode estar sem vaga on-line agora. Ligue para ' + telefones() + ".</p>";
    body.innerHTML = html;
    body.querySelectorAll(".adoc").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = +b.getAttribute("data-id");
        escolherMedico(S.esp.medicos.filter(function (m) { return m.id === id; })[0]);
        render();
      });
    });
  }

  function renderUnidade() {
    var html = '<p class="agenda__lead">' + esc(S.medico.nome) + " atende nestas unidades:</p><ul class=\"agenda__units\">";
    S.medico.unidades.forEach(function (uid) {
      var u = DATA.unidades[uid] || { nome: "Unidade " + uid, endereco: "" };
      var sel = S.unidade === uid;
      html +=
        '<li><button type="button" class="aunit' + (sel ? " is-selected" : "") + '" data-id="' + uid + '" aria-pressed="' + sel + '">' +
        '<span class="aunit__pin" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg></span>' +
        "<span><strong>" + esc(u.nome) + "</strong><small>" + esc(u.endereco) + "</small></span>" +
        '<span class="adoc__check" aria-hidden="true"></span></button></li>';
    });
    body.innerHTML = html + "</ul>";
    body.querySelectorAll(".aunit").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = +b.getAttribute("data-id");
        if (S.unidade !== id) {
          S.slots = null;
          S.slot = null;
          S.dia = null;
        }
        S.unidade = id;
        S.step = 3;
        render();
      });
    });
  }

  function renderHorario() {
    if (!S.slots) {
      body.innerHTML = '<div class="agenda__loading"><span class="agenda__spin" aria-hidden="true"></span>Buscando horários livres de ' + esc(S.medico.nome) + "…</div>";
      carregarHorarios();
      return;
    }
    var u = DATA.unidades[S.unidade] || { nome: "" };
    if (S.slots === "erro") {
      body.innerHTML =
        '<div class="agenda__empty"><strong>Não conseguimos buscar os horários agora.</strong><p>Tente de novo em instantes, ou ligue para ' + telefones() + ".</p></div>";
      return;
    }
    if (!S.slots.length) {
      body.innerHTML =
        '<div class="agenda__empty"><strong>Sem horários livres nos próximos 30 dias.</strong><p>' + esc(S.medico.nome) + " não tem vaga on-line em " + esc(u.nome) +
        ". Escolha outra unidade, outro médico, ou ligue para " + telefones() + ".</p></div>";
      return;
    }
    var dias = [];
    var porDia = {};
    S.slots.forEach(function (s) {
      if (!porDia[s.data]) {
        porDia[s.data] = [];
        dias.push(s.data);
      }
      porDia[s.data].push(s);
    });
    dias.sort();
    if (!S.dia || !porDia[S.dia]) S.dia = dias[0];

    // calendário corrido: da semana do primeiro dia com vaga até a semana do último (atravessa o mês)
    var ini = parseData(dias[0]);
    ini.setDate(ini.getDate() - ini.getDay());
    var fim = parseData(dias[dias.length - 1]);
    fim.setDate(fim.getDate() + (6 - fim.getDay()));
    var m1 = parseData(dias[0]).getMonth();
    var m2 = parseData(dias[dias.length - 1]).getMonth();
    var titulo = MESES_LONGOS[m1] + (m2 !== m1 ? " e " + MESES_LONGOS[m2] : "") + " de " + parseData(dias[dias.length - 1]).getFullYear();

    var cal =
      '<div class="acal"><div class="acal__head"><strong>' + titulo + "</strong></div>" +
      '<div class="acal__grid" aria-label="Dias com horário livre">' +
      ["D", "S", "T", "Q", "Q", "S", "S"].map(function (w) {
        return '<span class="acal__wd" aria-hidden="true">' + w + "</span>";
      }).join("");
    for (var dt = new Date(ini); dt <= fim; dt.setDate(dt.getDate() + 1)) {
      var iso = dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
      var rotulo = dt.getDate() === 1 || dt.getTime() === ini.getTime() ? "<small>" + MESES[dt.getMonth()] + "</small>" : "";
      if (porDia[iso]) {
        var on = iso === S.dia;
        cal +=
          '<button type="button" class="acal__day acal__day--on' + (on ? " is-selected" : "") + '" data-dia="' + iso + '" aria-pressed="' + on + '" aria-label="' +
          dataLonga(iso) + ", " + porDia[iso].length + (porDia[iso].length === 1 ? " horário" : " horários") + '">' + rotulo + dt.getDate() + "</button>";
      } else {
        cal += '<span class="acal__day" aria-hidden="true">' + rotulo + dt.getDate() + "</span>";
      }
    }
    cal += '</div><p class="acal__legend"><span aria-hidden="true"></span>Dias com horário livre</p></div>';

    var grupos = [["Manhã", []], ["Tarde", []]];
    porDia[S.dia].forEach(function (s, i) {
      grupos[+s.horario.slice(0, 2) >= 12 ? 1 : 0][1].push([s, i]);
    });
    var times =
      '<div class="ahours"><p class="agenda__daylabel">' + dataLonga(S.dia) + "<small>" + porDia[S.dia].length + (porDia[S.dia].length === 1 ? " horário livre" : " horários livres") + "</small></p>" +
      grupos.filter(function (g) {
        return g[1].length;
      }).map(function (g) {
        return (
          '<div class="ahours__group"><p class="ahours__label">' + g[0] + '</p><div class="agenda__times" role="listbox" aria-label="Horários da ' + g[0].toLowerCase() + '">' +
          g[1].map(function (p) {
            var s = p[0];
            var sel = S.slot && S.slot.data === s.data && S.slot.horario === s.horario;
            return '<button type="button" role="option" class="atime' + (sel ? " is-selected" : "") + '" data-i="' + p[1] + '" aria-selected="' + !!sel + '">' + hora(s.horario) + "</button>";
          }).join("") +
          "</div></div>"
        );
      }).join("") +
      "</div>";

    body.innerHTML =
      '<p class="agenda__lead">' + esc(S.medico.nome) + "<small>" + esc(S.esp.nome) + " · " + esc(u.nome) + "</small></p>" +
      '<div class="ahor">' + cal + times + "</div>";

    body.querySelectorAll(".acal__day--on").forEach(function (b) {
      b.addEventListener("click", function () {
        S.dia = b.getAttribute("data-dia");
        S.slot = null;
        render();
        var h = body.querySelector(".ahours");
        if (h && window.matchMedia("(max-width: 719px)").matches) h.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      });
    });
    body.querySelectorAll(".atime").forEach(function (b) {
      b.addEventListener("click", function () {
        S.slot = porDia[S.dia][+b.getAttribute("data-i")];
        body.querySelectorAll(".atime").forEach(function (x) {
          x.classList.toggle("is-selected", x === b);
          x.setAttribute("aria-selected", x === b);
        });
        atualizarNext();
      });
    });
  }

  function carregarHorarios() {
    var pedido = S.esp.id + ":" + S.medico.id + ":" + S.unidade;
    S._pedido = pedido;
    if (DEMO) {
      S.slots = horariosDemo();
      return render();
    }
    fetch(API + "horarios?profissional_id=" + S.medico.id + "&unidade_id=" + S.unidade + "&especialidade_id=" + S.esp.id, { headers: { Accept: "application/json" } })
      .then(function (r) {
        if (!r.ok) throw new Error("http " + r.status);
        return r.json();
      })
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

  /* Passo "Seus dados": primeiro o CPF. Com ele a ponte diz se já existe cadastro no Feegow.
     A data de nascimento nunca volta do servidor: ela confirma a identidade em "Meus agendamentos". */
  function renderDados() {
    var d = S.dados;
    var c = S.cad;
    function f(name, label, attrs, hint) {
      return (
        '<label class="afield"><span>' + label + "</span><input name=\"" + name + '" value="' + esc(d[name] || "") + '" ' + attrs + " />" +
        (hint ? "<small>" + hint + "</small>" : "") + '<em class="afield__err" aria-live="polite"></em></label>'
      );
    }
    var html =
      '<form class="agenda__form" novalidate>' +
      '<div class="acpf">' +
      f("cpf", "CPF do paciente", 'inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" maxlength="14" required', c ? "" : "Com o CPF, procuramos o seu cadastro na Clínica Dias.") +
      '<button type="button" class="botao acpf__btn"' + (c === "buscando" ? " disabled" : "") + ">" + (c === "buscando" ? "Buscando…" : c ? "Trocar CPF" : "Buscar cadastro") + "</button>" +
      "</div>";

    if (c === "buscando") {
      html += '<div class="agenda__loading"><span class="agenda__spin" aria-hidden="true"></span>Procurando o seu cadastro…</div>';
    } else if (c) {
      html += c.encontrado
        ? '<div class="acad acad--ok"><strong>' + (c.primeiro_nome ? "Olá, " + esc(c.primeiro_nome) + "! " : "") + "Puxamos o seu cadastro da Clínica Dias.</strong>" +
          "<p>Confira os dados abaixo. Se algo mudou, corrija antes de continuar.</p></div>"
        : '<div class="acad"><strong>' + (DEMO ? "Demonstração: preencha como se fosse a primeira vez." : "Primeira vez na Clínica Dias? Preencha os seus dados.") + "</strong>" +
          "<p>Vamos fazer o seu cadastro junto com o agendamento.</p></div>";
      html +=
        f("nome", "Nome completo", 'autocomplete="name" required') +
        '<div class="agenda__row">' +
        f("nascimento", "Data de nascimento", 'inputmode="numeric" placeholder="dd/mm/aaaa" maxlength="10" required') +
        f("celular", "Celular com DDD", 'type="tel" inputmode="tel" autocomplete="tel-national" placeholder="(31) 90000-0000" maxlength="15" required') +
        "</div>" +
        '<div class="agenda__row">' +
        '<fieldset class="afield afield--radio"><legend>Sexo</legend><div>' +
        ["F", "M"].map(function (v) {
          return '<label><input type="radio" name="sexo" value="' + v + '"' + (d.sexo === v ? " checked" : "") + " /> " + (v === "F" ? "Feminino" : "Masculino") + "</label>";
        }).join("") +
        '</div><em class="afield__err" aria-live="polite"></em></fieldset>' +
        f("email", "E-mail (opcional)", 'type="email" autocomplete="email"') +
        "</div>" +
        blocoPagamento(d);
    }
    body.innerHTML = html + "</form>";

    var form = body.querySelector("form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!S.cad) buscarCadastro();
    });
    mask(form.cpf, function (v) {
      v = v.replace(/\D/g, "").slice(0, 11);
      return v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    });
    if (form.nascimento)
      mask(form.nascimento, function (v) {
        v = v.replace(/\D/g, "").slice(0, 8);
        return v.replace(/(\d{2})(\d)/, "$1/$2").replace(/(\d{2})(\d)/, "$1/$2");
      });
    if (form.celular)
      mask(form.celular, function (v) {
        v = v.replace(/\D/g, "").slice(0, 11);
        if (v.length > 10) return v.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
        return v.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/^\((\d{0,2})\) ?-?$/, "$1");
      });

    form.querySelector(".acpf__btn").addEventListener("click", function () {
      if (S.cad && S.cad !== "buscando") {
        S.cad = null;
        S.dados = { cpf: S.dados.cpf };
        render();
        body.querySelector("[name=cpf]").focus();
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
        var el = body.querySelector("[name=cpf]");
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });

    function limpar(e) {
      lerDados();
      var box = e.target.closest(".afield");
      if (box) {
        box.classList.remove("has-error");
        var er = box.querySelector(".afield__err");
        if (er) er.textContent = "";
      }
      if (e.target.name === "lgpd") {
        var lg = form.querySelector(".afield__err--lgpd");
        if (lg) lg.textContent = "";
      }
    }
    form.addEventListener("input", limpar);
    form.addEventListener("change", limpar);
    form.addEventListener("change", function (e) {
      if (e.target.name !== "pagamento") return;
      var box = form.querySelector(".aconv");
      if (!box) return;
      box.hidden = e.target.value !== "convenio";
      var sel = box.querySelector("select");
      if (!box.hidden && sel && !sel.value) sel.focus();
    });

    if (c && c !== "buscando") {
      var first = form.querySelector(c.encontrado ? "[name=pagamento]" : "[name=nome]");
      if (first && (c.encontrado || !first.value)) first.focus();
    }
  }

  /* Convênios que cada médico aceita, vindos do Feegow (uma busca por médico) */
  var CONV = {};
  function carregarConvenios() {
    var id = S.medico.id + ":" + S.esp.id;
    if (CONV[id]) return;
    CONV[id] = "carregando";
    if (DEMO) {
      CONV[id] = [{ id: 1, nome: "CardFácil (exemplo)" }, { id: 2, nome: "Unimed (exemplo)" }];
      return;
    }
    fetch(API + "convenios?profissional_id=" + S.medico.id + "&especialidade_id=" + S.esp.id, { headers: { Accept: "application/json" } })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        CONV[id] = j.convenios || [];
      })
      .catch(function () {
        CONV[id] = [];
      })
      .then(function () {
        var box = body.querySelector(".aconv");
        if (box && S.medico && S.medico.id + ":" + S.esp.id === id) box.innerHTML = campoConvenio(S.dados);
      });
  }

  function campoConvenio(d) {
    var lista = CONV[S.medico.id + ":" + S.esp.id];
    if (lista === "carregando" || !lista)
      return '<div class="agenda__loading"><span class="agenda__spin" aria-hidden="true"></span>Buscando os convênios deste médico…</div>';
    if (!lista.length)
      return '<p class="agenda__hint">Não conseguimos carregar os convênios agora. Para marcar pelo convênio, ligue para ' + telefones() + ".</p>";
    return (
      '<label class="afield"><span>Qual convênio?</span><select name="convenio_id">' +
      '<option value="">Escolha o seu convênio</option>' +
      lista.map(function (c) {
        return '<option value="' + c.id + '"' + (String(d.convenio_id) === String(c.id) ? " selected" : "") + ">" + esc(c.nome) + "</option>";
      }).join("") +
      "</select><small>Só aparecem os convênios que " + esc(S.medico.nome.split(" ").slice(0, 2).join(" ")) + " atende. Não achou o seu? Ligue para " + telefones() + '.</small><em class="afield__err" aria-live="polite"></em></label>'
    );
  }

  function blocoPagamento(d) {
    carregarConvenios();
    return (
      '<fieldset class="afield afield--radio"><legend>Como vai ser a consulta?</legend><div>' +
      [["dinheiro_pix", "Particular · Dinheiro ou PIX"], ["cartao", "Particular · Cartão"], ["convenio", "Convênio"]].map(function (p) {
        return '<label><input type="radio" name="pagamento" value="' + p[0] + '"' + (d.pagamento === p[0] ? " checked" : "") + " /> " + p[1] + "</label>";
      }).join("") +
      '</div><em class="afield__err" aria-live="polite"></em></fieldset>' +
      '<div class="aconv"' + (d.pagamento === "convenio" ? "" : " hidden") + ">" + campoConvenio(d) + "</div>" +
      '<label class="acheck"><input type="checkbox" name="lgpd"' + (d.lgpd ? " checked" : "") + ' /> <span>Autorizo a Clínica Dias a usar estes dados para marcar a minha consulta, conforme a <a href="privacidade.html" target="_blank" rel="noopener">política de privacidade</a>.</span></label>' +
      '<em class="afield__err afield__err--lgpd" aria-live="polite"></em>'
    );
  }

  function buscarCadastro() {
    var form = body.querySelector("form");
    var cpf = form.cpf.value;
    var box = form.cpf.closest(".afield");
    if (!cpfValido(cpf)) {
      box.classList.add("has-error");
      box.querySelector(".afield__err").textContent = "Confira o CPF: os números não batem.";
      form.cpf.focus();
      return;
    }
    S.dados = { cpf: cpf };
    S.cpfBuscado = cpf.replace(/\D/g, "");
    S.cad = "buscando";
    render();
    var pedido = S.cpfBuscado;
    function pronto(res) {
      if (S.cpfBuscado !== pedido || S.step !== 4) return;
      S.cad = res;
      if (res && res.encontrado && res.dados) S.dados = Object.assign({ cpf: S.dados.cpf }, res.dados);
      render();
    }
    if (DEMO) return pronto({ encontrado: false });
    post("paciente", { cpf: cpf })
      .then(pronto)
      .catch(function () {
        pronto({ encontrado: false, falhou: true });
      });
  }

  function mask(input, fn) {
    input.addEventListener("input", function () {
      input.value = fn(input.value);
    });
  }

  function lerDados() {
    var form = body.querySelector("form");
    if (!form) return;
    function v(n) {
      return form[n] && form[n].value != null ? form[n].value.trim() : "";
    }
    var sexo = form.querySelector("[name=sexo]:checked");
    var pag = form.querySelector("[name=pagamento]:checked");
    S.dados = {
      cpf: form.cpf.value,
      nome: v("nome"),
      nascimento: v("nascimento"),
      celular: v("celular"),
      sexo: sexo ? sexo.value : "",
      email: v("email"),
      pagamento: pag ? pag.value : "",
      convenio_id: v("convenio_id"),
      convenio_nome: form.convenio_id && form.convenio_id.selectedIndex > 0 ? form.convenio_id.options[form.convenio_id.selectedIndex].text : "",
      lgpd: form.lgpd ? form.lgpd.checked : false,
    };
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
    var form = body.querySelector("form");
    var d = S.dados;
    var cel = d.celular.replace(/\D/g, "");
    var erros = {
      nome: d.nome.split(/\s+/).length < 2 ? "Escreva nome e sobrenome." : "",
      nascimento: !nascimentoValido(d.nascimento) ? "Use o formato dia/mês/ano, por exemplo 05/03/1958." : "",
      celular: cel.length < 10 ? "Informe o celular com DDD." : "",
      sexo: !d.sexo ? "Escolha uma opção." : "",
      pagamento: !d.pagamento ? "Escolha particular ou convênio." : "",
    };
    var idade = nascimentoValido(d.nascimento) ? idadeEm(d.nascimento, S.slot.data) : null;
    var mi = S.medico.idade_minima, ma = S.medico.idade_maxima;
    if (idade != null && ((mi != null && idade < mi) || (ma != null && idade > ma))) {
      erros.nascimento = S.medico.nome + " atende pacientes " + (ma != null && idade > ma ? "até " + ma : "a partir de " + mi) + " anos. Volte e escolha outro médico.";
    }
    if (d.pagamento === "convenio") {
      if (!form.convenio_id) erros.pagamento = "Os convênios ainda não carregaram. Espere um instante ou escolha particular.";
      else erros.convenio_id = !d.convenio_id ? "Escolha o seu convênio." : "";
    }
    var primeiro = null;
    ["nome", "nascimento", "celular", "sexo", "pagamento", "convenio_id"].forEach(function (k) {
      if (!(k in erros)) return;
      var el = form.querySelector("[name=" + k + "]");
      if (!el) return;
      var box = el.closest(".afield");
      box.classList.toggle("has-error", !!erros[k]);
      box.querySelector(".afield__err").textContent = erros[k];
      if (erros[k] && !primeiro) primeiro = el;
    });
    var lg = form.querySelector(".afield__err--lgpd");
    lg.textContent = d.lgpd ? "" : "Para marcar on-line, marque a autorização acima.";
    if (!d.lgpd && !primeiro) primeiro = form.lgpd;
    if (primeiro) {
      primeiro.focus();
      return false;
    }
    return true;
  }

  function renderRevisao() {
    var u = DATA.unidades[S.unidade] || { nome: "", endereco: "" };
    var m = S.medico;
    var d = S.dados;
    body.innerHTML =
      '<div class="areview">' +
      '<div class="areview__doc">' + avatar(m) +
      "<div><strong>" + esc(m.nome) + "</strong><small>Consulta de " + esc(S.esp.nome.toLowerCase()) + "</small></div></div>" +
      "<dl>" +
      "<div><dt>Quando</dt><dd>" + dataLonga(S.slot.data) + ", às " + hora(S.slot.horario) + "</dd></div>" +
      "<div><dt>Onde</dt><dd>" + esc(u.nome) + "<small>" + esc(u.endereco) + "</small></dd></div>" +
      "<div><dt>Paciente</dt><dd>" + esc(d.nome) + (S.cad && S.cad.encontrado ? " (já cadastrado)" : "") + "<small>CPF " + esc(d.cpf) + (d.celular ? " · " + esc(d.celular) : "") + "</small></dd></div>" +
      "<div><dt>Atendimento</dt><dd>" +
      (d.pagamento === "convenio" ? "Convênio " + esc(d.convenio_nome) : d.pagamento === "cartao" ? "Particular, no cartão" : "Particular, em dinheiro ou PIX") +
      '<small class="areview__valor">' + (DEMO ? "" : d.pagamento === "convenio" ? "Conferindo o convênio…" : "Consultando o valor…") + "</small></dd></div>" +
      "</dl>" +
      '<p class="agenda__hint">Para remarcar ou cancelar depois, entre em <a href="agendamentos.html">Meus agendamentos</a> ou ligue para ' + telefones() + ".</p>" +
      '<p class="agenda__error" role="alert" hidden></p>' +
      "</div>";
    if (!DEMO) carregarValor();
  }

  function carregarValor() {
    var el = body.querySelector(".areview__valor");
    post("valor", { profissional_id: S.medico.id, unidade_id: S.unidade, especialidade_id: S.esp.id, pagamento: S.dados.pagamento, convenio_id: S.dados.convenio_id })
      .then(function (j) {
        S.valor = j.valor;
        if (!el) return;
        if (j.convenio) el.textContent = "Leve a carteirinha do convênio e um documento com foto.";
        else el.textContent = j.valor ? "Consulta particular: " + (typeof j.valor === "number" ? brl(j.valor) : j.valor) : "O valor é informado na clínica.";
      })
      .catch(function (err) {
        if (!el) return;
        el.textContent = S.dados.pagamento === "convenio" ? (err && err.message) || "Não conseguimos conferir o convênio." : "O valor é informado na clínica.";
      });
  }

  function brl(v) {
    return "R$ " + Number(v).toFixed(2).replace(".", ",");
  }

  function confirmar() {
    if (S.enviando) return;
    var errEl = body.querySelector(".agenda__error");
    if (DEMO) {
      S.feito = { demo: true };
      return render();
    }
    S.enviando = true;
    nextBtn.disabled = true;
    nextBtn.textContent = "Marcando…";
    post("agendar", {
      profissional_id: S.medico.id,
      unidade_id: S.unidade,
      especialidade_id: S.esp.id,
      local_id: S.slot.local_id,
      data: S.slot.data,
      horario: S.slot.horario,
      nome: S.dados.nome,
      cpf: S.dados.cpf,
      nascimento: S.dados.nascimento,
      celular: S.dados.celular,
      sexo: S.dados.sexo,
      email: S.dados.email,
      pagamento: S.dados.pagamento,
      convenio_id: S.dados.pagamento === "convenio" ? S.dados.convenio_id : "",
    })
      .then(function (j) {
        S.feito = j;
        try {
          // "Meus agendamentos" já abre com o CPF preenchido (só nesta aba; some ao fechar)
          sessionStorage.setItem("cd-cpf", S.dados.cpf);
        } catch (e) {
          /* sem armazenamento: a pessoa digita o CPF de novo */
        }
        render();
      })
      .catch(function (err) {
        S.enviando = false;
        nextBtn.textContent = "Tentar de novo";
        nextBtn.disabled = false;
        errEl.hidden = false;
        errEl.textContent = (err && err.message) || "Não conseguimos marcar agora. Tente de novo ou ligue para (31) 3849-6156.";
      });
  }

  function post(path, data) {
    return fetch(API + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data),
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || j.erro) throw new Error(j.erro || "Não conseguimos marcar agora. Ligue para (31) 3849-6156.");
        return j;
      });
    });
  }

  function renderFeito() {
    var u = DATA.unidades[S.unidade] || { nome: "", endereco: "" };
    var simulado = S.feito.demo || S.feito.simulado;
    title.textContent = simulado ? "Teste concluído" : "Consulta marcada";
    Array.prototype.forEach.call(steps, function (li) {
      li.classList.add("is-done");
      li.classList.remove("is-current");
    });
    modal.querySelector(".agenda__foot").hidden = true;
    body.innerHTML =
      '<div class="adone">' +
      '<span class="adone__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>' +
      "<h3>" + (simulado ? "Tudo certo no teste. Nada foi marcado na agenda." : "Pronto, sua consulta está marcada.") + "</h3>" +
      "<p><strong>" + esc(S.medico.nome) + "</strong> · " + esc(S.esp.nome) + "<br />" + dataLonga(S.slot.data) + ", às " + hora(S.slot.horario) + "<br />" + esc(u.nome) + (u.endereco ? " · " + esc(u.endereco) : "") + "</p>" +
      (simulado ? '<p class="agenda__hint">' + (S.feito.demo ? "Esta é uma demonstração com médicos e horários de exemplo." : "O agendamento está em modo de teste: os horários são reais, mas a marcação final está desligada.") + "</p>" : "") +
      '<p class="agenda__hint">Para ver, remarcar ou cancelar, entre em Meus agendamentos com o seu CPF e a data de nascimento. Ou ligue para ' + telefones() + ".</p>" +
      '<div class="adone__actions">' +
      '<a class="botao botao-linha adone__btn" href="agendamentos.html">Ver meus agendamentos</a>' +
      '<button type="button" class="botao adone__btn" data-aclose>Fechar</button>' +
      "</div>" +
      "</div>";
  }

  function telefones() {
    return '<a href="tel:+553138496156">(31) 3849-6156</a>';
  }

  /* ------------------------------------------------------------ demonstração (?demo=1), claramente marcada na tela */

  function dadosDemo() {
    var u = {
      0: { nome: "Timóteo · Portaria I", endereco: "Rua Doutor Tadeu Damásio dos Reis, 450, loja 1, Santa Maria" },
      1: { nome: "Coronel Fabriciano", endereco: "Rua Pedro Nolasco, 107, Centro" },
      8: { nome: "Ipatinga", endereco: "Avenida Brasil, 700, loja 1, Iguaçu" },
    };
    function esp(id, nome, meds) {
      return { id: id, nome: nome, medicos: meds.map(function (m, i) { return { id: id * 10 + i, nome: m[0], sexo: m[1], unidades: m[2] }; }) };
    }
    return {
      unidades: u,
      especialidades: [
        esp(96, "Cardiologia", [["Dr. Exemplo Cardiologista", "M", [0, 1]], ["Dra. Exemplo Arritmia", "F", [0]]]),
        esp(227, "Clínica Geral", [["Dra. Exemplo Clínica", "F", [0, 1, 8]]]),
        esp(98, "Dermatologia", [["Dra. Exemplo Dermato", "F", [8]]]),
        esp(134, "Pediatria Geral", [["Dr. Exemplo Pediatra", "M", [0, 1]]]),
        esp(126, "Oftalmologia", [["Dr. Exemplo Oftalmo", "M", [0, 1, 8]]]),
      ],
    };
  }

  function horariosDemo() {
    var out = [];
    var d = new Date();
    var n = 0;
    while (out.length < 40 && n < 30) {
      d.setDate(d.getDate() + 1);
      n++;
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      var iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      ["08:00", "08:40", "09:20", "10:00", "14:00", "14:40", "15:20", "16:00"].forEach(function (h, i) {
        if ((i + n) % 3 !== 0) out.push({ data: iso, horario: h + ":00", local_id: 0 });
      });
    }
    return out;
  }

  // a lista de especialidades começa a carregar quando a pessoa chega perto de um botão de agendar
  ["pointerover", "focusin", "touchstart"].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      if (e.target.closest && e.target.closest("[data-agenda]")) carregarMedicos();
    }, { passive: true });
  });
})();
