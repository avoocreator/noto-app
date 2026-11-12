import { ensureContrast, hexToRgb, oklchHex, rgbToOklch, contrastHex } from './color.ts';

export type Mode = 'light' | 'dark';
export type ModePref = Mode | 'system';
export type Harmony = 'analogous' | 'triad' | 'complement' | 'split';
export type RadiusPref = 'sharp' | 'soft' | 'round';
export type Density = 'compact' | 'comfortable';

export interface Preset {
  id: string;
  name: string;
  /** hue + chroma aksen (aksen = pill aktif, tombol cari, fokus) */
  accent: { h: number; c: number; lLight?: number; lDark?: number };
  /** hue untuk 4 warna kartu + pengali chroma masing-masing */
  tints: { h: number; k: number }[];
  neutral: { h: number; c: number };
}

export const PRESETS: Preset[] = [
  {
    id: 'sorbet',
    name: 'Sorbet',
    accent: { h: 350, c: 0.105 },
    tints: [{ h: 92, k: 1 }, { h: 352, k: 0.95 }, { h: 125, k: 0.7 }, { h: 262, k: 0.8 }],
    neutral: { h: 85, c: 0.02 },
  },
  {
    id: 'jeruk',
    name: 'Jeruk',
    accent: { h: 52, c: 0.15 },
    tints: [{ h: 58, k: 1 }, { h: 92, k: 1 }, { h: 22, k: 0.85 }, { h: 200, k: 0.7 }],
    neutral: { h: 70, c: 0.02 },
  },
  {
    id: 'mint',
    name: 'Mint',
    accent: { h: 165, c: 0.11 },
    tints: [{ h: 165, k: 0.9 }, { h: 125, k: 0.85 }, { h: 215, k: 0.7 }, { h: 95, k: 0.9 }],
    neutral: { h: 160, c: 0.014 },
  },
  {
    id: 'lavender',
    name: 'Lavender',
    accent: { h: 300, c: 0.12 },
    tints: [{ h: 300, k: 0.9 }, { h: 340, k: 0.85 }, { h: 255, k: 0.8 }, { h: 195, k: 0.65 }],
    neutral: { h: 295, c: 0.014 },
  },
  {
    id: 'nord',
    name: 'Nord',
    accent: { h: 235, c: 0.09 },
    tints: [{ h: 235, k: 0.7 }, { h: 200, k: 0.6 }, { h: 150, k: 0.55 }, { h: 85, k: 0.7 }],
    neutral: { h: 250, c: 0.012 },
  },
  {
    id: 'mono',
    name: 'Mono',
    accent: { h: 85, c: 0.0, lLight: 0.24, lDark: 0.9 },
    tints: [{ h: 85, k: 0.1 }, { h: 85, k: 0.07 }, { h: 85, k: 0.05 }, { h: 85, k: 0.03 }],
    neutral: { h: 85, c: 0.004 },
  },
];

export const HARMONY_OFFSETS: Record<Harmony, number[]> = {
  analogous: [0, 40, -40, 80],
  triad: [0, 120, 240, 60],
  complement: [0, 180, 30, 210],
  split: [0, 150, 210, 60],
};

export interface ThemeSettings {
  mode: ModePref;
  presetId: string; // id preset atau 'custom'
  customHex: string;
  harmony: Harmony;
  /** 0.4–1.4: seberapa pekat warna kartu */
  intensity: number;
  radius: RadiusPref;
  density: Density;
  /** bentuk dekoratif di kartu */
  decor: boolean;
  fontBody: 'sans' | 'serif' | 'mono';
  reduceMotion: boolean;
}

export const DEFAULT_THEME: ThemeSettings = {
  mode: 'system',
  presetId: 'sorbet',
  customHex: '#e879a8',
  harmony: 'analogous',
  intensity: 1,
  radius: 'round',
  density: 'comfortable',
  decor: true,
  fontBody: 'sans',
  reduceMotion: false,
};

export function resolvePreset(s: Pick<ThemeSettings, 'presetId' | 'customHex' | 'harmony'>): Preset {
  const found = PRESETS.find((p) => p.id === s.presetId);
  if (found) return found;
  const rgb = hexToRgb(s.customHex) ?? [232, 121, 168];
  const { h, c } = rgbToOklch(rgb);
  const base = Math.min(0.17, Math.max(0.05, c));
  const offs = HARMONY_OFFSETS[s.harmony];
  return {
    id: 'custom',
    name: 'Kustom',
    accent: { h, c: base },
    tints: offs.map((o, i) => ({ h: (h + o + 360) % 360, k: i === 0 ? 1 : 0.85 })),
    neutral: { h, c: 0.012 },
  };
}

const RADII: Record<RadiusPref, number[]> = {
  sharp: [6, 9, 12, 16],
  soft: [8, 14, 20, 26],
  round: [10, 18, 26, 34],
};

export interface Tokens {
  [cssVar: string]: string;
}

/** Hasilkan seluruh variabel CSS untuk kombinasi mode + palet. Murni & deterministik. */
export function buildTokens(s: ThemeSettings, mode: Mode): Tokens {
  const p = resolvePreset(s);
  const dark = mode === 'dark';
  const { h: nh, c: nc } = p.neutral;
  const t: Tokens = {};
  const I = s.intensity;

  // netral
  const N = (L: number, k = 1) => oklchHex(L, nc * k, nh);
  const bg = dark ? N(0.17, 0.6) : N(0.968);
  t['--bg'] = bg;
  t['--sidebar'] = dark ? N(0.205, 0.7) : N(0.935, 1.15);
  t['--surface'] = dark ? N(0.24, 0.8) : N(0.925, 1.3);
  t['--surface-2'] = dark ? N(0.285, 0.8) : N(0.895, 1.3);
  t['--raised'] = dark ? N(0.265, 0.7) : N(0.992, 0.4);
  t['--border'] = dark ? N(0.34, 0.8) : N(0.855, 1.1);
  t['--border-strong'] = dark ? N(0.45, 0.8) : N(0.74, 1.1);
  t['--text'] = ensureContrast({ L: dark ? 0.95 : 0.2, C: nc * 0.7, h: nh }, bg, 12);
  t['--text-2'] = ensureContrast({ L: dark ? 0.78 : 0.4, C: nc * 0.7, h: nh }, bg, 7);
  t['--text-3'] = ensureContrast({ L: dark ? 0.66 : 0.52, C: nc * 0.7, h: nh }, bg, 4.5);

  // "ink" = pill hitam di light, krem di dark (mengikuti referensi)
  t['--ink'] = dark ? N(0.93, 0.8) : N(0.17, 0.5);
  t['--ink-fg'] = dark ? N(0.16, 0.6) : N(0.97, 0.8);

  // aksen
  const a = p.accent;
  const aL = dark ? (a.lDark ?? 0.76) : (a.lLight ?? 0.8);
  t['--accent'] = oklchHex(aL, a.c, a.h);
  t['--accent-fg'] = ensureContrast({ L: dark ? 0.18 : 0.2, C: 0.02, h: a.h }, t['--accent'], 7);
  t['--accent-soft'] = oklchHex(dark ? 0.3 : 0.9, a.c * (dark ? 0.55 : 0.55), a.h);
  t['--accent-strong'] = ensureContrast({ L: dark ? 0.78 : 0.55, C: Math.max(a.c * 1.2, 0.02), h: a.h }, bg, 4.5);

  // 4 warna kartu
  p.tints.forEach((tn, i) => {
    const n = i + 1;
    const c = Math.min(0.2, 0.115 * tn.k * I) * (dark ? 0.66 : 1);
    const L = dark ? 0.36 : 0.865;
    const fill = oklchHex(L, c, tn.h);
    t[`--tint-${n}`] = fill;
    t[`--tint-${n}-deep`] = oklchHex(dark ? L + 0.09 : L - 0.1, c * 1.05, tn.h);
    t[`--tint-${n}-soft`] = oklchHex(dark ? 0.28 : 0.93, c * 0.55, tn.h);
    t[`--tint-${n}-fg`] = ensureContrast({ L: dark ? 0.96 : 0.2, C: 0.02 + nc * 0.3, h: tn.h }, fill, 7);
  });

  // 6 warna preset JSON Canvas (merah, oranye, kuning, hijau, cyan, ungu)
  [25, 55, 95, 145, 200, 300].forEach((h, i) => {
    const c = Math.min(0.2, 0.11 * I) * (dark ? 0.66 : 1);
    const fill = oklchHex(dark ? 0.38 : 0.86, p.id === 'mono' ? 0.01 : c, h);
    t[`--c-${i + 1}`] = fill;
    t[`--c-${i + 1}-fg`] = ensureContrast({ L: dark ? 0.96 : 0.2, C: 0.02, h }, fill, 7);
  });

  // status
  const st = (h: number, key: string) => {
    t[`--${key}`] = ensureContrast({ L: dark ? 0.78 : 0.52, C: 0.15, h }, bg, 4.5);
    t[`--${key}-soft`] = oklchHex(dark ? 0.3 : 0.92, 0.05, h);
  };
  st(150, 'ok');
  st(25, 'danger');
  st(75, 'warn');

  const r = RADII[s.radius];
  t['--r-sm'] = `${r[0]}px`;
  t['--r-md'] = `${r[1]}px`;
  t['--r-lg'] = `${r[2]}px`;
  t['--r-xl'] = `${r[3]}px`;
  t['--density'] = s.density === 'compact' ? '0.86' : '1';
  t['--decor'] = s.decor ? '1' : '0';
  t['--shadow'] = dark ? '0 10px 30px rgba(0,0,0,.35)' : `0 10px 30px ${oklchHex(0.3, 0.02, nh)}22`;
  t['--font-body'] =
    s.fontBody === 'serif'
      ? "'Iowan Old Style', 'Palatino Linotype', Georgia, serif"
      : s.fontBody === 'mono'
        ? "'JetBrains Mono Variable', ui-monospace, monospace"
        : "'Plus Jakarta Sans Variable', system-ui, sans-serif";
  return t;
}

/** Ringkasan kontras kritis; dipakai tes & indikator di Pengaturan. */
export function auditContrast(tokens: Tokens): { name: string; ratio: number; min: number }[] {
  const rows: { name: string; a: string; b: string; min: number }[] = [
    { name: 'teks / latar', a: '--text', b: '--bg', min: 7 },
    { name: 'teks / kartu', a: '--text', b: '--surface', min: 7 },
    { name: 'teks-2 / latar', a: '--text-2', b: '--bg', min: 4.5 },
    { name: 'aksen: teks / isi', a: '--accent-fg', b: '--accent', min: 4.5 },
    { name: 'pill ink', a: '--ink-fg', b: '--ink', min: 7 },
  ];
  for (let i = 1; i <= 4; i++) rows.push({ name: `kartu ${i}`, a: `--tint-${i}-fg`, b: `--tint-${i}`, min: 4.5 });
  return rows.map((r) => ({ name: r.name, ratio: contrastHex(tokens[r.a], tokens[r.b]), min: r.min }));
}
