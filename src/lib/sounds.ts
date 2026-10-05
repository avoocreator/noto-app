// ── Mesin suara notifikasi Noto ─────────────────────────────────────
// 6 nada preset disintesis langsung via Web Audio API (tanpa file),
// atau suara kustom hasil upload pengguna (disimpan di IndexedDB).

export type SoundPresetId = 'chime' | 'bell' | 'marimba' | 'digital' | 'retro' | 'pop'

export const SOUND_PRESETS: { id: SoundPresetId; name: string; emoji: string; desc: string }[] = [
  { id: 'chime', name: 'Chime Lembut', emoji: '🎵', desc: 'Nada mayor berlapis, menenangkan' },
  { id: 'bell', name: 'Lonceng', emoji: '🔔', desc: 'Denting bel klasik yang jernih' },
  { id: 'marimba', name: 'Marimba', emoji: '🪘', desc: 'Kayu hangat tiga ketukan' },
  { id: 'digital', name: 'Digital', emoji: '📟', desc: 'Blip elektronik tegas' },
  { id: 'retro', name: 'Retro 8-bit', emoji: '🕹️', desc: 'Nostalgia game jadul' },
  { id: 'pop', name: 'Pop!', emoji: '🫧', desc: 'Pop singkat, lucu & ringan' },
]

let ctx: AudioContext | null = null
let out: AudioNode | null = null

function getCtx(): { c: AudioContext; out: AudioNode } | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
      // Limiter lembut: semua nada melewatinya agar boleh KENCANG tanpa pecah
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -8
      comp.knee.value = 8
      comp.ratio.value = 6
      comp.attack.value = 0.003
      comp.release.value = 0.2
      comp.connect(ctx.destination)
      out = comp
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return { c: ctx, out: out as AudioNode }
  } catch {
    return null
  }
}

interface ToneOpts {
  freq: number
  start: number
  dur: number
  type?: OscillatorType
  gain?: number
  sweepTo?: number
}

function tone(c: AudioContext, o: ToneOpts & { out: AudioNode }) {
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.freq, o.start)
  if (o.sweepTo) osc.frequency.exponentialRampToValueAtTime(o.sweepTo, o.start + o.dur)
  const peak = Math.max(0.0002, o.gain ?? 0.4)
  g.gain.setValueAtTime(0.0001, o.start)
  g.gain.exponentialRampToValueAtTime(peak, o.start + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, o.start + o.dur)
  osc.connect(g)
  g.connect(o.out)
  osc.start(o.start)
  osc.stop(o.start + o.dur + 0.06)
}

export function playPreset(id: SoundPresetId, volume = 1) {
  const got = getCtx()
  if (!got) return
  const c = got.c
  const out = got.out
  const t = c.currentTime + 0.03
  const v = Math.max(0, Math.min(1, volume))
  try {
    switch (id) {
      case 'chime':
        ;[523.25, 659.25, 783.99].forEach((f, i) => {
          tone(c, { freq: f, start: t + i * 0.09, dur: 0.9, gain: 0.55 * v, out })
          tone(c, { freq: f * 2, start: t + i * 0.09, dur: 0.45, gain: 0.14 * v, out })
        })
        break
      case 'bell': {
        const f = 880
        ;[1, 2.02, 2.98, 4.16].forEach((m, i) =>
          tone(c, { freq: f * m, start: t, dur: 1.7 - i * 0.3, gain: (0.5 / (i + 1)) * v, out }),
        )
        tone(c, { freq: f * 1.005, start: t + 0.12, dur: 1.2, gain: 0.18 * v, out })
        break
      }
      case 'marimba':
        tone(c, { freq: 659.25, start: t, dur: 0.34, gain: 0.85 * v, out })
        tone(c, { freq: 523.25, start: t + 0.14, dur: 0.38, gain: 0.85 * v, out })
        tone(c, { freq: 783.99, start: t + 0.28, dur: 0.5, gain: 0.8 * v, out })
        break
      case 'digital':
        tone(c, { freq: 1046.5, start: t, dur: 0.09, type: 'square', gain: 0.4 * v, out })
        tone(c, { freq: 1318.5, start: t + 0.11, dur: 0.09, type: 'square', gain: 0.4 * v, out })
        tone(c, { freq: 1568, start: t + 0.22, dur: 0.18, type: 'square', gain: 0.4 * v, out })
        break
      case 'retro':
        ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
          tone(c, { freq: f, start: t + i * 0.085, dur: 0.14, type: 'square', gain: 0.36 * v, out }),
        )
        break
      case 'pop':
        tone(c, { freq: 520, start: t, dur: 0.16, gain: 0.9 * v, sweepTo: 210, out })
        tone(c, { freq: 1560, start: t + 0.02, dur: 0.1, gain: 0.22 * v, out })
        break
    }
  } catch {
    // suara gagal main — abaikan
  }
}

export function playDataUrl(dataUrl: string, volume = 0.8): Promise<void> {
  return new Promise((resolve) => {
    try {
      const a = new Audio(dataUrl)
      a.volume = Math.max(0, Math.min(1, volume))
      a.onended = () => resolve()
      a.onerror = () => resolve()
      void a.play().catch(() => resolve())
    } catch {
      resolve()
    }
  })
}

interface PlaySettings {
  useCustomSound: boolean
  soundPreset: SoundPresetId
  notifVolume: number
}

export async function playNotificationSound(s: PlaySettings) {
  if (s.useCustomSound) {
    try {
      const { idbGet, CUSTOM_SOUND_KEY } = await import('./sound-store')
      const dataUrl = (await idbGet(CUSTOM_SOUND_KEY)) as string | undefined
      if (dataUrl) {
        await playDataUrl(dataUrl, s.notifVolume)
        return
      }
    } catch {
      // jatuh ke preset
    }
  }
  playPreset(s.soundPreset, s.notifVolume)
}
