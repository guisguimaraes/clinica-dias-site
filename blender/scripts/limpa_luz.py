"""Tira o chiado dos mapas de luz (luz_*.webp) e de oclusão (ao_*.webp) que o Blender calcula.

O bake do Cycles não passa denoiser; com 48 amostras cada parede sai granulada e no passeio
isso vira mancha. Aqui: NLM (alisa o grão e respeita bordas/sombras de contato) e depois um
desfoque que só mistura pixels do mesmo pedaço do atlas (o fundo preto entre as ilhas não vaza).

uso: python blender/scripts/limpa_luz.py <pasta_modelos> [pasta_origem]
  pasta_origem: de onde ler os mapas crus (padrão: a própria pasta; grava por cima).
"""
import os
import sys

import cv2
import json

import numpy as np

pasta = sys.argv[1] if len(sys.argv) > 1 else 'site/passeio/modelos'
origem = sys.argv[2] if len(sys.argv) > 2 else pasta


def mapas_desta_rodada(pasta):
    """Só os mapas que o Blender acabou de gravar (listados no luz.json). Os outros já foram limpos numa rodada
    anterior; regravar de novo só perde qualidade."""
    try:
        with open(os.path.join(pasta, 'luz.json'), encoding='utf-8') as f:
            j = json.load(f)
    except (OSError, ValueError):
        return set()
    return {f'luz_{g}.webp' for g in j.get('grupos', [])} | {f'ao_{g}.webp' for g in j.get('ao', [])}


def limpa(im, forca, sigma):
    d = cv2.fastNlMeansDenoisingColored(im, None, forca, forca, 7, 31)
    # desfoque normalizado: pesa só pixels "dentro" das ilhas (o fundo do atlas é preto puro)
    mascara = (im.max(axis=2) > 3).astype(np.float32)
    k = (0, 0)
    num = cv2.GaussianBlur(d.astype(np.float32) * mascara[..., None], k, sigma)
    den = cv2.GaussianBlur(mascara, k, sigma)[..., None]
    suave = np.where(den > 1e-3, num / np.maximum(den, 1e-3), d)
    return np.clip(suave, 0, 255).astype(np.uint8)


n = 0
feitos = mapas_desta_rodada(pasta)
for nome in sorted(os.listdir(origem)):
    if not nome.endswith('.webp') or nome not in feitos:
        continue
    if nome.startswith('luz_'):
        forca, sigma = 24, 1.6
    elif nome.startswith('ao_'):
        forca, sigma = 14, 1.0
    else:
        continue
    im = cv2.imread(os.path.join(origem, nome), cv2.IMREAD_COLOR)
    out = limpa(im, forca, sigma)
    cv2.imwrite(os.path.join(pasta, nome), out, [cv2.IMWRITE_WEBP_QUALITY, 82])
    n += 1
print(f'limpa_luz: {n} mapas sem chiado')
