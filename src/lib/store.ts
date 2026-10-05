// ── Pengaturan global Noto (zustand + localStorage) ─────────────────
'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SoundPresetId } from './sounds'

export type FontChoice = 'sans' | 'serif' | 'mono'

export interface NotoSettings {
  themeId: string
  accent: string // '' = pakai aksen bawaan tema
  radius: number // rem, 0.25 – 1.5
  noteFont: FontChoice
  notifEnabled: boolean
  notifVolume: number // 0 – 1
  soundPreset: SoundPresetId
  useCustomSound: boolean
  // Cloud Supabase (sinkronisasi web ↔ APK) — diisi lewat UI Pengaturan
  supabaseUrl: string
  supabaseAnonKey: string
  cloudAutoSync: boolean
}

export const DEFAULT_SETTINGS: NotoSettings = {
  themeId: 'noto-dark',
  accent: '',
  radius: 0.75,
  noteFont: 'sans',
  notifEnabled: false,
  notifVolume: 1,
  soundPreset: 'chime',
  useCustomSound: false,
  supabaseUrl: '',
  supabaseAnonKey: '',
  cloudAutoSync: true,
}

interface SettingsState extends NotoSettings {
  set: (p: Partial<NotoSettings>) => void
  reset: () => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (p) => set(p),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    { name: 'noto-settings' },
  ),
)
