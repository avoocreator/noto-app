#!/usr/bin/env python3
"""Menghasilkan semua aset brand Noto (SVG + PNG). Jalankan: python3 scripts/make-brand.py
Butuh `rsvg-convert` (librsvg) untuk render PNG. Tanpa itu, hanya SVG yang dibuat."""
import os, shutil, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, 'public')
ICONS = os.path.join(PUB, 'icons')
BRAND = os.path.join(ROOT, 'brand')
ANDROID = os.path.join(ROOT, 'native', 'android-widget', 'res')
for d in (PUB, ICONS, BRAND, ANDROID, os.path.join(PUB, 'art')):
    os.makedirs(d, exist_ok=True)

INK, CREAM = '#17130F', '#FAF3E3'
PINK, YELLOW, SAGE, BLUE = '#F5B7D8', '#F3D458', '#A9B879', '#B5C8EE'
HAS_RSVG = shutil.which('rsvg-convert') is not None


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)


def png(svg_path, out_path, w, h=None):
    if not HAS_RSVG:
        return
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    cmd = ['rsvg-convert', '-w', str(w), '-h', str(h or w), svg_path, '-o', out_path]
    subprocess.run(cmd, check=True)


# ── Lambang: huruf "N" tebal dari satu goresan + titik catatan + bintang kecil ──────────────
def mark(fg=CREAM, dot=PINK, star=YELLOW):
    return f'''
  <path d="M152 372 V148 L360 372 V148" fill="none" stroke="{fg}" stroke-width="58"
        stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="392" cy="120" r="30" fill="{dot}"/>
  <path d="M120 112 l9 21 21 9 -21 9 -9 21 -9 -21 -21 -9 21 -9z" fill="{star}"/>'''


def icon_svg(bg=INK, rounded=True, scale=1.0, **kw):
    r = 118 if rounded else 0
    t = f'translate({256 - 256 * scale} {256 - 256 * scale}) scale({scale})'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="{r}" fill="{bg}"/>
  <g transform="{t}">{mark(**kw)}</g>
</svg>
'''


# Logo utama + favicon
write(os.path.join(BRAND, 'logo-mark.svg'), icon_svg())
write(os.path.join(BRAND, 'logo-mark-light.svg'), icon_svg(bg=CREAM, fg=INK, dot='#E879A8', star='#E0B72A'))
write(os.path.join(PUB, 'favicon.svg'), f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <style>@media (prefers-color-scheme: dark){{.bg{{fill:{CREAM}}}.fg{{stroke:{INK}}}}}</style>
  <rect class="bg" width="512" height="512" rx="118" fill="{INK}"/>
  <path class="fg" d="M152 372 V148 L360 372 V148" fill="none" stroke="{CREAM}" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="392" cy="120" r="32" fill="{PINK}"/>
</svg>
''')

# Wordmark (horizontal)
def wordmark(fg=INK, bg=None, w=720, h=240):
    rect = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ''
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">
  {rect}
  <g transform="translate(30 30) scale(0.35)">
    <rect width="512" height="512" rx="118" fill="{INK if fg == INK else CREAM}"/>
    <g>{mark(fg=(CREAM if fg == INK else INK))}</g>
  </g>
  <text x="240" y="152" font-family="Poppins, 'Plus Jakarta Sans', sans-serif" font-weight="700" font-size="124"
        letter-spacing="-4" fill="{fg}">noto</text>
</svg>
'''
write(os.path.join(BRAND, 'wordmark-dark.svg'), wordmark(INK))
write(os.path.join(BRAND, 'wordmark-light.svg'), wordmark(CREAM))

# ── PNG ikon PWA / iOS ─────────────────────────────────────────────────────────────────────
tmp = os.path.join(BRAND, '_tmp')
os.makedirs(tmp, exist_ok=True)
full = os.path.join(BRAND, 'logo-mark.svg')
for size in (48, 64, 128, 192, 512):
    png(full, os.path.join(ICONS, f'icon-{size}.png'), size)
png(full, os.path.join(ICONS, 'favicon-48.png'), 48)

# apple-touch: iOS menerapkan masking sendiri → latar penuh tanpa sudut
apple = os.path.join(tmp, 'apple.svg')
write(apple, icon_svg(rounded=False))
png(apple, os.path.join(ICONS, 'apple-touch-icon.png'), 180)

# maskable: konten di zona aman 80% (scale 0.72)
mask = os.path.join(tmp, 'maskable.svg')
write(mask, icon_svg(rounded=False, scale=0.72))
png(mask, os.path.join(ICONS, 'maskable-512.png'), 512)

# ── Android: ikon launcher adaptif + widget ───────────────────────────────────────────────
fg_svg = os.path.join(tmp, 'fg.svg')
# foreground 108dp: lambang di zona aman (66/108 ≈ 0.61)
write(fg_svg, f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <g transform="translate({256 - 256 * 0.6} {256 - 256 * 0.6}) scale(0.6)">{mark()}</g>
</svg>
''')
legacy = os.path.join(tmp, 'legacy.svg')
write(legacy, icon_svg())
for dens, px in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    d = os.path.join(ANDROID, f'mipmap-{dens}')
    png(legacy, os.path.join(d, 'ic_launcher.png'), px)
    png(legacy, os.path.join(d, 'ic_launcher_round.png'), px)
    png(fg_svg, os.path.join(d, 'ic_launcher_foreground.png'), int(px * 108 / 48))
write(os.path.join(ANDROID, 'values', 'ic_launcher_background.xml'),
      f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">{INK}</color>\n</resources>\n')
write(os.path.join(ANDROID, 'mipmap-anydpi-v26', 'ic_launcher.xml'),
      '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
''')
shutil.copy(os.path.join(ANDROID, 'mipmap-anydpi-v26', 'ic_launcher.xml'),
            os.path.join(ANDROID, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'))

# ── Splash (2732×2732, mark di tengah) ─────────────────────────────────────────────────────
def splash(bg, fgmark):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="{bg}"/>
  <g transform="translate(1066 1066) scale(1.2)">
    <rect width="512" height="512" rx="118" fill="{fgmark[0]}"/>{mark(fg=fgmark[1])}
  </g>
</svg>
'''
sp = os.path.join(tmp, 'splash.svg')
write(sp, splash(CREAM, (INK, CREAM)))
png(sp, os.path.join(BRAND, 'splash.png'), 1366)
spd = os.path.join(tmp, 'splash-dark.svg')
write(spd, splash('#16130F', (CREAM, INK)))
png(spd, os.path.join(BRAND, 'splash-dark.png'), 1366)

# ── Gambar OG 1200×630 ────────────────────────────────────────────────────────────────────
og = os.path.join(BRAND, 'og.svg')
write(og, f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <rect width="1200" height="630" fill="{CREAM}"/>
  <rect x="60" y="60" width="1080" height="510" rx="44" fill="none" stroke="{INK}" stroke-width="4"/>
  <g transform="translate(110 110) scale(0.3)">
    <rect width="512" height="512" rx="118" fill="{INK}"/>{mark()}
  </g>
  <text x="110" y="372" font-family="Poppins, sans-serif" font-weight="700" font-size="70" letter-spacing="-2" fill="{INK}">Catatan &amp; canvas,</text>
  <text x="110" y="452" font-family="Poppins, sans-serif" font-weight="700" font-size="70" letter-spacing="-2" fill="{INK}">di folder milikmu.</text>
  <text x="110" y="518" font-family="Poppins, sans-serif" font-size="26" fill="#6b6256">Vault Markdown lokal-first · Canvas · Widget · Sinkron opsional</text>
  <rect x="860" y="104" width="230" height="110" rx="30" fill="{YELLOW}"/>
  <rect x="900" y="170" width="190" height="110" rx="30" fill="{PINK}"/>
  <rect x="860" y="246" width="150" height="86" rx="28" fill="{SAGE}"/>
</svg>
''')
png(og, os.path.join(PUB, 'og.png'), 1200, 630)

# ── Ikon tray desktop (monokrom, template) ─────────────────────────────────────────────────
tray = os.path.join(BRAND, 'tray.svg')
write(tray, '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <path d="M18 48 V16 L46 48 V16" fill="none" stroke="#000" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
''')
png(tray, os.path.join(ROOT, 'src-tauri', 'icons', 'tray.png'), 64)
for s in (32, 128):
    png(full, os.path.join(ROOT, 'src-tauri', 'icons', f'{s}x{s}.png'), s)
png(full, os.path.join(ROOT, 'src-tauri', 'icons', '128x128@2x.png'), 256)
png(full, os.path.join(ROOT, 'src-tauri', 'icons', 'icon.png'), 512)

# ── Ilustrasi empty-state (pakai currentColor-friendly CSS vars dengan fallback) ──────────
def art(name, body):
    write(os.path.join(PUB, 'art', f'{name}.svg'), f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" fill="none">
{body}
</svg>
''')

T1, T2, T3, T4 = 'var(--tint-1,#F3D458)', 'var(--tint-2,#F5B7D8)', 'var(--tint-3,#A9B879)', 'var(--tint-4,#B5C8EE)'
IK = 'var(--ink,#17130F)'
art('empty-notes', f'''  <rect x="58" y="34" width="124" height="118" rx="22" fill="{T1}"/>
  <rect x="78" y="58" width="60" height="9" rx="4.5" fill="{IK}"/>
  <rect x="78" y="78" width="84" height="7" rx="3.5" fill="{IK}" opacity=".35"/>
  <rect x="78" y="94" width="72" height="7" rx="3.5" fill="{IK}" opacity=".35"/>
  <rect x="78" y="110" width="40" height="7" rx="3.5" fill="{IK}" opacity=".35"/>
  <circle cx="176" cy="44" r="20" fill="{T2}"/>
  <path d="M176 35 v18 M167 44 h18" stroke="{IK}" stroke-width="4" stroke-linecap="round"/>''')
art('empty-tasks', f'''  <rect x="46" y="40" width="148" height="30" rx="15" fill="{T3}"/>
  <rect x="46" y="82" width="148" height="30" rx="15" fill="{T4}"/>
  <rect x="46" y="124" width="148" height="30" rx="15" fill="{T2}"/>
  <circle cx="64" cy="55" r="8" fill="{IK}"/><path d="M60 55 l3 3 6 -6" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="64" cy="97" r="8" stroke="{IK}" stroke-width="2.5"/>
  <circle cx="64" cy="139" r="8" stroke="{IK}" stroke-width="2.5"/>
  <rect x="84" y="51" width="60" height="7" rx="3.5" fill="{IK}" opacity=".45"/>
  <rect x="84" y="93" width="84" height="7" rx="3.5" fill="{IK}" opacity=".45"/>
  <rect x="84" y="135" width="48" height="7" rx="3.5" fill="{IK}" opacity=".45"/>''')
art('empty-canvas', f'''  <path d="M82 70 C 110 70, 110 118, 148 118" stroke="{IK}" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 7"/>
  <rect x="34" y="42" width="64" height="48" rx="14" fill="{T1}"/>
  <rect x="140" y="92" width="68" height="50" rx="14" fill="{T2}"/>
  <rect x="120" y="30" width="46" height="34" rx="12" fill="{T4}"/>
  <circle cx="98" cy="66" r="5" fill="{IK}"/><circle cx="140" cy="118" r="5" fill="{IK}"/>''')
art('empty-search', f'''  <circle cx="106" cy="84" r="40" fill="{T4}"/>
  <circle cx="106" cy="84" r="40" stroke="{IK}" stroke-width="7"/>
  <path d="M136 114 L172 150" stroke="{IK}" stroke-width="11" stroke-linecap="round"/>
  <path d="M92 76 h28 M92 92 h18" stroke="{IK}" stroke-width="5" stroke-linecap="round" opacity=".5"/>''')
art('empty-vault', f'''  <rect x="40" y="62" width="160" height="96" rx="24" fill="{T3}"/>
  <path d="M40 86 a24 24 0 0 1 24 -24 h34 l16 -20 h50 a24 24 0 0 1 24 24 v20 z" fill="{T1}"/>
  <circle cx="120" cy="116" r="18" fill="{IK}"/><path d="M111 116 l7 7 13 -14" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>''')

# ── Pratinjau widget Android 2×2 (untuk widget picker) ────────────────────────────────────
wp = os.path.join(tmp, 'widget-preview.svg')
write(wp, f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">
  <rect width="320" height="320" rx="56" fill="{CREAM}"/>
  <rect x="14" y="14" width="292" height="292" rx="44" fill="{YELLOW}"/>
  <text x="38" y="66" font-family="Poppins, sans-serif" font-weight="700" font-size="26" fill="{INK}">Hari ini</text>
  <circle cx="44" cy="106" r="9" fill="none" stroke="{INK}" stroke-width="3"/>
  <rect x="66" y="99" width="150" height="13" rx="6.5" fill="{INK}" opacity=".7"/>
  <circle cx="44" cy="144" r="9" fill="none" stroke="{INK}" stroke-width="3"/>
  <rect x="66" y="137" width="190" height="13" rx="6.5" fill="{INK}" opacity=".7"/>
  <circle cx="44" cy="182" r="9" fill="{INK}"/>
  <rect x="66" y="175" width="110" height="13" rx="6.5" fill="{INK}" opacity=".35"/>
  <rect x="38" y="236" width="170" height="48" rx="24" fill="{INK}"/>
  <text x="123" y="268" text-anchor="middle" font-family="Poppins, sans-serif" font-weight="600" font-size="20" fill="{CREAM}">＋ Catatan</text>
</svg>
''')
png(wp, os.path.join(ANDROID, 'drawable-nodpi', 'widget_preview.png'), 320)

# ── manifest PWA ─────────────────────────────────────────────────────────────────────────
write(os.path.join(PUB, 'manifest.webmanifest'), '''{
  "name": "Noto",
  "short_name": "Noto",
  "description": "Vault catatan Markdown dan canvas, lokal-first.",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#FAF3E3",
  "theme_color": "#FAF3E3",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "Catatan baru", "url": "./?new=note", "icons": [{ "src": "icons/icon-192.png", "sizes": "192x192" }] },
    { "name": "Tugas baru", "url": "./?new=task", "icons": [{ "src": "icons/icon-192.png", "sizes": "192x192" }] }
  ],
  "share_target": { "action": "./?share=1", "method": "GET", "params": { "title": "title", "text": "text", "url": "url" } }
}
''')

shutil.rmtree(tmp, ignore_errors=True)
print('Aset brand selesai.', '(PNG dilewati: rsvg-convert tidak ada)' if not HAS_RSVG else '')
