"""Baixa os tiles vetoriais (OpenFreeMap, dados OpenStreetMap) que cobrem o Vale do Aço, uma vez só.
uso: python -I baixa_tiles.py <pasta_saida>"""
import math, os, sys, time, urllib.request

Z = 14
S, W, N, E = -19.565, -42.65, -19.45, -42.52
URL = 'https://tiles.openfreemap.org/planet/20261101_080013_pt/{z}/{x}/{y}.pbf'

def tile(lat, lon, z):
    n = 2 ** z
    x = int((lon + 180) / 360 * n)
    y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
    return x, y

saida = sys.argv[1]
os.makedirs(saida, exist_ok=True)
x0, y0 = tile(N, W, Z)
x1, y1 = tile(S, E, Z)
print('tiles', x0, x1, y0, y1, (x1 - x0 + 1) * (y1 - y0 + 1))
for x in range(x0, x1 + 1):
    for y in range(y0, y1 + 1):
        dest = os.path.join(saida, f'{Z}_{x}_{y}.pbf')
        if os.path.exists(dest):
            continue
        req = urllib.request.Request(URL.format(z=Z, x=x, y=y), headers={'User-Agent': 'mapa-estatico/1.0'})
        with urllib.request.urlopen(req, timeout=30) as r:
            open(dest, 'wb').write(r.read())
        time.sleep(0.15)
print('ok')
