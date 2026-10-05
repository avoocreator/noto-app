#!/usr/bin/env python3
"""Regenerasi ikon launcher & splash Android Noto dari upload/Noto.png."""
from PIL import Image, ImageDraw
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "upload", "Noto.png")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
DARK = (16, 16, 19, 255)  # #101013

img = Image.open(SRC).convert("RGBA")
bbox = img.getchannel("A").getbbox()
logo = img.crop(bbox)
lw, lh = logo.size


def logo_on(size_ratio, canvas, target_w):
    """Tempatkan logo di tengah canvas dengan lebar target_w piksel."""
    scale = target_w / max(lw, lh)
    w, h = int(lw * scale), int(lh * scale)
    small = logo.resize((w, h), Image.LANCZOS)
    canvas.alpha_composite(small, ((canvas.width - w) // 2, ((canvas.height - h) // 2) + int(canvas.height * 0.03)))
    return canvas


def rounded_tile(size, radius_ratio=0.22):
    tile = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=DARK)
    return tile


# ── Launcher legacy (tile gelap membulat + logo) ──
DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
for dpi, mult in DENSITIES.items():
    base = int(48 * mult)
    # ic_launcher.png (legacy, dengan latar tile)
    tile = rounded_tile(base)
    logo_on(1, tile, int(base * 0.64))
    tile.save(f"{RES}/mipmap-{dpi}/ic_launcher.png")
    tile.save(f"{RES}/mipmap-{dpi}/ic_launcher_round.png")
    # foreground adaptif — transparan, logo di zona aman (62%)
    fg_size = int(108 * mult)
    fg = Image.new("RGBA", (fg_size, fg_size), (0, 0, 0, 0))
    logo_on(1, fg, int(fg_size * 0.52))
    fg.save(f"{RES}/mipmap-{dpi}/ic_launcher_foreground.png")

# ── Splash: latar gelap + logo tengah ──
SPLASHES = []
for f in os.listdir(f"{RES}/drawable"):
    if f.endswith(".png"):
        SPLASHES.append(f"{RES}/drawable/{f}")
for sub in os.listdir(RES):
    if sub.startswith("drawable-land") or sub.startswith("drawable-port"):
        for f in os.listdir(f"{RES}/{sub}"):
            if f.endswith(".png"):
                SPLASHES.append(f"{RES}/{sub}/{f}")

for p in SPLASHES:
    ref = Image.open(p)
    w, h = ref.size
    splash = Image.new("RGBA", (w, h), DARK)
    target = int(min(w, h) * 0.34)
    scale = target / max(lw, lh)
    lw2, lh2 = int(lw * scale), int(lh * scale)
    small = logo.resize((lw2, lh2), Image.LANCZOS)
    splash.alpha_composite(small, ((w - lw2) // 2, (h - lh2) // 2))
    splash.convert("RGB").save(p)
    print("splash:", p.replace(RES + "/", ""), (w, h))

print("Ikon launcher & splash Noto selesai ✓")
