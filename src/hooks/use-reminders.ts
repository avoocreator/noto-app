'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/client'
import type { Todo } from '@/lib/types'
import { playNotificationSound } from '@/lib/sounds'
import { useSettings } from '@/lib/store'
import { showNotif } from '@/lib/notif'

const FIRED_KEY = 'noto-fired-reminders'
const MAX_MISSED_MS = 12 * 3600 * 1000 // pengingat telat > 12 jam tidak dibunyikan

function getFired(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(FIRED_KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

/**
 * Scheduler pengingat: memeriksa todo dengan reminderAt setiap 20 detik
 * selama aplikasi terbuka, lalu memainkan suara + notifikasi sistem + toast.
 */
export function useReminders(enabled: boolean) {
  const settings = useSettings()

  useEffect(() => {
    if (!enabled) return
    let busy = false

    const tick = async () => {
      if (busy || document.visibilityState === 'hidden') return
      busy = true
      try {
        const todos = await api<Todo[]>('/api/todos')
        const fired = new Set(getFired())
        const now = Date.now()
        let changed = false

        for (const t of todos) {
          if (t.done || !t.reminderAt) continue
          const key = `${t.id}:${t.reminderAt}`
          if (fired.has(key)) continue
          const r = new Date(t.reminderAt).getTime()
          if (r > now) continue
          if (now - r > MAX_MISSED_MS) {
            fired.add(key)
            changed = true
            continue
          }
          fired.add(key)
          changed = true
          void playNotificationSound(settings)
          // Native Android → notifikasi asli di system tray; web → notifikasi browser
          void showNotif(
            '⏰ ' + t.title,
            'Pengingat dari Noto' + (t.notes ? ` — ${t.notes}` : ''),
            'noto-' + t.id,
          )
          toast('⏰ Pengingat: ' + t.title, {
            description: t.notes || 'Sudah waktunya untuk tugas ini.',
            duration: 12000,
          })
        }
        if (changed) {
          localStorage.setItem(FIRED_KEY, JSON.stringify([...fired].slice(-300)))
        }
      } catch {
        // offline / API error — coba lagi di tick berikutnya
      } finally {
        busy = false
      }
    }

    void tick()
    const iv = setInterval(() => void tick(), 20000)
    const vis = () => {
      if (document.visibilityState === 'visible') void tick()
    }
    document.addEventListener('visibilitychange', vis)
    return () => {
      clearInterval(iv)
      document.removeEventListener('visibilitychange', vis)
    }
     
  }, [enabled, settings.soundPreset, settings.notifVolume, settings.useCustomSound])
}
