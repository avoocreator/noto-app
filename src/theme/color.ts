// Konversi OKLCH ⇄ sRGB, pemetaan gamut, dan kontras WCAG. Semua murni (tanpa DOM).

export type RGB = [number, number, number]; // 0..255

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

const toSrgb = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
const toLinear = (x: number) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));

/** OKLCH → sRGB linear (bisa keluar gamut). */
function oklchToLinear(L: number, C: number, hDeg: number): RGB {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb: RGB) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);

/** OKLCH → RGB 0..255; bila di luar gamut, chroma dikurangi (hue & lightness dipertahankan). */
export function oklchToRgb(L: number, C: number, h: number): RGB {
  let lin = oklchToLinear(L, C, h);
  if (!inGamut(lin)) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear(L, mid, h))) lo = mid;
      else hi = mid;
    }
    lin = oklchToLinear(L, lo, h);
  }
  return lin.map((v) => Math.round(clamp01(toSrgb(clamp01(v))) * 255)) as RGB;
}

export function rgbToOklch([r, g, b]: RGB): { L: number; C: number; h: number } {
  const lr = toLinear(r / 255);
  const lg = toLinear(g / 255);
  const lb = toLinear(b / 255);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(a, bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C, h: C < 1e-4 ? 0 : h };
}

export function rgbToHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export const oklchHex = (L: number, C: number, h: number) => rgbToHex(oklchToRgb(L, C, h));

export function luminance([r, g, b]: RGB): number {
  const f = (v: number) => toLinear(v / 255);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function contrastHex(a: string, b: string): number {
  return contrast(hexToRgb(a)!, hexToRgb(b)!);
}

/**
 * Geser lightness `fg` sampai kontras terhadap `bg` ≥ min. Arah geser mengikuti
 * apakah bg terang (gelapkan fg) atau gelap (terangkan fg).
 */
export function ensureContrast(fg: { L: number; C: number; h: number }, bgHex: string, min: number): string {
  const bg = hexToRgb(bgHex)!;
  const dark = luminance(bg) < 0.4;
  let L = fg.L;
  for (let i = 0; i < 60; i++) {
    const hex = oklchHex(L, fg.C, fg.h);
    if (contrast(hexToRgb(hex)!, bg) >= min) return hex;
    L = dark ? Math.min(1, L + 0.015) : Math.max(0, L - 0.015);
  }
  return dark ? '#ffffff' : '#000000';
}
