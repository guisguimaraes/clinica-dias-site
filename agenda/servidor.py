"""Ponte de agendamento on-line da Clínica Dias com o Feegow.

Atende os sites da clínica (clinicadias.com e, se quiser, o COD) em /api/, falando com o
MCP do Feegow. O token fica só aqui (variável de ambiente), nunca vai para o navegador.

    python servidor.py            # http://127.0.0.1:3000

Por segurança a marcação real começa DESLIGADA: agendar, cancelar e remarcar conferem tudo
e respondem {"simulado": true}. Para gravar de verdade: PERMITIR_AGENDAR=1 (só depois de
combinar com a clínica).

Quais médicos aparecem vem do próprio Feegow: a cada 30 minutos a ponte consulta os horários
livres dos próximos 30 dias de cada especialidade liberada e guarda quem tem vaga em uma das
unidades do site. Só esses pares médico + especialidade + unidade podem ser marcados.
"""
import json
import os
import re
import secrets
import sys
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))


def load_env():
    path = os.path.join(ROOT, ".env")
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


def ids(nome, padrao=""):
    return {int(x) for x in re.findall(r"\d+", os.environ.get(nome, padrao))}


load_env()
PORT = int(os.environ.get("PORT", "3000"))
HOST = os.environ.get("HOST", "127.0.0.1")  # no Docker/Coolify: HOST=0.0.0.0
MCP_URL = os.environ.get("FEEGOW_MCP_URL", "")
MCP_TOKEN = os.environ.get("FEEGOW_MCP_TOKEN", "")
PERMITIR_AGENDAR = os.environ.get("PERMITIR_AGENDAR") == "1"
CORS_ORIGINS = {o.strip().rstrip("/") for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()}
UNIDADES = ids("UNIDADES", "0,1,7,8")
# vazio = todas as que o Feegow marca para agendamento on-line, menos as de fora
ESPECIALIDADES = ids("ESPECIALIDADES")
# exames, anestesia e triagem não são consulta que o paciente marca sozinho
ESPECIALIDADES_FORA = ids("ESPECIALIDADES_FORA", "94,306,296,297,300,144,106")
# consulta_id 3229 é "CONSULTA UROLOGISTA" e está como consulta padrão de várias especialidades
# (infectologia, obstetrícia, nutrologia...): marcar por elas gravaria o procedimento errado
CONSULTAS_FORA = ids("CONSULTAS_FORA", "3229")
PROFISSIONAIS = ids("PROFISSIONAIS")  # vazio = todos os que tiverem horário
DIAS = int(os.environ.get("DIAS", "30"))
TELEFONE = os.environ.get("TELEFONE", "(31) 3849-6156")
NOTA = os.environ.get("NOTA_AGENDAMENTO", "Marcado pelo site da Clínica Dias")
CANAL_SITE = int(os.environ.get("CANAL_ID", "1"))  # "Agendamento Online" no Feegow
CATALOGO_MINUTOS = int(os.environ.get("CATALOGO_MINUTOS", "30"))

# Única lista de ferramentas do Feegow que a ponte usa. O token do MCP abre muito mais
# (financeiro, faturas, estoque); nada fora daqui é chamado.
FERRAMENTAS = {
    "consultar_horarios", "preparar_agendamento", "buscar_paciente", "cadastrar_paciente",
    "criar_agendamento", "listar_convenios_do_profissional",
    "listar_especialidades", "listar_profissionais", "listar_unidades",
    "listar_agendamentos", "detalhar_agendamentos", "cancelar_agendamento", "remarcar_agendamento",
}

BRT = timezone(timedelta(hours=-3))  # horário de Brasília (sem horário de verão desde 2019)
TRAVA = threading.Lock()


class FeegowErro(Exception):
    """Erro vindo do MCP do Feegow. O texto pode ter dado interno ou de outra pessoa:
    vai só para o log (o nome da ferramenta), nunca para o navegador."""

    def __init__(self, texto, ferramenta=""):
        super().__init__(texto)
        self.ferramenta = ferramenta


class PonteErro(Exception):
    """Erro com texto escrito pela própria ponte, pronto para mostrar ao paciente."""


def feegow(tool, args):
    if tool not in FERRAMENTAS:
        raise FeegowErro("ferramenta não permitida")
    payload = {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": tool, "arguments": args}}
    req = urllib.request.Request(
        MCP_URL,
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "Authorization": "Bearer " + MCP_TOKEN,
        },
    )
    raw = urllib.request.urlopen(req, timeout=90).read().decode()
    lines = [l[6:] for l in raw.splitlines() if l.startswith("data: ")]
    msg = json.loads(lines[-1] if lines else raw)
    if "error" in msg:
        raise FeegowErro(msg["error"].get("message", "erro no Feegow"), tool)
    res = msg.get("result", {})
    text = "".join(c.get("text", "") for c in res.get("content", []))
    try:
        data = json.loads(text)
    except ValueError:
        data = {"texto": text}
    if res.get("isError"):
        raise FeegowErro(data.get("erro") or data.get("mensagem") or text[:300], tool)
    return data


def so_digitos(s):
    return re.sub(r"\D", "", str(s or ""))


def achar(d, *chaves):
    """Procura a primeira chave que existir, em qualquer nível do JSON."""
    if isinstance(d, dict):
        for k in chaves:
            if d.get(k) not in (None, ""):
                return d[k]
        for v in d.values():
            r = achar(v, *chaves)
            if r is not None:
                return r
    elif isinstance(d, list):
        for v in d:
            r = achar(v, *chaves)
            if r is not None:
                return r
    return None


MINUSCULAS = {"de", "da", "do", "das", "dos", "e"}


def nome_proprio(s):
    """HALLAN REIS TRINDADE -> Hallan Reis Trindade; mantém 'de', 'da', 'dos' em minúsculas."""
    s = " ".join(str(s or "").split())
    if not s:
        return ""
    partes = s.lower().split(" ")
    return " ".join(p if (i and p in MINUSCULAS) else p[:1].upper() + p[1:] for i, p in enumerate(partes))


# nome de exibição das unidades do site (o nome fantasia do Feegow vem com "Clinica Dias-" na frente)
NOMES_UNIDADE = {0: "Timóteo · Portaria I", 1: "Coronel Fabriciano", 7: "Timóteo · Portaria II", 8: "Ipatinga"}
# especialidades cadastradas em CAIXA ALTA ou com o nome do profissional em vez da área
NOMES_ESPECIALIDADE = {294: "Angiologia", 305: "Coloproctologia", 299: "Odontologia (geral)",
                       254: "Odontologia (dentística)", 157: "Odontologia (endodontia)",
                       242: "Odontologia (implantodontia)", 158: "Odontologia (ortodontia)"}


def nome_especialidade(eid, s):
    return NOMES_ESPECIALIDADE.get(eid) or nome_proprio(s)


def nome_unidade(s):
    """'Clinica Dias- Timóteo Portaria I' -> 'Timóteo Portaria I'."""
    return re.sub(r"^\s*Cl[ií]nica\s+Dias\s*-?\s*", "", str(s or "")).strip()


def int_ou(v, padrao=None):
    try:
        return int(v)
    except (TypeError, ValueError):
        return padrao


# --------------------------------------------------------------------------
# Catálogo: quem pode ser marcado pelo site, montado do Feegow e guardado na memória
# --------------------------------------------------------------------------
CATALOGO = {"pronto": False, "atualizado_em": None, "erro": None,
            "especialidades": {}, "unidades": {}, "medicos": {}, "por_procedimento": {}}
CATALOGO_PRONTO = threading.Event()


def _horarios_da_especialidade(eid):
    hoje = datetime.now(BRT).date()
    d = feegow("consultar_horarios", {
        "especialidade_id": eid,
        "data_inicio": (hoje + timedelta(days=1)).isoformat(),
        "data_fim": (hoje + timedelta(days=DIAS)).isoformat(),
        "limite": 500,
    })
    lista = list(d.get("horarios") or [])
    for g in d.get("horarios_por_unidade") or []:
        lista.extend(g.get("horarios") or [])
    idades = {int(r["profissional_id"]): (r.get("idade_minima"), r.get("idade_maxima"))
              for r in d.get("restricoes_de_idade") or [] if r.get("profissional_id") is not None}
    proc = d.get("procedimento_usado") or {}
    return lista, idades, proc


def _profissionais_da_especialidade(eid):
    d = feegow("listar_profissionais", {"especialidade_id": eid, "limite": 100})
    return {int(p["profissional_id"]): p for p in d.get("profissionais") or [] if p.get("ativo", True)}


def montar_catalogo():
    esp = feegow("listar_especialidades", {}).get("content") or []
    uni = feegow("listar_unidades", {}).get("unidades") or []
    unidades = {}
    for u in uni:
        uid = int_ou(u.get("unidade_id"))
        if uid in UNIDADES:
            partes = [str(u.get(k) or "").strip() for k in ("endereco", "numero", "complemento", "bairro", "cidade")]
            partes[2] = partes[2].lower()  # "LOJA 1" -> "loja 1"
            endereco = ", ".join(x for x in partes if x)
            unidades[uid] = {"id": uid, "nome": NOMES_UNIDADE.get(uid) or nome_unidade(u.get("nome_fantasia")),
                             "endereco": endereco}

    elegiveis = [e for e in esp
                 if int(e.get("exibir_agendamento_online") or 0) == 1
                 and int(e["especialidade_id"]) not in ESPECIALIDADES_FORA
                 and int_ou(e.get("consulta_id")) not in CONSULTAS_FORA
                 and (not ESPECIALIDADES or int(e["especialidade_id"]) in ESPECIALIDADES)]

    def uma(e):
        eid = int(e["especialidade_id"])
        lista, idades, proc = _horarios_da_especialidade(eid)
        vagas = {}  # profissional_id -> {unidade_id: quantidade}
        nomes = {}
        for h in lista:
            pid, uid = int_ou(h.get("profissional_id")), int_ou(h.get("unidade_id"))
            if pid is None or uid not in unidades or (PROFISSIONAIS and pid not in PROFISSIONAIS):
                continue
            vagas.setdefault(pid, {}).setdefault(uid, 0)
            vagas[pid][uid] += 1
            nomes[pid] = h.get("profissional")
        cadastro = _profissionais_da_especialidade(eid) if vagas else {}
        return e, vagas, nomes, idades, proc, cadastro

    with ThreadPoolExecutor(4) as ex:
        resultados = list(ex.map(uma, elegiveis))

    especialidades, medicos, por_proc = {}, {}, {}
    for e, vagas, nomes, idades, proc, cadastro in resultados:
        eid = int(e["especialidade_id"])
        proc_id = int_ou(proc.get("procedimento_id")) or int_ou(e.get("consulta_id"))
        n = 0
        for pid, por_unidade in vagas.items():
            cad = cadastro.get(pid) or {}
            faixa = cad.get("faixa_etaria") or {}
            imin, imax = idades.get(pid, (faixa.get("idade_minima"), faixa.get("idade_maxima")))
            medicos[(pid, eid)] = {
                "id": pid,
                "nome": nome_proprio(cad.get("nome") or nomes.get(pid)),
                "tratamento": cad.get("tratamento") or "",  # "Dr." / "Dra." / vazio
                "especialidade_id": eid,
                "especialidade": nome_especialidade(eid, e.get("nome")),
                "procedimento_id": proc_id,
                "unidades": sorted(por_unidade),
                "horarios_livres": sum(por_unidade.values()),
                "idade_minima": int_ou(imin),
                "idade_maxima": int_ou(imax),
            }
            if proc_id:
                por_proc.setdefault((pid, proc_id), eid)
            n += 1
        if n:
            especialidades[eid] = {"id": eid, "nome": nome_especialidade(eid, e.get("nome")), "medicos": n}

    # o Feegow só manda o "Dr./Dra." em parte das especialidades: usa o que aparecer para o médico
    tratamentos = {}
    for m in medicos.values():
        if m["tratamento"]:
            tratamentos.setdefault(m["id"], m["tratamento"])
    for m in medicos.values():
        m["tratamento"] = m["tratamento"] or tratamentos.get(m["id"], "")

    with TRAVA:
        CATALOGO.update(pronto=True, erro=None, especialidades=especialidades, unidades=unidades,
                        medicos=medicos, por_procedimento=por_proc,
                        atualizado_em=datetime.now(BRT).isoformat(timespec="seconds"))
    CATALOGO_PRONTO.set()
    sys.stderr.write("catálogo: %d especialidades, %d médicos\n" % (len(especialidades), len(medicos)))


def manter_catalogo():
    while True:
        try:
            montar_catalogo()
            espera = CATALOGO_MINUTOS * 60
        except Exception as e:  # noqa: BLE001 — mantém o último catálogo bom e tenta de novo logo
            with TRAVA:
                CATALOGO["erro"] = type(e).__name__
            sys.stderr.write("catálogo falhou: %s\n" % type(e).__name__)
            espera = 120
        time.sleep(espera)


def medico(pid, eid, uid=None):
    """O par médico + especialidade (e a unidade, se pedida) está liberado no site?"""
    with TRAVA:
        m = CATALOGO["medicos"].get((pid, eid))
    if not m or (uid is not None and uid not in m["unidades"]):
        return None
    return m


def _ids(fonte, *chaves):
    out = []
    for k in chaves:
        v = fonte.get(k)
        if isinstance(v, list):
            v = v[0] if v else None
        out.append(int_ou(v))
    return out


def lista_medicos(q):
    CATALOGO_PRONTO.wait(60)
    eid = int_ou((q.get("especialidade_id") or [None])[0])
    with TRAVA:
        if not CATALOGO["pronto"]:
            return 503, {"erro": "Estamos carregando a agenda. Tente de novo em um minuto."}
        unidades = CATALOGO["unidades"]
        grupos = {}
        for m in CATALOGO["medicos"].values():
            if eid is not None and m["especialidade_id"] != eid:
                continue
            g = grupos.setdefault(m["especialidade_id"], {"id": m["especialidade_id"], "nome": m["especialidade"], "medicos": []})
            t = m["tratamento"]
            g["medicos"].append({
                "id": m["id"],
                # pronto para exibir: "Dr."/"Dra." só para quem é médico (nutricionista vem como "Sra.")
                "nome": (t + " " if t in ("Dr.", "Dra.") else "") + m["nome"],
                "sexo": "F" if t in ("Dra.", "Sra.") else ("M" if t in ("Dr.", "Sr.") else ""),
                "unidades": m["unidades"],
                "idade_minima": m["idade_minima"],
                "idade_maxima": m["idade_maxima"],
                "horarios_livres": m["horarios_livres"],
            })
        lista = sorted(grupos.values(), key=lambda g: g["nome"].lower())
        for g in lista:
            g["medicos"].sort(key=lambda x: x["nome"].split(" ", 1)[-1].lower() if x["nome"][:3] in ("Dr.", "Dra") else x["nome"].lower())
        return 200, {"atualizado_em": CATALOGO["atualizado_em"], "especialidades": lista,
                     "unidades": {str(k): {"nome": u["nome"], "endereco": u["endereco"]} for k, u in sorted(unidades.items())}}


def lista_especialidades():
    CATALOGO_PRONTO.wait(60)
    with TRAVA:
        if not CATALOGO["pronto"]:
            return 503, {"erro": "Estamos carregando a agenda. Tente de novo em um minuto."}
        es = sorted(CATALOGO["especialidades"].values(), key=lambda e: e["nome"].lower())
        return 200, {"especialidades": es}


def lista_unidades():
    CATALOGO_PRONTO.wait(60)
    with TRAVA:
        return 200, {"unidades": sorted(CATALOGO["unidades"].values(), key=lambda u: u["id"])}


# --------------------------------------------------------------------------
# Horários, valor e convênios
# --------------------------------------------------------------------------
HORARIOS_CACHE = {}  # (pid, uid, eid) -> (hora, lista)
HORARIOS_SEGUNDOS = 60


def livres(pid, uid, eid, fresco=False):
    chave = (pid, uid, eid)
    hit = HORARIOS_CACHE.get(chave)
    if hit and not fresco and time.time() - hit[0] < HORARIOS_SEGUNDOS:
        return hit[1]
    hoje = datetime.now(BRT).date()
    d = feegow("consultar_horarios", {
        "profissional_id": pid,
        "unidade_id": uid,
        "especialidade_id": eid,
        "data_inicio": (hoje + timedelta(days=1)).isoformat(),
        "data_fim": (hoje + timedelta(days=DIAS)).isoformat(),
        "limite": 300,
    })
    # o Feegow devolve horários de outras unidades e médicos misturados: filtra de novo
    out = [
        {"data": h["data"], "horario": str(h["horario"])[:5], "local_id": h.get("local_id")}
        for h in d.get("horarios") or []
        if int_ou(h.get("unidade_id"), -1) == uid and int_ou(h.get("profissional_id"), pid) == pid
    ]
    HORARIOS_CACHE[chave] = (time.time(), out)
    return out


def horarios(q):
    pid, uid, eid = _ids(q, "profissional_id", "unidade_id", "especialidade_id")
    if not medico(pid, eid, uid):
        return 400, {"erro": "Médico, especialidade ou unidade inválidos."}
    return 200, {"horarios": livres(pid, uid, eid)}


def preparar(pid, uid, eid, pagamento):
    """Devolve (tabela_id, valor) da tabela PARTICULAR (sem cartão de desconto) para a forma de pagamento."""
    forma = "cartao" if pagamento == "cartao" else "dinheiro_pix"
    d = feegow("preparar_agendamento", {
        "profissional_id": pid,
        "especialidade_id": eid,
        "unidade_id": uid,
        "tipo_atendimento": "particular",
        "forma_pagamento": forma,
    })
    opcoes = d.get("opcoes") or []
    escolhida = next((o for o in opcoes if str(o.get("nome", "")).lower().startswith("particular")), None)
    if escolhida:
        return escolhida.get("tabela_id"), escolhida.get("valor")
    return achar(d, "tabela_id"), achar(d, "valor")


# Preços de uma consulta, para mostrar ANTES de a pessoa escolher como vai pagar.
# O preparar_agendamento sem tabela devolve "opcoes" com todas as tabelas daquela forma de pagamento:
# a "Particular" e as dos cartões de desconto (CardFácil, AAPI...). A "Parceria" é interna e fica fora.
PRECOS_CACHE = {}  # (profissional, unidade, especialidade) -> (hora, resposta)
NOMES_DESCONTO = {
    "cardfacil": "CardFácil",
    "aapi": "AAPI",
    "associacao dos aposentados": "Associação dos Aposentados",
    "tomocard": "TomoCard",
}


def _nome_tabela(nome):
    """'CardFacil (Dinheiro e Pix)' -> 'cardfacil'; 'AAPI (CARTÃO)' -> 'aapi'."""
    base = re.sub(r"\s*\(.*?\)\s*$", "", str(nome or "")).strip().lower()
    return base


def precos(q):
    pid, uid, eid = _ids(q, "profissional_id", "unidade_id", "especialidade_id")
    if not medico(pid, eid, uid):
        return 400, {"erro": "Médico, especialidade ou unidade inválidos."}
    chave = (pid, uid, eid)
    hit = PRECOS_CACHE.get(chave)
    if hit and time.time() - hit[0] < 3600:
        return 200, hit[1]

    def opcoes(forma):
        d = feegow("preparar_agendamento", {
            "profissional_id": pid, "especialidade_id": eid, "unidade_id": uid,
            "tipo_atendimento": "particular", "forma_pagamento": forma,
        })
        return forma, d.get("opcoes") or []

    with ThreadPoolExecutor(2) as ex:
        por_forma = dict(ex.map(opcoes, ["dinheiro_pix", "cartao"]))

    particular, descontos = {}, {}
    for forma, lista in por_forma.items():
        for o in lista:
            base = _nome_tabela(o.get("nome"))
            preco = {"valor": o.get("valor"), "centavos": int_ou(o.get("valor_centavos"))}
            if base == "particular":
                particular[forma] = preco
            elif base in NOMES_DESCONTO:
                descontos.setdefault(base, {"nome": NOMES_DESCONTO[base]})[forma] = preco
    resp = {
        "particular": particular,
        "descontos": sorted(descontos.values(), key=lambda x: x["nome"].lower()),
        "pagamento": "na clínica, no dia da consulta",
    }
    PRECOS_CACHE[chave] = (time.time(), resp)
    return 200, resp


CONVENIOS_CACHE = {}  # profissional_id -> (hora, lista)


def convenios_do_medico(pid):
    hit = CONVENIOS_CACHE.get(pid)
    if hit and time.time() - hit[0] < 3600:
        return hit[1]
    d = feegow("listar_convenios_do_profissional", {"profissional_id": pid})
    lista = sorted(
        ({"id": int(c["convenio_id"]), "nome": str(c.get("nome", "")).strip()}
         for c in (d.get("convenios_aceitos") or {}).get("content", []) if c.get("convenio_id") is not None),
        key=lambda c: c["nome"].lower(),
    )
    CONVENIOS_CACHE[pid] = (time.time(), lista)
    return lista


def convenios(q):
    pid, eid = _ids(q, "profissional_id", "especialidade_id")
    with TRAVA:
        liberado = any(k[0] == pid and (eid is None or k[1] == eid) for k in CATALOGO["medicos"])
    if not liberado:
        return 400, {"erro": "Médico inválido."}
    return 200, {"convenios": convenios_do_medico(pid)}


def convenio_valido(pid, b):
    cid = int_ou(b.get("convenio_id"))
    return next((c for c in convenios_do_medico(pid) if c["id"] == cid), None) if cid is not None else None


def preparar_convenio(pid, uid, eid, cid):
    d = feegow("preparar_agendamento", {
        "profissional_id": pid,
        "especialidade_id": eid,
        "unidade_id": uid,
        "tipo_atendimento": "convenio",
        "convenio_id": cid,
    })
    pronto = d.get("pedido_pronto") or {}
    if not pronto.get("convenio_id"):
        raise PonteErro("Este médico não atende por esse convênio nesta unidade. Ligue para " + TELEFONE + ".")
    return pronto


def valor(b):
    pid, uid, eid = _ids(b, "profissional_id", "unidade_id", "especialidade_id")
    if not medico(pid, eid, uid):
        return 400, {"erro": "Médico, especialidade ou unidade inválidos."}
    if b.get("pagamento") == "convenio":
        conv = convenio_valido(pid, b)
        if not conv:
            return 400, {"erro": "Este médico não atende por esse convênio."}
        preparar_convenio(pid, uid, eid, conv["id"])
        return 200, {"convenio": conv["nome"]}
    tabela_id, v = preparar(pid, uid, eid, b.get("pagamento"))
    return 200, {"valor": v, "tabela_id": tabela_id}


# --------------------------------------------------------------------------
# Paciente
# --------------------------------------------------------------------------
def buscar_cadastro(cpf):
    """Busca o paciente pelo CPF. Devolve (paciente_id, cadastro) ou (None, {})."""
    try:
        pac = feegow("buscar_paciente", {"cpf": cpf})
    except FeegowErro:
        return None, {}  # CPF sem cadastro vem como erro, não como lista vazia
    c = pac.get("content") if isinstance(pac, dict) and isinstance(pac.get("content"), dict) else pac
    pid = achar(c, "paciente_id") or (c.get("id") if isinstance(c, dict) else None)
    return pid, (c if pid else {})


def data_ddmmaaaa(v):
    """Normaliza 1958-03-05, 05-03-1958 ou 05/03/1958 para 05/03/1958."""
    v = str(v or "").strip()[:10]
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", v)
    if m:
        return f"{m[3]}/{m[2]}/{m[1]}"
    return v.replace("-", "/")


def idade_em(nascimento, dia):
    """Idade (anos completos) na data da consulta, ou None se a data não fizer sentido."""
    try:
        d, m, a = (int(x) for x in data_ddmmaaaa(nascimento).split("/"))
        n = date(a, m, d)
    except (TypeError, ValueError):
        return None
    return dia.year - n.year - ((dia.month, dia.day) < (n.month, n.day))


def primeiro(v):
    if isinstance(v, list):
        return next((str(x).strip() for x in v if str(x or "").strip()), "")
    return str(v or "").strip()


def fmt_tel(t):
    d = so_digitos(t)
    if len(d) == 11:
        return f"({d[:2]}) {d[2:7]}-{d[7:]}"
    if len(d) == 10:
        return f"({d[:2]}) {d[2:6]}-{d[6:]}"
    return d


def celular_do_cadastro(pac):
    return primeiro(pac.get("celulares")) or primeiro(pac.get("telefones")) or str(achar(pac, "celular", "telefone") or "")


LIMITES = {}  # (nome, chave) -> horários das tentativas


def _limite(nome, chave, maximo, janela):
    """True se ainda cabe mais uma tentativa (e registra a tentativa)."""
    agora = time.time()
    k = (nome, chave)
    with TRAVA:
        lista = [t for t in LIMITES.get(k, []) if agora - t < janela]
        if len(lista) >= maximo:
            LIMITES[k] = lista
            return False
        LIMITES[k] = lista + [agora]
        return True


def _contar(nome, chave, janela):
    agora = time.time()
    with TRAVA:
        return len([t for t in LIMITES.get((nome, chave), []) if agora - t < janela])


def mascarar_tel(t):
    d = so_digitos(t)
    if len(d) < 8:
        return ""
    return f"({d[:2]}) •••••-{d[-4:]}" if len(d) >= 10 else f"••••-{d[-4:]}"


# Erros de data de nascimento: 5 por CPF a partir do mesmo endereço, ou 15 por CPF no total,
# pausam aquele CPF por 1 hora (busca, marcação e "Meus agendamentos").
def _cpf_pausado(cpf, ip):
    return _contar("erro_cpf_ip", cpf + "|" + ip, 3600) >= 5 or _contar("erro_cpf", cpf, 3600) >= 15


def _errou_cpf(cpf, ip):
    _limite("erro_cpf_ip", cpf + "|" + ip, 99, 3600)
    _limite("erro_cpf", cpf, 99, 3600)


def _confere_nascimento(pac, nasc):
    n = data_ddmmaaaa(pac.get("nascimento"))
    return bool(re.fullmatch(r"\d{2}/\d{2}/\d{4}", n)) and n == nasc


TEXTO_PAUSADO = "Por segurança, o acesso com este CPF foi pausado por uma hora. Ligue para " + TELEFONE + "."


def paciente(b, ip):
    """Com CPF + data de nascimento, devolve o cadastro para preencher o formulário.
    Só com o CPF não devolve nada: senão bastaria chutar CPFs para colher nomes e telefones."""
    cpf = so_digitos(b.get("cpf"))
    nasc = data_ddmmaaaa(b.get("nascimento"))
    if len(cpf) != 11:
        return 400, {"erro": "Confira o CPF."}
    if not re.fullmatch(r"\d{2}/\d{2}/\d{4}", nasc):
        return 400, {"erro": "Informe a data de nascimento."}
    if not _limite("busca", ip, 8, 600):  # evita testar CPFs em sequência
        return 429, {"erro": "Muitas buscas seguidas. Espere alguns minutos ou ligue para " + TELEFONE + "."}
    if _cpf_pausado(cpf, ip):
        return 429, {"erro": TEXTO_PAUSADO}
    pid, pac = buscar_cadastro(cpf)
    if not pid or not _confere_nascimento(pac, nasc):
        if pid:
            _errou_cpf(cpf, ip)
        # mesma resposta para CPF sem cadastro e data que não confere: não revela se o CPF existe
        return 200, {"encontrado": False}
    nome = " ".join(str(pac.get("nome_social") or pac.get("nome") or "").split())
    sexo = str(pac.get("sexo") or "").strip().upper()[:1]
    return 200, {
        "encontrado": True,
        "primeiro_nome": nome.split(" ")[0].title() if nome else "",
        "dados": {
            "nome": nome.title(),
            "nascimento": nasc,
            # o contato completo não sai do servidor: celular vazio na marcação = o do cadastro
            "celular": "",
            "celular_mascarado": mascarar_tel(celular_do_cadastro(pac)),
            "sexo": sexo if sexo in ("F", "M") else "",
            "email": "",
        },
    }


def faixa_ok(m, nascimento, dia):
    idade = idade_em(nascimento, dia)
    if idade is None:
        return True  # sem data válida no cadastro: a recepção confere
    if m["idade_minima"] is not None and idade < m["idade_minima"]:
        return False
    if m["idade_maxima"] is not None and idade > m["idade_maxima"]:
        return False
    return True


def texto_faixa(m):
    a, b = m["idade_minima"], m["idade_maxima"]
    if a is not None and b is not None:
        return f"de {a} a {b} anos"
    if a is not None:
        return f"a partir de {a} anos"
    return f"até {b} anos"


def agendar(b, ip):
    pid, uid, eid = _ids(b, "profissional_id", "unidade_id", "especialidade_id")
    m = medico(pid, eid, uid)
    if not m:
        return 400, {"erro": "Médico, especialidade ou unidade inválidos."}
    cpf = so_digitos(b.get("cpf"))
    if len(cpf) != 11:
        return 400, {"erro": "Confira o CPF."}
    # 20 por hora: a recepção e o Wi-Fi da clínica saem pelo mesmo endereço
    if not _limite("agendar", ip, 20, 3600):
        return 429, {"erro": "Muitas marcações seguidas. Ligue para " + TELEFONE + "."}
    if _cpf_pausado(cpf, ip):
        return 429, {"erro": TEXTO_PAUSADO}

    data, hora = str(b.get("data") or ""), str(b.get("horario") or "")[:5]
    with ThreadPoolExecutor(2) as ex:  # o Feegow é lento: horário e cadastro ao mesmo tempo
        f_livres = ex.submit(livres, pid, uid, eid, True)
        f_cad = ex.submit(buscar_cadastro, cpf)
        livres_agora, (paciente_id, pac) = f_livres.result(), f_cad.result()
    slot = next((h for h in livres_agora if h["data"] == data and h["horario"] == hora), None)
    if not slot:
        return 409, {"erro": "Esse horário acabou de ser ocupado. Escolha outro."}

    if paciente_id:
        # quem já tem cadastro confirma a data de nascimento: só o CPF não basta para marcar em nome de alguém
        if not _confere_nascimento(pac, data_ddmmaaaa(b.get("nascimento"))):
            _errou_cpf(cpf, ip)
            return 422, {"erro": "A data de nascimento não confere com o cadastro da Clínica Dias. Confira a data ou ligue para " + TELEFONE + "."}
        if not so_digitos(b.get("celular")):
            b["celular"] = celular_do_cadastro(pac)
        nascimento = pac.get("nascimento")
    elif not (b.get("nome") and b.get("nascimento") and b.get("celular") and b.get("sexo")):
        return 400, {"erro": "Preencha nome, data de nascimento, celular e sexo."}
    else:
        nascimento = b.get("nascimento")
    if not faixa_ok(m, nascimento, date.fromisoformat(data)):
        return 422, {"erro": "Este médico atende pacientes " + texto_faixa(m) + ". Escolha outro médico ou ligue para " + TELEFONE + "."}

    novo = {
        "nome_completo": b.get("nome", ""),
        "cpf": cpf,
        "data_nascimento": b.get("nascimento", ""),
        "telefone": so_digitos(b.get("celular")),
        "sexo": "Feminino" if b.get("sexo") == "F" else "Masculino",
    }
    if b.get("email"):
        novo["email"] = b["email"]

    por_convenio = b.get("pagamento") == "convenio"
    conv = convenio_valido(pid, b) if por_convenio else None
    if por_convenio and not conv:
        return 400, {"erro": "Este médico não atende por esse convênio. Escolha outro ou ligue para " + TELEFONE + "."}

    def cobranca():
        if por_convenio:
            pronto = preparar_convenio(pid, uid, eid, conv["id"])
            return {"convenio_id": conv["id"], "convenio_plano_id": pronto.get("plano", 1), "valor": 0}
        tabela_id, _ = preparar(pid, uid, eid, b.get("pagamento"))
        if not tabela_id:
            raise PonteErro("Não conseguimos confirmar o valor da consulta. Ligue para " + TELEFONE + ".")
        return {"tabela_id": tabela_id}

    if not PERMITIR_AGENDAR:
        # modo teste: valida o cadastro (sem gravar) e confere o preço, mas não marca
        if not paciente_id:
            feegow("cadastrar_paciente", novo)  # sem confirmar=true: só valida
        cobranca()
        return 200, {"simulado": True, "paciente_existente": bool(paciente_id)}

    preco = cobranca()  # confere antes de gravar qualquer coisa
    if not paciente_id:
        cad = feegow("cadastrar_paciente", dict(novo, confirmar=True))
        paciente_id = achar(cad, "paciente_id", "id")
        if not paciente_id:
            return 502, {"erro": "Não conseguimos fazer o seu cadastro. Ligue para " + TELEFONE + "."}
    ag = feegow("criar_agendamento", dict(preco, **{
        "paciente_id": paciente_id,
        "profissional_id": pid,
        "especialidade_id": eid,
        "unidade_id": uid,
        "local_id": slot.get("local_id"),
        "data": data,
        "horario": hora,
        "canal_id": CANAL_SITE,
        "celular": so_digitos(b["celular"]),
        "notas": NOTA + (" - convênio " + conv["nome"] if conv else ""),
    }))
    HORARIOS_CACHE.pop((pid, uid, eid), None)
    return 200, {"agendamento_id": achar(ag, "agendamento_id", "id")}


# --------------------------------------------------------------------------
# "Meus agendamentos": a pessoa entra com CPF + data de nascimento e vê, cancela
# ou remarca as consultas dela. Sem senha: a sessão vive 30 minutos na memória
# do servidor e some quando ele reinicia.
# --------------------------------------------------------------------------
STATUS_ATIVOS = {1, 7}  # Marcado - não confirmado, Marcado - confirmado
STATUS_TEXTO = {
    1: "Marcada", 7: "Confirmada", 3: "Realizada", 6: "Não compareceu", 11: "Desmarcada",
    22: "Cancelada pela clínica", 15: "Remarcada", 4: "Aguardando atendimento", 2: "Em atendimento",
    5: "Em atendimento", 33: "Em espera", 208: "Aguardando pagamento",
}
MOTIVO_PACIENTE = 1  # "Solicitado pelo Paciente"
SESSAO_SEGUNDOS = 30 * 60
SESSOES = {}  # token -> {"paciente_id", "nome", "expira", "ags": {agendamento_id: item}}


def entrar(b, ip):
    cpf = so_digitos(b.get("cpf"))
    nasc = data_ddmmaaaa(b.get("nascimento"))
    if len(cpf) != 11 or not re.fullmatch(r"\d{2}/\d{2}/\d{4}", nasc):
        return 400, {"erro": "Confira o CPF e a data de nascimento."}
    if not _limite("entrar", ip, 8, 600):
        return 429, {"erro": "Muitas tentativas seguidas. Espere alguns minutos ou ligue para " + TELEFONE + "."}
    if _cpf_pausado(cpf, ip):
        return 429, {"erro": TEXTO_PAUSADO}
    pid, pac = buscar_cadastro(cpf)
    if not pid or not _confere_nascimento(pac, nasc):
        # mesma resposta para CPF sem cadastro e data errada: não revela se o CPF existe
        _errou_cpf(cpf, ip)
        return 401, {"erro": "CPF ou data de nascimento não conferem com o cadastro da Clínica Dias."}
    nome = " ".join(str(pac.get("nome_social") or pac.get("nome") or "").split())
    token = secrets.token_urlsafe(32)
    agora = time.time()
    with TRAVA:
        for t in [t for t, v in SESSOES.items() if v["expira"] < agora]:
            del SESSOES[t]
        SESSOES[token] = {"paciente_id": int(pid), "nome": nome, "nascimento": nasc,
                          "expira": agora + SESSAO_SEGUNDOS, "ags": {}}
    return 200, {"token": token, "primeiro_nome": nome.split(" ")[0].title() if nome else ""}


def sessao_do_pedido(headers):
    auth = headers.get("Authorization") or ""
    token = auth[7:].strip() if auth.startswith("Bearer ") else ""
    agora = time.time()
    with TRAVA:
        s = SESSOES.get(token)
        if not s or s["expira"] < agora:
            SESSOES.pop(token, None)
            return None, None
        s["expira"] = agora + SESSAO_SEGUNDOS  # cada uso renova os 30 minutos
        return token, s


def sair(headers):
    token, _ = sessao_do_pedido(headers)
    with TRAVA:
        SESSOES.pop(token, None)
    return 200, {"ok": True}


def _iso(ddmmaaaa):
    d, m, a = str(ddmmaaaa)[:10].split("-")
    return f"{a}-{m}-{d}"


def _listar(pid, ini, fim):
    """O Feegow só aceita períodos menores que 180 dias: quebra em partes e busca em paralelo."""
    partes, a = [], ini
    while a <= fim:
        b = min(a + timedelta(days=170), fim)
        partes.append((a, b))
        a = b + timedelta(days=1)

    def um(p):
        d = feegow("listar_agendamentos", {"paciente_id": pid, "data_inicio": p[0].isoformat(), "data_fim": p[1].isoformat()})
        return d.get("content") or []

    with ThreadPoolExecutor(len(partes)) as ex:
        itens = [x for lista in ex.map(um, partes) for x in lista]
    vistos, out = set(), []
    for x in itens:
        if int(x.get("paciente_id") or 0) != pid or x.get("agendamento_id") in vistos:
            continue  # garantia extra: só consultas desta pessoa
        vistos.add(x.get("agendamento_id"))
        out.append(x)
    return out


def _unidades(itens):
    """A lista simples não traz a unidade. Busca no detalhamento do dia de cada médico
    (o filtro paciente_id do detalhamento não funciona; limite máximo 200)."""
    chaves = {(x["profissional_id"], x["data"]) for x in itens if x.get("profissional_id")}

    def um(k):
        try:
            d = feegow("detalhar_agendamentos", {
                "data_inicio": _iso(k[1]), "data_fim": _iso(k[1]), "profissional_id": k[0],
                "incluir_dados_pessoais": False, "limite": 200,
            })
            return {a["agendamento_id"]: a for a in d.get("agendamentos") or []}
        except Exception:  # noqa: BLE001 — sem unidade, a consulta aparece igual, só não pode remarcar on-line
            return {}

    mapa = {}
    if chaves:
        with ThreadPoolExecutor(min(len(chaves), 6)) as ex:
            for m in ex.map(um, chaves):
                mapa.update(m)
    return mapa


def _item(x, agora, det=None):
    data, hora = _iso(x["data"]), str(x.get("horario") or "")[:5]
    st = int(x.get("status_id") or 0)
    futura = datetime.fromisoformat(f"{data}T{hora or '00:00'}").replace(tzinfo=BRT) > agora
    uid = int_ou((det or {}).get("unidade_id"))
    proc = str(x.get("procedimento") or "").strip()
    pid = int(x.get("profissional_id") or 0)
    with TRAVA:
        eid = CATALOGO["por_procedimento"].get((pid, int_ou(x.get("procedimento_id"))))
        nome_esp = (CATALOGO["especialidades"].get(eid) or {}).get("nome", "") if eid else ""
    # pelo site só se mexe em CONSULTA; exame e cirurgia têm preparo e reserva de sala: pelo telefone
    pode_cancelar = st in STATUS_ATIVOS and futura and "CONSULTA" in proc.upper()
    return {
        "id": int(x["agendamento_id"]),
        "data": data,
        "hora": hora,
        "medico_id": pid,
        "medico": nome_proprio(x.get("profissional")),
        "especialidade_id": eid,
        "especialidade": nome_esp,
        "procedimento": proc[:1].upper() + proc[1:].lower(),
        "status_id": st,
        "status": STATUS_TEXTO.get(st) or str(x.get("status") or ""),
        "unidade_id": uid,
        "unidade": nome_unidade((det or {}).get("unidade") or x.get("unidade")),
        "ativa": st in STATUS_ATIVOS and futura,
        "pode_cancelar": pode_cancelar,
        # remarcar on-line só consulta com médico, especialidade e unidade liberados no site
        "pode_remarcar": bool(pode_cancelar and eid is not None and uid is not None and medico(pid, eid, uid)),
    }


def meus_agendamentos(s, q):
    pid = s["paciente_id"]
    agora = datetime.now(BRT)
    hoje = agora.date()
    if (q.get("periodo") or [""])[0] == "historico":
        itens = _listar(pid, hoje - timedelta(days=364), hoje - timedelta(days=1))
        out = [_item(x, agora) for x in itens]
    else:
        itens = _listar(pid, hoje, hoje + timedelta(days=179))
        ativos = [x for x in itens if int(x.get("status_id") or 0) in STATUS_ATIVOS]
        det = _unidades(ativos)
        out = [_item(x, agora, det.get(x["agendamento_id"])) for x in itens]
        with TRAVA:
            s["ags"].update({i["id"]: i for i in out})
    out.sort(key=lambda i: (i["data"], i["hora"]))
    return 200, {"agendamentos": out}


def _confere(s, b, acao):
    """Só mexe em consulta que apareceu na lista desta pessoa e que, conferindo de novo no Feegow,
    ainda é dela e ainda está marcada."""
    aid = int_ou(b.get("agendamento_id"))
    if aid is None:
        return None, (400, {"erro": "Consulta inválida."})
    item = s["ags"].get(aid)
    if not item or not item[acao]:
        return None, (403, {"erro": "Esta consulta não pode ser alterada pelo site. Ligue para " + TELEFONE + "."})
    d = feegow("listar_agendamentos", {"agendamento_id": aid, "paciente_id": s["paciente_id"],
                                        "data_inicio": item["data"], "data_fim": item["data"]})
    atual = next((x for x in d.get("content") or [] if int(x.get("agendamento_id") or 0) == aid), None)
    if not atual or int(atual.get("paciente_id") or 0) != s["paciente_id"] or int(atual.get("status_id") or 0) not in STATUS_ATIVOS:
        return None, (409, {"erro": "Esta consulta mudou na agenda da clínica. Atualize a página para ver como ela está agora."})
    return item, None


def cancelar(s, b):
    item, erro = _confere(s, b, "pode_cancelar")
    if erro:
        return erro
    if not PERMITIR_AGENDAR:
        return 200, {"simulado": True}
    feegow("cancelar_agendamento", {"agendamento_id": item["id"], "motivo_id": MOTIVO_PACIENTE,
                                    "observacao": "Desmarcado pelo paciente no site"})
    with TRAVA:
        item.update(ativa=False, pode_cancelar=False, pode_remarcar=False, status_id=11, status=STATUS_TEXTO[11])
    return 200, {"ok": True}


def remarcar(s, b):
    item, erro = _confere(s, b, "pode_remarcar")
    if erro:
        return erro
    data, hora = str(b.get("data") or ""), str(b.get("horario") or "")[:5]
    if not any(h["data"] == data and h["horario"] == hora
               for h in livres(item["medico_id"], item["unidade_id"], item["especialidade_id"], fresco=True)):
        return 409, {"erro": "Esse horário acabou de ser ocupado. Escolha outro."}
    if not PERMITIR_AGENDAR:
        return 200, {"simulado": True}
    feegow("remarcar_agendamento", {"agendamento_id": item["id"], "motivo_id": MOTIVO_PACIENTE,
                                    "data": data, "horario": hora,
                                    "observacao": "Remarcado pelo paciente no site"})
    HORARIOS_CACHE.pop((item["medico_id"], item["unidade_id"], item["especialidade_id"]), None)
    with TRAVA:
        s["ags"].pop(item["id"], None)
    return 200, {"ok": True}


# --------------------------------------------------------------------------
# HTTP
# --------------------------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "agenda"
    sys_version = ""

    def log_message(self, fmt, *args):
        # não registra corpo, consulta nem dados pessoais
        sys.stderr.write("%s %s\n" % (self.command, self.path.split("?")[0]))

    def ip(self):
        # atrás do Traefik do Coolify: X-Real-Ip é escrito pelo proxy (o X-Forwarded-For o cliente consegue forjar)
        return (self.headers.get("X-Real-Ip") or "").strip() or self.client_address[0]

    def origem_ok(self):
        o = (self.headers.get("Origin") or "").rstrip("/")
        return o if o in CORS_ORIGINS else None

    def end_headers(self):
        o = self.origem_ok()
        if o:
            self.send_header("Access-Control-Allow-Origin", o)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Vary", "Origin")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        if self.headers.get("X-Forwarded-Proto") == "https":
            self.send_header("Strict-Transport-Security", "max-age=31536000")
        super().end_headers()

    def send_json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204 if self.origem_ok() else 403)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def erro(self, e, texto):
        if isinstance(e, PonteErro):
            return self.send_json(422, {"erro": str(e)})
        if isinstance(e, FeegowErro):
            # o texto do Feegow não sai daqui (pode ter dado interno ou de outra pessoa)
            sys.stderr.write("feegow recusou: %s\n" % (e.ferramenta or "?"))
            return self.send_json(422, {"erro": "Não conseguimos concluir agora. Ligue para " + TELEFONE + "."})
        sys.stderr.write("erro: %s\n" % type(e).__name__)
        return self.send_json(502, {"erro": texto})

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        p = u.path.rstrip("/")
        try:
            if p == "/api/saude":
                with TRAVA:
                    cat = {"pronto": CATALOGO["pronto"], "atualizado_em": CATALOGO["atualizado_em"],
                           "medicos": len(CATALOGO["medicos"]), "erro": CATALOGO["erro"]}
                return self.send_json(200, {"ok": True, "marcacao_real": PERMITIR_AGENDAR, "catalogo": cat})
            if p == "/api/especialidades":
                return self.send_json(*lista_especialidades())
            if p == "/api/medicos":
                return self.send_json(*lista_medicos(q))
            if p == "/api/unidades":
                return self.send_json(*lista_unidades())
            if p == "/api/horarios":
                return self.send_json(*horarios(q))
            if p == "/api/convenios":
                return self.send_json(*convenios(q))
            if p == "/api/precos":
                return self.send_json(*precos(q))
            if p == "/api/meus/agendamentos":
                _, sess = sessao_do_pedido(self.headers)
                if not sess:
                    return self.send_json(401, {"erro": "Sua sessão terminou. Entre de novo."})
                return self.send_json(*meus_agendamentos(sess, q))
            if p == "":
                return self.send_json(200, {"servico": "agenda da Clínica Dias", "saude": "/api/saude"})
        except Exception as e:  # noqa: BLE001
            return self.erro(e, "Não conseguimos falar com a agenda agora. Tente de novo em instantes.")
        return self.send_json(404, {"erro": "não encontrado"})

    def do_HEAD(self):
        return self.do_GET()

    def do_POST(self):
        u = urlparse(self.path)
        p = u.path.rstrip("/")
        # navegador de outro site não pode marcar em nome de ninguém
        if self.headers.get("Origin") and not self.origem_ok():
            return self.send_json(403, {"erro": "origem não permitida"})
        n = int_ou(self.headers.get("Content-Length"), 0)
        try:
            b = json.loads(self.rfile.read(min(max(n, 0), 20000)) or b"{}")
            if not isinstance(b, dict):
                raise ValueError
        except ValueError:
            return self.send_json(400, {"erro": "pedido inválido"})
        try:
            if p == "/api/paciente":
                return self.send_json(*paciente(b, self.ip()))
            if p == "/api/valor":
                return self.send_json(*valor(b))
            if p == "/api/agendar":
                return self.send_json(*agendar(b, self.ip()))
            if p == "/api/meus/entrar":
                return self.send_json(*entrar(b, self.ip()))
            if p == "/api/meus/sair":
                return self.send_json(*sair(self.headers))
            if p in ("/api/meus/cancelar", "/api/meus/remarcar"):
                _, sess = sessao_do_pedido(self.headers)
                if not sess:
                    return self.send_json(401, {"erro": "Sua sessão terminou. Entre de novo."})
                return self.send_json(*(cancelar if p.endswith("cancelar") else remarcar)(sess, b))
        except Exception as e:  # noqa: BLE001
            return self.erro(e, "Não conseguimos concluir agora. Ligue para " + TELEFONE + ".")
        return self.send_json(404, {"erro": "não encontrado"})


if __name__ == "__main__":
    if not MCP_URL or not MCP_TOKEN:
        sys.exit("Falta FEEGOW_MCP_URL ou FEEGOW_MCP_TOKEN")
    threading.Thread(target=manter_catalogo, daemon=True).start()
    ThreadingHTTPServer.daemon_threads = True
    print(f"Agenda em http://{HOST}:{PORT}  (marcação real: {'LIGADA' if PERMITIR_AGENDAR else 'desligada, modo teste'};"
          f" CORS: {', '.join(sorted(CORS_ORIGINS)) or 'nenhum'})", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
