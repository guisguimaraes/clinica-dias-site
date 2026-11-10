# Desenha uma grade de 1 m (com números) por cima da "planta layout", para ler a posição dos móveis em metros.
# uso: python -I grade_layout.py <png_da_pagina> <dpi> <origem_x_pt> <origem_y_pt> <pt_por_m> <largura_m> <fundo_m> <saida.png>
import sys
import cv2

png, dpi, ox, oy, ppm, L, F, saida = sys.argv[1], float(sys.argv[2]), *map(float, sys.argv[3:8]), sys.argv[8]
im = cv2.imread(png)
k = dpi / 72
px = lambda x: int((ox + x * ppm) * k)
pz = lambda z: int((oy + z * ppm) * k)
x0, x1, z0, z1 = px(-0.5), px(L + 0.5), pz(-0.5), pz(F + 0.5)
c = im[max(0, z0):z1, max(0, x0):x1].copy()
cor = (0, 120, 255)
for x in range(0, int(L) + 1):
    xx = px(x) - x0
    cv2.line(c, (xx, 0), (xx, c.shape[0]), cor if x % 5 else (0, 0, 220), 1)
    if x % 2 == 0:
        cv2.putText(c, str(x), (xx + 2, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 220), 1)
for z in range(0, int(F) + 1):
    zz = pz(z) - z0
    cv2.line(c, (0, zz), (c.shape[1], zz), cor if z % 5 else (0, 0, 220), 1)
    cv2.putText(c, str(z), (2, zz - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 220), 1)
cv2.imwrite(saida, c)
print(saida, c.shape)
