# Renderiza as maquetes (vista de cima, isométrica) no Cycles — como as imagens iso_* do ICG.
# Usa o blender/clinica.blend salvo pelo monta_clinica.py e a MESMA câmera do three.js
# (passeio.js: DIR_ISO, fov 22°, distância de enquadra(), deslocamento de 10% para cima).
#
# uso: blender -b blender/clinica.blend -P blender/render_maquetes.py -- <planta.json> <saida_dir> <largura> <altura> <amostras> [indices]
#   indices: "0,3,5" (padrão: todas). Uma imagem por área: maq_<id>[_cel].webp
import bpy, json, math, os, sys, time
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
P = json.load(open(argv[0], encoding='utf-8'))
SAIDA = os.path.abspath(argv[1])
W, H, AMOSTRAS = int(argv[2]), int(argv[3]), int(argv[4])
INDICES = [int(i) for i in argv[5].split(',')] if len(argv) > 5 and argv[5] else list(range(len(P['areas'])))
SUFIXO = '_cel' if H > W else ''
os.makedirs(SAIDA, exist_ok=True)


def B(x, y, z):
    return Vector((x, -z, y))


def log(*a):
    print('[maquete]', *a, flush=True)


cena = bpy.context.scene
cena.render.engine = 'CYCLES'
cena.cycles.device = 'CPU'
cena.render.threads_mode = 'AUTO'  # todos os núcleos
cena.cycles.samples = AMOSTRAS
cena.cycles.use_denoising = True
try:
    cena.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception:
    pass
cena.cycles.max_bounces = 4
cena.cycles.diffuse_bounces = 3
cena.cycles.glossy_bounces = 1
cena.cycles.transmission_bounces = 2
cena.cycles.transparent_max_bounces = 48  # muitas paredes recortadas uma atrás da outra
cena.render.resolution_x, cena.render.resolution_y = W, H
cena.render.resolution_percentage = 100
cena.render.film_transparent = True
cena.view_settings.view_transform = 'AgX'
cena.view_settings.look = 'None'
cena.view_settings.exposure = -0.12
for _look in ('AgX - Medium High Contrast', 'Medium High Contrast'):
    try:
        cena.view_settings.look = _look
        break
    except Exception:
        pass
cena.render.image_settings.file_format = 'WEBP'
cena.render.image_settings.color_mode = 'RGBA'
cena.render.image_settings.quality = 86

# ── luz de estúdio: céu claro e quente + sol difuso (sombra macia). Spots do forro desligados.
for o in bpy.data.objects:
    if o.type == 'LIGHT':
        o.hide_render = True
mundo = cena.world
mundo.use_nodes = True
bg = mundo.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (1.0, 0.965, 0.92, 1)
bg.inputs['Strength'].default_value = 0.72
sd = bpy.data.lights.new('sol_estudio', 'SUN')
sd.energy = 4.4
sd.angle = math.radians(12)
sd.color = (1.0, 0.93, 0.84)
sol = bpy.data.objects.new('sol_estudio', sd)
cena.collection.objects.link(sol)
d = B(14, -22, -12).normalized()  # do sol para o alvo (igual ao passeio.js)
sol.rotation_mode = 'QUATERNION'
sol.rotation_quaternion = Vector((0, 0, -1)).rotation_difference(d)

# esconde forro, luminárias e volumes dos andares de cima
for o in bpy.data.objects:
    if o.type == 'MESH' and ('_teto' in o.name or 'luminarias' in o.name or 'volume' in o.name):
        o.hide_render = True

# ── máscara de corte (recorte da área + paredes da frente + topo) em TODOS os materiais
grupo = bpy.data.node_groups.new('corte_maquete', 'ShaderNodeTree')
gi = grupo.nodes.new('NodeGroupInput')
go = grupo.nodes.new('NodeGroupOutput')
grupo.interface.new_socket('Shader', in_out='INPUT', socket_type='NodeSocketShader')
grupo.interface.new_socket('Shader', in_out='OUTPUT', socket_type='NodeSocketShader')
VAL = {}
for k in ('minx', 'maxx', 'miny', 'maxy', 'minz', 'maxz', 'corte', 'topo'):
    v = grupo.nodes.new('ShaderNodeValue')
    v.label = k
    VAL[k] = v
geo = grupo.nodes.new('ShaderNodeNewGeometry')
sep = grupo.nodes.new('ShaderNodeSeparateXYZ')
grupo.links.new(geo.outputs['Position'], sep.inputs[0])
L = grupo.links


def mat_op(op, a, b):
    n = grupo.nodes.new('ShaderNodeMath')
    n.operation = op
    for i, x in enumerate((a, b)):
        if isinstance(x, (int, float)):
            n.inputs[i].default_value = x
        else:
            L.new(x, n.inputs[i])
    return n.outputs[0]


X = sep.outputs['X']
Zp = mat_op('MULTIPLY', sep.outputs['Y'], -1.0)  # z da planta
Y = sep.outputs['Z']                              # altura
V = {k: v.outputs[0] for k, v in VAL.items()}
dentro = mat_op('MULTIPLY', mat_op('GREATER_THAN', X, V['minx']), mat_op('LESS_THAN', X, V['maxx']))
dentro = mat_op('MULTIPLY', dentro, mat_op('GREATER_THAN', Zp, V['minz']))
dentro = mat_op('MULTIPLY', dentro, mat_op('LESS_THAN', Zp, V['maxz']))
dentro = mat_op('MULTIPLY', dentro, mat_op('GREATER_THAN', Y, V['miny']))
dentro = mat_op('MULTIPLY', dentro, mat_op('LESS_THAN', Y, V['maxy']))
dentro = mat_op('MULTIPLY', dentro, mat_op('LESS_THAN', Y, V['topo']))
frente = mat_op('MAXIMUM', mat_op('GREATER_THAN', X, mat_op('SUBTRACT', V['maxx'], 0.55)),
                mat_op('GREATER_THAN', Zp, mat_op('SUBTRACT', V['maxz'], 0.55)))
cortado = mat_op('MULTIPLY', mat_op('GREATER_THAN', Y, V['corte']), frente)
mantem = mat_op('MULTIPLY', dentro, mat_op('SUBTRACT', 1.0, cortado))
# miolo de parede cortada (face de trás): cor de corte clara e lisa
# cor de corte EMISSIVA (lisa, não depende de luz): o miolo de sólidos cortados nunca fica preto
cap = grupo.nodes.new('ShaderNodeEmission')
cap.inputs['Color'].default_value = (0.74, 0.69, 0.63, 1)
cap.inputs['Strength'].default_value = 0.85
mix_cap = grupo.nodes.new('ShaderNodeMixShader')
L.new(geo.outputs['Backfacing'], mix_cap.inputs[0])
L.new(gi.outputs[0], mix_cap.inputs[1])
L.new(cap.outputs[0], mix_cap.inputs[2])
transp = grupo.nodes.new('ShaderNodeBsdfTransparent')
mix = grupo.nodes.new('ShaderNodeMixShader')
L.new(mantem, mix.inputs[0])
L.new(transp.outputs[0], mix.inputs[1])
L.new(mix_cap.outputs[0], mix.inputs[2])
L.new(mix.outputs[0], go.inputs[0])

# decalques: alfa da imagem como mistura explícita com Transparente (o Cycles ignora o Alpha do Principled aqui)
for m in bpy.data.materials:
    if not m.name.startswith('decal_') or not m.node_tree:
        continue
    nt = m.node_tree
    tex = next((n for n in nt.nodes if n.type == 'TEX_IMAGE'), None)
    bsdf = nt.nodes.get('Principled BSDF')
    out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None)
    if tex and bsdf and out:
        for l in list(bsdf.inputs['Alpha'].links):
            nt.links.remove(l)
        tr = nt.nodes.new('ShaderNodeBsdfTransparent')
        mx_ = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(tex.outputs['Alpha'], mx_.inputs[0])
        nt.links.new(tr.outputs[0], mx_.inputs[1])
        nt.links.new(bsdf.outputs[0], mx_.inputs[2])
        nt.links.new(mx_.outputs[0], out.inputs['Surface'])

# vidros: mistura clara e transparente (transmissão de verdade escurece sobre o fundo transparente)
for m in bpy.data.materials:
    if m.name not in ('vidro', 'acrilico') or not m.node_tree:
        continue
    nt = m.node_tree
    out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None)
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    gl = nt.nodes.new('ShaderNodeBsdfGlossy')
    gl.inputs['Color'].default_value = (0.8, 0.9, 0.95, 1)
    gl.inputs['Roughness'].default_value = 0.08
    mx_ = nt.nodes.new('ShaderNodeMixShader')
    mx_.inputs[0].default_value = 0.22
    nt.links.new(tr.outputs[0], mx_.inputs[1])
    nt.links.new(gl.outputs[0], mx_.inputs[2])
    nt.links.new(mx_.outputs[0], out.inputs['Surface'])

# ── argila (como as maquetes do ICG): tudo numa cor só, fosca; logos e placas (decalques) e vidro ficam como estão
BARRO = (0.863, 0.815, 0.745, 1)  # #EFE9E0 em linear (igual ao COR_BARRO do passeio.js)
for m in bpy.data.materials:
    if not m.node_tree or m.name.startswith('decal_') or m.name in ('vidro', 'acrilico'):
        continue
    nt = m.node_tree
    out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None)
    if not out:
        continue
    barro = nt.nodes.new('ShaderNodeBsdfPrincipled')
    barro.inputs['Base Color'].default_value = BARRO
    barro.inputs['Roughness'].default_value = 0.92
    nt.links.new(barro.outputs[0], out.inputs['Surface'])

for m in bpy.data.materials:
    if not m.use_nodes or not m.node_tree:
        continue
    if m.name.startswith('decal_'):
        continue  # decalque fica colado na parede: sem máscara (com ela o alfa do logo vira preto)
    nt = m.node_tree
    out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None)
    if not out or not out.inputs['Surface'].is_linked:
        continue
    origem = out.inputs['Surface'].links[0].from_socket
    g = nt.nodes.new('ShaderNodeGroup')
    g.node_tree = grupo
    nt.links.new(origem, g.inputs[0])
    nt.links.new(g.outputs[0], out.inputs['Surface'])

# ── base da maquete (cinza-azulado) e câmera
mb = bpy.data.materials.new('base_maquete')
mb.use_nodes = True
mb.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.723, 0.651, 0.558, 1)  # #DDD3C5 em linear
mb.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.95
bpy.ops.mesh.primitive_cube_add(size=1)
base = bpy.context.active_object
base.name = 'base_maquete'
base.data.materials.append(mb)

# chão invisível que só recebe sombra: a sombra da maquete cai no fundo bege da página
bpy.ops.mesh.primitive_plane_add(size=400)
chao = bpy.context.active_object
chao.name = 'chao_sombra'
chao.is_shadow_catcher = True

cam_d = bpy.data.cameras.new('cam')
cam_d.sensor_fit = 'VERTICAL'
cam_d.angle_y = math.radians(22)
cam_d.clip_start, cam_d.clip_end = 0.1, 500
cam = bpy.data.objects.new('cam', cam_d)
cena.collection.objects.link(cam)
cena.camera = cam
DIR = Vector((1.05, 1.0, 1.15)).normalized()  # espaço da planta (three)
aspecto = W / H

for i in INDICES:
    a = P['areas'][i]
    mn, mx = Vector(a['caixa']['min']), Vector(a['caixa']['max'])
    # só renderiza o que toca a caixa da área (menos camadas transparentes, render mais rápido)
    for o in bpy.data.objects:
        if o.type != 'MESH' or o.name in ('base_maquete', 'chao_sombra') or '_teto' in o.name or 'luminarias' in o.name or 'volume' in o.name:
            continue
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
        xs = [v.x for v in bb]; zs = [-v.y for v in bb]; ys = [v.z for v in bb]
        toca = min(xs) < mx.x and max(xs) > mn.x and min(zs) < mx.z and max(zs) > mn.z and min(ys) < mx.y and max(ys) > mn.y
        o.hide_render = not toca
        if o.name.startswith('decal_') and toca:
            # decalque não leva máscara: esconde se cair na faixa das paredes da frente cortadas
            cx_ = sum(xs) / 8; cz_ = sum(zs) / 8; cy_ = sum(ys) / 8
            na_frente = (cx_ > mx.x - 0.55 or cz_ > mx.z - 0.55) and cy_ > a.get('corte', 99)
            fora = not (mn.x < cx_ < mx.x and mn.z < cz_ < mx.z and mn.y < cy_ < min(mx.y, a.get('topo', 99)))
            o.hide_render = na_frente or fora
    VAL['minx'].outputs[0].default_value = mn.x
    VAL['maxx'].outputs[0].default_value = mx.x
    VAL['minz'].outputs[0].default_value = mn.z
    VAL['maxz'].outputs[0].default_value = mx.z
    VAL['miny'].outputs[0].default_value = mn.y
    VAL['maxy'].outputs[0].default_value = mx.y
    VAL['corte'].outputs[0].default_value = a.get('corte', 99)
    VAL['topo'].outputs[0].default_value = a.get('topo', 99)
    # base: igual a posicionaBase() do passeio.js
    sx, sz = mx.x - mn.x, mx.z - mn.z
    fundo = mn.y + 0.15
    base.scale = (sx + 0.02, sz + 0.02, 0.18)
    base.location = B((mn.x + mx.x) / 2, fundo - 0.09, (mn.z + mx.z) / 2)
    # sem base (como o ICG): a maquete fica solta no fundo e a sombra cai na altura do piso mais baixo que aparece
    base.hide_render = True
    piso = min((min((o.matrix_world @ Vector(c)).z for c in o.bound_box) for o in bpy.data.objects
                if o.type == 'MESH' and not o.hide_render and o.name not in ('base_maquete', 'chao_sombra')), default=fundo)
    chao.location = B((mn.x + mx.x) / 2, max(piso, mn.y) - 0.005, (mn.z + mx.z) / 2)
    # câmera: igual a enquadra()/aplicaVista()
    centro = (mn + mx) / 2
    raio = (mx - mn).length / 2
    asp = min(aspecto, 1.6)
    dist = (raio / math.sin(math.radians(11))) * ((1.05 / asp) if asp < 1 else 0.9) * a.get('zoom', 1)  # igual a enquadra() do passeio.js
    alvo = centro - Vector((0, 0.6, 0))
    pos = alvo + DIR * dist
    cam.location = B(*pos)
    olhar = (B(*alvo) - B(*pos)).normalized()
    cam.rotation_mode = 'QUATERNION'
    cam.rotation_quaternion = olhar.to_track_quat('-Z', 'Y')
    # setViewOffset(0, 10% da altura): conteúdo sobe → deslocamento negativo da câmera
    cam_d.shift_x = 0
    cam_d.shift_y = 0.1 * H / max(W, H)  # o site sobe a imagem o quanto precisar (posicionaImagem)
    t0 = time.time()
    cena.render.filepath = os.path.join(SAIDA, f"maq_{a['id']}{SUFIXO}.webp")
    bpy.ops.render.render(write_still=True)
    log(f"{a['id']}{SUFIXO}: {time.time() - t0:.0f}s → {cena.render.filepath}")
