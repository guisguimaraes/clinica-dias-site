# Tira as paredes do vetor da planta (PDF → SVG com pdftocairo) e devolve caixas em metros.
# Parede nas plantas da Lígia = duas linhas pretas paralelas, 7 a 30 cm uma da outra.
# Só usa linhas pretas grossas (stroke-width 6), retas e alinhadas aos eixos.
#
# uso: python -I extrai_paredes_svg.py <svg> <config.json> <saida.json> [<png_conferencia> <png_base> <dpi> <x_off_px> <y_off_px>]
# config: {"recorte_pt": [x0,y0,x1,y1], "origem_pt": [x,y], "pt_por_m": n, "eixo": "normal"}
#   recorte_pt: retângulo da planta cotada na página (pt); origem_pt: canto noroeste externo (pt)
import json, re, sys
from collections import defaultdict

svg, cfg_path, saida = sys.argv[1:4]
cfg = json.load(open(cfg_path))
X0, Y0, X1, Y1 = cfg['recorte_pt']
OX, OY = cfg['origem_pt']
PPM = cfg['pt_por_m']
MIN_SW = cfg.get('traco_min', 6)
SO_PRETO = cfg.get('so_preto', True)

txt = open(svg, encoding='utf-8').read()
segs = []
arcos = []  # (inicio, meio, fim) em metros — candidatos a arco de porta
diag = []   # retas curtas inclinadas (arcos desenhados como polilinha)
for p in re.findall(r'<path[^>]*/>', txt):
    sw = re.search(r'stroke-width="([\d.]+)"', p)
    if not sw or 'fill="none"' not in p or float(sw.group(1)) < MIN_SW:
        continue
    d = re.search(r' d="([^"]*)"', p).group(1)
    tr = re.search(r'transform="matrix\(([^)]*)\)"', p)
    a, b, c, dd, e, f = map(float, tr.group(1).split(',')) if tr else (1, 0, 0, 1, 0, 0)
    preto = 'rgb(0%, 0%, 0%)' in p
    if 'C' not in d:
        # retas curtas inclinadas (de qualquer cor) podem ser pedaços do arco de abertura da porta
        nums0 = re.findall(r'([ML])\s*(-?[\d.]+)\s+(-?[\d.]+)', d)
        pts0 = [(a * float(x) + c * float(y) + e, b * float(x) + dd * float(y) + f) for _, x, y in nums0]
        for (xa, ya), (xb, yb) in zip(pts0, pts0[1:]):
            if X0 <= xa <= X1 and Y0 <= ya <= Y1:
                ma = ((xa - OX) / PPM, (ya - OY) / PPM)
                mb = ((xb - OX) / PPM, (yb - OY) / PPM)
                L = ((ma[0] - mb[0]) ** 2 + (ma[1] - mb[1]) ** 2) ** 0.5
                if 0.005 < L < 0.3 and abs(ma[0] - mb[0]) > 0.003 and abs(ma[1] - mb[1]) > 0.003:
                    diag.append((ma, ((ma[0] + mb[0]) / 2, (ma[1] + mb[1]) / 2), mb))
    if SO_PRETO and not preto and 'C' not in d:
        continue  # linhas retas: só pretas (cinza = cota)
    if 'C' in d:
        # arco: guarda início, meio e fim (para achar a dobradiça e a largura da porta)
        toks = re.findall(r'[MC]|-?[\d.]+', d)
        ancoras, ctrl, cmd, buf = [], [], None, []
        for tk in toks:
            if tk in 'MC':
                cmd = tk; buf = []; continue
            buf.append(float(tk))
            if cmd == 'M' and len(buf) == 2:
                ancoras.append(tuple(buf)); buf = []
            elif cmd == 'C' and len(buf) == 6:
                ctrl.append((ancoras[-1], (buf[0], buf[1]), (buf[2], buf[3]), (buf[4], buf[5])))
                ancoras.append((buf[4], buf[5])); buf = []
        if len(ancoras) < 2 or not ctrl:
            continue
        if len(ctrl) == 1:
            p0, p1, p2, p3 = ctrl[0]
            meio = tuple(0.125 * p0[i] + 0.375 * p1[i] + 0.375 * p2[i] + 0.125 * p3[i] for i in range(2))
        else:
            meio = ancoras[len(ancoras) // 2]
        def tm(q):
            X = a * q[0] + c * q[1] + e
            Y = b * q[0] + dd * q[1] + f
            return ((X - OX) / PPM, (Y - OY) / PPM), X, Y
        (ini, xi, yi), (mei, _, _), (fim, _, _) = tm(ancoras[0]), tm(meio), tm(ancoras[-1])
        if X0 <= xi <= X1 and Y0 <= yi <= Y1:
            arcos.append((ini, mei, fim))
        continue
    nums = re.findall(r'([ML])\s*(-?[\d.]+)\s+(-?[\d.]+)', d)
    pts = [(a * float(x) + c * float(y) + e, b * float(x) + dd * float(y) + f) for _, x, y in nums]
    for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
        if not (X0 <= xa <= X1 and Y0 <= ya <= Y1):
            continue
        # para metros, com x para leste e z para o sul
        ma = ((xa - OX) / PPM, (ya - OY) / PPM)
        mb = ((xb - OX) / PPM, (yb - OY) / PPM)
        segs.append((ma, mb))

TOL = 0.01
H = defaultdict(list)  # z → [(x0, x1)]
V = defaultdict(list)  # x → [(z0, z1)]
for (xa, za), (xb, zb) in segs:
    if abs(za - zb) < TOL and abs(xa - xb) > 0.2:
        H[round((za + zb) / 2, 2)].append((min(xa, xb), max(xa, xb)))
    elif abs(xa - xb) < TOL and abs(za - zb) > 0.2:
        V[round((xa + xb) / 2, 2)].append((min(za, zb), max(za, zb)))


def junta_intervalos(iv):
    iv = sorted(iv)
    out = []
    for a, b in iv:
        if out and a <= out[-1][1] + 0.02:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return out


def pares(linhas, esp_min=0.07, esp_max=0.30):
    """linhas: {coord: [(a,b)]} → caixas (c0, c1, a, b) onde c = eixo perpendicular."""
    chaves = sorted(linhas)
    lin = {k: junta_intervalos(linhas[k]) for k in chaves}
    caixas = []
    for i, k in enumerate(chaves):
        for a, b in lin[k]:
            # procura a linha paralela mais próxima "abaixo" (k2 > k) que se sobreponha
            restante = [(a, b)]
            for k2 in chaves[i + 1:]:
                d = k2 - k
                if d > esp_max:
                    break
                if d < esp_min:
                    continue
                novo = []
                for ra, rb in restante:
                    cobertos = []
                    for a2, b2 in lin[k2]:
                        lo, hi = max(ra, a2), min(rb, b2)
                        if hi - lo > 0.12:
                            caixas.append((k, k2, lo, hi))
                            cobertos.append((lo, hi))
                    # o que não teve par continua procurando mais longe
                    pos = ra
                    for lo, hi in sorted(cobertos):
                        if lo - pos > 0.12:
                            novo.append((pos, lo))
                        pos = max(pos, hi)
                    if rb - pos > 0.12:
                        novo.append((pos, rb))
                restante = novo
                if not restante:
                    break
    return caixas


brutas = []
for z0, z1, xa, xb in pares(H):
    brutas.append({'o': 'h', 'x0': xa, 'x1': xb, 'z0': z0, 'z1': z1})
for x0, x1, za, zb in pares(V):
    brutas.append({'o': 'v', 'x0': x0, 'x1': x1, 'z0': za, 'z1': zb})

# limite do prédio (recorta) e áreas a ignorar (escadas, hachuras) — tudo em metros
limites = cfg.get('limites', [])   # [[x0,z0,x1,z1], ...] a parede tem que estar dentro de algum
fora = cfg.get('ignorar', [])      # [[x0,z0,x1,z1], ...]
def dentro(w, r, folga=0.02):
    return w['x0'] >= r[0] - folga and w['x1'] <= r[2] + folga and w['z0'] >= r[1] - folga and w['z1'] <= r[3] + folga
def toca(w, r):
    return w['x0'] < r[2] and w['x1'] > r[0] and w['z0'] < r[3] and w['z1'] > r[1]
paredes = []
for w in brutas:
    if limites:
        # recorta pelo primeiro limite que a parede toca
        def sobra(r):
            return max(0, min(w['x1'], r[2]) - max(w['x0'], r[0])) * max(0, min(w['z1'], r[3]) - max(w['z0'], r[1]))
        r = max(limites, key=sobra)
        if sobra(r) <= 0:
            continue
        w = {**w, 'x0': max(w['x0'], r[0]), 'x1': min(w['x1'], r[2]), 'z0': max(w['z0'], r[1]), 'z1': min(w['z1'], r[3])}
        comp = (w['x1'] - w['x0']) if w['o'] == 'h' else (w['z1'] - w['z0'])
        if comp < 0.15:
            continue
    if any(dentro(w, r) for r in fora):
        continue
    paredes.append({k: (round(v, 3) if isinstance(v, float) else v) for k, v in w.items()})

# ── portas pelos arcos de abertura: dobradiça = canto do arco, largura = raio
import math
def dist(p, q):
    return math.hypot(p[0] - q[0], p[1] - q[1])
# os arcos vêm quebrados em vários pedaços: emenda pelas pontas (até 1,5 cm)
def emenda(pecas):
    def chave(p):
        return (round(p[0] / 0.015), round(p[1] / 0.015))
    livres = list(range(len(pecas)))
    usados = set()
    pontas = defaultdict(list)
    for i, (ini, _, fim) in enumerate(pecas):
        pontas[chave(ini)].append(i)
        pontas[chave(fim)].append(i)
    cadeias = []
    for i in livres:
        if i in usados:
            continue
        usados.add(i)
        ini, mei, fim = pecas[i]
        pts = [ini, mei, fim]
        for lado in (0, 1):  # cresce pelas duas pontas
            while True:
                ponta = pts[-1] if lado == 0 else pts[0]
                prox = None
                for j in pontas[chave(ponta)]:
                    if j not in usados:
                        prox = j; break
                if prox is None:
                    break
                usados.add(prox)
                a2, m2, f2 = pecas[prox]
                seq = [a2, m2, f2] if chave(a2) == chave(ponta) else [f2, m2, a2]
                if lado == 0:
                    pts += seq[1:]
                else:
                    pts = seq[::-1][:-1] + pts
        cadeias.append((pts[0], pts[len(pts) // 2], pts[-1]))
    return cadeias

def agrupa_tracejados(pecas, tol=0.12):
    """arcos tracejados: junta pedaços próximos e ajusta um quarto de círculo a cada grupo."""
    n = len(pecas)
    pai = list(range(n))
    def raiz(i):
        while pai[i] != i:
            pai[i] = pai[pai[i]]; i = pai[i]
        return i
    # grade para achar vizinhos
    grade = defaultdict(list)
    for i, (ini, _, fim) in enumerate(pecas):
        for q in (ini, fim):
            grade[(int(q[0] // tol), int(q[1] // tol))].append((i, q))
    for (gx, gz), itens in list(grade.items()):
        viz = [it for dx in (-1, 0, 1) for dz in (-1, 0, 1) for it in grade.get((gx + dx, gz + dz), [])]
        for i, q in itens:
            for j, q2 in viz:
                if i != j and dist(q, q2) < tol:
                    pai[raiz(i)] = raiz(j)
    grupos = defaultdict(list)
    for i, (ini, mei, fim) in enumerate(pecas):
        grupos[raiz(i)] += [ini, mei, fim]
    saida_ = []
    for pts in grupos.values():
        xs, zs = [p[0] for p in pts], [p[1] for p in pts]
        w, h = max(xs) - min(xs), max(zs) - min(zs)
        if not (0.5 < w < 1.4 and 0.5 < h < 1.4 and abs(w - h) < 0.2 * max(w, h)):
            continue
        melhor = None
        for C in [(x, z) for x in (min(xs), max(xs)) for z in (min(zs), max(zs))]:
            ds = [dist(C, p) for p in pts]
            m = sum(ds) / len(ds)
            dp = (sum((d - m) ** 2 for d in ds) / len(ds)) ** 0.5
            if melhor is None or dp / m < melhor[0]:
                melhor = (dp / m, C, m)
        if melhor[0] > 0.08:
            continue
        _, C, r = melhor
        ang = sorted(pts, key=lambda p: math.atan2(p[1] - C[1], p[0] - C[0]))
        # se o arco cruza o ângulo ±180°, a ordenação quebra; ainda serve (A e B são os extremos)
        saida_.append((ang[0], ang[len(ang) // 2], ang[-1]))
    return saida_

arcos = emenda(arcos)
arcos = [a for a in arcos if dist(a[0], a[2]) / math.sqrt(2) >= 0.5] + agrupa_tracejados([a for a in arcos if dist(a[0], a[2]) / math.sqrt(2) < 0.5] + diag, tol=0.05)
print('retas inclinadas', len(diag))
portas = []
for A, M, Bp in arcos:
    corda = dist(A, Bp)
    r = corda / math.sqrt(2)
    if not (0.55 <= r <= 1.35):
        continue
    xs, zs = [A[0], Bp[0], M[0]], [A[1], Bp[1], M[1]]
    cantos = [(x, z) for x in (min(xs), max(xs)) for z in (min(zs), max(zs))]
    C = None
    for q in cantos:
        if abs(dist(q, A) - r) < 0.15 * r and abs(dist(q, Bp) - r) < 0.15 * r and abs(dist(q, M) - r) < 0.15 * r:
            C = q
    if not C:
        continue
    escolha = None
    for E in (A, Bp):
        o = 'h' if abs(E[0] - C[0]) > abs(E[1] - C[1]) else 'v'
        for w in paredes:
            if w['o'] != o:
                continue
            if o == 'h':
                lin = (w['z0'] + w['z1']) / 2
                if abs(lin - C[1]) < 0.22 and w['x0'] - r < C[0] < w['x1'] + r:
                    escolha = (o, lin, sorted((C[0], E[0]))); break
            else:
                lin = (w['x0'] + w['x1']) / 2
                if abs(lin - C[0]) < 0.22 and w['z0'] - r < C[1] < w['z1'] + r:
                    escolha = (o, lin, sorted((C[1], E[1]))); break
        if escolha:
            break
    if not escolha:
        continue
    o, lin, (ia, ib) = escolha
    if any(pp['o'] == o and abs(pp['c'] - lin) < 0.1 and pp['a'] < ib - 0.1 and pp['b'] > ia + 0.1 and abs((pp['b'] - pp['a']) - (ib - ia)) < 0.05 for pp in portas):
        continue  # repetida
    portas.append({'o': o, 'c': round(lin, 3), 'a': round(ia, 3), 'b': round(ib, 3)})

if saida.endswith('.js'):
    with open(saida, 'w', encoding='utf-8') as f:
        f.write('// Gerado por blender/avulsos/extrai_paredes_svg.py a partir da planta cotada. Não editar à mão.\n')
        f.write('export default ' + json.dumps({'paredes': paredes, 'portas': portas}) + ';\n')
else:
    json.dump({'paredes': paredes, 'portas': portas, 'segmentos': len(segs)}, open(saida, 'w'), indent=0)
print(len(segs), 'segmentos;', len(brutas), 'brutas;', len(paredes), 'paredes;', len(arcos), 'arcos;', len(portas), 'portas →', saida)

if len(sys.argv) > 4:
    import cv2
    conf, base, dpi, xo, yo = sys.argv[4], sys.argv[5], float(sys.argv[6]), float(sys.argv[7]), float(sys.argv[8])
    im = cv2.imread(base)
    im = (im * 0.5 + 120).astype('uint8')
    k = dpi / 72
    def px(xm, zm):
        return int((xm * PPM + OX) * k - xo), int((zm * PPM + OY) * k - yo)
    for w in paredes:
        cv2.rectangle(im, px(w['x0'], w['z0']), px(w['x1'], w['z1']), (40, 40, 230) if w['o'] == 'h' else (230, 90, 30), -1)
    cv2.imwrite(conf, im)
