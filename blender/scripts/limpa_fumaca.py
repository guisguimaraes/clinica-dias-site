# Tira as manchas de sombra soltas acima da maquete renderizada (coluna por coluna, acima do primeiro pixel opaco).
# Roda sozinho no fim do roda_final.ps1. uso: python blender/scripts/limpa_fumaca.py <maquetes.webp...>
import sys, numpy as np
from PIL import Image
for p in sys.argv[1:]:
    im = Image.open(p).convert('RGBA'); a = np.array(im)
    al = a[..., 3].astype(int)
    opaco = al > 200
    tem = opaco.any(0)
    topo = np.where(tem, opaco.argmax(0), -1)
    ys = np.arange(al.shape[0])[:, None]
    acima = (ys < (topo[None, :] - 4)) & tem[None, :]
    alvo = acima & (al > 0) & (al < 200)
    n = int(alvo.sum())
    a[..., 3][alvo] = 0
    Image.fromarray(a).save(p, 'WEBP', quality=90, method=6)
    print(p, n, 'pixels limpos')
