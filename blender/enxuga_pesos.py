"""Deixa o passeio mais leve no primeiro carregamento (meta: menos de 6 MB).

- regrava as texturas JPEG de dentro do clinica.glb com qualidade menor (o granito e a calçada
  têm muito grão e pesam 400–530 KB cada com a qualidade padrão do Blender);
- regrava os mapas de oclusão (ao_*.webp) e de luz (luz_*.webp): móveis com metade da resolução
  (aparecem pequenos na tela) e todos com qualidade menor.

Não muda a geometria nem os nomes, só o peso das imagens. Pode rodar mais de uma vez.
uso: python blender/enxuga_pesos.py site/passeio/modelos
"""
import io
import json
import os
import struct
import sys

from PIL import Image

pasta = sys.argv[1] if len(sys.argv) > 1 else 'site/passeio/modelos'
Q_JPEG = 74       # texturas de piso, fachada e madeira
Q_MAPA = 80       # mapas de luz e oclusão (são suaves, aguentam bem)


def enxuga_glb(caminho):
    b = open(caminho, 'rb').read()
    magic, versao, _ = struct.unpack('<4sII', b[:12])
    assert magic == b'glTF' and versao == 2
    n_json = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + n_json])
    p_bin = 20 + n_json
    n_bin = struct.unpack('<I', b[p_bin:p_bin + 4])[0]
    binario = b[p_bin + 8:p_bin + 8 + n_bin]

    trocas = {}
    for im in j.get('images', []):
        if im.get('mimeType') != 'image/jpeg' or im.get('bufferView') is None:
            continue
        bv = j['bufferViews'][im['bufferView']]
        ini = bv.get('byteOffset', 0)
        dados = binario[ini:ini + bv['byteLength']]
        buf = io.BytesIO()
        Image.open(io.BytesIO(dados)).convert('RGB').save(buf, 'JPEG', quality=Q_JPEG, optimize=True, progressive=True)
        if buf.tell() < len(dados):
            trocas[im['bufferView']] = buf.getvalue()

    # remonta o bloco binário com os novos tamanhos (alinhado de 4 em 4 bytes)
    novo = bytearray()
    for i, bv in enumerate(j['bufferViews']):
        ini = bv.get('byteOffset', 0)
        dados = trocas.get(i, binario[ini:ini + bv['byteLength']])
        while len(novo) % 4:
            novo.append(0)
        bv['byteOffset'] = len(novo)
        bv['byteLength'] = len(dados)
        novo += dados
    while len(novo) % 4:
        novo.append(0)
    j['buffers'][0]['byteLength'] = len(novo)

    js = json.dumps(j, separators=(',', ':')).encode('utf-8')
    js += b' ' * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(novo)
    saida = struct.pack('<4sII', b'glTF', 2, total) + struct.pack('<I4s', len(js), b'JSON') + js \
        + struct.pack('<I4s', len(novo), b'BIN\x00') + bytes(novo)
    antes = len(b)
    open(caminho, 'wb').write(saida)
    print(f'glb: {antes / 1e6:.2f} MB → {len(saida) / 1e6:.2f} MB ({len(trocas)} texturas regravadas)')


def enxuga_mapas(pasta):
    antes = depois = 0
    for nome in sorted(os.listdir(pasta)):
        if not (nome.startswith(('ao_', 'luz_')) and nome.endswith('.webp')):
            continue
        c = os.path.join(pasta, nome)
        antes += os.path.getsize(c)
        im = Image.open(c)
        im.load()
        if '_moveis' in nome and im.width > 512:
            im = im.resize((512, 512), Image.LANCZOS)
        modo = 'L' if nome.startswith('ao_') else 'RGB'
        im.convert(modo).convert('RGB').save(c, 'WEBP', quality=Q_MAPA, method=6)
        depois += os.path.getsize(c)
    print(f'mapas: {antes / 1e6:.2f} MB → {depois / 1e6:.2f} MB')


enxuga_glb(os.path.join(pasta, 'clinica.glb'))
enxuga_mapas(pasta)
