"""Turn the OC drawing (gold lines on black) into the background sprites.

Usage: python tools/prepare_oc.py raw_images/oc/OCSitting_v2.png

Writes into assets/:
  oc_sitting.webp  the whole figure (still picture when the animation is off)
  oc_base.webp     the figure without orb, with tail and feet faded out where they move
  oc_tail.webp, oc_foot1.webp, oc_foot2.webp   the moving parts (cropped, see PARTS for offsets)
The orb above her hand is removed and drawn live by app.js.
All coordinates are in the 860 x 860 working size.
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

N = 860
GOLD = np.array([236, 196, 120.0])

# moving parts: polygon of the area that moves, feather radius
PARTS = {
    "tail": ([(0, 88), (246, 88), (246, 300), (236, 360), (215, 425), (0, 425)], 7),
    "foot1": ([(108, 432), (176, 430), (196, 458), (196, 500), (176, 520), (150, 540), (108, 520)], 5),   # raised foot
    "foot2": ([(178, 588), (262, 584), (282, 600), (282, 640), (250, 656), (178, 652)], 5),              # lower foot
}
ORB = (258, 76, 446, 168)          # box of the drawn orb, erased
ORB_LOW = (339, 168, 373, 175)     # the little cube under the ring
PILLARS = [(333, 341), (376, 384)]  # vertical pillar lines behind the orb, restored after erasing


def to_rgba(path):
    im = Image.open(path).convert("RGB")
    im = im.resize((N, round(N * im.size[1] / im.size[0])), Image.LANCZOS).crop((0, 0, N, N))
    a = np.asarray(im).astype(float)
    lum = a.max(2)
    al = np.clip((lum - 24) / 130, 0, 1) ** 0.85
    fx = np.clip(np.linspace(0, 1, N) / 0.14, 0, 1) ** 1.5      # soft left edge
    fy = np.clip(np.linspace(0, 1, N) / 0.02, 0, 1)
    al = al * fx[None, :] * fy[:, None]
    col = a / np.maximum(lum[..., None], 1)
    rgb = np.clip(0.55 * col * 255 + 0.45 * GOLD, 0, 255)
    return np.dstack([rgb, al * 255])


def mask(poly, feather):
    m = Image.new("L", (N, N), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    return np.asarray(m.filter(ImageFilter.GaussianBlur(feather))).astype(float) / 255


def save(arr, path):
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA").save(path, quality=90, method=6)


def main(src):
    full = to_rgba(src)
    save(full, "assets/oc_sitting.webp")
    base = full.copy()
    # orb out, pillar lines back in (copied from just above the orb)
    x0, y0, x1, y1 = ORB
    base[y0:y1, x0:x1, 3] = 0
    lx0, ly0, lx1, ly1 = ORB_LOW
    base[ly0:ly1, lx0:lx1, 3] = 0
    for a, b in PILLARS:
        base[y0:y1, a:b] = full[y0 - 6:y0 - 5, a:b]
    for name, (poly, fe) in PARTS.items():
        m = mask(poly, fe)
        part = full.copy()
        part[..., 3] *= m
        base[..., 3] *= 1 - m
        ys, xs = np.where(part[..., 3] > 1)
        bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        save(part[by0:by1, bx0:bx1], f"assets/oc_{name}.webp")
        print(f"{name}: x={bx0} y={by0} w={bx1 - bx0} h={by1 - by0}")
    save(base, "assets/oc_base.webp")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "raw_images/oc/OCSitting_v2.png")
