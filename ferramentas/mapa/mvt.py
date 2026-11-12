"""Leitor mínimo de Mapbox Vector Tiles (protobuf), sem dependências."""
import gzip, struct


def _varint(b, i):
    r = s = 0
    while True:
        c = b[i]; i += 1
        r |= (c & 0x7F) << s
        if c < 0x80:
            return r, i
        s += 7


def _campos(b):
    i, n = 0, len(b)
    while i < n:
        k, i = _varint(b, i)
        f, t = k >> 3, k & 7
        if t == 0:
            v, i = _varint(b, i)
        elif t == 1:
            v = b[i:i + 8]; i += 8
        elif t == 2:
            ln, i = _varint(b, i)
            v = b[i:i + ln]; i += ln
        elif t == 5:
            v = b[i:i + 4]; i += 4
        else:
            raise ValueError('tipo protobuf %d' % t)
        yield f, t, v


def _empacotado(b):
    i, out = 0, []
    while i < len(b):
        v, i = _varint(b, i)
        out.append(v)
    return out


def _valor(b):
    for f, t, v in _campos(b):
        if f == 1: return v.decode('utf-8', 'replace')
        if f == 2: return struct.unpack('<f', v)[0]
        if f == 3: return struct.unpack('<d', v)[0]
        if f in (4, 5): return v
        if f == 6: return (v >> 1) ^ -(v & 1)
        if f == 7: return bool(v)
    return None


def _geometria(cmds):
    """Lista de anéis/linhas em coordenadas do tile."""
    partes, atual, x, y, i = [], [], 0, 0, 0
    while i < len(cmds):
        c = cmds[i]; i += 1
        cid, cnt = c & 7, c >> 3
        if cid == 7:
            if atual: atual.append(atual[0])
            continue
        for _ in range(cnt):
            dx, dy = cmds[i], cmds[i + 1]; i += 2
            x += (dx >> 1) ^ -(dx & 1)
            y += (dy >> 1) ^ -(dy & 1)
            if cid == 1:
                if atual: partes.append(atual)
                atual = [(x, y)]
            else:
                atual.append((x, y))
    if atual: partes.append(atual)
    return partes


def le(caminho):
    b = open(caminho, 'rb').read()
    if b[:2] == b'\x1f\x8b':
        b = gzip.decompress(b)
    camadas = {}
    for f, t, v in _campos(b):
        if f != 3: continue
        nome, feats, chaves, valores, extent = '', [], [], [], 4096
        for g, _, w in _campos(v):
            if g == 1: nome = w.decode()
            elif g == 2: feats.append(w)
            elif g == 3: chaves.append(w.decode())
            elif g == 4: valores.append(_valor(w))
            elif g == 5: extent = w
        lista = []
        for fb in feats:
            tags, tipo, geo = [], 0, []
            for g, _, w in _campos(fb):
                if g == 2: tags = _empacotado(w)
                elif g == 3: tipo = w
                elif g == 4: geo = _empacotado(w)
            props = {chaves[tags[k]]: valores[tags[k + 1]] for k in range(0, len(tags), 2)}
            lista.append({'tipo': tipo, 'props': props, 'partes': _geometria(geo)})
        camadas[nome] = {'extent': extent, 'features': lista}
    return camadas
