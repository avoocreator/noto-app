import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { buildTokens, DEFAULT_THEME, type Mode, type ThemeSettings } from './palettes.ts';

interface ThemeStore extends ThemeSettings {
  patch: (p: Partial<ThemeSettings>) => void;
  reset: () => void;
}

export const useTheme = create<ThemeStore>()(
  persist(
    (set) => ({
      ...DEFAULT_THEME,
      patch: (p) => set(p),
      reset: () => set({ ...DEFAULT_THEME }),
    }),
    {
      name: 'noto-theme',
      partialize: (s) => ({
        mode: s.mode, presetId: s.presetId, customHex: s.customHex, harmony: s.harmony, intensity: s.intensity,
        radius: s.radius, density: s.density, decor: s.decor, fontBody: s.fontBody, reduceMotion: s.reduceMotion,
      }),
    },
  ),
);

export function systemMode(): Mode {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

let first = true;

export function applyTheme(s: ThemeSettings) {
  const mode: Mode = s.mode === 'system' ? systemMode() : s.mode;
  const root = document.documentElement;
  const tokens = buildTokens(s, mode);
  if (!first) {
    // transisi warna halus hanya saat pengguna mengganti tema
    root.classList.add('theme-anim');
    window.setTimeout(() => root.classList.remove('theme-anim'), 450);
  }
  first = false;
  for (const [k, v] of Object.entries(tokens)) root.style.setProperty(k, v);
  root.dataset.mode = mode;
  root.dataset.motion = s.reduceMotion ? 'reduce' : 'full';
  root.dataset.density = s.density;
  root.style.colorScheme = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tokens['--bg']);
}

/** Pasang di App: terapkan tema + ikuti perubahan mode sistem. */
export function useThemeEffect() {
  const s = useTheme();
  useEffect(() => {
    applyTheme(s);
    if (s.mode !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyTheme(useTheme.getState());
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [s.mode, s.presetId, s.customHex, s.harmony, s.intensity, s.radius, s.density, s.decor, s.fontBody, s.reduceMotion]);
}

export function useReducedMotion(): boolean {
  const r = useTheme((s) => s.reduceMotion);
  const os = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return r || os;
}
