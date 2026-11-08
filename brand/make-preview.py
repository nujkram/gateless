"""Contact sheet: how each mark actually looks where it gets used.

    python brand/make-preview.py

Full square (the app icon), circle-cropped (the server icon), and 48px
(the sidebar). The 48px cell is the one that decides it.
"""

import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
VARIANTS = [('gateless-icon', 'In use  -  pointed arch'), ('gateless-alt-round', 'Alternate  -  round arch')]
BG = (24, 26, 33)
INK = (226, 230, 238)
DIM = (140, 148, 163)


def circle(img, size):
    img = img.resize((size, size), Image.LANCZOS)
    mask = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size * 4 - 1, size * 4 - 1], fill=255)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask.resize((size, size), Image.LANCZOS))
    return out


def font(sz):
    try:
        return ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', sz)
    except OSError:
        return ImageFont.load_default()


PAD, BIG, MID = 36, 220, 128
row_h = BIG + 86
sheet = Image.new('RGB', (PAD * 2 + BIG + MID + 48 * 3 + 160, PAD * 2 + row_h * len(VARIANTS)), BG)
d = ImageDraw.Draw(sheet)

for i, (name, label) in enumerate(VARIANTS):
    src = Image.open(os.path.join(HERE, f'{name}-1024.png')).convert('RGB')
    y = PAD + i * row_h
    d.text((PAD, y), label, font=font(22), fill=INK)
    y += 34

    sheet.paste(src.resize((BIG, BIG), Image.LANCZOS), (PAD, y))
    d.text((PAD, y + BIG + 8), 'app icon, square', font=font(15), fill=DIM)

    x = PAD + BIG + 40
    sheet.paste(circle(src, MID), (x, y + (BIG - MID) // 2), circle(src, MID))
    d.text((x, y + BIG + 8), 'server icon, circle', font=font(15), fill=DIM)

    x += MID + 48
    for j, px in enumerate((48, 32, 20)):
        sheet.paste(circle(src, px), (x, y + (BIG - px) // 2), circle(src, px))
        d.text((x - 4, y + BIG + 8), f'{px}px', font=font(15), fill=DIM)
        x += px + 42

out = os.path.join(HERE, 'preview.png')
sheet.save(out, 'PNG', optimize=True)
print(f'{os.path.basename(out)}  {sheet.size[0]}x{sheet.size[1]}  {os.path.getsize(out)//1024} KB')
