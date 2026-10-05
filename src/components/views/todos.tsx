'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown, ArrowUp, Bell, BellOff, CalendarClock, ChevronDown, Flame,
  ListPlus, Loader2, Pencil, Plus, Tag, Trash2, X,
} from 'lucide-react'
import { api, fmtDue, toDateInputValue, toDateTimeInputValue } from '@/lib/client'
import { parseTodoInput } from '@/lib/smart-parse'
import { LIST_COLORS, LIST_EMOJIS, PRIORITY, type Todo, type TodoList } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type Filter = 'all' | 'today' | 'upcoming' | 'overdue' | 'done'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'today', label: 'Hari Ini' },
  { id: 'upcoming', label: 'Akan Datang' },
  { id: 'overdue', label: 'Terlambat' },
  { id: 'done', label: 'Selesai' },
]

function daySlice(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

export function TodosView() {
  const [todos, setTodos] = useState<Todo[] | null>(null)
  const [lists, setLists] = useState<TodoList[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [quick, setQuick] = useState('')
  const [quickListId, setQuickListId] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Todo | null>(null)
  const [listDialog, setListDialog] = useState<'new' | TodoList | null>(null)
  const [deleteList, setDeleteList] = useState<TodoList | null>(null)
  const [deleteTodo, setDeleteTodo] = useState<Todo | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const [t, l] = await Promise.all([api<Todo[]>('/api/todos'), api<TodoList[]>('/api/lists')])
      setTodos(t)
      setLists(l)
      if (!quickListId && l.length) setQuickListId(l[0].id)
    } catch {
      setTodos([])
      toast.error('Gagal memuat tugas')
    }
     
  }, [])

  useEffect(() => void load(), [load])

  // Deep link dari widget Android (noto://add) → fokuskan kotak tambah cepat
  useEffect(() => {
    const onFocus = () => {
      inputRef.current?.focus()
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    window.addEventListener('noto:quick-add', onFocus)
    return () => window.removeEventListener('noto:quick-add', onFocus)
  }, [])

  const parsed = useMemo(() => parseTodoInput(quick), [quick])
  const parsedDue = parsed.dueDate ? fmtDue(parsed.dueDate.toISOString()) : null

  const addQuick = async () => {
    if (!parsed.title || adding) return
    setAdding(true)
    try {
      await api<Todo>('/api/todos', {
        method: 'POST',
        body: JSON.stringify({
          title: parsed.title,
          tags: parsed.tags,
          priority: parsed.priority ?? 1,
          dueDate: parsed.dueDate ? parsed.dueDate.toISOString() : null,
          listId: quickListId || lists[0]?.id || null,
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

  const toggle = async (t: Todo) => {
    setTodos((prev) => (prev ? prev.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) : prev))
    try {
      await api(`/api/todos/${t.id}`, { method: 'PUT', body: JSON.stringify({ done: !t.done }) })
    } catch {
      toast.error('Gagal memperbarui')
      load()
    }
  }

  const removeTodo = async () => {
    if (!deleteTodo) return
    try {
      await api(`/api/todos/${deleteTodo.id}`, { method: 'DELETE' })
      setTodos((prev) => (prev ? prev.filter((x) => x.id !== deleteTodo.id) : prev))
      toast.success('Tugas dihapus')
    } catch {
      toast.error('Gagal menghapus')
    } finally {
      setDeleteTodo(null)
    }
  }

  const move = async (t: Todo, dir: -1 | 1) => {
    if (!todos) return
    const siblings = todos
      .filter((x) => x.listId === t.listId && !x.done)
      .sort((a, b) => a.order - b.order)
    const idx = siblings.findIndex((x) => x.id === t.id)
    const swapWith = siblings[idx + dir]
    if (!swapWith) return
    const optimistic = todos.map((x) => {
      if (x.id === t.id) return { ...x, order: swapWith.order }
      if (x.id === swapWith.id) return { ...x, order: t.order }
      return x
    })
    setTodos(optimistic)
    try {
      await Promise.all([
        api(`/api/todos/${t.id}`, { method: 'PUT', body: JSON.stringify({ order: swapWith.order }) }),
        api(`/api/todos/${swapWith.id}`, { method: 'PUT', body: JSON.stringify({ order: t.order }) }),
      ])
    } catch {
      load()
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10)

  const filtered = useMemo(() => {
    if (!todos) return []
    switch (filter) {
      case 'done':
        return todos.filter((t) => t.done)
      case 'today':
        return todos.filter((t) => !t.done && daySlice(t.dueDate) === todayStr)
      case 'upcoming':
        return todos.filter((t) => !t.done && daySlice(t.dueDate) > todayStr)
      case 'overdue':
        return todos.filter((t) => !t.done && t.dueDate && daySlice(t.dueDate) < todayStr)
      default:
        return todos
    }
  }, [todos, filter, todayStr])

  const grouped = useMemo(() => {
    const g: { key: string; label: string; color?: string; emoji?: string; items: Todo[] }[] = []
    if (filter === 'done') {
      g.push({ key: '__done', label: 'Selesai', items: filtered })
    } else {
      for (const l of lists) {
        const items = filtered.filter((t) => t.listId === l.id)
        if (items.length || filter === 'all') {
          g.push({ key: l.id, label: l.name, color: l.color, emoji: l.emoji, items })
        }
      }
      const tanpa = filtered.filter((t) => !t.listId || !lists.some((l) => l.id === t.listId))
      if (tanpa.length) g.push({ key: '__none', label: 'Tanpa Daftar', items: tanpa })
    }
    return g.filter((x) => x.items.length > 0)
  }, [filtered, lists, filter])

  const totalActive = (todos ?? []).filter((t) => !t.done).length
  const totalDone = (todos ?? []).filter((t) => t.done).length
  const pct = totalActive + totalDone === 0 ? 0 : Math.round((totalDone / (totalActive + totalDone)) * 100)

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto w-full pb-28 md:pb-12">
      {/* Header + progres */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tugas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalActive} aktif · {totalDone} selesai
          </p>
        </div>
        <div className="w-32 hidden sm:block">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Progres</span>
            <span className="font-semibold text-foreground">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
      </div>

      {/* Quick add */}
      <div className="rounded-2xl border border-border bg-card p-3 shadow-sm mb-4">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addQuick()}
            placeholder='Tugas baru… coba: "Rapat tim besok 10:00 !penting #kerja"'
            className="h-10 bg-background"
          />
          <Button onClick={addQuick} disabled={!parsed.title || adding} className="h-10 px-4">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-accent font-medium flex items-center gap-1 transition-colors">
                {(() => {
                  const l = lists.find((x) => x.id === (quickListId || lists[0]?.id))
                  return l ? <>{l.emoji} {l.name}</> : <ListPlus className="w-3 h-3" />
                })()}
                <ChevronDown className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {lists.map((l) => (
                <DropdownMenuItem key={l.id} onClick={() => setQuickListId(l.id)}>
                  {l.emoji} {l.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setListDialog('new')}>+ Daftar baru</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {parsed.priority !== null && (
            <Badge variant="outline" className="text-xs bg-primary/5 border-primary/30 text-primary">
              {PRIORITY[parsed.priority].emoji} {PRIORITY[parsed.priority].label}
            </Badge>
          )}
          {parsedDue && (
            <Badge variant="outline" className="text-xs bg-amber-500/5 border-amber-500/30 text-amber-600 dark:text-amber-400">
              📅 {parsedDue.text}
            </Badge>
          )}
          {parsed.tags.map((t) => (
            <Badge key={t} variant="outline" className="text-xs text-muted-foreground">#{t}</Badge>
          ))}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1 h-7" onClick={() => setListDialog('new')}>
            <ListPlus className="w-3.5 h-3.5" /> Daftar baru
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 no-scrollbar">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border',
              filter === f.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:text-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Daftar */}
      {todos === null ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-2xl" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">🌱</p>
          <p className="text-sm">
            {filter === 'done' ? 'Belum ada tugas yang selesai.' : 'Tidak ada tugas di sini. Santai dulu!'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => {
            const l = lists.find((x) => x.id === g.key)
            const doneCount = g.items.filter((t) => t.done).length
            return (
              <section key={g.key}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color ?? '#8a8a94' }} />
                  <h2 className="text-sm font-bold">
                    {g.emoji ? `${g.emoji} ` : ''}{g.label}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {filter === 'done' ? doneCount : g.items.filter((t) => !t.done).length} aktif
                  </span>
                  <div className="flex-1" />
                  {l && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" aria-label="Kelola daftar">
                          ⋯
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setListDialog(l)}>
                          <Pencil className="w-3.5 h-3.5" /> Ubah daftar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteList(l)} className="text-destructive">
                          <Trash2 className="w-3.5 h-3.5" /> Hapus daftar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <div className="space-y-1.5">
                  {g.items
                    .sort((a, b) => Number(a.done) - Number(b.done) || a.order - b.order)
                    .map((t, idx, arr) => (
                      <TodoRow
                        key={t.id}
                        todo={t}
                        onToggle={() => toggle(t)}
                        onEdit={() => setEditing(t)}
                        onDelete={() => setDeleteTodo(t)}
                        onUp={idx > 0 ? () => move(t, -1) : undefined}
                        onDown={idx < arr.length - 1 ? () => move(t, 1) : undefined}
                        list={lists.find((x) => x.id === t.listId)}
                      />
                    ))}
                  {g.items.length === 0 && (
                    <p className="text-xs text-muted-foreground px-2 py-2">Tidak ada tugas.</p>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* Dialog edit tugas */}
      <EditTodoDialog
        todo={editing}
        lists={lists}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          setTodos((prev) => (prev ? prev.map((x) => (x.id === updated.id ? updated : x)) : prev))
          setEditing(null)
          toast.success('Tugas diperbarui')
        }}
      />

      {/* Dialog daftar baru/ubah */}
      <ListDialog
        target={listDialog}
        onClose={() => setListDialog(null)}
        onSaved={(l) => {
          setLists((prev) => {
            const exists = prev.some((x) => x.id === l.id)
            return exists ? prev.map((x) => (x.id === l.id ? l : x)) : [...prev, l]
          })
          setListDialog(null)
          toast.success(listDialog === 'new' ? 'Daftar dibuat' : 'Daftar diperbarui')
        }}
      />

      {/* Konfirmasi hapus daftar */}
      <AlertDialog open={!!deleteList} onOpenChange={(o) => !o && setDeleteList(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus daftar &ldquo;{deleteList?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Tugas di dalamnya tidak ikut terhapus — hanya lepas dari daftar ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteList) return
                try {
                  await api(`/api/lists/${deleteList.id}`, { method: 'DELETE' })
                  setLists((prev) => prev.filter((x) => x.id !== deleteList.id))
                  toast.success('Daftar dihapus')
                } catch {
                  toast.error('Gagal menghapus daftar')
                } finally {
                  setDeleteList(null)
                }
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Konfirmasi hapus tugas */}
      <AlertDialog open={!!deleteTodo} onOpenChange={(o) => !o && setDeleteTodo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus tugas ini?</AlertDialogTitle>
            <AlertDialogDescription>&ldquo;{deleteTodo?.title}&rdquo; akan dihapus permanen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={removeTodo} className="bg-destructive text-white hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Baris tugas ─────────────────────────────────────────────────────
function TodoRow({
  todo, onToggle, onEdit, onDelete, onUp, onDown, list,
}: {
  todo: Todo
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onUp?: () => void
  onDown?: () => void
  list?: TodoList
}) {
  const due = fmtDue(todo.dueDate)
  const prio = PRIORITY[todo.priority] ?? PRIORITY[1]
  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-2xl border border-border/70 bg-card px-3 py-2.5 transition-all hover:shadow-sm',
        todo.done && 'opacity-60',
      )}
    >
      <button
        onClick={onToggle}
        aria-label={todo.done ? 'Tandai belum selesai' : 'Tandai selesai'}
        className={cn(
          'mt-0.5 w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-all',
          todo.done
            ? 'bg-primary border-primary text-primary-foreground'
            : 'border-muted-foreground/40 hover:border-primary',
        )}
      >
        {todo.done && (
          <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M2 6.5 4.5 9 10 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-snug', todo.done && 'line-through text-muted-foreground')}>
          {todo.title}
        </p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {todo.priority === 2 && (
            <span className="text-[11px] font-semibold text-red-500 flex items-center gap-0.5">
              <Flame className="w-3 h-3" /> Tinggi
            </span>
          )}
          {list && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: list.color }} />
              {list.name}
            </span>
          )}
          {due && (
            <span className="text-[11px] font-medium flex items-center gap-0.5" style={{ color: due.color }}>
              <CalendarClock className="w-3 h-3" /> {due.text}
            </span>
          )}
          {todo.reminderAt && !todo.done && (
            <Bell className="w-3 h-3 text-primary" aria-label="Ada pengingat" />
          )}
          {todo.tags.map((t) => (
            <span key={t} className="text-[11px] text-muted-foreground flex items-center gap-0.5">
              <Tag className="w-2.5 h-2.5" />{t}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 max-sm:opacity-100 transition-opacity">
        {onUp && (
          <button onClick={onUp} aria-label="Naikkan" className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground">
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        )}
        {onDown && (
          <button onClick={onDown} aria-label="Turunkan" className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground">
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={onEdit} aria-label="Ubah tugas" className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete} aria-label="Hapus tugas" className="w-7 h-7 rounded-lg hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Dialog edit tugas ───────────────────────────────────────────────
function EditTodoDialog({
  todo, lists, onClose, onSaved,
}: {
  todo: Todo | null
  lists: TodoList[]
  onClose: () => void
  onSaved: (t: Todo) => void
}) {
  const [title, setTitle] = useState('')
  const [notesText, setNotesText] = useState('')
  const [listId, setListId] = useState<string>('')
  const [priority, setPriority] = useState(1)
  const [due, setDue] = useState('')
  const [reminder, setReminder] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!todo) return
    setTitle(todo.title)
    setNotesText(todo.notes)
    setListId(todo.listId ?? '')
    setPriority(todo.priority)
    setDue(todo.dueDate ? toDateInputValue(new Date(todo.dueDate)) : '')
    setReminder(todo.reminderAt ? toDateTimeInputValue(new Date(todo.reminderAt)) : '')
    setTags(todo.tags)
  }, [todo])

  if (!todo) return null

  const save = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      const updated = await api<Todo>(`/api/todos/${todo.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title,
          notes: notesText,
          listId: listId || null,
          priority,
          dueDate: due ? new Date(due + 'T23:59').toISOString() : null,
          reminderAt: reminder ? new Date(reminder).toISOString() : null,
          tags,
        }),
      })
      onSaved(updated)
    } catch {
      toast.error('Gagal menyimpan tugas')
    } finally {
      setSaving(false)
    }
  }

  const quickReminder = (d: Date) => setReminder(toDateTimeInputValue(d))

  return (
    <Dialog open={!!todo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ubah Tugas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="todo-title">Judul</Label>
            <Input id="todo-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="todo-notes">Catatan (opsional)</Label>
            <Textarea id="todo-notes" value={notesText} onChange={(e) => setNotesText(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Daftar</Label>
              <select
                value={listId}
                onChange={(e) => setListId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Tanpa daftar</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.emoji} {l.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioritas</Label>
              <div className="flex gap-1.5">
                {PRIORITY.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    className={cn(
                      'flex-1 h-9 rounded-md border text-xs font-semibold transition-all',
                      priority === p.value ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                    style={priority === p.value ? { backgroundColor: p.color } : undefined}
                  >
                    {p.emoji} {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="todo-due">Tenggat</Label>
              <Input id="todo-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="todo-rem">Pengingat</Label>
              <Input
                id="todo-rem" type="datetime-local" value={reminder}
                onChange={(e) => setReminder(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => quickReminder(new Date(Date.now() + 3600_000))}>
              +1 jam
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { const d = new Date(); d.setHours(20, 0, 0, 0); quickReminder(d) }}>
              Malam ini
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); quickReminder(d) }}>
              Besok pagi
            </Button>
            {reminder && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => setReminder('')}>
                <BellOff className="w-3 h-3" /> Hapus pengingat
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {tags.map((t) => (
              <Badge key={t} variant="outline" className="gap-1">
                #{t}
                <button onClick={() => setTags((p) => p.filter((x) => x !== t))} aria-label={`Hapus ${t}`}>
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            <Input
              placeholder="Tambah tag + Enter"
              className="h-7 w-40 text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const v = e.currentTarget.value.trim().replace(/^#/, '').toLowerCase()
                  if (v && !tags.includes(v)) setTags((p) => [...p, v])
                  e.currentTarget.value = ''
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={save} disabled={saving || !title.trim()}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Dialog daftar ───────────────────────────────────────────────────
function ListDialog({
  target, onClose, onSaved,
}: {
  target: 'new' | TodoList | null
  onClose: () => void
  onSaved: (l: TodoList) => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(LIST_COLORS[0])
  const [emoji, setEmoji] = useState(LIST_EMOJIS[0])
  const [saving, setSaving] = useState(false)
  const isNew = target === 'new'

  useEffect(() => {
    if (target && target !== 'new') {
      setName(target.name)
      setColor(target.color)
      setEmoji(target.emoji)
    } else if (target === 'new') {
      setName('')
      setColor(LIST_COLORS[Math.floor(Math.random() * LIST_COLORS.length)])
      setEmoji(LIST_EMOJIS[Math.floor(Math.random() * LIST_EMOJIS.length)])
    }
  }, [target])

  if (!target) return null

  const save = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      if (isNew) {
        const l = await api<TodoList>('/api/lists', {
          method: 'POST',
          body: JSON.stringify({ name, color, emoji }),
        })
        onSaved(l)
      } else {
        const l = await api<TodoList>(`/api/lists/${(target as TodoList).id}`, {
          method: 'PUT',
          body: JSON.stringify({ name, color, emoji }),
        })
        onSaved(l)
      }
    } catch {
      toast.error('Gagal menyimpan daftar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Daftar Baru' : 'Ubah Daftar'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="list-name">Nama</Label>
            <Input id="list-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="cth. Proyek Kantor" />
          </div>
          <div className="space-y-1.5">
            <Label>Emoji</Label>
            <div className="flex flex-wrap gap-1">
              {LIST_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={cn('w-9 h-9 rounded-lg text-lg flex items-center justify-center border transition-all', emoji === e ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-accent')}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Warna</Label>
            <div className="flex flex-wrap gap-2">
              {LIST_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`Warna ${c}`}
                  className={cn('w-7 h-7 rounded-full transition-transform', color === c && 'ring-2 ring-offset-2 ring-offset-background scale-110')}
                  style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px ${c}` : undefined }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={save} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
