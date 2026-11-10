# Monta a Clínica Dias no Blender a partir da planta (JSON), calcula a luz e exporta para o site.
#
# Uso (pelo terminal):
#   blender -b -P blender/monta_clinica.py -- <planta.json> <pasta_saida> <modo> [resolucao] [amostras]
#   modo = rascunho  → só geometria e materiais (segundos), a luz fica por conta do navegador
#   modo = luz       → calcula a luz de cada área em textura (lightmap), como no ICG Gallery
#
# Eixos: a planta usa o padrão do three.js (y para cima, z para fora do prédio).
# No Blender z é para cima, então (x, y, z) da planta vira (x, -z, y) aqui;
# o exportador glTF desfaz a troca, e o navegador recebe tudo no lugar certo.

import bpy, bmesh, json, math, os, sys, time
import numpy as np
from mathutils import Vector, Matrix, Euler

argv = sys.argv[sys.argv.index('--') + 1:]
PLANTA, SAIDA, MODO = argv[0], os.path.abspath(argv[1]), argv[2]
RES = int(argv[3]) if len(argv) > 3 else 1024
AMOSTRAS = int(argv[4]) if len(argv) > 4 else 64
os.makedirs(os.path.join(SAIDA, 'tex'), exist_ok=True)

with open(PLANTA, encoding='utf-8') as f:
    P = json.load(f)

K_LUZ = 4.0  # o lightmap guarda luz/K em sRGB; o navegador multiplica de volta


def B(x, y, z):
    return Vector((x, -z, y))


def log(*a):
    print('[clinica]', *a, flush=True)


# ─────────────────────────────────────────────── cena limpa
bpy.ops.wm.read_factory_settings(use_empty=True)
cena = bpy.context.scene
cena.render.engine = 'CYCLES'
cena.cycles.device = 'CPU'
cena.cycles.samples = AMOSTRAS
cena.cycles.max_bounces = 6
cena.cycles.diffuse_bounces = 4
cena.cycles.glossy_bounces = 1
cena.cycles.transmission_bounces = 4
cena.cycles.use_denoising = False
cena.unit_settings.system = 'METRIC'
# deixa 2 núcleos livres para o PC continuar usável enquanto calcula
cena.render.threads_mode = 'AUTO'  # todos os núcleos (pedido do Guilherme: o mais rápido possível)

mundo = bpy.data.worlds.new('ceu')
cena.world = mundo
mundo.use_nodes = True
fundo = mundo.node_tree.nodes['Background']
fundo.inputs['Color'].default_value = (0.42, 0.47, 0.58, 1)  # fim de tarde, céu azul-lilás
fundo.inputs['Strength'].default_value = 0.55


def hexcor(h, a=1.0):
    h = h.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(r), lin(g), lin(b), a)


# ─────────────────────────────────────────────── texturas de detalhe (geradas, sem baixar nada)
rng = np.random.default_rng(7)


def salva_textura(nome, arr):
    """arr: float HxWx3 em sRGB 0–1."""
    h, w, _ = arr.shape
    img = bpy.data.images.new(nome, w, h, alpha=False)
    rgba = np.ones((h, w, 4), np.float32)
    rgba[..., :3] = np.clip(arr, 0, 1)
    img.pixels.foreach_set(rgba[::-1].ravel())
    caminho = os.path.join(SAIDA, 'tex', nome + '.jpg')
    img.filepath_raw = caminho
    img.file_format = 'JPEG'
    img.save()
    img.reload()
    return img


def ruido(n, escala):
    base = rng.random((n // escala + 2, n // escala + 2))
    from numpy import kron
    up = kron(base, np.ones((escala, escala)))[:n, :n]
    return up


def tex_granito(n=512):
    a = np.zeros((n, n, 3))
    a[:] = np.array([0.86, 0.85, 0.82])
    a += (ruido(n, 64) - 0.5)[..., None] * 0.04
    for cor, qtd, tam in [((0.18, 0.18, 0.19), 2600, 2), ((0.45, 0.43, 0.42), 3500, 2), ((0.62, 0.55, 0.52), 1500, 3), ((0.97, 0.97, 0.96), 2500, 2)]:
        ys, xs = rng.integers(0, n, qtd), rng.integers(0, n, qtd)
        for dy in range(tam):
            for dx in range(tam):
                a[(ys + dy) % n, (xs + dx) % n] = cor
    # junta fina da placa (placa de 60 cm, textura cobre 1,2 m)
    for k in (0, n // 2):
        a[k:k + 1, :] *= 0.93
        a[:, k:k + 1] *= 0.93
    return a


def tex_madeira(n=512):
    x = np.linspace(0, 1, n)
    veio = 0.5 + 0.5 * np.sin((x[None, :] * 38 + ruido(n, 32) * 2.5) * math.pi)
    a = np.zeros((n, n, 3))
    clara, escura = np.array([0.83, 0.71, 0.55]), np.array([0.72, 0.58, 0.42])
    a[:] = clara
    a = a * (1 - veio[..., None] * 0.35) + escura * veio[..., None] * 0.35
    return a


def tex_borracha(n=256):
    a = np.full((n, n, 3), 0.19)
    yy, xx = np.mgrid[0:n, 0:n]
    passo = n // 8
    d = np.hypot((xx % passo) - passo / 2, (yy % passo) - passo / 2)
    a[d < passo * 0.22] = 0.26
    a += (rng.random((n, n)) - 0.5)[..., None] * 0.03
    return a


def tex_calcada(n=512):
    a = np.full((n, n, 3), 0.0)
    a[:] = np.array([0.70, 0.68, 0.64])
    a += (ruido(n, 16) - 0.5)[..., None] * 0.06
    passo = n // 4
    yy, xx = np.mgrid[0:n, 0:n]
    junta = ((xx % passo) < 3) | ((yy % passo) < 3)
    a[junta] *= 0.75
    # piso tátil: barras em diagonal leve
    d = ((xx + yy) % (passo // 3)) < 3
    a[d & ~junta] *= 0.93
    return a


def tex_asfalto(n=256):
    a = np.full((n, n, 3), 0.24)
    a += (rng.random((n, n)) - 0.5)[..., None] * 0.08
    return a


def tex_fachada(n=512):
    a = np.full((n, n, 3), 0.0)
    a[:] = np.array([0.56, 0.57, 0.60])
    a += (ruido(n, 128) - 0.5)[..., None] * 0.03
    yy, xx = np.mgrid[0:n, 0:n]
    junta = ((xx % (n // 2)) < 2) | ((yy % (n // 4)) < 2)
    a[junta] *= 0.82
    return a


def ruido_suave(n, escala):
    """ruído em blocos borrado (sem degraus), repetível nas bordas."""
    r = ruido(n, escala)
    k = np.ones(escala) / escala
    for eixo in (0, 1):
        r = np.apply_along_axis(lambda v: np.convolve(np.concatenate([v[-escala:], v, v[:escala]]), k, 'same')[escala:-escala], eixo, r)
    return (r - r.min()) / max(1e-6, r.max() - r.min())


def tex_marmore(n=512):
    """mármore branco com veios cinza (parede do logo e tampo dos guichês da Recepção 1)."""
    yy, xx = np.mgrid[0:n, 0:n] / n
    campo = xx * 2.2 + yy * 0.9 + ruido_suave(n, 64) * 1.1 + ruido_suave(n, 16) * 0.18
    veio = np.exp(-np.square(np.sin(campo * math.pi * 2.2)) * 60)
    fino = np.exp(-np.square(np.sin((campo * 1.7 + ruido_suave(n, 32) * 0.4) * math.pi * 5)) * 220)
    a = np.ones((n, n, 3)) * np.array([0.93, 0.93, 0.92])
    a -= (veio * 0.32 + fino * 0.12)[..., None] * np.array([1, 1, 0.97])
    return a


def tex_ripado(n=256):
    """painel ripado: 1 ripa de 7 cm + junta de 3 cm a cada 10 cm (a textura repete a cada 0,4 m = 4 ripas)."""
    a = tex_madeira(n)
    xx = np.arange(n)
    junta = (xx % (n // 4)) >= int(n / 4 * 0.7)
    a[:, junta] = a[:, junta] * 0.28
    borda = ((xx % (n // 4)) == int(n / 4 * 0.7) - 1)
    a[:, borda] *= 0.75
    return a


def tex_grama(n=256):
    a = np.full((n, n, 3), 0.0)
    a[:] = np.array([0.36, 0.48, 0.25])
    a += (rng.random((n, n)) - 0.5)[..., None] * np.array([0.08, 0.12, 0.06])
    a += (ruido(n, 32) - 0.5)[..., None] * 0.08
    return a


TEX = {}


PH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'texturas-polyhaven')


def carrega_ph(nome, passo=1):
    """textura do Poly Haven (CC0) como array sRGB 0–1 (linhas de cima para baixo), reduzida por `passo`."""
    caminho = os.path.join(PH, nome + '_Diffuse.jpg')
    if not os.path.exists(caminho):
        return None
    img = bpy.data.images.load(caminho)
    w, h = img.size
    px = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    a = px.reshape(h, w, 4)[::-1, :, :3]
    return np.ascontiguousarray(a[::passo, ::passo])


def lum(a):
    return a @ np.array([0.299, 0.587, 0.114])


def ph_granito():
    """granito claro polido das fotos: quase branco-acinzentado com pontos escuros e juntas finas."""
    a = carrega_ph('granite_tile_03')
    if a is None:
        return tex_granito()
    L = lum(a)
    v = np.clip(0.8 + (L - L.mean()) * 1.6, 0.22, 0.97)
    return v[..., None] * np.array([1.0, 0.975, 0.94])


def ph_madeira(passo=2):
    a = carrega_ph('oak_veneer_01', passo)
    if a is None:
        return tex_madeira()
    return np.clip(a * 1.05, 0, 1)


def ph_ripado():
    """ripas de carvalho (7 cm) com junta escura (3 cm): 4 ripas por repetição de 0,4 m."""
    a = ph_madeira(2)
    n = a.shape[1]
    xx = np.arange(n)
    junta = (xx % (n // 4)) >= int(n / 4 * 0.7)
    a = a.copy()
    a[:, junta] *= 0.22
    return a


def ph_fachada():
    """placas cinza da Portaria 2 (concreto em placas, clareado para o cinza das fotos)."""
    a = carrega_ph('concrete_tile_facade', 2)
    if a is None:
        return tex_fachada()
    L = lum(a)
    v = np.clip(L * 2.15 + 0.06, 0, 1)
    return v[..., None] * np.array([0.97, 0.98, 1.0])


def ph_calcada():
    a = carrega_ph('concrete_pavement_03', 2)
    if a is None:
        return tex_calcada()
    L = lum(a)[..., None]
    a = L + (a - L) * 0.35
    return np.clip(a * 1.55, 0, 1)


def ph_asfalto():
    a = carrega_ph('asphalt_floor', 2)
    if a is None:
        return tex_asfalto()
    L = lum(a)[..., None]
    return np.clip(L * 0.62, 0, 1) * np.array([1.0, 1.0, 1.02])


def gera_texturas():
    # tamanho real de cada repetição (m): granito em placas de 60 cm (3 × 2 placas por imagem)
    for nome, fn, tile in [
        ('granito', ph_granito, 1.8), ('madeira', ph_madeira, 1.2), ('borracha', tex_borracha, 0.5),
        ('calcada', ph_calcada, 2.0), ('asfalto', ph_asfalto, 3.0), ('fachada', ph_fachada, 2.4),
        ('marmore', tex_marmore, 1.6), ('grama', tex_grama, 2.0), ('ripado', ph_ripado, 0.4),
    ]:
        TEX[nome] = (salva_textura('tx_' + nome, fn()), tile)


# ─────────────────────────────────────────────── materiais
MATS = {}


def material(chave, cor=None, rug=0.6, metal=0.0, tex=None, emissao=0.0, vidro=False):
    if chave in MATS:
        return MATS[chave]
    m = bpy.data.materials.new(chave)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    cor = cor or P['materiais'].get(chave, '#cccccc')
    bsdf.inputs['Base Color'].default_value = hexcor(cor)
    bsdf.inputs['Roughness'].default_value = rug
    bsdf.inputs['Metallic'].default_value = metal
    if tex:
        img, _ = TEX[tex]
        ti = nt.nodes.new('ShaderNodeTexImage')
        ti.image = img
        uv = nt.nodes.new('ShaderNodeUVMap')
        uv.uv_map = 'UVMap'
        nt.links.new(uv.outputs['UV'], ti.inputs['Vector'])
        nt.links.new(ti.outputs['Color'], bsdf.inputs['Base Color'])
    if emissao:
        bsdf.inputs['Emission Color'].default_value = hexcor(cor)
        bsdf.inputs['Emission Strength'].default_value = emissao
    if vidro:
        bsdf.inputs['Transmission Weight'].default_value = 1.0
        bsdf.inputs['Roughness'].default_value = 0.02
        bsdf.inputs['IOR'].default_value = 1.45
        m['vidro'] = 1
    m['tile'] = TEX[tex][1] if tex else 1.0
    MATS[chave] = m
    return m


def prepara_materiais():
    material('asfalto', tex='asfalto', rug=0.95)
    material('calcada', tex='calcada', rug=0.9)
    material('fachada', tex='fachada', rug=0.8)
    material('concreto', rug=0.85)
    material('parede', rug=0.85)
    material('teto', rug=0.9)
    material('granito', tex='granito', rug=0.22)
    material('rampa', tex='borracha', rug=0.9)
    material('madeira', tex='madeira', rug=0.6)
    material('branco', rug=0.3)
    material('preto', rug=0.45)
    material('plastico', cor='#202022', rug=0.5)
    material('inox', rug=0.25, metal=1.0)
    material('porta', rug=0.5)
    material('laranja', rug=0.5)
    material('planta', rug=0.6)
    material('vaso', rug=0.7)
    material('vidro', cor='#dcecee', vidro=True)
    material('tela', cor='#2a39c8', emissao=2.5)
    material('luz', cor='#fff3e0', emissao=12.0)
    material('teal', cor='#5C95A4', rug=0.4)
    material('verde', cor='#7bb342', rug=0.5)
    material('azul', cor='#1f4fb5', rug=0.5)
    material('amarelo', cor='#f2c21b', rug=0.5)
    material('vermelho', cor='#c62828', rug=0.5)
    material('quadro', cor='#6d6470', rug=0.6)
    material('faixa-azul', cor='#5C95A4', rug=0.5)
    material('marmore', tex='marmore', rug=0.15)
    material('grama', tex='grama', rug=0.95)
    material('plastico-cinza', cor='#55575c', rug=0.5)
    material('banner', cor='#FDE0C9', rug=0.6)
    material('roxo', cor='#101E44', rug=0.5)
    material('acrilico', cor='#e9eff0', rug=0.1)
    material('faixa-branca', cor='#f2f2ee', rug=0.7)


# ─────────────────────────────────────────────── utilitários de geometria
COLECAO = bpy.data.collections.new('clinica')
cena.collection.children.link(COLECAO)


def novo_obj(nome, bm, mat):
    me = bpy.data.meshes.new(nome)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(nome, me)
    ob.data.materials.append(MATS[mat] if isinstance(mat, str) else mat)
    COLECAO.objects.link(ob)
    return ob


def caixa(nome, mn, mx, mat):
    """mn/mx no espaço da planta (three)."""
    a, b = B(*mn), B(*mx)
    lo = Vector((min(a.x, b.x), min(a.y, b.y), min(a.z, b.z)))
    hi = Vector((max(a.x, b.x), max(a.y, b.y), max(a.z, b.z)))
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((lo.x + (v.co.x + 0.5) * (hi.x - lo.x), lo.y + (v.co.y + 0.5) * (hi.y - lo.y), lo.z + (v.co.z + 0.5) * (hi.z - lo.z)))
    return novo_obj(nome, bm, mat)


def caixa_local(nome, centro, tam, mat, rot_y=0.0, base=None):
    """caixa centrada num ponto (planta), com tamanho (sx, sy, sz) e giro em torno do eixo vertical."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    sx, sy, sz = tam
    for v in bm.verts:
        v.co = Vector((v.co.x * sx, -v.co.z * sz, v.co.y * sy))  # (x,y,z)planta → blender
    ob = novo_obj(nome, bm, mat)
    ob.location = B(*centro)
    ob.rotation_euler = Euler((0, 0, math.radians(rot_y)))
    return ob


def cilindro(nome, a, b, raio, mat, seg=12):
    a, b = B(*a), B(*b)
    d = b - a
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=raio, radius2=raio, depth=d.length)
    ob = novo_obj(nome, bm, mat)
    ob.location = (a + b) / 2
    ob.rotation_mode = 'QUATERNION'
    ob.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return ob


def texto(nome, conteudo, centro, tamanho, mat, rot_y=0.0, extrude=0.01):
    cu = bpy.data.curves.new(nome, 'FONT')
    cu.body = conteudo
    cu.size = tamanho
    cu.extrude = extrude
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    ob = bpy.data.objects.new(nome, cu)
    COLECAO.objects.link(ob)
    ob.data.materials.append(MATS[mat])
    ob.location = B(*centro)
    ob.rotation_euler = Euler((math.radians(90), 0, math.radians(rot_y)))
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.ops.object.convert(target='MESH')
    return bpy.context.view_layer.objects.active


def grupo(objs, nome):
    """junta peças pequenas num objeto só."""
    objs = [o for o in objs if o]
    if not objs:
        return None
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = nome
    ob.data.name = nome  # senão o glb herda o nome da 1ª peça (ex.: pele-vidro) e o site se confunde
    return ob


# ─────────────────────────────────────────────── peças
def rot_vec(v, graus):
    r = math.radians(graus)
    x, y, z = v
    return (x * math.cos(r) + z * math.sin(r), y, -x * math.sin(r) + z * math.cos(r))


def soma(a, b):
    return tuple(a[i] + b[i] for i in range(3))


def cadeira(nome, pos, vira, cor='preto'):
    """cadeira de espera (assento e encosto de plástico, pés de aço). cor: preto (R2) ou cinza (R1)."""
    mat = 'plastico-cinza' if cor == 'cinza' else 'plastico'
    partes = []
    def em(local):
        return soma(pos, rot_vec(local, vira))
    partes.append(caixa_local(nome + '_assento', em((0, 0.46, 0)), (0.46, 0.04, 0.44), mat, vira))
    partes.append(caixa_local(nome + '_encosto', em((0, 0.72, -0.21)), (0.44, 0.34, 0.03), mat, vira))
    for sx in (-0.2, 0.2):
        for sz in (-0.19, 0.19):
            partes.append(cilindro(nome + '_pe', em((sx, 0, sz)), em((sx, 0.45, sz)), 0.012, 'preto', 4))
        partes.append(cilindro(nome + '_haste', em((sx, 0.45, -0.19)), em((sx, 0.72, -0.2)), 0.012, 'preto', 4))
    return partes


def porta(nome, centro, vira, placa, largura=0.95):
    """porta de madeira branca fechada, do tamanho do vão."""
    x, y, z = centro
    L = max(0.6, min(largura, 1.0))
    partes = []
    em = lambda l: soma((x, y, z), rot_vec(l, vira))
    partes.append(caixa_local(nome + '_folha', em((0, 1.05, 0.0)), (L - 0.1, 2.08, 0.04), 'porta', vira))
    partes.append(caixa_local(nome + '_batente', em((0, 2.11, 0.0)), (L, 0.06, 0.16), 'porta', vira))
    for s in (-(L / 2 - 0.03), L / 2 - 0.03):
        partes.append(caixa_local(nome + '_batente', em((s, 1.05, 0.0)), (0.06, 2.1, 0.16), 'porta', vira))
    for lado in (0.03, -0.03):
        partes.append(cilindro(nome + '_macaneta', em((L / 2 - 0.15, 1.02, lado)), em((L / 2 - 0.15, 1.02, lado * 3)), 0.012, 'inox', 6))
    if placa:
        partes.append(caixa_local(nome + '_placa', em((L / 2 + 0.17, 2.0, 0.06)), (0.2, 0.26, 0.012), 'laranja', vira))
        partes.append(texto(nome + '_num', placa, em((L / 2 + 0.17, 1.97, 0.068)), 0.11, 'branco', vira, 0.002))
    return grupo(partes, nome)


def monta():
    objs_vidro, objs_luz = [], []
    ESTRUTURA = {'caixa', 'rampa', 'degraus', 'vidro', 'porta-vidro', 'faixa-piso', 'faixas-cores', 'faixas-vaga',
                 'painel-marmore', 'ripado', 'caixilho', 'cobogo', 'letras', 'decal', 'letreiro', 'placa', 'tv',
                 'quadro', 'corrimao', 'guarda-vidro', 'porta'}
    for p in P['pecas']:
        t, n = p['tipo'], p['nome']
        _antes = set(COLECAO.objects[:])
        if t == 'caixa':
            ob = caixa(n, p['min'], p['max'], p['mat'])
            if p['mat'] == 'parede':
                chanfra(ob, 0.012, 1)  # quina levemente arredondada (leitura de maquete)
            if p.get('teto'):
                ob['teto'] = 1
        elif t == 'vidro':
            objs_vidro.append(caixa(n, p['min'], p['max'], 'vidro'))
        elif t == 'porta-vidro':
            mn, mx = p['min'], p['max']
            objs_vidro.append(caixa('vidro_' + n, mn, mx, 'vidro'))
            perf = []
            if p.get('eixo') == 'x':  # porta numa parede leste/oeste (vista de +x)
                cz = (mn[2] + mx[2]) / 2
                fx = mx[0]
                for zz in (mn[2], cz, mx[2]):
                    perf.append(caixa(n + '_perfil', (mn[0] - 0.02, mn[1], zz - 0.03), (mx[0] + 0.02, mx[1], zz + 0.03), 'inox'))
                perf.append(caixa(n + '_perfil', (mn[0] - 0.02, mx[1] - 0.05, mn[2]), (mx[0] + 0.02, mx[1], mx[2]), 'inox'))
                perf.append(caixa(n + '_faixa', (fx + 0.005, mn[1] + 1.95, mn[2]), (fx + 0.01, mn[1] + 2.1, mx[2]), 'faixa-azul'))
                perf.append(texto(n + '_txt', p['texto'], (fx + 0.012, mn[1] + 2.025, mx[2] - 0.55), 0.08, 'branco', 90, 0.001)) if p.get('texto') else None
                for zz in (cz - 0.12, cz + 0.12):
                    perf.append(cilindro(n + '_puxador', (fx + 0.06, mn[1] + 0.7, zz), (fx + 0.06, mn[1] + 1.5, zz), 0.014, 'inox', 8))
            else:
                cx = (mn[0] + mx[0]) / 2
                for xx in (mn[0], cx, mx[0]):
                    perf.append(caixa(n + '_perfil', (xx - 0.03, mn[1], mn[2] - 0.02), (xx + 0.03, mx[1], mx[2] + 0.02), 'inox'))
                perf.append(caixa(n + '_perfil', (mn[0], mx[1] - 0.05, mn[2] - 0.02), (mx[0], mx[1], mx[2] + 0.02), 'inox'))
                perf.append(caixa(n + '_faixa', (mn[0], mn[1] + 1.95, mx[2] + 0.005), (mx[0], mn[1] + 2.1, mx[2] + 0.01), 'faixa-azul'))
                perf.append(texto(n + '_txt', p['texto'], (mn[0] + 0.55, mn[1] + 2.025, mx[2] + 0.012), 0.08, 'branco', 0, 0.001)) if p.get('texto') else None
                for xx in (cx - 0.12, cx + 0.12):
                    perf.append(cilindro(n + '_puxador', (xx, mn[1] + 0.7, mx[2] + 0.06), (xx, mn[1] + 1.5, mx[2] + 0.06), 0.014, 'inox', 8))
            grupo(perf, n)
        elif t == 'degraus':
            mn, mx, k = p['min'], p['max'], p['n']
            alt = (mx[1] - mn[1]) / k
            if p.get('eixo') == 'x':  # sobe em direção a -x (para dentro do prédio)
                prof = (mx[0] - mn[0]) / k
                partes = [caixa(f'{n}_{i}', (mn[0], mn[1] - 0.15, mn[2]), (mx[0] - prof * i, mn[1] + alt * (i + 1), mx[2]), 'concreto') for i in range(k)]
            else:
                prof = (mx[2] - mn[2]) / k
                partes = [caixa(f'{n}_{i}', (mn[0], mn[1], mn[2]), (mx[0], mn[1] + alt * (i + 1), mx[2] - prof * i), 'concreto') for i in range(k)]
            grupo(partes, n)
        elif t == 'corrimao':
            a, b = p['de'], p['ate']
            partes = [cilindro(n + '_tubo', a, b, 0.022, 'inox')]
            for f in np.linspace(0, 1, 5):
                q = tuple(a[i] + (b[i] - a[i]) * f for i in range(3))
                if p.get('preso'):  # suporte até a parede
                    partes.append(cilindro(n + '_suporte', q, soma(q, p['preso']), 0.01, 'inox', 6))
                else:
                    partes.append(cilindro(n + '_poste', (q[0], q[1] - 0.9, q[2]), q, 0.02, 'inox', 8))
            grupo(partes, n)
        elif t == 'guarda-vidro':
            a, b = p['de'], p['ate']
            ex = 0.01 if abs(a[2] - b[2]) > abs(a[0] - b[0]) else 0
            ez = 0.01 if ex == 0 else 0
            mn = (min(a[0], b[0]) - ex, a[1], min(a[2], b[2]) - ez)
            mx = (max(a[0], b[0]) + ex, a[1] + 0.95, max(a[2], b[2]) + ez)
            objs_vidro.append(caixa('vidro_' + n, mn, mx, 'vidro'))
            topo_a, topo_b = (a[0], a[1] + 1.0, a[2]), (b[0], b[1] + 1.0, b[2])
            partes = [cilindro(n + '_tubo', topo_a, topo_b, 0.025, 'inox')]
            comp = math.dist(a, b)
            for f in np.linspace(0, 1, max(2, int(comp / 1.2) + 1)):
                q = tuple(a[i] + (b[i] - a[i]) * f for i in range(3))
                partes.append(cilindro(n + '_poste', q, (q[0], q[1] + 1.0, q[2]), 0.02, 'inox', 8))
            grupo(partes, n)
        elif t == 'rampa':
            mn, mx = p['min'], p['max']
            # bloco com topo inclinado: alto em x = min (sobe para -x), baixo em x = max
            y0 = mn[1] - 0.12
            def alt(x):
                return mx[1] + (mn[1] - mx[1]) * (x - mn[0]) / (mx[0] - mn[0])
            bm = bmesh.new()
            topo = [bm.verts.new(B(x, alt(x), z)) for x, z in ((mn[0], mn[2]), (mx[0], mn[2]), (mx[0], mx[2]), (mn[0], mx[2]))]
            base = [bm.verts.new(B(x, y0, z)) for x, z in ((mn[0], mn[2]), (mx[0], mn[2]), (mx[0], mx[2]), (mn[0], mx[2]))]
            bm.faces.new(topo)
            bm.faces.new(base[::-1])
            for i in range(4):
                j = (i + 1) % 4
                bm.faces.new((base[i], base[j], topo[j], topo[i]))
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            novo_obj(n, bm, 'rampa')
        elif t == 'balcao':
            mn, mx = p['min'], p['max']
            tampo = 'marmore' if p.get('marmore') else 'branco'
            partes = [
                caixa(n + '_base', (mn[0], mn[1], mn[2]), (mx[0], mn[1] + 0.2, mx[2]), 'madeira'),
                caixa(n + '_corpo', (mn[0] + 0.02, mn[1] + 0.2, mn[2] + 0.02), (mx[0] - 0.02, mx[1] - 0.04, mx[2] - 0.02), 'branco'),
                caixa(n + '_tampo', (mn[0] - 0.04, mx[1] - 0.04, mn[2] - 0.04), (mx[0] + 0.04, mx[1], mx[2] + 0.04), tampo),
            ]
            g = p.get('guiches', 1)
            if p.get('eixo') == 'z':
                # guichês em fila ao longo de z; atendente do lado -x (parede), paciente do lado +x
                larg = (mx[2] - mn[2]) / g
                for i in range(g):
                    cz = mn[2] + larg * (i + 0.5)
                    partes.append(caixa_local(f'{n}_monitor{i}', (mn[0] + 0.15, mx[1] + 0.2, cz), (0.5, 0.3, 0.03), 'preto', 90))
                    partes.append(caixa_local(f'{n}_pe{i}', (mn[0] + 0.13, mx[1] + 0.04, cz), (0.08, 0.08, 0.08), 'preto', 90))
                    if i:
                        partes.append(caixa(f'{n}_div{i}', (mn[0], mx[1], mn[2] + larg * i - 0.01), (mx[0], mx[1] + 0.4, mn[2] + larg * i + 0.01), 'acrilico'))
                    partes += cadeira(f'{n}_cad{i}', (mn[0] - 0.55, mn[1], cz), 90)
                    partes += cadeira(f'{n}_pac{i}', (mx[0] + 0.5, mn[1], cz), -90, 'cinza')
            else:
                # guichês em fila ao longo de x; atendente do lado sul (+z)
                larg = (mx[0] - mn[0]) / g
                for i in range(g):
                    cx = mn[0] + larg * (i + 0.5)
                    partes.append(caixa_local(f'{n}_monitor{i}', (cx, mx[1] + 0.2, mx[2] - 0.15), (0.5, 0.3, 0.03), 'preto', 0))
                    partes.append(caixa_local(f'{n}_pe{i}', (cx, mx[1] + 0.04, mx[2] - 0.13), (0.08, 0.08, 0.08), 'preto', 0))
                    if i:
                        partes.append(caixa(f'{n}_div{i}', (mn[0] + larg * i - 0.01, mx[1], mn[2]), (mn[0] + larg * i + 0.01, mx[1] + 0.35, mx[2]), 'acrilico'))
                    partes += cadeira(f'{n}_cad{i}', (cx, mn[1], mx[2] + 0.55), 180)
            grupo(partes, n)
        elif t == 'cadeiras':
            partes = []
            for i in range(p['n']):
                pos = tuple(p['de'][k] + p['passo'][k] * i for k in range(3))
                partes += cadeira(f'{n}_{i}', pos, p['vira'], p.get('cor', 'preto'))
            grupo(partes, n)
        elif t == 'porta':
            porta(n, p['centro'], p['vira'], p.get('placa'), p.get('largura', 0.95))
        elif t == 'faixas-vaga':
            # vagas de estacionamento: faixas brancas no chão
            x0, y, z0 = p['de']
            partes = []
            for i in range(p['n'] + 1):
                x = x0 + i * p['passo']
                partes.append(caixa(f'{n}_{i}', (x - 0.05, y - 0.02, z0), (x + 0.05, y + 0.005, z0 + p['fundo']), 'faixa-branca'))
            grupo(partes, n)
        elif t == 'painel-marmore':
            mn, mx = p['min'], p['max']
            partes = [caixa(n + '_madeira', (mn[0], mn[1], mn[2]), (mx[0], mn[1] + 1.15, mx[2]), 'madeira'),
                      caixa(n + '_pedra', (mn[0], mn[1] + 1.15, mn[2]), (mx[0], mx[1], mx[2]), 'marmore')]
            if p.get('logo'):
                cz = (mn[2] + mx[2]) / 2
                partes.append(texto(n + '_nome', 'CLINICADIAS', (mx[0] + 0.01, mn[1] + 1.95, cz + 0.35), 0.32, 'roxo', 90, 0.02))
                partes.append(caixa_local(n + '_cruz_v', (mx[0] + 0.02, mn[1] + 1.98, cz - 1.25), (0.14, 0.42, 0.03), 'teal', 90))
                partes.append(caixa_local(n + '_cruz_h', (mx[0] + 0.02, mn[1] + 1.98, cz - 1.25), (0.42, 0.14, 0.03), 'teal', 90))
                partes.append(caixa_local(n + '_folha', (mx[0] + 0.04, mn[1] + 1.86, cz - 1.42), (0.24, 0.1, 0.02), 'laranja', 90))
            grupo(partes, n)
        elif t == 'banner':
            mn, mx = p['min'], p['max']
            partes = [caixa(n + '_lona', mn, mx, 'banner')]
            for i, linha in enumerate(p.get('texto', [])):
                partes.append(texto(f'{n}_t{i}', linha, ((mn[0] + mx[0]) / 2 + 0.55, mx[1] - 0.3 - i * 0.24, mx[2] + 0.01), 0.18, 'roxo', 0, 0.003))
            partes.append(caixa(n + '_faixa', (mn[0], mn[1], mx[2]), (mx[0], mn[1] + 0.35, mx[2] + 0.005), 'roxo'))
            grupo(partes, n)
        elif t == 'placa':
            c, v = p['centro'], p.get('vira', 0)
            em = lambda l: soma(c, rot_vec(l, v))
            grupo([caixa_local(n + '_fundo', em((0, 0, 0.01)), (0.75, 0.18, 0.015), 'branco', v),
                   texto(n + '_txt', p['texto'], em((0.05, 0, 0.02)), 0.06, 'preto', v, 0.002),
                   caixa_local(n + '_cruz', em((-0.3, 0, 0.02)), (0.08, 0.08, 0.005), 'verde', v)], n)
        elif t == 'totem':
            c = p['centro']
            partes = [caixa_local(n + '_corpo', (c[0], c[1] + 0.85, c[2]), (0.55, 1.7, 0.4), 'preto', -90)]
            objs_luz.append(caixa_local(n + '_tela', (c[0] - 0.205, c[1] + 1.15, c[2]), (0.4, 0.55, 0.01), 'tela', -90))
            grupo(partes, n)
        elif t == 'planta':
            c = p['centro']
            partes = [caixa_local(n + '_vaso', (c[0], c[1] + 0.25, c[2]), (0.38, 0.5, 0.38), 'vaso')]
            for i in range(14):
                ang = i * 137.5
                alt = 0.6 + rng.random() * 1.0
                topo = soma(c, (math.cos(math.radians(ang)) * 0.35, alt, math.sin(math.radians(ang)) * 0.35))
                partes.append(cilindro(n + '_haste', (c[0], c[1] + 0.5, c[2]), topo, 0.008, 'planta', 5))
                folha = caixa_local(n + '_folha', topo, (0.05, 0.02, 0.38), 'planta', ang)
                partes.append(folha)
            grupo(partes, n)
        elif t == 'plantas':
            mn, mx = p['min'], p['max']
            partes = []
            for i in range(40):
                x = mn[0] + rng.random() * (mx[0] - mn[0])
                z = mn[2] + rng.random() * (mx[2] - mn[2])
                h = 0.3 + rng.random() * (mx[1] - mn[1])
                partes.append(caixa_local(n + '_folha', (x, mn[1] + h / 2, z), (0.04, h, 0.02), 'planta', rng.random() * 180))
            grupo(partes, n)
        elif t == 'letreiro':
            c, L, v = p['centro'], p['largura'], p.get('vira', 0)
            em = lambda l: soma(c, rot_vec(l, v))
            partes = [
                caixa_local(n + '_cruz_v', em((0, 0.55, 0.03)), (0.32, 0.95, 0.06), 'teal', v),
                caixa_local(n + '_cruz_h', em((0, 0.55, 0.03)), (0.95, 0.32, 0.06), 'teal', v),
                caixa_local(n + '_folha1', em((-0.42, 0.25, 0.07)), (0.5, 0.2, 0.03), 'laranja', v),
                caixa_local(n + '_folha2', em((-0.32, 0.05, 0.07)), (0.45, 0.18, 0.03), 'verde', v),
                texto(n + '_nome', p.get('texto', 'CLINICADIAS'), em((0, -0.3, 0.03)), L * 0.16, 'branco', v, 0.02),
            ]
            if p.get('sub', 'MEDICINA ESPECIALIZADA'):
                partes.append(texto(n + '_sub', p.get('sub', 'MEDICINA ESPECIALIZADA'), em((0, -0.5, 0.03)), L * 0.05, 'branco', v, 0.005))
            grupo(partes, n)
        elif t == 'ripado':
            # painel ripado como UMA peça com textura de ripas (mipmap no navegador = sem moiré)
            mn, mx = p['min'], p['max']
            ob = caixa(n, mn, mx, 'ripado')
            chanfra(ob, 0.01)
        elif t == 'tv':
            c, L, v = p['centro'], p['largura'], p.get('vira', 0)
            em = lambda l: soma(c, rot_vec(l, v))
            caixa_local(n, em((0, 0, 0.03)), (L, L * 0.58, 0.05), 'preto', v)
            objs_luz.append(caixa_local(n + '_tela', em((0, 0, 0.056)), (L - 0.04, L * 0.58 - 0.04, 0.002), 'tela', v))
        elif t == 'quadro':
            c, v = p['centro'], p.get('vira', 0)
            caixa_local(n, soma(c, rot_vec((0, 0, 0.015), v)), (p['largura'], p['altura'], 0.03), 'quadro', v)
        elif t == 'faixa-piso':
            mn, mx = p['min'], p['max']
            y = mn[1] + 0.003
            w = 0.05
            partes = [
                caixa(n + '_a', (mn[0], mn[1], mn[2]), (mx[0], y, mn[2] + w), 'preto'),
                caixa(n + '_b', (mn[0], mn[1], mx[2] - w), (mx[0], y, mx[2]), 'preto'),
                caixa(n + '_c', (mn[0], mn[1], mn[2]), (mn[0] + w, y, mx[2]), 'preto'),
                caixa(n + '_d', (mx[0] - w, mn[1], mn[2]), (mx[0], y, mx[2]), 'preto'),
            ]
            grupo(partes, n)
        elif t == 'faixas-cores':
            a, b = p['de'], p['ate']
            partes = []
            for i, cor in enumerate(['azul', 'amarelo', 'vermelho', 'verde']):
                d = -0.2 + i * 0.13
                if p.get('eixo') == 'x':
                    z = a[2] + d
                    partes.append(caixa(f'{n}_{cor}', (min(a[0], b[0]), a[1] - 0.002, z), (max(a[0], b[0]), a[1] + 0.002, z + 0.05), cor))
                else:
                    x = a[0] + d
                    partes.append(caixa(f'{n}_{cor}', (x, a[1] - 0.002, min(a[2], b[2])), (x + 0.05, a[1] + 0.002, max(a[2], b[2])), cor))
            grupo(partes, n)
        else:
            if not monta_extra(p, objs_vidro, objs_luz):
                log('tipo desconhecido', t)
        if t not in ESTRUTURA:
            for o in set(COLECAO.objects[:]) - _antes:
                o['movel'] = 1
    return objs_vidro, objs_luz


# ─────────────────────────────────────────────── luzes
def luzes():
    # sol baixo, quente (fim de tarde), vindo da frente-esquerda
    sd = bpy.data.lights.new('sol', 'SUN')
    sd.energy = 3.2
    sd.color = (1.0, 0.82, 0.62)
    sd.angle = math.radians(2.5)
    so = bpy.data.objects.new('sol', sd)
    # fachada vira para leste (Av. Treze): sol baixo da manhã, vindo do leste-sudeste
    # direção da luz na planta (x, y, z) = para oeste, para baixo, um pouco para o norte
    # ilumina as duas fachadas: a leste (Av. Treze) e a sul (Rua 128, estacionamento)
    dirB = B(-0.62, -0.5, -0.75).normalized()
    so.rotation_mode = 'QUATERNION'
    so.rotation_quaternion = Vector((0, 0, -1)).rotation_difference(dirB)
    cena.collection.objects.link(so)

    objs = []
    # spots redondos embutidos no forro, a cada ~1,8 m, nos tetos marcados
    for p in P['pecas']:
        if not (p['tipo'] == 'caixa' and p.get('teto') and p.get('mat') == 'teto'):
            continue
        mn, mx = p['min'], p['max']
        y = mn[1] - 0.005
        nx = max(1, round((mx[0] - mn[0] - 0.6) / 1.8))
        nz = max(1, round((mx[2] - mn[2]) / 1.8))
        for i in range(nx):
            for k in range(nz):
                x = mn[0] + 0.5 + (i + 0.5) * (mx[0] - mn[0] - 1.0) / nx
                z = mn[2] + (k + 0.5) * (mx[2] - mn[2]) / nz
                ld = bpy.data.lights.new('spot', 'AREA')
                ld.shape = 'DISK'
                ld.size = 0.16
                ld.energy = 22
                ld.color = (1.0, 0.86, 0.7)
                lo = bpy.data.objects.new('spot', ld)
                lo.location = B(x, y - 0.02, z)
                cena.collection.objects.link(lo)
                bm = bmesh.new()
                bmesh.ops.create_circle(bm, cap_ends=True, segments=16, radius=0.08)
                d = novo_obj('luminaria', bm, 'luz')
                d.location = B(x, y, z)
                d.rotation_euler = Euler((math.radians(180), 0, 0))
                objs.append(d)
    # poste/arandela da fachada: luz quente sob a marquise
    for p in P['pecas']:
        if p['nome'].startswith('marquise'):
            mn, mx = p['min'], p['max']
            ld = bpy.data.lights.new('marquise', 'AREA')
            ld.shape = 'RECTANGLE'
            ld.size, ld.size_y = 2.4, 0.5
            ld.energy = 120
            ld.color = (1.0, 0.8, 0.6)
            lo = bpy.data.objects.new('marquise', ld)
            lo.location = B((mn[0] + mx[0]) / 2, mn[1] - 0.02, (mn[2] + mx[2]) / 2)
            cena.collection.objects.link(lo)
    return objs


# ─────────────────────────────────────────────── UVs
def uv_mundo(ob):
    """UV de detalhe em escala do mundo (a textura repete a cada `tile` metros)."""
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uvl = bm.loops.layers.uv.get('UVMap') or bm.loops.layers.uv.new('UVMap')
    mw = ob.matrix_world
    for f in bm.faces:
        mat = me.materials[f.material_index] if me.materials else None
        tile = float(mat.get('tile', 1.0)) if mat else 1.0
        n = (mw.to_3x3() @ f.normal)
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            w = mw @ l.vert.co
            if ax == 2:
                u, v = w.x, w.y
            elif ax == 1:
                u, v = w.x, w.z
            else:
                u, v = w.y, w.z
            l[uvl].uv = (u / tile, v / tile)
    bm.to_mesh(me)
    bm.free()


def uv_luz(ob):
    me = ob.data
    if 'luz' not in me.uv_layers:
        me.uv_layers.new(name='luz')
    me.uv_layers['luz'].active = True
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004, area_weight=0.0, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(rotate=True, margin=0.004)
    bpy.ops.object.mode_set(mode='OBJECT')
    me.uv_layers['UVMap'].active_render = True


# ─────────────────────────────────────────────── luz em textura
def area_de(ob):
    # centro do objeto em coordenadas da planta
    c = sum((ob.matrix_world @ Vector(v) for v in ob.bound_box), Vector()) / 8
    x, y, z = c.x, c.z, -c.y  # volta para a planta (y para cima, z para o sul)
    # a primeira área cuja caixa contém o centro; se nenhuma, a de centro mais próximo
    # salas (consultórios vistos por dentro) primeiro: ganham grupo e mapa de luz próprios
    melhor, dist = None, 1e9
    for a in sorted(P['areas'], key=lambda a: 0 if a.get('sala') else 1):
        mn, mx = a['caixa']['min'], a['caixa']['max']
        if mn[0] <= x <= mx[0] and mn[1] <= y <= mx[1] and mn[2] <= z <= mx[2]:
            return a['id']
        if a.get('sala'):
            continue
        cx, cy, cz = ((mn[i] + mx[i]) / 2 for i in range(3))
        d = (x - cx) ** 2 + (y - cy) ** 2 * 4 + (z - cz) ** 2
        if d < dist:
            melhor, dist = a['id'], d
    return melhor


def res_de(nome):
    """resolução do mapa de luz: móveis e forro com metade (aparecem menos), estrutura com a cheia."""
    return max(256, RES // 2) if (nome.endswith('_moveis') or nome.endswith('_teto')) else RES


def bilateral(img, r=3, ss=2.0, sr=0.12):
    """filtro bilateral (preserva bordas): pesa vizinhos pela distância E pela diferença de brilho."""
    L = img.mean(axis=2)
    escala = max(1e-4, float(np.percentile(L, 90)))
    acc = np.zeros_like(img)
    pes = np.zeros(L.shape, np.float32)
    pad = np.pad(img, ((r, r), (r, r), (0, 0)), mode='edge')
    padL = np.pad(L, r, mode='edge')
    h, w = L.shape
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            viz = pad[r + dy:r + dy + h, r + dx:r + dx + w]
            vizL = padL[r + dy:r + dy + h, r + dx:r + dx + w]
            wgt = np.exp(-(dy * dy + dx * dx) / (2 * ss * ss)) * np.exp(-np.square((vizL - L) / (sr * escala)) / 2)
            acc += viz * wgt[..., None]
            pes += wgt
    return acc / pes[..., None]


def suaviza(arr, cobertura, r=2):
    """filtro gaussiano só dentro das ilhas (não puxa a cor do fundo)."""
    from numpy.lib.stride_tricks import sliding_window_view
    k = np.exp(-np.square(np.arange(-r, r + 1)) / (2 * (r * 0.6) ** 2))
    k /= k.sum()
    def conv(img):
        out = img
        for eixo in (0, 1):
            pad = [(r, r) if i == eixo else (0, 0) for i in range(img.ndim)]
            p = np.pad(out, pad, mode='edge')
            out = sum(k[i] * np.take(p, range(i, i + img.shape[eixo]), axis=eixo) for i in range(2 * r + 1))
        return out
    num = conv(arr * cobertura[..., None])
    den = conv(cobertura)[..., None]
    lisa = np.where(den > 1e-4, num / np.maximum(den, 1e-4), arr)
    return lisa


def calcula_ao(ob, nome, res, amostras=24):
    """mapa de oclusão (só a sombra de contato), com forro, luminárias, vidros e decalques escondidos:
    é a luz da maquete vista de cima, como os renders de argila do ICG."""
    img = bpy.data.images.new('ao_' + nome, res, res, alpha=True, float_buffer=True)
    for m in ob.data.materials:
        nt = m.node_tree
        alvo = nt.nodes.get('luz_alvo') or nt.nodes.new('ShaderNodeTexImage')
        alvo.name = 'luz_alvo'
        alvo.image = img
        nt.nodes.active = alvo
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    ob.data.uv_layers['luz'].active = True
    antes = cena.cycles.samples
    cena.cycles.samples = amostras
    t0 = time.time()
    bpy.ops.object.bake(type='AO', margin=6, margin_type='EXTEND', use_clear=True)
    cena.cycles.samples = antes
    px = np.empty(res * res * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(res, res, 4)
    v = suaviza(px[..., :3], np.ones((res, res), np.float32), r=2)
    v = np.clip(v, 0, 1) ** 0.85  # um pouco mais claro: oclusão suave
    out = bpy.data.images.new('ao_' + nome + '_img', res, res, alpha=False)
    out.colorspace_settings.name = 'Non-Color'
    rgba = np.ones((res, res, 4), np.float32)
    rgba[..., :3] = v
    out.pixels.foreach_set(rgba.ravel())
    out.filepath_raw = os.path.join(SAIDA, f'ao_{nome}.webp')
    out.file_format = 'WEBP'
    out.save()
    for m in ob.data.materials:
        n_ = m.node_tree.nodes.get('luz_alvo')
        if n_:
            m.node_tree.nodes.remove(n_)
    log(f'oclusão de {nome}: {time.time() - t0:.0f}s')


def calcula_luz(ob, nome):
    RES = res_de(nome)
    img = bpy.data.images.new('luz_' + nome, RES, RES, alpha=True, float_buffer=True)
    for m in ob.data.materials:
        nt = m.node_tree
        alvo = nt.nodes.get('luz_alvo') or nt.nodes.new('ShaderNodeTexImage')
        alvo.name = 'luz_alvo'
        alvo.image = img
        nt.nodes.active = alvo
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    ob.data.uv_layers['luz'].active = True
    t0 = time.time()
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=6, margin_type='EXTEND', use_clear=True)
    log(f'luz de {nome}: {time.time() - t0:.0f}s')
    px = np.empty(RES * RES * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(RES, RES, 4)
    rgb, a = px[..., :3], (px[..., 3] > 0.5).astype(np.float32)
    rgb = bilateral(rgb, r=3, sr=0.12)  # tira o chiado sem borrar cantos e sombras de contato
    # sRGB de (luz / K)
    v = np.clip(rgb / K_LUZ, 0, 1)
    v = np.where(v <= 0.0031308, v * 12.92, 1.055 * np.power(v, 1 / 2.4) - 0.055)
    out = bpy.data.images.new('luz_' + nome + '_png', RES, RES, alpha=False)
    out.colorspace_settings.name = 'Non-Color'
    rgba = np.ones((RES, RES, 4), np.float32)
    rgba[..., :3] = v
    out.pixels.foreach_set(rgba.ravel())
    out.filepath_raw = os.path.join(SAIDA, f'luz_{nome}.webp')
    out.file_format = 'WEBP'
    cena.render.image_settings.quality = 88
    out.save()
    # tira o nó de alvo para não ir no glb
    for m in ob.data.materials:
        n = m.node_tree.nodes.get('luz_alvo')
        if n:
            m.node_tree.nodes.remove(n)


# ─────────────────────────────────────────────── principal
t_ini = time.time()
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'moveis.py'), encoding='utf-8').read(), globals())
gera_texturas()
prepara_materiais()
material_extra()
vidros, telas = monta()
lumin = luzes()

# junta tudo que recebe luz por área (como os "sets" do ICG); vidro e telas ficam separados
fixos = [o for o in COLECAO.objects if o.type == 'MESH' and o not in vidros and o not in telas and o not in lumin and not o.get('decal')]
por_area = {}
for o in fixos:
    por_area.setdefault(area_de(o), []).append(o)

for o in fixos:
    uv_mundo(o)

finais = []
for nome, objs in por_area.items():
    tetos = [o for o in objs if o.get('teto')]
    moveis = [o for o in objs if o.get('movel') and not o.get('teto')]
    resto = [o for o in objs if not o.get('teto') and not o.get('movel')]
    ob = grupo(resto, f'luz_{nome}')
    finais.append((ob, nome))
    if moveis:
        mv = grupo(moveis, f'luz_{nome}_moveis')  # móveis num atlas próprio: mais texels para piso e paredes
        finais.append((mv, nome + '_moveis'))
    if tetos:
        tt = grupo(tetos, f'luz_{nome}_teto')
        finais.append((tt, nome + '_teto'))

if lumin:
    grupo(lumin, 'luminarias_teto')
for o in vidros:
    o.name = 'vidro_' + o.name if not o.name.startswith('vidro') else o.name

for ob, nome in finais:
    uv_luz(ob)

manifesto = os.path.join(SAIDA, 'luz.json')
if os.path.exists(manifesto):
    os.remove(manifesto)  # mapas antigos não servem para a geometria nova
grupos_luz, grupos_ao = [], []
if MODO in ('ao', 'luz'):
    # oclusão da maquete: esconde forro, luminárias, volumes de cima, vidros e decalques
    escondidos = [o for o in cena.objects if o.type == 'MESH' and (
        '_teto' in o.name or 'luminarias' in o.name or 'vidro' in o.name or o.name.startswith('decal_') or
        o.name.endswith('_tela'))]
    for o in escondidos:
        o.hide_render = True
    mundo.light_settings.distance = 1.1
    for ob, nome in finais:
        if not nome.endswith('_teto'):
            calcula_ao(ob, nome, min(RES, 1024), 24 if MODO == 'luz' else 16)
            grupos_ao.append(nome)
    for o in escondidos:
        o.hide_render = False
if MODO == 'luz':
    for ob, nome in finais:
        calcula_luz(ob, nome)
        grupos_luz.append(nome)
if grupos_ao or grupos_luz:
    with open(manifesto, 'w', encoding='utf-8') as f:
        json.dump({'k': K_LUZ, 'ext': 'webp', 'grupos': grupos_luz, 'ao': grupos_ao, 'res': RES, 'amostras': AMOSTRAS}, f)

# exporta
for o in bpy.context.selected_objects:
    o.select_set(False)
destino = os.path.join(SAIDA, 'clinica.glb')
bpy.ops.export_scene.gltf(
    filepath=destino, export_format='GLB', use_selection=False,
    export_texcoords=True, export_normals=True, export_materials='EXPORT',
    export_image_format='JPEG', export_jpeg_quality=85,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
    export_lights=False, export_cameras=False, export_apply=True, export_extras=True,
)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'clinica.blend'))
log(f'pronto em {time.time() - t_ini:.0f}s → {destino}')
