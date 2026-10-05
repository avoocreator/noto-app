// ── Sistem tema Noto: 8 mode warna + aksen kustom ──────────────────
export interface ThemeVars {
  background: string
  foreground: string
  card: string
  cardForeground: string
  popover: string
  popoverForeground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  border: string
  input: string
  ring: string
  destructive: string
  canvasDots: string
}

export interface ThemePreset {
  id: string
  name: string
  appearance: 'dark' | 'light'
  desc: string
  vars: ThemeVars
}

const t = (
  background: string, foreground: string, card: string, primary: string,
  primaryForeground: string, mutedForeground: string, border: string,
  appearance: 'dark' | 'light',
  extra?: Partial<ThemeVars>,
): ThemeVars => ({
  background,
  foreground,
  card,
  cardForeground: foreground,
  popover: extra?.popover ?? card,
  popoverForeground: foreground,
  primary,
  primaryForeground,
  secondary: extra?.secondary ?? card,
  secondaryForeground: extra?.secondaryForeground ?? foreground,
  muted: extra?.muted ?? card,
  mutedForeground,
  accent: extra?.accent ?? card,
  accentForeground: foreground,
  border,
  input: extra?.input ?? border,
  ring: primary,
  destructive: extra?.destructive ?? '#ef4444',
  canvasDots: extra?.canvasDots ?? border,
})

export const THEMES: ThemePreset[] = [
  {
    id: 'noto-dark',
    name: 'Noto Gelap',
    appearance: 'dark',
    desc: 'Charcoal & oranye — dari logonya',
    vars: t('#101013', '#EDEDF0', '#17171B', '#F97316', '#FFFFFF', '#9C9CA8', '#26262D', 'dark', {
      popover: '#1C1C21', secondary: '#202026', secondaryForeground: '#C9C9D1',
      muted: '#1B1B20', accent: '#24242B', input: '#2A2A32', canvasDots: '#2B2B34',
    }),
  },
  {
    id: 'noto-light',
    name: 'Noto Terang',
    appearance: 'light',
    desc: 'Putih hangat, bersih & fokus',
    vars: t('#FAF9F7', '#232120', '#FFFFFF', '#EA580C', '#FFFFFF', '#7D7873', '#E8E4DD', 'light', {
      secondary: '#F1EEE9', secondaryForeground: '#44403C',
      muted: '#F2F0EB', accent: '#F3F0EA', input: '#E0DCD4', canvasDots: '#DDD8CF',
    }),
  },
  {
    id: 'midnight',
    name: 'Tengah Malam',
    appearance: 'dark',
    desc: 'Biru laut rimbun beraksen emas',
    vars: t('#0A0E17', '#E4E9F2', '#10151F', '#F59E0B', '#1A1206', '#8A93A6', '#1D2432', 'dark', {
      popover: '#141A26', secondary: '#161D2B', secondaryForeground: '#C3CBD9',
      muted: '#121826', accent: '#1A2130', input: '#222A3A', canvasDots: '#1E2637',
    }),
  },
  {
    id: 'sepia',
    name: 'Kertas Sepia',
    appearance: 'light',
    desc: 'Hangat seperti buku catatan lama',
    vars: t('#F4EDDF', '#3D3427', '#FAF5E9', '#B45309', '#FFF8EB', '#8A7D64', '#E0D4BC', 'light', {
      secondary: '#ECE2CE', secondaryForeground: '#57503F',
      muted: '#EEE5D2', accent: '#EFE4CE', input: '#D6C9AD', canvasDots: '#DDD1B8',
    }),
  },
  {
    id: 'nord',
    name: 'Fjord Nord',
    appearance: 'dark',
    desc: 'Tenang seperti pantai utara',
    vars: t('#2E3440', '#ECEFF4', '#353C4A', '#D08770', '#2A2125', '#A7B0C0', '#434C5E', 'dark', {
      popover: '#3B4252', secondary: '#3B4252', secondaryForeground: '#D8DEE9',
      muted: '#3A4250', accent: '#434C5E', input: '#4C566A', canvasDots: '#404A5B',
    }),
  },
  {
    id: 'sakura',
    name: 'Sakura Lembut',
    appearance: 'light',
    desc: 'Manis, cerah, penuh semangat',
    vars: t('#FFF6F7', '#432B31', '#FFFFFF', '#E11D48', '#FFFFFF', '#A07983', '#F3DBE1', 'light', {
      secondary: '#FBE9ED', secondaryForeground: '#6E4750',
      muted: '#FBEFF2', accent: '#FAE8EC', input: '#EDD2DA', canvasDots: '#F0D8DE',
    }),
  },
  {
    id: 'forest',
    name: 'Rimba Hijau',
    appearance: 'dark',
    desc: 'Segar seperti hutan setelah hujan',
    vars: t('#0D1613', '#DCE8E1', '#12201A', '#34D399', '#04211A', '#7E958A', '#1E3329', 'dark', {
      popover: '#152620', secondary: '#182A22', secondaryForeground: '#B7CCC0',
      muted: '#14241D', accent: '#1B2F26', input: '#223A2F', canvasDots: '#1C3026',
    }),
  },
  {
    id: 'mono',
    name: 'Monokrom',
    appearance: 'dark',
    desc: 'Hitam-putih murni, tanpa distraksi',
    vars: t('#0C0C0D', '#E9E9EA', '#141416', '#E9E9EA', '#111113', '#8F8F97', '#26262A', 'dark', {
      popover: '#19191B', secondary: '#1D1D20', secondaryForeground: '#C6C6CB',
      muted: '#17171A', accent: '#222226', input: '#2C2C31', canvasDots: '#2A2A2F',
    }),
  },
]

export const ACCENT_SWATCHES = [
  '#F97316', '#EF4444', '#F59E0B', '#84CC16', '#10B981', '#14B8A6',
  '#EC4899', '#F43F5E', '#A855F7', '#06B6D4', '#8A8A94', '#E9E9EA',
]

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const r = parseInt(v.slice(0, 2), 16) / 255
  const g = parseInt(v.slice(2, 4), 16) / 255
  const b = parseInt(v.slice(4, 6), 16) / 255
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function readableFg(hex: string): string {
  return luminance(hex) > 0.45 ? '#17130E' : '#FFFFFF'
}

export function getTheme(id: string): ThemePreset {
  return THEMES.find((x) => x.id === id) ?? THEMES[0]
}

export function applyTheme(themeId: string, accentOverride?: string, radius = 0.75) {
  if (typeof document === 'undefined') return
  const theme = getTheme(themeId)
  const vars = theme.vars
  const root = document.documentElement.style
  const primary = accentOverride && accentOverride !== '' ? accentOverride : vars.primary
  const map: Record<string, string> = {
    '--background': vars.background,
    '--foreground': vars.foreground,
    '--card': vars.card,
    '--card-foreground': vars.cardForeground,
    '--popover': vars.popover,
    '--popover-foreground': vars.popoverForeground,
    '--primary': primary,
    '--primary-foreground': accentOverride && accentOverride !== '' ? readableFg(accentOverride) : vars.primaryForeground,
    '--secondary': vars.secondary,
    '--secondary-foreground': vars.secondaryForeground,
    '--muted': vars.muted,
    '--muted-foreground': vars.mutedForeground,
    '--accent': vars.accent,
    '--accent-foreground': vars.accentForeground,
    '--border': vars.border,
    '--input': vars.input,
    '--ring': primary,
    '--destructive': vars.destructive,
    '--radius': `${radius}rem`,
    '--canvas-dots': vars.canvasDots,
  }
  for (const [k, v] of Object.entries(map)) root.setProperty(k, v)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', vars.background)
}
