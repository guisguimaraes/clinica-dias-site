# Móveis, plantas e decalques da Clínica Dias, feitos por código (nada baixado da internet).
# Este arquivo é executado dentro de monta_clinica.py (usa caixa_local, cilindro, grupo, texto, B...).
#
# Convenção de cada móvel (coordenadas da planta, giro "vira" em graus em torno do eixo vertical):
#   frente = +z local (onde a pessoa senta ou chega), fundo = -z local (parede)
#   maca, leito e esteira: comprimento ao longo de z local (cabeceira em -z)
#   tomógrafo: mesa ao longo de +x local
# vira 0 = encostado na parede norte · 90 = na parede oeste · -90 = na leste · 180 = na sul

import bmesh, math
from mathutils import Vector, Euler


def material_extra():
    material('estofado', cor='#4f5a66', rug=0.75)
    material('estofado-claro', cor='#c9ccd0', rug=0.8)
    material('estofado-azul', cor='#5C95A4', rug=0.7)
    material('madeira-clara', cor='#d6c3a5', rug=0.55)
    material('louca', cor='#f4f4f2', rug=0.15)
    material('cortina', cor='#cfe2e8', rug=0.9)
    material('equip', cor='#e9ecef', rug=0.35)
    material('equip-escuro', cor='#3a3f45', rug=0.4)
    material('verde-hosp', cor='#8fbfb2', rug=0.6)
    material('folha', cor='#3f7a3a', rug=0.55)
    material('folha-clara', cor='#6aa04f', rug=0.55)
    material('terra', cor='#4a3a2c', rug=0.95)
    material('ripado', tex='ripado', rug=0.55)
    material('creme', cor='#ece3d3', rug=0.7)
    material('fachada-escura', cor='#4a4d52', rug=0.6)
    material('fachada-clara', cor='#a3a7ad', rug=0.6)


def chanfra(ob, w=0.012, seg=2):
    """quinas arredondadas: aplica um Bevel limitado por ângulo no objeto (antes de juntar)."""
    if ob is None or ob.type != 'MESH':
        return ob
    m = ob.modifiers.new('chanfro', 'BEVEL')
    m.width = w
    m.segments = seg
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(40)
    m.harden_normals = False
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=m.name)
    return ob


def _em(pos, vira):
    return lambda l: soma(pos, rot_vec(l, vira))


def bx(nome, em, local, tam, mat, vira, giro_extra=0):
    return caixa_local(nome, em(local), tam, mat, vira + giro_extra)


def cil(nome, em, a, b, r, mat, seg=12):
    return cilindro(nome, em(a), em(b), r, mat, seg)


# ─────────────────────────────── assentos
def cadeira_escritorio(n, pos, vira):
    em = _em(pos, vira)
    p = [
        bx(n + '_assento', em, (0, 0.47, 0), (0.48, 0.07, 0.46), 'estofado', vira),
        bx(n + '_encosto', em, (0, 0.82, -0.23), (0.44, 0.5, 0.06), 'estofado', vira),
        cil(n + '_coluna', em, (0, 0.08, 0), (0, 0.44, 0), 0.025, 'equip-escuro', 8),
    ]
    for k in range(5):
        a = k * 72
        p.append(bx(n + f'_pe{k}', em, rot_vec((0, 0.05, 0.16), a), (0.05, 0.04, 0.32), 'equip-escuro', vira, a))
    return chanfra(grupo(p, n), 0.015)


def sofa(n, pos, vira, lugares=3, mat='estofado', larg=0.62):
    em = _em(pos, vira)
    L = lugares * larg
    p = [bx(n + '_base', em, (0, 0.2, 0), (L + 0.2, 0.22, 0.78), mat, vira),
         bx(n + '_encosto', em, (0, 0.6, -0.31), (L + 0.2, 0.6, 0.18), mat, vira)]
    for s in (-1, 1):
        p.append(bx(n + f'_braco{s}', em, (s * (L / 2 + 0.05), 0.42, 0.0), (0.12, 0.3, 0.78), mat, vira))
    for k in range(lugares):
        x = -L / 2 + larg * (k + 0.5)
        p.append(bx(n + f'_almof{k}', em, (x, 0.38, 0.06), (larg - 0.03, 0.12, 0.6), mat, vira))
    return chanfra(grupo(p, n), 0.035, 3)


def poltrona(n, pos, vira, reclina=False, mat='estofado-azul'):
    em = _em(pos, vira)
    p = [bx(n + '_base', em, (0, 0.22, 0), (0.75, 0.26, 0.75), mat, vira),
         bx(n + '_assento', em, (0, 0.42, 0.04), (0.6, 0.12, 0.62), mat, vira),
         bx(n + '_encosto', em, (0, 0.75, -0.3), (0.75, 0.7, 0.16), mat, vira)]
    for s in (-1, 1):
        p.append(bx(n + f'_braco{s}', em, (s * 0.33, 0.5, 0.0), (0.1, 0.22, 0.72), mat, vira))
    if reclina:
        p.append(bx(n + '_pes', em, (0, 0.32, 0.65), (0.6, 0.12, 0.5), mat, vira))
    return chanfra(grupo(p, n), 0.04, 3)


# ─────────────────────────────── mesas, bancadas, armários
def mesa(n, pos, vira, larg=1.4, prof=0.7, pacientes=2, medico=True, monitor=True):
    """mesa de consultório: médico em -z, pacientes em +z."""
    em = _em(pos, vira)
    p = [bx(n + '_tampo', em, (0, 0.74, 0), (larg, 0.035, prof), 'madeira-clara', vira),
         bx(n + '_frontal', em, (0, 0.45, prof / 2 - 0.03), (larg - 0.06, 0.5, 0.025), 'branco', vira)]
    for s in (-1, 1):
        p.append(bx(n + f'_lado{s}', em, (s * (larg / 2 - 0.02), 0.37, 0), (0.035, 0.74, prof - 0.02), 'branco', vira))
    if monitor:
        p.append(bx(n + '_tela', em, (0.15, 0.98, -prof / 2 + 0.15), (0.52, 0.32, 0.03), 'preto', vira))
        p.append(bx(n + '_pe_tela', em, (0.15, 0.8, -prof / 2 + 0.17), (0.08, 0.1, 0.12), 'preto', vira))
        p.append(bx(n + '_teclado', em, (0.1, 0.765, -0.02), (0.42, 0.015, 0.14), 'equip-escuro', vira))
    ob = chanfra(grupo(p, n), 0.01)
    out = [ob]
    if medico:
        out.append(cadeira_escritorio(n + '_med', em((0, 0, -prof / 2 - 0.45)), vira))
    for k in range(pacientes):
        x = (k - (pacientes - 1) / 2) * 0.62
        out.append(grupo(cadeira(n + f'_pac{k}', em((x, 0, prof / 2 + 0.45)), vira + 180, 'preto'), n + f'_pac{k}'))
    return out


def bancada(n, mn, mx, pia=0, tampo='marmore'):
    """bancada com armários embaixo (min/max da planta, altura 0,9) e pias opcionais."""
    x0, y0, z0 = mn
    x1, _, z1 = mx
    p = [caixa(n + '_corpo', (x0, y0 + 0.08, z0), (x1, y0 + 0.86, z1), 'branco'),
         caixa(n + '_rodape', (x0 + 0.04, y0, z0 + 0.04), (x1 - 0.04, y0 + 0.08, z1 - 0.04), 'equip-escuro'),
         caixa(n + '_tampo', (x0 - 0.02, y0 + 0.86, z0 - 0.02), (x1 + 0.02, y0 + 0.9, z1 + 0.02), tampo)]
    longo_x = (x1 - x0) >= (z1 - z0)
    for k in range(pia):
        f = (k + 0.5) / pia
        cx = x0 + (x1 - x0) * (f if longo_x else 0.5)
        cz = z0 + (z1 - z0) * (0.5 if longo_x else f)
        p.append(caixa(n + f'_cuba{k}', (cx - 0.22, y0 + 0.9, cz - 0.17), (cx + 0.22, y0 + 0.905, cz + 0.17), 'inox'))
        p.append(cilindro(n + f'_torneira{k}', (cx, y0 + 0.9, cz), (cx, y0 + 1.15, cz), 0.015, 'inox', 8))
    return chanfra(grupo(p, n), 0.008)


def armario(n, mn, mx):
    p = [caixa(n + '_corpo', mn, mx, 'branco')]
    x0, y0, z0 = mn
    x1, y1, z1 = mx
    longo_x = (x1 - x0) >= (z1 - z0)
    portas = max(1, round(((x1 - x0) if longo_x else (z1 - z0)) / 0.5))
    for k in range(1, portas):
        f = k / portas
        if longo_x:
            x = x0 + (x1 - x0) * f
            p.append(caixa(n + f'_frisa{k}', (x - 0.005, y0 + 0.1, z0 - 0.005), (x + 0.005, y1 - 0.05, z1 + 0.005), 'equip-escuro'))
        else:
            z = z0 + (z1 - z0) * f
            p.append(caixa(n + f'_frisa{k}', (x0 - 0.005, y0 + 0.1, z - 0.005), (x1 + 0.005, y1 - 0.05, z + 0.005), 'equip-escuro'))
    return chanfra(grupo(p, n), 0.01)


def pia(n, pos, vira):
    em = _em(pos, vira)
    p = [bx(n + '_gab', em, (0, 0.42, 0.0), (0.6, 0.84, 0.48), 'branco', vira),
         bx(n + '_tampo', em, (0, 0.87, 0.0), (0.64, 0.04, 0.52), 'marmore', vira),
         bx(n + '_cuba', em, (0, 0.885, 0.04), (0.4, 0.01, 0.3), 'inox', vira),
         cil(n + '_torneira', em, (0, 0.88, -0.18), (0, 1.12, -0.16), 0.014, 'inox', 8)]
    return chanfra(grupo(p, n), 0.01)


def lavatorio(n, pos, vira):
    em = _em(pos, vira)
    p = [bx(n + '_cuba', em, (0, 0.8, 0.05), (0.5, 0.16, 0.4), 'louca', vira),
         cil(n + '_coluna', em, (0, 0.0, -0.05), (0, 0.72, -0.05), 0.07, 'louca', 12),
         cil(n + '_torneira', em, (0, 0.88, -0.12), (0, 1.0, -0.1), 0.012, 'inox', 8),
         bx(n + '_espelho', em, (0, 1.55, -0.18), (0.5, 0.7, 0.01), 'vidro', vira)]
    return chanfra(grupo(p, n), 0.03, 3)


def vaso(n, pos, vira):
    em = _em(pos, vira)
    p = [cil(n + '_base', em, (0, 0, 0.05), (0, 0.32, 0.05), 0.15, 'louca', 14),
         bx(n + '_bacia', em, (0, 0.38, 0.12), (0.38, 0.1, 0.5), 'louca', vira),
         bx(n + '_caixa', em, (0, 0.62, -0.2), (0.42, 0.42, 0.18), 'louca', vira)]
    return chanfra(grupo(p, n), 0.04, 3)


# ─────────────────────────────── equipamentos
def maca(n, pos, vira, comp=1.9, cor='estofado-azul'):
    em = _em(pos, vira)
    p = [bx(n + '_colchao', em, (0, 0.74, 0.1), (0.68, 0.1, comp - 0.5), cor, vira),
         # cabeceira inclinada
         caixa_local(n + '_cabeca', em((0, 0.86, -comp / 2 + 0.3)), (0.68, 0.1, 0.6), cor, vira),
         bx(n + '_base', em, (0, 0.38, 0), (0.6, 0.62, comp - 0.2), 'branco', vira),
         bx(n + '_degrau', em, (0.55, 0.1, 0.2), (0.4, 0.2, 0.3), 'equip', vira)]
    cab = p[1]
    cab.rotation_euler = Euler((math.radians(-22), 0, cab.rotation_euler.z))
    return chanfra(grupo(p, n), 0.03, 3)


def leito(n, pos, vira, comp=2.0):
    em = _em(pos, vira)
    p = [bx(n + '_colchao', em, (0, 0.62, 0.05), (0.9, 0.16, comp - 0.1), 'verde-hosp', vira),
         bx(n + '_estrado', em, (0, 0.46, 0), (0.92, 0.12, comp), 'equip', vira),
         bx(n + '_cabeceira', em, (0, 0.75, -comp / 2), (0.95, 0.6, 0.05), 'equip', vira),
         bx(n + '_pes', em, (0, 0.65, comp / 2), (0.95, 0.42, 0.05), 'equip', vira)]
    for s in (-1, 1):
        p.append(bx(n + f'_grade{s}', em, (s * 0.48, 0.8, -0.2), (0.03, 0.18, 0.9), 'inox', vira))
        for zz in (-comp / 2 + 0.1, comp / 2 - 0.1):
            p.append(cil(n + '_perna', em, (s * 0.4, 0.05, zz), (s * 0.4, 0.42, zz), 0.025, 'inox', 8))
    return chanfra(grupo(p, n), 0.025, 2)


def cadeira_odonto(n, pos, vira):
    em = _em(pos, vira)
    p = [cil(n + '_base', em, (0, 0, 0.1), (0, 0.42, 0.1), 0.2, 'equip', 16),
         bx(n + '_assento', em, (0, 0.52, 0.15), (0.6, 0.12, 0.6), 'estofado-azul', vira),
         bx(n + '_pernas', em, (0, 0.45, 0.7), (0.5, 0.1, 0.6), 'estofado-azul', vira)]
    enc = caixa_local(n + '_encosto', em((0, 0.78, -0.35)), (0.56, 0.1, 0.75), 'estofado-azul', vira)
    enc.rotation_euler = Euler((math.radians(-28), 0, math.radians(vira)))
    p.append(enc)
    p += [cil(n + '_braco', em, (0.55, 0.0, -0.3), (0.55, 1.9, -0.3), 0.03, 'equip', 10),
          bx(n + '_foco', em, (0.25, 1.95, 0.05), (0.42, 0.12, 0.22), 'equip', vira),
          cil(n + '_cuspideira', em, (-0.45, 0, -0.05), (-0.45, 0.85, -0.05), 0.06, 'equip', 10),
          cil(n + '_cuba', em, (-0.45, 0.85, -0.05), (-0.45, 0.95, -0.05), 0.13, 'louca', 14),
          bx(n + '_mocho', em, (0.6, 0.5, 0.45), (0.38, 0.08, 0.38), 'estofado', vira)]
    return chanfra(grupo(p, n), 0.03, 2)


def cadeira_oftalmo(n, pos, vira):
    em = _em(pos, vira)
    p = [cil(n + '_base', em, (0, 0, 0), (0, 0.4, 0), 0.18, 'equip', 14),
         bx(n + '_assento', em, (0, 0.48, 0), (0.56, 0.12, 0.55), 'estofado', vira),
         bx(n + '_encosto', em, (0, 0.85, -0.27), (0.52, 0.65, 0.1), 'estofado', vira),
         bx(n + '_mesa', em, (0, 0.82, 0.62), (0.7, 0.04, 0.45), 'equip', vira),
         cil(n + '_pe_mesa', em, (0, 0, 0.62), (0, 0.8, 0.62), 0.05, 'equip', 10),
         bx(n + '_refrator', em, (0, 1.15, 0.55), (0.3, 0.3, 0.3), 'equip-escuro', vira),
         cil(n + '_coluna', em, (0.45, 0, 0.3), (0.45, 1.6, 0.3), 0.04, 'equip', 10)]
    return chanfra(grupo(p, n), 0.025, 2)


def tomografo(n, pos, vira):
    em = _em(pos, vira)
    p = [bx(n + '_gantry', em, (0.6, 1.0, 0), (0.9, 1.95, 2.05), 'equip', vira),
         bx(n + '_mesa', em, (-0.8, 0.88, 0), (2.4, 0.12, 0.55), 'equip', vira),
         bx(n + '_colchao', em, (-0.8, 0.96, 0), (2.3, 0.06, 0.45), 'estofado-azul', vira),
         bx(n + '_pedestal', em, (-0.9, 0.42, 0), (1.3, 0.8, 0.5), 'equip', vira),
         bx(n + '_faixa', em, (0.6, 1.0, 1.03), (0.92, 0.12, 0.01), 'teal', vira),
         bx(n + '_faixa2', em, (0.6, 1.0, -1.03), (0.92, 0.12, 0.01), 'teal', vira)]
    ob = chanfra(grupo(p, n), 0.06, 3)
    # túnel do tomógrafo (anel escuro na face do gantry)
    tun = cilindro(n + '_tunel', em((0.14, 1.05, 0)), em((0.16, 1.05, 0)), 0.38, 'equip-escuro', 28)
    return [ob, tun]


def esteira(n, pos, vira):
    em = _em(pos, vira)
    p = [bx(n + '_deck', em, (0, 0.12, 0.15), (0.75, 0.2, 1.8), 'equip-escuro', vira),
         bx(n + '_lona', em, (0, 0.225, 0.2), (0.5, 0.01, 1.55), 'preto', vira),
         bx(n + '_painel', em, (0, 1.35, -0.72), (0.7, 0.32, 0.12), 'equip', vira)]
    for s in (-1, 1):
        p.append(cil(n + f'_haste{s}', em, (s * 0.33, 0.2, -0.65), (s * 0.33, 1.25, -0.72), 0.03, 'equip', 8))
        p.append(cil(n + f'_corrimao{s}', em, (s * 0.38, 1.0, -0.7), (s * 0.38, 1.0, 0.0), 0.02, 'inox', 8))
    return chanfra(grupo(p, n), 0.02)


def mesa_cirurgica(n, pos, vira):
    em = _em(pos, vira)
    p = [bx(n + '_tampo', em, (0, 0.88, 0), (0.55, 0.1, 2.0), 'estofado', vira),
         bx(n + '_coluna', em, (0, 0.45, 0), (0.3, 0.8, 0.45), 'equip', vira),
         bx(n + '_base', em, (0, 0.05, 0), (0.6, 0.1, 0.8), 'equip', vira),
         cil(n + '_foco', em, (0, 2.05, 0.1), (0, 2.15, 0.1), 0.42, 'equip', 24),
         cil(n + '_braco_foco', em, (0, 2.15, 0.1), (0, 2.6, 0.1), 0.03, 'equip', 8)]
    return chanfra(grupo(p, n), 0.02)


def carrinho(n, pos, vira, alto=1.1):
    em = _em(pos, vira)
    p = [bx(n + '_corpo', em, (0, alto / 2, 0), (0.55, alto - 0.1, 0.45), 'equip', vira),
         bx(n + '_tela', em, (0, alto + 0.2, -0.1), (0.4, 0.3, 0.04), 'preto', vira)]
    return chanfra(grupo(p, n), 0.02)


def cortina(n, de, ate, y0, alt=1.9):
    """cortina hospitalar ondulada entre dois pontos (planta)."""
    a, b = Vector((de[0], de[1])), Vector((ate[0], ate[1]))
    d = b - a
    L = d.length
    k = max(8, int(L / 0.12))
    bm = bmesh.new()
    vs_baixo, vs_cima = [], []
    nrm = Vector((-d.y, d.x)).normalized()
    for i in range(k + 1):
        f = i / k
        p = a + d * f + nrm * (0.04 * math.sin(f * L / 0.12 * math.pi))
        vs_baixo.append(bm.verts.new(B(p.x, y0 + 0.25, p.y)))
        vs_cima.append(bm.verts.new(B(p.x, y0 + 0.25 + alt, p.y)))
    for i in range(k):
        bm.faces.new((vs_baixo[i], vs_baixo[i + 1], vs_cima[i + 1], vs_cima[i]))
    ob = novo_obj(n, bm, 'cortina')
    return ob


# ─────────────────────────────── plantas com folhas de verdade
def _folha(n, base, ang, comp, larg, incl, mat):
    """folha lanceolada curvada: grade de 2 × 7 vértices dobrada para baixo na ponta."""
    bm = bmesh.new()
    seg = 7
    linhas = []
    for i in range(seg + 1):
        f = i / seg
        w = larg * math.sin(math.pi * min(1, f * 1.05)) * (1 - 0.15 * f)
        # sobe inclinada e cai na ponta (parábola)
        h = comp * f * math.sin(incl) - comp * 0.55 * f * f * math.cos(incl) * 0.6
        r = comp * f * math.cos(incl)
        linha = []
        for s in (-1, 1):
            lx, lz = s * w / 2, r
            x = lx * math.cos(math.radians(ang)) + lz * math.sin(math.radians(ang))
            z = -lx * math.sin(math.radians(ang)) + lz * math.cos(math.radians(ang))
            linha.append(bm.verts.new(B(base[0] + x, base[1] + h, base[2] + z)))
        linhas.append(linha)
    for i in range(seg):
        bm.faces.new((linhas[i][0], linhas[i][1], linhas[i + 1][1], linhas[i + 1][0]))
    return novo_obj(n, bm, mat)


def planta_vaso(n, pos, altura=1.5, folhas=26):
    """palmeira-ráfis em vaso (como nas fotos da Recepção 2)."""
    p = [cilindro(n + '_vaso', pos, soma(pos, (0, 0.5, 0)), 0.22, 'vaso', 16),
         cilindro(n + '_terra', soma(pos, (0, 0.48, 0)), soma(pos, (0, 0.5, 0)), 0.2, 'terra', 16)]
    for i in range(folhas):
        ang = i * 137.5
        topo = soma(pos, (0.04 * math.cos(math.radians(ang)), 0.5 + altura * (0.45 + 0.5 * rng.random()), 0.04 * math.sin(math.radians(ang))))
        p.append(cilindro(n + '_haste', soma(pos, (0, 0.5, 0)), topo, 0.006, 'folha', 4))
        p.append(_folha(n + '_f', topo, ang, 0.32 + 0.12 * rng.random(), 0.07, math.radians(25 + 30 * rng.random()), 'folha' if i % 3 else 'folha-clara'))
    return grupo(p, n)


def touceira(n, mn, mx, n_folhas=60):
    """capim/agave de jardineira: lâminas compridas saindo do chão."""
    p = []
    for i in range(n_folhas):
        x = mn[0] + rng.random() * (mx[0] - mn[0])
        z = mn[2] + rng.random() * (mx[2] - mn[2])
        p.append(_folha(n + '_l', (x, mn[1], z), rng.random() * 360, (mx[1] - mn[1]) * (0.6 + 0.6 * rng.random()), 0.05,
                        math.radians(55 + 25 * rng.random()), 'folha' if i % 2 else 'folha-clara'))
    return grupo(p, n)


# ─────────────────────────────── decalques (logo, banners, faixas)
DECAIS = {}


def decal(n, imagem, centro, larg, alt, vira=0):
    """plano com imagem PNG (fundo transparente), virado para +z local."""
    caminho = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'decais', imagem + '.png')
    if imagem not in DECAIS:
        img = bpy.data.images.load(caminho)
        m = bpy.data.materials.new('decal_' + imagem)
        m.use_nodes = True
        nt = m.node_tree
        bsdf = nt.nodes['Principled BSDF']
        ti = nt.nodes.new('ShaderNodeTexImage')
        ti.image = img
        nt.links.new(ti.outputs['Color'], bsdf.inputs['Base Color'])
        nt.links.new(ti.outputs['Alpha'], bsdf.inputs['Alpha'])
        bsdf.inputs['Roughness'].default_value = 0.6
        DECAIS[imagem] = m
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    em = _em(centro, vira)
    cantos = [(-larg / 2, -alt / 2), (larg / 2, -alt / 2), (larg / 2, alt / 2), (-larg / 2, alt / 2)]
    vs = [bm.verts.new(B(*em((x, y, 0)))) for x, y in cantos]
    f = bm.faces.new(vs)
    for loop, (u, v) in zip(f.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        loop[uv].uv = (u, v)
    me = bpy.data.meshes.new('decal_' + n)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new('decal_' + n, me)
    ob.data.materials.append(DECAIS[imagem])
    COLECAO.objects.link(ob)
    ob['decal'] = 1
    return ob


def letras(n, conteudo, centro, tamanho, mat, vira=0, prof=0.06):
    """letras 3D (letreiro de fachada)."""
    return texto(n, conteudo, centro, tamanho, mat, vira, prof)



# ─────────────────────────────── objetos de cena (carros, extintores, lixeiras)
def carro(n, pos, vira, cor='#7d8288'):
    """carro simples (sedã): carroceria e cabine arredondadas, vidros escuros, rodas."""
    chave = 'carro_' + cor
    if chave not in MATS:
        material(chave, cor=cor, rug=0.3, metal=0.4)
    em = _em(pos, vira)
    p = [bx(n + '_baixo', em, (0, 0.55, 0), (1.76, 0.62, 4.3), chave, vira),
         bx(n + '_cabine', em, (0, 1.12, -0.15), (1.56, 0.52, 2.2), chave, vira),
         bx(n + '_vidros', em, (0, 1.13, -0.15), (1.58, 0.4, 2.0), 'equip-escuro', vira)]
    ob = chanfra(grupo(p, n), 0.12, 3)
    rodas = []
    for sx in (-0.82, 0.82):
        for sz in (-1.35, 1.35):
            rodas.append(cil(n + '_roda', em, (sx - 0.1, 0.33, sz), (sx + 0.1, 0.33, sz), 0.33, 'preto', 16))
    return [ob, grupo(rodas, n + '_rodas')]


def extintor(n, pos, vira):
    em = _em(pos, vira)
    chave = 'vermelho-ext'
    if chave not in MATS:
        material(chave, cor='#c0272d', rug=0.35)
    p = [cil(n + '_corpo', em, (0, 0.95, 0.1), (0, 1.5, 0.1), 0.085, chave, 14),
         cil(n + '_bico', em, (0, 1.5, 0.1), (0, 1.6, 0.1), 0.03, 'preto', 8),
         bx(n + '_placa', em, (0, 1.95, 0.005), (0.22, 0.3, 0.01), chave, vira)]
    return chanfra(grupo(p, n), 0.01)


def lixeira(n, pos, vira):
    em = _em(pos, vira)
    p = [cil(n + '_corpo', em, (0, 0.0, 0), (0, 0.45, 0), 0.16, 'branco', 16),
         cil(n + '_tampa', em, (0, 0.45, 0), (0, 0.49, 0), 0.165, 'equip', 16)]
    return chanfra(grupo(p, n), 0.01)


def purificador(n, pos, vira):
    """purificador de água branco na parede, com o tubo de copos ao lado (fotos r1 p02/p03, r2 p10)."""
    em = _em(pos, vira)
    p = [bx(n + '_corpo', em, (0, 1.38, 0.075), (0.3, 0.42, 0.15), 'branco', vira),
         bx(n + '_painel', em, (0, 1.45, 0.152), (0.2, 0.12, 0.004), 'equip-escuro', vira),
         bx(n + '_bica', em, (0, 1.2, 0.17), (0.08, 0.03, 0.06), 'inox', vira),
         cil(n + '_copos', em, (0.27, 1.05, 0.06), (0.27, 1.6, 0.06), 0.04, 'branco', 12)]
    return chanfra(grupo(p, n), 0.01)


def ar_split(n, pos, vira, alt=2.45):
    """ar-condicionado split na parede (foto r2 p06)."""
    em = _em(pos, vira)
    p = [bx(n + '_corpo', em, (0, alt, 0.11), (0.92, 0.3, 0.22), 'branco', vira),
         bx(n + '_saida', em, (0, alt - 0.13, 0.2), (0.8, 0.025, 0.03), 'equip-escuro', vira)]
    return chanfra(grupo(p, n), 0.02)


def dea(n, pos, vira):
    """caixa vermelha do desfibrilador (DEA) na parede da espera (foto r2 p21)."""
    em = _em(pos, vira)
    chave = 'vermelho-ext'
    if chave not in MATS:
        material(chave, cor='#c0272d', rug=0.35)
    p = [bx(n + '_caixa', em, (0, 1.4, 0.07), (0.36, 0.44, 0.14), chave, vira),
         bx(n + '_visor', em, (0, 1.36, 0.142), (0.24, 0.26, 0.004), 'branco', vira),
         bx(n + '_placa', em, (0, 1.82, 0.005), (0.22, 0.22, 0.01), chave, vira)]
    return chanfra(grupo(p, n), 0.01)


def gradil(n, de, ate, alt=1.05, passo=0.13):
    """grade de barras pretas (guarda-corpo de fora, fotos da Av. Treze)."""
    comp = math.dist(de, ate)
    k = max(2, int(comp / passo) + 1)
    p = [cilindro(n + '_topo', (de[0], de[1] + alt, de[2]), (ate[0], ate[1] + alt, ate[2]), 0.025, 'preto', 8),
         cilindro(n + '_base', (de[0], de[1] + 0.1, de[2]), (ate[0], ate[1] + 0.1, ate[2]), 0.018, 'preto', 6)]
    for i in range(k):
        f = i / (k - 1)
        q = tuple(de[j] + (ate[j] - de[j]) * f for j in range(3))
        p.append(cilindro(n + '_barra', q, (q[0], q[1] + alt, q[2]), 0.011 if i % 8 else 0.025, 'preto', 6))
    return grupo(p, n)


# ─────────────────────────────── despacho
def monta_extra(p, objs_vidro, objs_luz):
    t, n = p['tipo'], p['nome']
    pos, v = p.get('pos'), p.get('vira', 0)
    if t == 'mesa':
        mesa(n, pos, v, p.get('larg', 1.4), p.get('prof', 0.7), p.get('pacientes', 2), p.get('medico', True), p.get('monitor', True))
    elif t == 'sofa':
        sofa(n, pos, v, p.get('lugares', 3), p.get('mat', 'estofado'))
    elif t == 'poltrona':
        poltrona(n, pos, v, p.get('reclina', False), p.get('mat', 'estofado-azul'))
    elif t == 'cadeira-escritorio':
        cadeira_escritorio(n, pos, v)
    elif t == 'bancada':
        bancada(n, p['min'], p['max'], p.get('pia', 0), p.get('tampo', 'marmore'))
    elif t == 'armario':
        armario(n, p['min'], p['max'])
    elif t == 'pia':
        pia(n, pos, v)
    elif t == 'lavatorio':
        lavatorio(n, pos, v)
    elif t == 'vaso':
        vaso(n, pos, v)
    elif t == 'maca':
        maca(n, pos, v, p.get('comp', 1.9), p.get('cor', 'estofado-azul'))
    elif t == 'leito':
        leito(n, pos, v)
    elif t == 'cadeira-odonto':
        cadeira_odonto(n, pos, v)
    elif t == 'cadeira-oftalmo':
        cadeira_oftalmo(n, pos, v)
    elif t == 'tomografo':
        tomografo(n, pos, v)
    elif t == 'esteira':
        esteira(n, pos, v)
    elif t == 'mesa-cirurgica':
        mesa_cirurgica(n, pos, v)
    elif t == 'carrinho':
        carrinho(n, pos, v)
    elif t == 'cortina':
        cortina(n, p['de'], p['ate'], p['y'])
    elif t == 'planta-vaso':
        planta_vaso(n, pos, p.get('altura', 1.5))
    elif t == 'touceira':
        touceira(n, p['min'], p['max'], p.get('folhas', 60))
    elif t == 'decal':
        decal(n, p['imagem'], p['centro'], p['larg'], p['alt'], v)
    elif t == 'letras':
        letras(n, p['texto'], p['centro'], p['tamanho'], p.get('mat', 'branco'), v, p.get('prof', 0.06))
    elif t == 'carro':
        carro(n, pos, v, p.get('cor', '#7d8288'))
    elif t == 'extintor':
        extintor(n, pos, v)
    elif t == 'lixeira':
        lixeira(n, pos, v)
    elif t == 'purificador':
        purificador(n, pos, v)
    elif t == 'ar-split':
        ar_split(n, pos, v, p.get('alt', 2.45))
    elif t == 'dea':
        dea(n, pos, v)
    elif t == 'gradil':
        gradil(n, p['de'], p['ate'], p.get('alt', 1.05))
    elif t == 'totem':
        return False
    elif t == 'cobogo':
        cobogo(n, p['min'], p['max'])
    elif t == 'caixilho':
        caixilho(n, p['min'], p['max'], p.get('modulo', 1.25), p.get('eixo', 'x'), objs_vidro)
    else:
        return False
    return True


def cobogo(n, mn, mx, passo=0.25):
    """painel de cobogó: grade de blocos vazados (cruzetas) na frente da fachada."""
    x0, y0, z0 = mn
    x1, y1, z1 = mx
    p = []
    nx = max(1, int((x1 - x0) / passo))
    ny = max(1, int((y1 - y0) / passo))
    px_, py_ = (x1 - x0) / nx, (y1 - y0) / ny
    for i in range(nx + 1):
        x = x0 + i * px_
        p.append(caixa(n + f'_v{i}', (x - 0.025, y0, z0), (x + 0.025, y1, z1), 'branco'))
    for j in range(ny + 1):
        y = y0 + j * py_
        p.append(caixa(n + f'_h{j}', (x0, y - 0.025, z0), (x1, y + 0.025, z1), 'branco'))
    for i in range(nx):
        for j in range(ny):
            cx, cy = x0 + (i + 0.5) * px_, y0 + (j + 0.5) * py_
            p.append(caixa(n + f'_c{i}_{j}', (cx - 0.035, cy - 0.035, z0), (cx + 0.035, cy + 0.035, z1), 'branco'))
    return grupo(p, n)


def caixilho(n, mn, mx, modulo, eixo, objs_vidro):
    """pele de vidro com caixilhos (montantes e travessas) — volume envidraçado da fachada."""
    x0, y0, z0 = mn
    x1, y1, z1 = mx
    objs_vidro.append(caixa('vidro_' + n, mn, mx, 'vidro'))
    p = []
    if eixo == 'x':
        k = max(1, round((x1 - x0) / modulo))
        for i in range(k + 1):
            x = x0 + (x1 - x0) * i / k
            p.append(caixa(n + f'_m{i}', (x - 0.03, y0, z0 - 0.04), (x + 0.03, y1, z1 + 0.04), 'equip-escuro'))
    else:
        k = max(1, round((z1 - z0) / modulo))
        for i in range(k + 1):
            z = z0 + (z1 - z0) * i / k
            p.append(caixa(n + f'_m{i}', (x0 - 0.04, y0, z - 0.03), (x1 + 0.04, y1, z + 0.03), 'equip-escuro'))
    k = max(1, round((y1 - y0) / 1.05))
    for j in range(k + 1):
        y = y0 + (y1 - y0) * j / k
        p.append(caixa(n + f'_t{j}', (x0 - 0.04, y - 0.03, z0 - 0.04), (x1 + 0.04, y + 0.03, z1 + 0.04), 'equip-escuro'))
    return grupo(p, n)
