'use client'

import { useEffect, useRef, useState } from 'react'
import { useHashRoute } from '@/hooks/use-hash-route'
import { useReminders } from '@/hooks/use-reminders'
import { useSettings } from '@/lib/store'
import { applyTheme } from '@/lib/themes'
import { seedIfEmpty } from '@/lib/db'
import { initSync } from '@/lib/sync'
import { AppShell } from '@/components/app-shell'
import { DashboardView } from '@/components/views/dashboard'
import { NotesView } from '@/components/views/notes'
import { TodosView } from '@/components/views/todos'
import { CanvasView } from '@/components/views/canvas'
import { SettingsView } from '@/components/views/settings'
import { GuideView } from '@/components/views/guide'
import { WidgetView } from '@/components/views/widget'

// Durasi minimum splash tampil agar tidak berkedip cepat (ms)
const MIN_SPLASH_MS = 1400
const SPLASH_FADE_MS = 550
// Dicatat saat modul dimuat klien — perkiraan waktu splash mulai tampil
const BOOT_AT = typeof window !== 'undefined' ? Date.now() : 0

/** Fokuskan kotak tambah-tugas cepat (dipakai deep link noto://add). */
export function fireQuickAdd(): void {
  window.dispatchEvent(new CustomEvent('noto:quick-add'))
}

export default function Page() {
  const { view, param, navigate } = useHashRoute()
  const settings = useSettings()
  const [booting, setBooting] = useState(true)

  // Terapkan tema sesegera mungkin
  useEffect(() => {
    applyTheme(settings.themeId, settings.accent, settings.radius)
  }, [])

  // Siapkan database lokal (seed data contoh bila kosong) + cloud sync
  useEffect(() => {
    let alive = true
    seedIfEmpty()
      .catch(() => {})
      .finally(() => {
        if (alive) setBooting(false)
      })
    initSync()
    return () => {
      alive = false
    }
  }, [])

  // Deep link: noto://add (tombol widget Android) & ?action=add (web/PWA)
  useEffect(() => {
    const openAdd = () => {
      navigate('todos')
      setTimeout(fireQuickAdd, 350)
    }
    const params = new URLSearchParams(window.location.search)
    if (params.get('action') === 'add') {
      openAdd()
      window.history.replaceState({}, '', window.location.pathname)
    }
    ;(async () => {
      try {
        if ((window as { Capacitor?: unknown }).Capacitor) {
          const { App: CapApp } = await import('@capacitor/app')
          CapApp.addListener('appUrlOpen', (data: { url: string }) => {
            if (data.url.includes('add')) openAdd()
            else navigate('todos')
          })
        }
      } catch {
        /* bukan APK — abaikan */
      }
    })()
  }, [navigate])

  // Daftarkan service worker (PWA)
  useEffect(() => {
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  useReminders(!booting && settings.notifEnabled)

  // Sembunyikan splash statis dari layout begitu aplikasi siap
  // (dengan durasi tampil minimum supaya terasa halus & berkelas)
  const splashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (booting) return
    const splash = document.getElementById('boot-splash')
    if (!splash || splash.dataset.done === '1') return
    splash.dataset.done = '1'

    const elapsed = Date.now() - BOOT_AT
    const wait = Math.max(0, MIN_SPLASH_MS - elapsed)
    splashTimer.current = setTimeout(() => {
      splash.classList.add('hide')
      setTimeout(() => splash.remove(), SPLASH_FADE_MS)
    }, wait)
    return () => {
      if (splashTimer.current) clearTimeout(splashTimer.current)
    }
  }, [booting])

  // Selama persiapan database berjalan, splash statis dari layout masih
  // menutupi layar — tidak perlu merender apa pun di sini.
  if (booting) return null
  if (view === 'widget') return <WidgetView />

  const content =
    view === 'notes' ? <NotesView param={param} navigate={navigate} /> :
    view === 'todos' ? <TodosView /> :
    view === 'canvas' ? <CanvasView navigate={navigate} /> :
    view === 'settings' ? <SettingsView /> :
    view === 'guide' ? <GuideView /> :
    <DashboardView navigate={navigate} />

  return (
    <AppShell view={view} param={param} navigate={navigate}>
      {content}
    </AppShell>
  )
}
