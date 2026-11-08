"""Generates the Gateless logo at the sizes Discord wants.

    python brand/make-logo.py

Writes PNGs into brand/. Everything is drawn at 4x and downscaled with
LANCZOS, which is what gives clean curve edges without a vector renderer.

Design constraints, which drive nearly every decision here:
  - A Discord SERVER icon is cropped to a circle and shown around 48px in the
    sidebar. The mark stays inside a safe circle and uses one bold shape.
  - The APP icon is square at 1024. The background is full-bleed so the same
    art survives either crop.
  - An arch on its own reads as a horseshoe. The threshold bar at the foot is
    what makes it a doorway, and the light inside is what makes it an OPEN
    one — which is the entire name.
"""

import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SS = 4
OUT = 1024
W = OUT * SS

BG_IN = (32, 42, 74)
BG_OUT = (9, 12, 22)
GOLD_TOP = (250, 216, 132)
GOLD_BOT = (214, 124, 48)
PALE = (255, 246, 222)
WARM = (255, 231, 180)   # the light beyond the door, kept gold not white

# Geometry, as fractions of the canvas.
CX = 0.500
HALF = 0.248          # half-width of the opening, outer edge
TOP = 0.212           # top of the arch head
FOOT = 0.760          # where the legs stop
THICK = 0.078         # wall thickness
SILL_Y = 0.775        # threshold bar
SILL_HALF = 0.300
SILL_H = 0.048
APEX = 0.205          # where a pointed head must stop, to clear the circle crop


def px(v):
    return int(round(v * W))


def radial_background():
    y, x = np.mgrid[0:W, 0:W].astype(np.float32)
    c = (W - 1) / 2.0
    r = np.sqrt((x - c) ** 2 + (y - c) ** 2) / (W * 0.70)
    t = np.clip(r, 0, 1)[..., None]
    img = np.array(BG_IN, np.float32) * (1 - t) + np.array(BG_OUT, np.float32) * t
    return Image.fromarray(img.astype(np.uint8), 'RGB')


def vertical_gradient(top, bottom):
    t = np.linspace(0, 1, W, dtype=np.float32)[:, None, None]
    img = np.array(top, np.float32) * (1 - t) + np.array(bottom, np.float32) * t
    return Image.fromarray(np.repeat(img.astype(np.uint8), W, axis=1), 'RGB')


def round_arch(half, top, foot):
    """Romanesque: semicircular head on straight legs."""
    m = Image.new('L', (W, W), 0)
    ImageDraw.Draw(m).rounded_rectangle(
        [px(CX) - half, top, px(CX) + half, foot],
        radius=half, corners=(True, True, False, False), fill=255)
    return np.array(m, np.float32) / 255.0


def gothic_arch(half, springing, foot, offset):
    """Pointed: a drop arch, built in numpy because Pillow has no bezier.

    The arcs are struck from centres INSIDE the span, at cx +/- offset, each
    with radius (half + offset) so it reaches the opposite springing point.

    That last part is what I got wrong first time. With the centres sitting
    on the springing points, the radius needed to put the apex at a given
    height was shorter than the span, so the head never met the legs and
    floated above two disconnected posts.

      offset = half  ->  equilateral, a sharp point
      offset = 0     ->  a plain semicircle
    """
    y, x = np.mgrid[0:W, 0:W].astype(np.float32)
    cx = px(CX)
    r = half + offset
    left = np.sqrt((x - (cx - offset)) ** 2 + (y - springing) ** 2)
    right = np.sqrt((x - (cx + offset)) ** 2 + (y - springing) ** 2)
    head = (left <= r) & (right <= r) & (y <= springing)
    legs = (np.abs(x - cx) <= half) & (y > springing) & (y <= foot)
    return (head | legs).astype(np.float32)


def offset_for_apex(half, springing, apex):
    """How far in to place the arc centres so the point lands on `apex`.

    rise**2 = r**2 - offset**2, with r = half + offset, solves to this.
    """
    rise = springing - apex
    return max(0.0, (rise ** 2 - half ** 2) / (2.0 * half))


def build(pointed=False):
    base = radial_background()
    gold = vertical_gradient(GOLD_TOP, GOLD_BOT)

    half, thick = px(HALF), px(THICK)
    top, foot = px(TOP), px(FOOT)

    if pointed:
        # Springs low so the point has room to rise without leaving the
        # circle crop; the offset is solved so the apex lands on APEX.
        springing = px(0.560)
        offset = offset_for_apex(half, springing, px(APEX))
        outer = gothic_arch(half, springing, foot, offset)
        inner = gothic_arch(half - thick, springing, foot + thick, offset)
    else:
        outer = round_arch(half, top, foot)
        inner = round_arch(half - thick, top + thick, foot + thick)

    ring = np.clip(outer - inner, 0, 1)
    opening = np.clip(inner, 0, 1)

    # Light beyond the doorway: a warm pool low in the opening, so the arch
    # reads as something you walk through rather than a filled shape.
    y, x = np.mgrid[0:W, 0:W].astype(np.float32)
    d = np.sqrt((x - px(CX)) ** 2 + (y - px(0.70)) ** 2) / (W * 0.33)
    pool = np.clip(1.0 - d, 0, 1) ** 1.6
    lit = (np.array(base, np.float32)
           + np.array(WARM, np.float32) * (pool * opening * 0.80)[..., None])
    base = Image.fromarray(np.clip(lit, 0, 255).astype(np.uint8))

    ring_img = Image.fromarray((ring * 255).astype(np.uint8))

    # Threshold. Without it the arch is a horseshoe.
    sill = Image.new('L', (W, W), 0)
    ImageDraw.Draw(sill).rounded_rectangle(
        [px(CX - SILL_HALF), px(SILL_Y), px(CX + SILL_HALF), px(SILL_Y + SILL_H)],
        radius=px(SILL_H / 2), fill=255)

    mark = Image.fromarray(np.maximum(np.array(ring_img), np.array(sill)))

    halo = mark.filter(ImageFilter.GaussianBlur(W * 0.026))
    halo = Image.fromarray((np.array(halo, np.float32) * 0.36).clip(0, 255).astype(np.uint8))
    base = Image.composite(Image.new('RGB', (W, W), PALE), base, halo)
    base.paste(gold, (0, 0), mark)
    return base


def save(img, name):
    for size in (1024, 512):
        path = os.path.join(HERE, f'{name}-{size}.png')
        img.resize((size, size), Image.LANCZOS).save(path, 'PNG', optimize=True)
        print(f'  {os.path.basename(path):30s} {os.path.getsize(path) // 1024} KB')


if __name__ == '__main__':
    # The pointed arch is the one in use. The round one is kept because it is
    # a one-line change away, not because anything references it.
    print('gateless-icon        pointed arch - the live server and app icon')
    save(build(pointed=True), 'gateless-icon')
    print('gateless-alt-round   round arch - alternate, unused')
    save(build(pointed=False), 'gateless-alt-round')
