'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, RefreshCw } from 'lucide-react'
import { api, fmtDue } from '@/lib/client'
import type { Todo } from '@/lib/types'
import { applyTheme, getTheme } from '@/lib/themes'
import { useSettings } from '@/lib/store'

/**
 * Tampilan minimalis untuk layar HP kecil (2x2) — buka lewat pintasan
 * layar utama, atau jadikan sumber data widget KWGT.
 */
export function WidgetView() {
  const [todos, setTodos] = useState<Todo[] | null>(null)
  const settings = useSettings()

  useEffect(() => {
    applyTheme(settings.themeId, settings.accent, settings.radius)
     
  }, [])

  const load = useCallback(() => {
    api<Todo[]>('/api/todos')
      .then((all) => {
        const active = all
          .filter((t) => !t.done)
          .sort((a, b) => b.priority - a.priority || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
          .slice(0, 7)
        setTodos(active)
      })
      .catch(() => setTodos([]))
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 30000)
    return () => clearInterval(iv)
  }, [load])

  const toggle = async (t: Todo) => {
    setTodos((prev) => (prev ? prev.filter((x) => x.id !== t.id) : prev))
    try {
      await api(`/api/todos/${t.id}`, { method: 'PUT', body: JSON.stringify({ done: true }) })
    } catch {
      load()
    }
  }

  const theme = getTheme(settings.themeId)

  return (
    <div
      className="min-h-[100dvh] p-5 flex flex-col gap-3 select-none"
      style={{ background: theme.vars.background, color: theme.vars.foreground }}
    >
      <header className="flex items-center gap-2.5">
        { }
        <img src="/icons/logo-64.png" alt="Noto" className="w-8 h-8 rounded-lg" />
        <div className="flex-1">
          <p className="text-sm font-bold leading-tight">Tugasku</p>
          <p className="text-[11px] opacity-60 leading-tight">
            {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date())}
          </p>
        </div>
        <button
          onClick={load}
          aria-label="Muat ulang"
          className="w-8 h-8 rounded-lg flex items-center justify-center opacity-60 hover:opacity-100"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 flex flex-col gap-2">
        {todos === null ? (
          <p className="text-sm opacity-60">Memuat…</p>
        ) : todos.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-1 text-center">
            <p className="text-3xl">🎉</p>
            <p className="text-sm font-semibold">Semua beres!</p>
            <p className="text-xs opacity-60">Tidak ada tugas aktif.</p>
          </div>
        ) : (
          todos.map((t) => {
            const due = fmtDue(t.dueDate)
            return (
              <button
                key={t.id}
                onClick={() => toggle(t)}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left active:scale-[0.98] transition-transform"
                style={{ background: theme.vars.card, border: `1px solid ${theme.vars.border}` }}
              >
                <span
                  className="w-5 h-5 rounded-md border-2 shrink-0"
                  style={{ borderColor: theme.vars.mutedForeground, opacity: 0.5 }}
                  aria-hidden
                />
                <span className="flex-1 text-sm font-medium leading-snug">{t.title}</span>
                {t.priority === 2 && <span aria-hidden>🔥</span>}
                {due && (
                  <span className="text-[10px] font-bold shrink-0" style={{ color: due.color }}>
                    {due.text}
                  </span>
                )}
              </button>
            )
          })
        )}
      </div>

      <footer className="text-center">
        <p className="text-[10px] opacity-50 flex items-center justify-center gap-1">
          <Check className="w-3 h-3" /> Ketuk tugas untuk menyelesaikan · Noto Widget
        </p>
      </footer>
    </div>
  )
}
