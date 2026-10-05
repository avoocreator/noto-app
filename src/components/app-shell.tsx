'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen, FileText, Home, ListTodo, Plus, Search, Settings, Shapes, StickyNote,
} from 'lucide-react'
import { api } from '@/lib/client'
import type { Note, Todo } from '@/lib/types'
import { useSettings } from '@/lib/store'
import { applyTheme } from '@/lib/themes'
import type { View } from '@/hooks/use-hash-route'
import { Button } from '@/components/ui/button'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CommandPalette } from '@/components/command-palette'

const NAV: { id: View; label: string; icon: typeof Home }[] = [
  { id: 'dashboard', label: 'Beranda', icon: Home },
  { id: 'notes', label: 'Catatan', icon: FileText },
  { id: 'todos', label: 'Tugas', icon: ListTodo },
  { id: 'canvas', label: 'Kanvas', icon: Shapes },
  { id: 'guide', label: 'Panduan', icon: BookOpen },
  { id: 'settings', label: 'Pengaturan', icon: Settings },
]

export function AppShell({
  view,
  param,
  navigate,
  children,
}: {
  view: View
  param: string | null
  navigate: (v: string, p?: string) => void
  children: React.ReactNode
}) {
  const settings = useSettings()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Terapkan tema setiap kali pengaturan berubah
  useEffect(() => {
    applyTheme(settings.themeId, settings.accent, settings.radius)
  }, [settings.themeId, settings.accent, settings.radius])

  // Buka palet perintah dengan Ctrl/Cmd+K
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])

  const go = (v: View) => {
    if (v === view && v !== 'notes') return
    navigate(v)
  }
  const goClose = (v: View) => {
    setSheetOpen(false)
    navigate(v)
  }

  const active = useMemo(
    () => NAV.find((n) => n.id === view) ?? NAV[0],
    [view],
  )

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Rail kiri — desktop */}
      <TooltipProvider delayDuration={200}>
        <aside className="hidden md:flex flex-col w-16 shrink-0 items-center py-4 border-r border-border/60 bg-card/40 sticky top-0 h-screen">
          { }
          <button onClick={() => go('dashboard')} className="rounded-xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Beranda Noto">
            { }
            <img src="/icons/logo-64.png" alt="Logo Noto" className="w-9 h-9" />
          </button>
          <nav className="flex-1 flex flex-col gap-1.5 mt-6" aria-label="Navigasi utama">
            {NAV.map((n) => {
              const Icon = n.icon
              const isActive = view === n.id
              return (
                <Tooltip key={n.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => go(n.id)}
                      aria-label={n.label}
                      aria-current={isActive ? 'page' : undefined}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                        isActive
                          ? 'bg-primary/15 text-primary shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      }`}
                    >
                      <Icon className="w-[18px] h-[18px]" strokeWidth={isActive ? 2.4 : 2} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    {n.label}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </nav>
          <button
            onClick={() => setPaletteOpen(true)}
            aria-label="Pencarian (Ctrl+K)"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Search className="w-[18px] h-[18px]" />
          </button>
        </aside>
      </TooltipProvider>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header atas — mobile */}
        <header className="md:hidden sticky top-0 z-40 flex items-center gap-2 px-4 h-14 border-b border-border/60 bg-background/85 backdrop-blur-md">
          { }
          <img src="/icons/logo-64.png" alt="Logo Noto" className="w-7 h-7 rounded-lg" />
          <h1 className="font-bold tracking-tight">{active.label}</h1>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" aria-label="Cari" onClick={() => setPaletteOpen(true)}>
            <Search className="w-5 h-5" />
          </Button>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Menu lainnya">
                <StickyNote className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-left">
                  { }
                  <img src="/icons/logo-64.png" alt="" className="w-6 h-6 rounded-md" /> Noto
                </SheetTitle>
              </SheetHeader>
              <div className="px-3 pb-6 flex flex-col gap-1">
                {NAV.filter((n) => !['dashboard', 'notes', 'todos', 'canvas'].includes(n.id)).map((n) => {
                  const Icon = n.icon
                  return (
                    <button
                      key={n.id}
                      onClick={() => goClose(n.id)}
                      className="flex items-center gap-3 h-11 px-3 rounded-xl text-sm font-medium hover:bg-accent transition-colors"
                    >
                      <Icon className="w-4 h-4 text-muted-foreground" /> {n.label}
                    </button>
                  )
                })}
                <div className="h-px bg-border my-2" />
                <button
                  onClick={() => { setSheetOpen(false); navigate('widget') }}
                  className="flex items-center gap-3 h-11 px-3 rounded-xl text-sm font-medium hover:bg-accent transition-colors"
                >
                  <Plus className="w-4 h-4 text-muted-foreground" /> Tampilan Widget HP
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 min-h-0">{children}</main>

        {/* Nav bawah — mobile */}
        <nav
          className="md:hidden sticky bottom-0 z-40 grid grid-cols-5 h-16 border-t border-border/60 bg-background/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
          aria-label="Navigasi utama"
        >
          {(['dashboard', 'notes', 'todos', 'canvas'] as View[]).map((id) => {
            const n = NAV.find((x) => x.id === id)!
            const Icon = n.icon
            const isActive = view === id
            return (
              <button
                key={id}
                onClick={() => go(id)}
                aria-label={n.label}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.4 : 2} />
                {n.label}
              </button>
            )
          })}
          <button
            onClick={() => setSheetOpen(true)}
            aria-label="Menu lainnya"
            className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground"
          >
            <StickyNote className="w-5 h-5" />
            Lainnya
          </button>
        </nav>
      </div>

      <CommandPalette open={paletteOpen} setOpen={setPaletteOpen} navigate={navigate} />
    </div>
  )
}

export type { Note, Todo }
