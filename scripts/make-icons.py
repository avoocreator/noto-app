#!/usr/bin/env python3
"""Generate ikon PWA Noto dari logo Noto.png (sudah transparan / RGBA).

- Ikon 'any' (icon-192/512, favicon, logo-64) : latar TRANSPARAN.
- apple-touch-icon & maskable                 : latar gelap solid (iOS & maskable
  tidak menyukai transparansi — iOS akan merender transparan sebagai hitam).
"""
from PIL import Image
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "upload", "Noto.png")
OUT = os.path.join(ROOT, "public", "icons")
DARK_BG = (16, 16, 19, 255)  # #101013 — warna dasar tema Noto Gelap
os.makedirs(OUT, exist_ok=True)

img = Image.open(SRC).convert("RGBA")
print("sumber:", img.size, img.mode)

# Potong mengikuti bounding box alpha (area tidak-transparan)
alpha = img.getchannel("A")
bbox = alpha.getbbox()
print("bbox logo:", bbox)
logo = img.crop(bbox) if bbox else img
lw, lh = logo.size
print("logo dipotong:", logo.size)


def compose(size: int, ratio: float, bg=None) -> Image.Image:
    """Logo di tengah kanvas `size`x`size`, lebar = `ratio` dari kanvas.
    bg=None → transparan; bg=(r,g,b,a) → latar solid."""
    if bg:
        canvas = Image.new("RGBA", (size, size), bg)
    else:
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    target = int(size * ratio)
    scale = target / max(lw, lh)
    w, h = int(lw * scale), int(lh * scale)
    resized = logo.resize((w, h), Image.LANCZOS)
    canvas.alpha_composite(resized, ((size - w) // 2, (size - h) // 2))
    return canvas


# Ikon PWA 'any' — transparan, logo besar
compose(512, 0.86).save(f"{OUT}/icon-512.png", optimize=True)
compose(192, 0.86).save(f"{OUT}/icon-192.png", optimize=True)

# Maskable — latar solid, logo kecil di zona aman (66%)
compose(512, 0.62, DARK_BG).save(f"{OUT}/maskable-512.png", optimize=True)

# Apple touch icon (iOS menambahkan sudutnya sendiri) — solid
compose(180, 0.82, DARK_BG).save(f"{OUT}/apple-touch-icon.png", optimize=True)

# Logo chip kecil untuk header/UI — transparan
compose(64, 0.88).save(f"{OUT}/logo-64.png", optimize=True)
compose(128, 0.88).save(f"{OUT}/logo-128.png", optimize=True)

# Favicon .ico (16/32/48) — RGBA agar valid sebagai ICO
fav = compose(48, 0.92)
fav.save(os.path.join(ROOT, "src", "app", "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])

# Salin favicon juga ke public untuk SW/manifest
fav.save(f"{OUT}/favicon-48.png", optimize=True)

for f in sorted(os.listdir(OUT)):
    p = os.path.join(OUT, f)
    im = Image.open(p)
    print(f"{f}: {os.path.getsize(p)//1024} KB mode={im.mode} size={im.size}")
print("Selesai")
