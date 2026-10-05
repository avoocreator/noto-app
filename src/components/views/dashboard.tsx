'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight, CalendarClock, CalendarDays, Check, CheckCircle2, ChevronLeft,
  ChevronRight, FileText, ListTodo, Loader2, Palette, Plus, Shapes, X,
} from 'lucide-react'
import { api, fmtDateIDLong, fmtDue, greeting } from '@/lib/client'
import { parseTodoInput } from '@/lib/smart-parse'
import type { Note, Todo, TodoList } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type StatusFilter = 'active' | 'done' | 'all'

/** Kunci tanggal lokal 'YYYY-MM-DD' (bukan UTC — sesuai hari di HP user). */
function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const MAX_ROWS = 100

export function DashboardView({ navigate }: { navigate: (v: string, p?: string) => void }) {
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [todos, setTodos] = useState<Todo[] | null>(null)
  const [lists, setLists] = useState<TodoList[] | null>(null)
  const [quick, setQuick] = useState('')
  const [adding, setAdding] = useState(false)

  // Filter daftar tugas + kalender
  const [catFilter, setCatFilter] = useState<string>('all') // 'all' | 'none' | listId
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [selDay, setSelDay] = useState<string | null>(null)
  const now = new Date()
  const [calMonth, setCalMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1))

  const load = useCallback(() => {
    api<Todo[]>('/api/todos').then(setTodos).catch(() => setTodos([]))
    api<Note[]>('/api/notes').then(setNotes).catch(() => setNotes([]))
    api<TodoList[]>('/api/lists').then(setLists).catch(() => setLists([]))
  }, [])

  useEffect(load, [load])

  const parsed = useMemo(() => parseTodoInput(quick), [quick])
  const parsedDue = parsed.dueDate ? fmtDue(parsed.dueDate.toISOString()) : null
  const canAdd = parsed.title.length > 0

  const addQuick = async () => {
    if (!canAdd || adding) return
    setAdding(true)
    try {
      await api<Todo>('/api/todos', {
        method: 'POST',
        body: JSON.stringify({
          title: parsed.title,
          tags: parsed.tags,
          priority: parsed.priority ?? 1,
          dueDate: parsed.dueDate ? parsed.dueDate.toISOString() : null,
        }),
      })
      setQuick('')
      toast.success('Tugas ditambahkan')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menambah tugas')
    } finally {
      setAdding(false)
    }
  }

  const toggleTodo = async (t: Todo) => {
    setTodos((prev) => (prev ? prev.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) : prev))
    try {
      await api(`/api/todos/${t.id}`, { method: 'PUT', body: JSON.stringify({ done: !t.done }) })
    } catch {
      toast.error('Gagal memperbarui tugas')
      load()
    }
  }

  const stats = useMemo(() => {
    if (!todos || !notes) return null
    const todayStr = new Date().toISOString().slice(0, 10)
    return {
      notes: notes.length,
      active: todos.filter((t) => !t.done).length,
      doneToday: todos.filter((t) => t.done && t.completedAt?.slice(0, 10) === todayStr).length,
      overdue: todos.filter((t) => !t.done && t.dueDate && t.dueDate.slice(0, 10) < todayStr).length,
    }
  }, [todos, notes])

  const recentNotes = useMemo(() => (notes ?? []).slice(0, 3), [notes])

  // ── Daftar tugas terfilter ────────────────────────────────────────
  const filteredTodos = useMemo(() => {
    if (!todos) return []
    const match = todos.filter((t) => {
      if (catFilter === 'none' ? t.listId : catFilter !== 'all' && t.listId !== catFilter) return false
      if (statusFilter === 'active' && t.done) return false
      if (statusFilter === 'done' && !t.done) return false
      if (selDay && (!t.dueDate || dayKeyOf(new Date(t.dueDate)) !== selDay)) return false
      return true
    })
    return match.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      if (!a.done) {
        if (a.priority !== b.priority) return b.priority - a.priority
        return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')
      }
      return (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt)
    })
  }, [todos, catFilter, statusFilter, selDay])

  const listName = useMemo(() => {
    const m = new Map<string, TodoList>()
    for (const l of lists ?? []) m.set(l.id, l)
    return m
  }, [lists])

  // ── Kalender: jumlah tugas per hari ──────────────────────────────
  const perDay = useMemo(() => {
    const m = new Map<string, { active: number; done: number }>()
    for (const t of todos ?? []) {
      if (!t.dueDate) continue
      const k = dayKeyOf(new Date(t.dueDate))
      const e = m.get(k) ?? { active: 0, done: 0 }
      if (t.done) e.done++
      else e.active++
      m.set(k, e)
    }
    return m
  }, [todos])

  const todayKey = dayKeyOf(new Date())

  const cal = useMemo(() => {
    const y = calMonth.getFullYear()
    const m = calMonth.getMonth()
    const firstOffset = (new Date(y, m, 1).getDay() + 6) % 7 // Senin = kolom pertama
    const days = new Date(y, m + 1, 0).getDate()
    return { y, m, firstOffset, days }
  }, [calMonth])

  const selDayLabel = useMemo(() => {
    if (!selDay) return ''
    const [y, m, d] = selDay.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'short',
    })
  }, [selDay])

  const monthLabel = calMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full pb-28 md:pb-12">
      {/* Sapaan */}
      <header className="mb-6">
        <p className="text-sm text-muted-foreground">{fmtDateIDLong()}</p>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-1">{greeting()} 👋</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Semua catatan, tugas, dan idemu ada di sini.
        </p>
      </header>

      {/* Quick add */}
      <div className="rounded-2xl border border-border bg-card p-4 mb-6 shadow-sm">
        <div className="flex gap-2">
          <Input
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addQuick()}
            placeholder='Tambah tugas cepat… coba: "Belanja minggu besok !penting #rumah"'
            className="h-11 bg-background"
          />
          <Button onClick={addQuick} disabled={!canAdd || adding} className="h-11 px-4">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>
        {quick.trim() && (parsed.tags.length > 0 || parsed.priority !== null || parsedDue) && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {parsed.priority !== null && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {parsed.priority === 2 ? '🔥 Prioritas tinggi' : parsed.priority === 1 ? '⚡ Sedang' : '🫧 Rendah'}
              </span>
            )}
            {parsedDue && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                📅 {parsedDue.text}
              </span>
            )}
            {parsed.tags.map((t) => (
              <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats === null
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
          : [
              { icon: FileText, label: 'Catatan', value: stats.notes, color: 'text-primary', onClick: () => navigate('notes') },
              { icon: ListTodo, label: 'Tugas aktif', value: stats.active, color: 'text-emerald-500', onClick: () => navigate('todos') },
              { icon: CheckCircle2, label: 'Selesai hari ini', value: stats.doneToday, color: 'text-amber-500', onClick: () => navigate('todos') },
              { icon: CalendarClock, label: 'Terlambat', value: stats.overdue, color: stats.overdue > 0 ? 'text-red-500' : 'text-muted-foreground', onClick: () => navigate('todos') },
            ].map((s) => (
              <button
                key={s.label}
                onClick={s.onClick}
                className="text-left rounded-2xl border border-border bg-card p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <p className="text-2xl font-bold mt-2">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </button>
            ))}
      </div>

      {/* Semua tugas — filter kategori/status/tanggal + kalender */}
      <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden mb-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-primary" /> Semua Tugas
          </h2>
          <span className="text-xs text-muted-foreground">
            {todos === null ? '…' : `${filteredTodos.length} tugas`}
          </span>
        </div>

        {/* Filter kategori */}
        <div className="px-4 pt-2.5 pb-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setCatFilter('all')}
            className={cn(
              'shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              catFilter === 'all' ? 'bg-primary/15 border-primary/40 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            Semua
          </button>
          {(lists ?? []).map((l) => (
            <button
              key={l.id}
              onClick={() => setCatFilter(catFilter === l.id ? 'all' : l.id)}
              className={cn(
                'shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors flex items-center gap-1.5',
                catFilter === l.id ? 'bg-primary/15 border-primary/40 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: l.color }} />
              <span>{l.emoji} {l.name}</span>
            </button>
          ))}
          <button
            onClick={() => setCatFilter(catFilter === 'none' ? 'all' : 'none')}
            className={cn(
              'shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              catFilter === 'none' ? 'bg-primary/15 border-primary/40 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            Tanpa kategori
          </button>
        </div>

        {/* Filter status + tanggal terpilih dari kalender */}
        <div className="px-4 pb-2.5 flex items-center gap-1.5 flex-wrap">
          {(
            [
              { id: 'active', label: 'Aktif' },
              { id: 'done', label: 'Selesai' },
              { id: 'all', label: 'Semua status' },
            ] as { id: StatusFilter; label: string }[]
          ).map((s) => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                statusFilter === s.id ? 'bg-primary/15 border-primary/40 text-primary' : 'border-border text-muted-foreground hover:bg-accent',
              )}
            >
              {s.label}
            </button>
          ))}
          {selDay && (
            <button
              onClick={() => setSelDay(null)}
              className="rounded-full border border-primary/40 bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium flex items-center gap-1 hover:bg-primary/20 transition-colors"
            >
              <CalendarDays className="w-3 h-3" /> {selDayLabel}
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Daftar */}
        <div className="p-2 border-t border-border/60">
          {todos === null ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-xl" />
              ))}
            </div>
          ) : filteredTodos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 px-4">
              {selDay
                ? 'Tidak ada tugas di tanggal ini. ✨'
                : catFilter !== 'all'
                  ? 'Tidak ada tugas di kategori ini.'
                  : statusFilter === 'done'
                    ? 'Belum ada tugas yang selesai. Semangat!'
                    : 'Tidak ada tugas aktif. Nikmati harimu! 🌤️'}
            </p>
          ) : (
            <>
              {filteredTodos.slice(0, MAX_ROWS).map((t) => {
                const due = fmtDue(t.dueDate)
                const list = t.list ?? listName.get(t.listId ?? '') ?? null
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTodo(t)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent transition-colors text-left"
                  >
                    <span
                      className={cn(
                        'w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-colors',
                        t.done ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/40',
                      )}
                      aria-hidden
                    >
                      {t.done && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </span>
                    <span
                      className={cn(
                        'flex-1 text-sm truncate',
                        t.done && 'line-through text-muted-foreground',
                        !t.done && t.priority === 2 && 'font-semibold',
                      )}
                    >
                      {t.title}
                    </span>
                    {list && (
                      <span className="hidden sm:flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0 max-w-32">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: list.color }} />
                        <span className="truncate">{list.emoji} {list.name}</span>
                      </span>
                    )}
                    {due && (
                      <span className="text-xs shrink-0 font-medium" style={{ color: due.color }}>
                        {due.text}
                      </span>
                    )}
                  </button>
                )
              })}
              {filteredTodos.length > MAX_ROWS && (
                <p className="text-xs text-muted-foreground text-center py-3">
                  …dan {filteredTodos.length - MAX_ROWS} tugas lagi. Kelola semuanya di tab Tugas.
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Kalender dengan penanda tugas */}
        <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden self-start">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" /> Kalender
            </h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => setCalMonth(new Date(cal.y, cal.m - 1, 1))}
                aria-label="Bulan sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs font-medium min-w-28 text-center">{monthLabel}</span>
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => setCalMonth(new Date(cal.y, cal.m + 1, 1))}
                aria-label="Bulan berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost" size="sm" className="h-7 px-2 text-xs"
                onClick={() => setCalMonth(new Date(now.getFullYear(), now.getMonth(), 1))}
              >
                Hari ini
              </Button>
            </div>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map((w) => (
                <span key={w} className="text-center text-[10px] font-medium text-muted-foreground py-1">
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: cal.firstOffset }).map((_, i) => (
                <span key={`b${i}`} />
              ))}
              {Array.from({ length: cal.days }, (_, i) => i + 1).map((d) => {
                const key = `${cal.y}-${String(cal.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                const cnt = perDay.get(key) ?? { active: 0, done: 0 }
                const total = cnt.active + cnt.done
                const isToday = key === todayKey
                const isPast = key < todayKey
                const selected = selDay === key
                const dotCount = Math.min(total, 3)
                return (
                  <button
                    key={d}
                    onClick={() => {
                      setSelDay(selected ? null : key)
                      setCalMonth(new Date(cal.y, cal.m, 1))
                    }}
                    aria-label={`Tugas pada tanggal ${d}`}
                    className={cn(
                      'relative h-12 rounded-lg flex flex-col items-center justify-start pt-1.5 transition-colors',
                      'hover:bg-accent',
                      selected && 'bg-primary/15 ring-1 ring-primary/50',
                      !selected && isToday && 'bg-primary/5',
                    )}
                  >
                    <span
                      className={cn(
                        'text-xs leading-none',
                        isToday && 'font-bold text-primary',
                        !isToday && 'text-foreground/90',
                      )}
                    >
                      {d}
                    </span>
                    <span className="flex items-center gap-0.5 mt-1.5 h-1.5">
                      {Array.from({ length: dotCount }).map((_, i) => {
                        const red = isPast && cnt.active > 0
                        const emerald = i >= cnt.active
                        return (
                          <span
                            key={i}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: red ? '#ef4444' : emerald ? '#10b981' : 'var(--primary)' }}
                          />
                        )
                      })}
                      {total > 3 && <span className="text-[8px] leading-none font-semibold text-muted-foreground">+{total - 3}</span>}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 px-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full align-middle mr-1" style={{ background: 'var(--primary)' }} />
              tugas aktif ·
              <span className="inline-block w-1.5 h-1.5 rounded-full align-middle mx-1" style={{ background: '#10b981' }} />
              selesai ·
              <span className="inline-block w-1.5 h-1.5 rounded-full align-middle mx-1" style={{ background: '#ef4444' }} />
              lewat tenggat · ketuk tanggal untuk memfilter daftar
            </p>
          </div>
        </section>

        {/* Catatan terbaru */}
        <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden self-start">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Catatan Terbaru
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('notes')} className="text-xs gap-1">
              Semua <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
          <div className="p-3 flex flex-col gap-2">
            {notes === null ? (
              Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)
            ) : recentNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8 px-4">
                Belum ada catatan. Yuk mulai menulis! ✍️
              </p>
            ) : (
              recentNotes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => navigate('notes', n.id)}
                  className="text-left rounded-xl border border-border/70 p-3 hover:bg-accent transition-colors"
                >
                  <p className="text-sm font-semibold truncate">{n.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    {n.content.replace(/[#*`>\-[\]()]/g, '').slice(0, 80) || 'Catatan kosong'}
                  </p>
                </button>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Aksi cepat */}
      <div className="grid grid-cols-3 gap-3 mt-6">
        {[
          { icon: FileText, label: 'Tulis Catatan', onClick: () => navigate('notes') },
          { icon: Shapes, label: 'Buka Kanvas', onClick: () => navigate('canvas') },
          { icon: Palette, label: 'Ganti Tema', onClick: () => navigate('settings') },
        ].map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-4 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all"
          >
            <a.icon className="w-5 h-5" />
            {a.label}
          </button>
        ))}
      </div>
    </div>
  )
}
