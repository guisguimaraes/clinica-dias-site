"""Desenha o mapa do Vale do Aço (dados © OpenStreetMap, via OpenFreeMap/OpenMapTiles) nas cores do site.
uso: python -I desenha.py <pasta_tiles> <saida.webp> <saida.json>"""
import glob, json, math, os, sys
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mvt

Z = 14
S, W, N, E = -19.562, -42.648, -19.458, -42.527
LADO = 2400          # largura final em px
SUPER = 2            # desenha 2x maior e reduz (bordas suaves)

UNIDADES = {
    'timoteo': (-19.54274, -42.62974),
    'fabriciano': (-19.52960, -42.62390),
    'ipatinga': (-19.47516, -42.54862),
}

COR = {
    'fundo': (244, 241, 236),
    'verde': (221, 229, 211),
    'parque': (210, 224, 200),
    'agua': (186, 211, 219),
    'predio': (230, 224, 215),
    'rua': (255, 255, 255),
    'borda': (222, 214, 203),
    'principal': (248, 223, 190),
    'principal_borda': (229, 196, 154),
    'trilho': (190, 184, 176),
}


def merc(lat, lon):
    n = 2 ** Z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


X0, Y0 = merc(N, W)
X1, Y1 = merc(S, E)
ESC = LADO * SUPER / (X1 - X0)
ALTO = int((Y1 - Y0) * ESC)
LARG = LADO * SUPER


def px(tx, ty, ext, p):
    return ((tx + p[0] / ext - X0) * ESC, (ty + p[1] / ext - Y0) * ESC)


def area(anel):
    return sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(anel, anel[1:] + anel[:1])) / 2


img = Image.new('RGB', (LARG, ALTO), COR['fundo'])
d = ImageDraw.Draw(img)
tiles = []
for f in sorted(glob.glob(os.path.join(sys.argv[1], '*.pbf'))):
    _, x, y = os.path.basename(f)[:-4].split('_')
    tiles.append((int(x), int(y), mvt.le(f)))


def poligonos(camada, filtro, cor):
    for tx, ty, c in tiles:
        L = c.get(camada)
        if not L: continue
        for ft in L['features']:
            if ft['tipo'] != 3 or not filtro(ft['props']): continue
            for anel in ft['partes']:
                if len(anel) < 3 or area(anel) <= 0: continue  # só o anel de fora
                d.polygon([px(tx, ty, L['extent'], p) for p in anel], fill=cor)


def linhas(camada, filtro, cor, larg):
    for tx, ty, c in tiles:
        L = c.get(camada)
        if not L: continue
        for ft in L['features']:
            if ft['tipo'] != 2 or not filtro(ft['props']): continue
            for parte in ft['partes']:
                pts = [px(tx, ty, L['extent'], p) for p in parte]
                if len(pts) > 1:
                    d.line(pts, fill=cor, width=int(larg * SUPER), joint='curve')


poligonos('landcover', lambda p: p.get('class') in ('wood', 'grass', 'farmland'), COR['verde'])
poligonos('landuse', lambda p: p.get('class') in ('cemetery', 'pitch', 'stadium'), COR['parque'])
poligonos('park', lambda p: True, COR['parque'])
poligonos('water', lambda p: True, COR['agua'])
linhas('waterway', lambda p: p.get('class') in ('river', 'stream'), COR['agua'], 3)
poligonos('building', lambda p: True, COR['predio'])
menores = ('minor', 'service', 'tertiary', 'secondary')
grandes = ('primary', 'trunk', 'motorway')
linhas('transportation', lambda p: p.get('class') in menores and p.get('brunnel') != 'tunnel', COR['borda'], 5)
linhas('transportation', lambda p: p.get('class') in grandes, COR['principal_borda'], 10)
linhas('transportation', lambda p: p.get('class') == 'minor', COR['rua'], 3)
linhas('transportation', lambda p: p.get('class') in ('service',), COR['rua'], 2)
linhas('transportation', lambda p: p.get('class') in ('tertiary', 'secondary'), COR['rua'], 4.5)
linhas('transportation', lambda p: p.get('class') in grandes, COR['principal'], 7.5)
linhas('transportation', lambda p: p.get('class') == 'rail', COR['trilho'], 2)

img = img.resize((LADO, ALTO // SUPER), Image.LANCZOS)
img.save(sys.argv[2], 'WEBP', quality=80, method=6)

pos = {}
for k, (lat, lon) in UNIDADES.items():
    x, y = merc(lat, lon)
    pos[k] = {'x': round((x - X0) / (X1 - X0) * 100, 2), 'y': round((y - Y0) / (Y1 - Y0) * 100, 2)}
json.dump({'largura': LADO, 'altura': ALTO // SUPER, 'unidades': pos}, open(sys.argv[3], 'w'), indent=1)
print('ok', LADO, ALTO // SUPER, pos)
