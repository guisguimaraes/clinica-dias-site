# Gera os decalques desenhados (não recortados de foto) usados no passeio:
#   decais/placas-medicos.png → quadro bege das placas dos médicos da Recepção 1 (vídeo 0522.mp4, 0:14–0:17)
#   decais/placa-2piso.png    → placa de direção "2º PISO" da Recepção 2 (fotos f10–f12, vídeo 1:16)
# Nomes e especialidades copiados das placas do vídeo, na mesma ordem das três colunas.
# uso: python -I blender/gera_decais.py
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
DEC = os.path.join(AQUI, 'decais')
FONTES = 'C:/Windows/Fonts'
NEGRITO = os.path.join(FONTES, 'ARIALNB.TTF')   # Arial Narrow Bold: as placas usam letra estreita em caixa alta
NORMAL = os.path.join(FONTES, 'ARIALN.TTF')
JOST = os.path.join(AQUI, '..', 'site', 'assets', 'fonts')

# (nome, especialidade, placa branca?) — coluna da esquerda, do meio e da direita, de cima para baixo
COLUNAS = [
    [('DR. DOUGLAS LOURENÇO DIAS', 'CARDIOLOGIA/CLÍNICA MÉDICA', 0), ('DRA. BRUNA S. SILVA COTTAHEM', 'OFTALMOLOGIA', 0),
     ('FERREIRA LOPES', '', 0), ('DRA. GABRIELA F. VIEIRA MACHADO', 'DERMATOLOGISTA', 0),
     ('DR. ANDERSON FRANCO MAGRI', 'ULTRASSONOGRAFIA', 0), ('DR. EMANUEL H. SILVA FRANCO', 'CLÍNICO GERAL', 0),
     ('DR. EDUARDO MOREIRA DE SOUZA', 'ENDOSCOPISTA', 0), ('DR. RAFAEL G. DE OLIVEIRA BARROS', 'REUMATOLOGIA', 0),
     ('DR. EDUARDO DE ABREU BORGES', 'OFTALMOLOGISTA', 1), ('DRA. THAMIRES NAPOLEÃO NOGUEIRA', 'DERMATOLOGISTA', 1),
     ('DR. EMERSON LUIZ DA SILVA', 'PSICOLOGIA', 0), ('DR. BRUNO NUNES RIBEIRO', 'CARDIOLOGISTA', 1),
     ('DR. DIEGO MENDES CARDOSO', 'PSIQUIATRIA', 1), ('DRA. NATÁLIA QUINTÃO BARROS', 'GASTROENTEROLOGISTA', 1)],
    [('DRA. TIARA DE LIMA RIBEIRO', 'CARDIOLOGIA/CLÍNICA MÉDICA', 0), ('DRA. JANE DIAS CARNEIRO', 'MÉDICA DA FAMÍLIA', 1),
     ('DR. FELIPE VITA', 'ORTOPEDISTA', 0), ('DR. LEONARDO PEREIRA TAVARES', 'UROLOGISTA', 1),
     ('DR. DAVIDSON LOURENÇO DIAS', 'OFTALMOLOGISTA', 1), ('DR. AYRTON DOMINGUES', 'CLÍNICO GERAL', 1),
     ('DRA. GISELLE DRUMOND COTA', 'ENDOCRINOLOGIA', 0), ('DRA. MONALISA DOS REIS F. MARQUES', 'GINECOLOGISTA/OBSTETRA', 0),
     ('DRA. YALA CRISTINA D\'AVILA QUINTÃO', 'ENDOCRINOLOGISTA', 1), ('DR. ALEYSSON FABIAN TERRA', 'NEFROLOGISTA', 1),
     ('DR. ADÃO GOMES DE SOUZA', 'PSICOLOGIA', 0), ('DRA. LUANA GOMES', 'NUTRICIONISTA', 0),
     ('DR. FABRÍCIO FREITAS DE OLIVEIRA', 'ORTOPEDISTA', 1), ('DRA. VIVIAN SCARLLETH LOPES OLIVEIRA', 'PROCTOLOGISTA', 1),
     ('DRA. MARIANE DRUMOND FERRER', 'GINECOLOGISTA', 1)],
    [('DR. HUMBERTO DE FREITAS BOY', 'CARDIOLOGISTA', 0), ('DR. DIEGO LOURENÇO DIAS', 'OFTALMOLOGIA', 0),
     ('DR. FELIPE RIBEIRO', 'ORTOPEDISTA', 0), ('DRA. NAIRA M. FRANCO DIAS', 'RADIOLOGIA/ULTRASSONOGRAFIA', 0),
     ('DRA. NAIARA CAMPOS FRANCO', 'GASTROENTEROLOGISTA', 1), ('DRA. SHEILA FRANCO DA SILVEIRA', 'MÉDICA DA FAMÍLIA', 1),
     ('DR. GUERINO DE MARTA', 'MASTOLOGISTA', 0), ('DR. FÁBIO JÚNIOR VIDEIRO B. PAULA', 'PNEUMOLOGISTA', 0),
     ('DR. EDUARDO PEREIRA NASCIMENTO', 'ANGIOLOGISTA E CIRURGIA VASCULAR', 0), ('DR. FELIPE SANTIAGO MENDONÇA', 'PSICÓLOGO', 1),
     ('DRA. PAULA EDUARDA S. M. FRANCO', 'PSICÓLOGA', 0), ('DRA. SABRYNA DAMASCENO', 'NUTRICIONISTA', 0),
     ('DRA. NOELLY MAYRA SILVA DE CARVALHO', 'ENDOCRINOLOGISTA', 1), ('DRA. MÉRCIA MARTINS SOUSA', 'PSICÓLOGA', 1),
     ('DRA. ADRIANA MARIA CAMPOS', 'NUTRICIONISTA', 1)],
]


def cabe(draw, txt, fonte_arq, larg, alt_max):
    """maior fonte (até alt_max px) em que o texto cabe na largura."""
    t = alt_max
    while t > 8:
        f = ImageFont.truetype(fonte_arq, t)
        if draw.textlength(txt, font=f) <= larg:
            return f
        t -= 1
    return ImageFont.truetype(fonte_arq, 8)


def placas_medicos():
    # 1 px = 1 mm: quadro de 1,45 × 2,45 m
    W, H = 1450, 2450
    im = Image.new('RGBA', (W, H), (226, 216, 196, 255))  # MDF bege do vídeo
    d = ImageDraw.Draw(im)
    # leve variação de tom (pintura) e borda mais escura
    d.rectangle([0, 0, W - 1, H - 1], outline=(200, 189, 168, 255), width=6)
    logo = Image.open(os.path.join(DEC, 'logo.png')).convert('RGBA')
    lw = 760
    logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
    im.alpha_composite(logo, ((W - lw) // 2, 40))
    topo, base = 360, H - 70
    col_w, gap = 395, 50
    x0 = (W - (3 * col_w + 2 * gap)) // 2
    linhas = 16
    passo = (base - topo) / linhas
    ph = int(passo * 0.78)
    for c, col in enumerate(COLUNAS):
        x = x0 + c * (col_w + gap)
        # trilho de alumínio da coluna (as placas encaixam nele)
        d.rectangle([x - 14, topo - 10, x - 8, base], fill=(160, 158, 152, 255))
        for i in range(linhas):
            y = int(topo + i * passo)
            if i >= len(col):
                # encaixe vazio: só os dois trilhos curtos
                d.rectangle([x + 4, y + ph // 2 - 30, x + 10, y + ph // 2 + 30], fill=(150, 148, 142, 255))
                continue
            nome, esp, branca = col[i]
            # sombra da placa no quadro
            sombra = Image.new('RGBA', (col_w + 24, ph + 24), (0, 0, 0, 0))
            ImageDraw.Draw(sombra).rectangle([12, 16, col_w + 12, ph + 14], fill=(60, 45, 30, 90))
            sombra = sombra.filter(ImageFilter.GaussianBlur(7))
            im.alpha_composite(sombra, (x - 12, y - 8))
            # moldura de metal escovado e a face (bege metálico ou branca)
            d.rectangle([x, y, x + col_w, y + ph], fill=(176, 174, 168, 255))
            face = (247, 247, 250, 255) if branca else (214, 206, 188, 255)
            d.rectangle([x + 6, y + 6, x + col_w - 6, y + ph - 6], fill=face)
            d.line([x + 6, y + 6, x + col_w - 6, y + 6], fill=(255, 255, 255, 200), width=2)
            tinta = (35, 33, 40, 255)
            if esp:
                f1 = cabe(d, nome, NEGRITO, col_w - 40, 30)
                f2 = cabe(d, esp, NEGRITO, col_w - 40, 24)
                d.text((x + col_w / 2, y + ph * 0.36), nome, font=f1, fill=tinta, anchor='mm')
                d.text((x + col_w / 2, y + ph * 0.7), esp, font=f2, fill=tinta, anchor='mm')
            else:
                f1 = cabe(d, nome, NEGRITO, col_w - 40, 30)
                d.text((x + col_w / 2, y + ph / 2), nome, font=f1, fill=tinta, anchor='mm')
    im.save(os.path.join(DEC, 'placas-medicos.png'))


def placa_2piso():
    # placa branca de 1,62 × 0,40 m: aba laranja "2º PISO" + três setas de direção (vídeo 1:16)
    W, H = 1620, 400
    im = Image.new('RGBA', (W, H), (250, 250, 248, 255))
    d = ImageDraw.Draw(im)
    laranja, azul = (233, 128, 45, 255), (16, 30, 68, 255)
    d.rectangle([0, 0, W - 1, H - 1], outline=(214, 214, 210, 255), width=4)
    d.rectangle([0, 0, 300, 62], fill=laranja)
    d.text((150, 32), '2º PISO', font=ImageFont.truetype(NEGRITO, 44), fill=(255, 255, 255, 255), anchor='mm')
    d.text((340, 32), 'CENTRO DE ESPECIALIDADES', font=ImageFont.truetype(NORMAL, 34), fill=(90, 90, 96, 255), anchor='lm')
    logo = Image.open(os.path.join(DEC, 'logo.png')).convert('RGBA')
    lw = 250
    logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
    im.alpha_composite(logo, (W - lw - 30, 6))
    grupos = [(0, ['ULTRASSOM', 'CONSULTÓRIOS', 'OFTALMOLOGIA']),
              (0, ['CARDIOLOGIA', 'PEDIATRIA', 'LABORATÓRIO']),
              (45, ['ESTRATIFICAÇÃO', 'EXAMES'])]
    ft = ImageFont.truetype(NEGRITO, 46)
    import math

    def seta(cx, cy, giro):
        """seta cheia (haste + ponta), girada em graus no sentido horário a partir de 'para cima'."""
        pts = [(-11, 48), (11, 48), (11, -8), (34, -8), (0, -50), (-34, -8), (-11, -8)]
        a = math.radians(giro)
        d.polygon([(cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)) for x, y in pts], fill=laranja)

    for k, (giro, itens) in enumerate(grupos):
        x = 70 + k * 530
        seta(x + 40, 210, giro)
        for j, txt in enumerate(itens):
            d.text((x + 110, 145 + j * 62), txt, font=ft, fill=azul, anchor='lm')
    im.save(os.path.join(DEC, 'placa-2piso.png'))


def placa_faixas():
    # placa da espera do 2º piso (vídeo 1:32): "2º PISO · SIGA A FAIXA INDICATIVA" e as especialidades com a cor da faixa
    W, H = 1300, 360
    im = Image.new('RGBA', (W, H), (250, 250, 248, 255))
    d = ImageDraw.Draw(im)
    laranja, azul = (233, 128, 45, 255), (16, 30, 68, 255)
    d.rectangle([0, 0, W - 1, H - 1], outline=(214, 214, 210, 255), width=4)
    d.rectangle([0, 0, 280, 70], fill=laranja)
    d.text((140, 36), '2º PISO', font=ImageFont.truetype(NEGRITO, 50), fill=(255, 255, 255, 255), anchor='mm')
    d.text((310, 36), 'SIGA A FAIXA INDICATIVA', font=ImageFont.truetype(NEGRITO, 40), fill=azul, anchor='lm')
    # cores de cada faixa como na placa da foto f27: neuro amarela, cardio vermelha, ultrassom azul,
    # pediatria verde, gineco azul, clínico vermelha; faixa laranja + azul no pé
    cores = {'azul': (24, 40, 92, 255), 'amarelo': (226, 214, 60, 255), 'vermelho': (206, 64, 60, 255), 'verde': (52, 120, 80, 255)}
    itens = [('NEUROLOGIA', 'amarelo'), ('CARDIOLOGIA', 'vermelho'), ('ULTRASSOM', 'azul'),
             ('PEDIATRIA', 'verde'), ('GINECOLOGIA', 'azul'), ('CLÍNICO GERAL', 'vermelho')]
    ft = ImageFont.truetype(NORMAL, 42)
    d.rectangle([310, 14, W - 20, 60], fill=(250, 250, 248, 255))
    d.text((W - 40, 37), 'SIGA A FAIXA INDICATIVA', font=ImageFont.truetype(NORMAL, 34), fill=(120, 120, 126, 255), anchor='rm')
    for k, (txt, cor) in enumerate(itens):
        col, lin = k % 2, k // 2
        x, y = 40 + col * 630, 120 + lin * 70
        d.text((x, y), txt, font=ft, fill=azul, anchor='lm')
        d.rounded_rectangle([x + 330, y - 8, x + 570, y + 8], radius=8, fill=cores[cor])
    d.rectangle([0, H - 26, W * 0.55, H - 14], fill=laranja)
    d.rectangle([W * 0.55, H - 26, W, H - 14], fill=azul)
    im.save(os.path.join(DEC, 'placa-faixas.png'))


def tela_chamadas():
    # TV da espera do 2º piso (f27): quadro azul da chamada atual à esquerda e "ÚLTIMAS CHAMADAS" em vinho
    W, H = 1280, 720
    im = Image.new('RGBA', (W, H), (40, 22, 120, 255))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 34], fill=(30, 40, 200, 255))
    d.rectangle([520, 34, W, H], fill=(112, 26, 52, 255))
    d.rounded_rectangle([20, 70, 500, 470], radius=18, fill=(26, 34, 230, 255))
    f1, f2 = ImageFont.truetype(NEGRITO, 44), ImageFont.truetype(NEGRITO, 34)
    d.text((260, 230), 'CHAMANDO', font=f1, fill=(255, 255, 255, 255), anchor='mm')
    d.rounded_rectangle([110, 280, 410, 300], radius=8, fill=(160, 170, 255, 255))
    d.text((260, 340), 'Consultório 21', font=f2, fill=(220, 225, 255, 255), anchor='mm')
    d.text((900, 90), 'ÚLTIMAS CHAMADAS', font=f1, fill=(255, 255, 255, 255), anchor='mm')
    for k, sala in enumerate(['24', '24', '20', '18']):
        y = 170 + k * 130
        d.rounded_rectangle([560, y, 1010 - k * 30, y + 26], radius=8, fill=(236, 210, 220, 255))  # nome (ilegível de longe)
        d.text((560, y + 62), f'Consultório {sala}', font=f2, fill=(240, 200, 120, 255), anchor='lm')
        d.line([540, y + 104, W - 20, y + 104], fill=(150, 60, 90, 255), width=2)
    im.save(os.path.join(DEC, 'tela-chamadas.png'))


def quadro_acrilico(nome, conteudo):
    # quadro de acrílico com prolongadores de inox (parede da espera do 2º piso, f25 e f27)
    W, H = 600, 1300
    im = Image.new('RGBA', (W, H), (236, 241, 240, 255))
    d = ImageDraw.Draw(im)
    azul, ouro = (22, 36, 72, 255), (205, 160, 70, 255)
    d.polygon([(0, 0), (120, 0), (0, 120)], fill=azul)
    d.polygon([(40, 0), (130, 0), (0, 130), (0, 40)], fill=ouro)
    d.polygon([(W, H), (W - 120, H), (W, H - 120)], fill=azul)
    d.polygon([(W - 40, H), (W - 130, H), (W, H - 130), (W, H - 40)], fill=ouro)
    logo = Image.open(os.path.join(DEC, 'logo.png')).convert('RGBA')
    lw = 240
    logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
    im.alpha_composite(logo, ((W - lw) // 2, 60))
    y = 190
    for kind, txt in conteudo:
        if kind == 't':
            d.text((W / 2, y), txt, font=ImageFont.truetype(NEGRITO, 34), fill=azul, anchor='mm')
            y += 48
        elif kind == 'p':
            f = ImageFont.truetype(NORMAL, 25)
            palavras, linha = txt.split(), ''
            for p in palavras:
                if d.textlength(linha + ' ' + p, font=f) > W - 120:
                    d.text((W / 2, y), linha.strip(), font=f, fill=(60, 64, 80, 255), anchor='mm')
                    y += 32
                    linha = ''
                linha += ' ' + p
            d.text((W / 2, y), linha.strip(), font=f, fill=(60, 64, 80, 255), anchor='mm')
            y += 62
        elif kind == 'c':  # linha colorida (quadro de indicadores)
            cor = txt
            d.rounded_rectangle([80, y, 140, y + 60], radius=8, fill=cor)
            for j in range(3):
                d.rectangle([165, y + 6 + j * 20, W - 90 - j * 60, y + 14 + j * 20], fill=(150, 152, 160, 255))
            y += 92
    for cx, cy in ((34, 34), (W - 34, 34), (34, H - 34), (W - 34, H - 34)):
        d.ellipse([cx - 16, cy - 16, cx + 16, cy + 16], fill=(190, 192, 196, 255), outline=(140, 142, 146, 255), width=3)
    im.save(os.path.join(DEC, nome + '.png'))


def placa_laboratorio():
    # placa laranja de direção da espera do 2º piso (f24): Laboratório e Sala 16 →
    W, H = 600, 360
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    lar = (214, 122, 56, 255)
    d.rounded_rectangle([0, 0, W - 1, H - 1], radius=26, fill=lar)
    d.rectangle([0, 0, 120, H], fill=lar)
    for cy in (95, 265):
        d.ellipse([22, cy - 70, 162, cy + 70], fill=(250, 250, 250, 255))
    # microscópio e olho bem simples
    d.rectangle([80, 60, 98, 125], fill=(40, 40, 50, 255))
    d.rectangle([62, 125, 130, 137], fill=(40, 40, 50, 255))
    d.ellipse([52, 245, 132, 285], outline=(40, 40, 50, 255), width=8)
    d.ellipse([80, 252, 104, 278], fill=(40, 40, 50, 255))
    f = ImageFont.truetype(NEGRITO, 54)
    d.text((200, 95), 'Laboratório', font=f, fill=(255, 255, 255, 255), anchor='lm')
    d.text((200, 265), 'Sala 16', font=f, fill=(255, 255, 255, 255), anchor='lm')
    d.polygon([(500, 160), (540, 180), (500, 200)], fill=(255, 255, 255, 255))
    d.rectangle([460, 172, 505, 188], fill=(255, 255, 255, 255))
    im.save(os.path.join(DEC, 'placa-laboratorio.png'))


def placa_saida():
    W, H = 400, 400
    im = Image.new('RGBA', (W, H), (34, 120, 72, 255))
    d = ImageDraw.Draw(im)
    br = (245, 245, 240, 255)
    d.rectangle([250, 60, 340, 340], outline=br, width=14)  # porta
    d.ellipse([170, 70, 220, 120], fill=br)               # cabeça
    d.line([(195, 125), (175, 220), (210, 300)], fill=br, width=22)
    d.line([(175, 220), (130, 290)], fill=br, width=22)
    d.line([(190, 150), (240, 190)], fill=br, width=18)
    d.polygon([(60, 200), (120, 150), (120, 250)], fill=br)  # seta
    im.save(os.path.join(DEC, 'placa-saida.png'))


tela_chamadas()
quadro_acrilico('quadro-missao', [
    ('t', 'Nosso Negócio'), ('p', '«Soluções inovadoras e integradas em Medicina Especializada.»'),
    ('t', 'Missão'), ('p', 'Nossa missão é acolher e cuidar das pessoas.'),
    ('t', 'Visão'), ('p', 'Ser reconhecida como uma clínica modelo em gestão de excelência, com foco na qualidade assistencial, humanização, sustentabilidade e inovação.'),
    ('t', 'Valores'), ('p', 'Ética · Segurança · Qualidade · Sustentabilidade · Inovação · Sinergia · Disciplina · Cooperação e Resultado · Amor e Compaixão · Alegria · Lealdade')])
quadro_acrilico('quadro-indicadores', [('c', (60, 110, 190, 255)), ('c', (220, 150, 50, 255)), ('c', (70, 150, 90, 255)),
                                       ('c', (200, 70, 70, 255)), ('c', (120, 90, 170, 255)), ('c', (60, 160, 170, 255)),
                                       ('c', (230, 190, 60, 255)), ('c', (90, 100, 120, 255))])
placa_laboratorio()
placa_saida()


placas_medicos()
placa_2piso()
placa_faixas()
print('ok', os.listdir(DEC))
