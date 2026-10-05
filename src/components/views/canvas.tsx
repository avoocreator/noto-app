'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CheckCircle2, Image as ImageIcon, ListTodo, Loader2, Maximize,
  Minus, MoreHorizontal, Pencil, Plus, Repeat2, StickyNote, Trash2, Type, X,
} from 'lucide-react'
import { api, uid } from '@/lib/client'
import { CARD_COLORS, TINTS, type Board, type BoardData, type CanvasItem, type CanvasItemType, type Note, type Todo, type TodoList } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  TextCardBody, NoteCardBody, TodoCardBody, ChecklistCardBody, ImageCardBody,
} from './canvas-cards'

interface ListWithTodos extends TodoList {
  todos: Todo[]
}

const CARD_DEFAULTS: Record<CanvasItemType, { w: number; h: number }> = {
  text: { w: 290, h: 170 },
  note: { w: 300, h: 220 },
  todo: { w: 280, h: 240 },
  image: { w: 260, h: 260 },
  checklist: { w: 260, h: 230 },
}

const MIN_W = 150
const MIN_H = 100

export function CanvasView({ navigate }: { navigate: (v: string, p?: string) => void }) {
  const [boards, setBoards] = useState<Board[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [lists, setLists] = useState<ListWithTodos[]>([])

  const [vp, setVp] = useState({ x: 0, y: 0, k: 1 })
  const [connectMode, setConnectMode] = useState(false)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [renameBoard, setRenameBoard] = useState<Board | null>(null)
  const [deleteBoard, setDeleteBoard] = useState<Board | null>(null)
  const [picker, setPicker] = useState<'note' | 'todo' | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirtyRef = useRef(false)
  const dragRef = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null)
  const resizeRef = useRef<{ id: string; sx: number; sy: number; ow: number; oh: number } | null>(null)
  const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const pinchRef = useRef<{ d0: number; k0: number; cx: number; cy: number; x0: number; y0: number } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const vpRef = useRef(vp)
  vpRef.current = vp

  const board = boards?.find((b) => b.id === activeId) ?? null
  const data: BoardData = board?.data ?? { items: [], edges: [] }

  const boardsRef = useRef<Board[]>([])
  boardsRef.current = boards ?? []

  // ── Muat data ─────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([api<Board[]>('/api/boards'), api<Note[]>('/api/notes'), api<ListWithTodos[]>('/api/lists')])
      .then(([b, n, l]) => {
        setBoards(b)
        setNotes(n)
        setLists(l)
        if (b.length > 0) setActiveId(b[0].id)
      })
      .catch(() => {
        setBoards([])
        toast.error('Gagal memuat papan')
      })
  }, [])

  // ── Simpan otomatis ───────────────────────────────────────────────
  const persist = useCallback(async () => {
    if (!dirtyRef.current || !activeId) return
    dirtyRef.current = false
    setSaveState('saving')
    const current = boardsRef.current.find((b) => b.id === activeId)
    if (!current) return
    try {
      await api(`/api/boards/${activeId}`, { method: 'PUT', body: JSON.stringify({ data: current.data }) })
      setSaveState('saved')
    } catch {
      setSaveState('idle')
      toast.error('Gagal menyimpan papan')
    }
  }, [activeId])

  const updateData = useCallback((fn: (d: BoardData) => BoardData) => {
    dirtyRef.current = true
    setSaveState('idle')
    setBoards((prev) =>
      prev ? prev.map((b) => (b.id === activeId ? { ...b, data: fn(b.data) } : b)) : prev,
    )
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void persist(), 800)
  }, [activeId, persist])

  // Simpan saat tab disembunyikan / ditutup
  useEffect(() => {
    const flush = () => {
      if (dirtyRef.current) void persist()
    }
    document.addEventListener('visibilitychange', flush)
    window.addEventListener('beforeunload', flush)
    return () => {
      document.removeEventListener('visibilitychange', flush)
      window.removeEventListener('beforeunload', flush)
    }
  }, [persist])

  // ── Zoom wheel (non-passive) ──────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      setVp((v) => {
        const factor = Math.exp(-e.deltaY * 0.0016)
        const k2 = Math.max(0.25, Math.min(2.5, v.k * factor))
        const wx = (px - v.x) / v.k
        const wy = (py - v.y) / v.k
        return { k: k2, x: px - wx * k2, y: py - wy * k2 }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Escape membatalkan mode sambung / seleksi
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConnectMode(false)
        setConnectFrom(null)
        setSelectedEdge(null)
        setEditingTextId(null)
      }
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])

  // ── Pan & pinch (di latar kanvas) ─────────────────────────────────
  const onBgPointerDown = (e: React.PointerEvent) => {
    const el = e.target as HTMLElement
    if (el.closest('[data-card]') || el.closest('button, input, textarea, [data-nodrag]')) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinchRef.current = {
        d0: Math.hypot(a.x - b.x, a.y - b.y),
        k0: vpRef.current.k,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
        x0: vpRef.current.x,
        y0: vpRef.current.y,
      }
      panRef.current = null
    } else if (pointers.current.size === 1) {
      panRef.current = { sx: e.clientX, sy: e.clientY, ox: vpRef.current.x, oy: vpRef.current.y }
    }
  }

  const onBgPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && pinchRef.current) {
      const [a, b] = [...pointers.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const p = pinchRef.current
      const k2 = Math.max(0.25, Math.min(2.5, p.k0 * (d / Math.max(1, p.d0))))
      const wx = (p.cx - p.x0) / p.k0
      const wy = (p.cy - p.y0) / p.k0
      const rect = containerRef.current?.getBoundingClientRect()
      const px = p.cx - (rect?.left ?? 0)
      const py = p.cy - (rect?.top ?? 0)
      setVp({ k: k2, x: px - wx * k2, y: py - wy * k2 })
    } else if (panRef.current && pointers.current.size === 1) {
      const p = panRef.current
      setVp((v) => ({ ...v, x: p.ox + (e.clientX - p.sx), y: p.oy + (e.clientY - p.sy) }))
    }
  }

  const onBgPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchRef.current = null
    if (pointers.current.size === 0) panRef.current = null
  }

  // ── Kartu ─────────────────────────────────────────────────────────
  const screenToWorldCenter = () => {
    const rect = containerRef.current?.getBoundingClientRect()
    const px = (rect?.width ?? 0) / 2
    const py = (rect?.height ?? 0) / 2
    const jx = (Math.random() - 0.5) * 80
    const jy = (Math.random() - 0.5) * 80
    return { x: (px - vpRef.current.x) / vpRef.current.k + jx, y: (py - vpRef.current.y) / vpRef.current.k + jy }
  }

  const addItemAt = (type: CanvasItemType, extra: Partial<CanvasItem['data']> = {}, pos?: { x: number; y: number }) => {
    const def = CARD_DEFAULTS[type]
    const c = pos ?? screenToWorldCenter()
    const item: CanvasItem = {
      id: uid(), type,
      x: Math.round(c.x - def.w / 2), y: Math.round(c.y - def.h / 2),
      w: def.w, h: def.h, color: '', data: { ...extra },
    }
    updateData((d) => ({ ...d, items: [...d.items, item] }))
    if (type === 'text') setTimeout(() => setEditingTextId(item.id), 60)
    return item
  }

  const moveItem = (id: string, x: number, y: number) =>
    updateData((d) => ({ ...d, items: d.items.map((it) => (it.id === id ? { ...it, x, y } : it)) }))

  const resizeItem = (id: string, w: number, h: number) =>
    updateData((d) => ({ ...d, items: d.items.map((it) => (it.id === id ? { ...it, w, h } : it)) }))

  const patchItem = (id: string, patch: Partial<CanvasItem>) =>
    updateData((d) => ({ ...d, items: d.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }))

  const deleteItem = (id: string) =>
    updateData((d) => ({
      ...d,
      items: d.items.filter((it) => it.id !== id),
      edges: d.edges.filter((e) => e.from !== id && e.to !== id),
    }))

  const duplicateItem = (id: string) => {
    const src = data.items.find((i) => i.id === id)
    if (!src) return
    const copy: CanvasItem = { ...src, id: uid(), x: src.x + 30, y: src.y + 30, data: JSON.parse(JSON.stringify(src.data)) }
    updateData((d) => ({ ...d, items: [...d.items, copy] }))
  }

  // ── Sambungan ─────────────────────────────────────────────────────
  const handleConnectClick = (id: string) => {
    if (!connectFrom) {
      setConnectFrom(id)
      toast('Titik awal dipilih — klik kartu tujuan', { duration: 3000 })
      return
    }
    if (connectFrom === id) {
      setConnectFrom(null)
      return
    }
    const exists = data.edges.some(
      (e) => (e.from === connectFrom && e.to === id) || (e.from === id && e.to === connectFrom),
    )
    if (!exists) {
      updateData((d) => ({ ...d, edges: [...d.edges, { id: uid(), from: connectFrom, to: id }] }))
    } else {
      toast.info('Kartu ini sudah terhubung')
    }
    setConnectFrom(null)
    setConnectMode(false)
  }

  // ── Interaksi todo di kartu ───────────────────────────────────────
  const toggleListTodo = async (t: Todo) => {
    setLists((prev) =>
      prev.map((l) =>
        l.id === t.listId ? { ...l, todos: l.todos.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) } : l,
      ),
    )
    try {
      await api(`/api/todos/${t.id}`, { method: 'PUT', body: JSON.stringify({ done: !t.done }) })
    } catch {
      toast.error('Gagal memperbarui tugas')
    }
  }

  // ── Papan ─────────────────────────────────────────────────────────
  const createBoard = async () => {
    try {
      const b = await api<Board>('/api/boards', { method: 'POST', body: JSON.stringify({ name: `Papan ${boards!.length + 1}` }) })
      setBoards((prev) => [...(prev ?? []), b])
      setActiveId(b.id)
      setVp({ x: 0, y: 0, k: 1 })
    } catch {
      toast.error('Gagal membuat papan')
    }
  }

  const removeBoard = async () => {
    if (!deleteBoard) return
    try {
      await api(`/api/boards/${deleteBoard.id}`, { method: 'DELETE' })
      const rest = (boards ?? []).filter((b) => b.id !== deleteBoard.id)
      setBoards(rest)
      if (activeId === deleteBoard.id) setActiveId(rest[0]?.id ?? null)
      toast.success('Papan dihapus')
    } catch {
      toast.error('Gagal menghapus papan')
    } finally {
      setDeleteBoard(null)
    }
  }

  const toggleDone = (t: Todo) => void toggleListTodo(t)

  const byId = (id: string) => data.items.find((i) => i.id === id)
  const edgeColors = [...new Set(data.edges.map((e) => e.color ?? 'var(--primary)'))]

  return (
    <div className="relative h-[calc(100dvh-3.5rem)] md:h-screen overflow-hidden bg-background">
      {/* Bar atas */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center gap-2 px-3 py-2.5 bg-background/80 backdrop-blur-md border-b border-border/40">
        <span className="text-sm font-bold hidden sm:inline mr-1">Kanvas</span>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1">
          {boards === null ? (
            <Skeleton className="h-8 w-40 rounded-lg" />
          ) : boards.length === 0 ? null : (
            boards.map((b) => (
              <button
                key={b.id}
                onClick={() => { setActiveId(b.id); setConnectFrom(null) }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border',
                  b.id === activeId
                    ? 'bg-primary/15 text-primary border-primary/40'
                    : 'text-muted-foreground border-transparent hover:bg-accent',
                )}
              >
                {b.name}
              </button>
            ))
          )}
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={createBoard}>
            <Plus className="w-3.5 h-3.5" /> Papan
          </Button>
        </div>
        {board && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Menu papan">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setRenameBoard(board)}>
                <Pencil className="w-3.5 h-3.5" /> Ganti nama
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDeleteBoard(board)} className="text-destructive">
                <Trash2 className="w-3.5 h-3.5" /> Hapus papan
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <span className="text-[11px] text-muted-foreground w-16 text-right hidden sm:block">
          {saveState === 'saving' ? (
            <span className="inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Simpan…</span>
          ) : saveState === 'saved' ? 'Tersimpan ✓' : ''}
        </span>
      </div>

      {/* Dunia kanvas */}
      <div
        ref={containerRef}
        className="absolute inset-0 canvas-dots touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={onBgPointerDown}
        onPointerMove={onBgPointerMove}
        onPointerUp={onBgPointerUp}
        onPointerCancel={onBgPointerUp}
        onDoubleClick={(e) => {
          const el = e.target as HTMLElement
          if (el.closest('[data-card],button,input,textarea')) return
          const rect = containerRef.current!.getBoundingClientRect()
          const wx = (e.clientX - rect.left - vp.x) / vp.k
          const wy = (e.clientY - rect.top - vp.y) / vp.k
          addItemAt('text', {}, { x: wx, y: wy })
        }}
      >
        {board && (
          <div
            className="absolute left-0 top-0"
            style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.k})`, transformOrigin: '0 0' }}
          >
            {/* Garis sambungan */}
            <svg style={{ position: 'absolute', overflow: 'visible', width: 1, height: 1, pointerEvents: 'none' }}>
              <defs>
                {edgeColors.map((c) => (
                  <marker
                    key={c}
                    id={`arr-${c.replace(/[^a-z0-9]/gi, '')}`}
                    viewBox="0 0 10 10" refX="9" refY="5"
                    markerWidth="7" markerHeight="7" orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 9 5 L 0 9 z" fill={c} />
                  </marker>
                ))}
              </defs>
              {data.edges.map((e) => {
                const a = byId(e.from)
                const b = byId(e.to)
                if (!a || !b) return null
                const x1 = a.x + a.w / 2, y1 = a.y + a.h / 2
                const x2 = b.x + b.w / 2, y2 = b.y + b.h / 2
                const c1x = x1 + (x2 - x1) * 0.45, c2x = x2 - (x2 - x1) * 0.45
                const color = e.color ?? 'var(--primary)'
                const d = `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`
                const mk = `url(#arr-${color.replace(/[^a-z0-9]/gi, '')})`
                return (
                  <g key={e.id}>
                    <path
                      d={d} fill="none" stroke={color} strokeWidth={2.5}
                      strokeDasharray={selectedEdge === e.id ? '7 5' : undefined}
                      markerEnd={mk} opacity={0.85}
                    />
                    <path
                      d={d} fill="none" stroke="transparent" strokeWidth={18}
                      style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                      onClick={() => setSelectedEdge(e.id)}
                    />
                  </g>
                )
              })}
            </svg>

            {/* Kartu */}
            {data.items.map((item) => {
              const tint = TINTS[item.color ?? ''] ?? TINTS['']
              const isConnectSource = connectFrom === item.id
              return (
                <div
                  key={item.id}
                  data-card
                  className={cn(
                    'absolute rounded-2xl border-2 shadow-md overflow-hidden group/card transition-shadow',
                    'hover:shadow-xl',
                    (connectMode || isConnectSource) && 'cursor-pointer',
                  )}
                  style={{
                    left: item.x, top: item.y, width: item.w, height: item.h,
                    background: tint.bg, borderColor: isConnectSource ? 'var(--primary)' : tint.border,
                    outline: isConnectSource ? '2px dashed var(--primary)' : undefined,
                    outlineOffset: 3,
                  }}
                  onPointerDown={(e) => {
                    const el = e.target as HTMLElement
                    if (connectMode) return
                    if (el.closest('[data-nodrag], button, input, textarea, img')) return
                    dragRef.current = { id: item.id, sx: e.clientX, sy: e.clientY, ox: item.x, oy: item.y, moved: false }
                    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                  }}
                  onPointerMove={(e) => {
                    const dr = dragRef.current
                    if (!dr || dr.id !== item.id) return
                    const dx = (e.clientX - dr.sx) / vpRef.current.k
                    const dy = (e.clientY - dr.sy) / vpRef.current.k
                    if (Math.abs(dx) + Math.abs(dy) > 3) dr.moved = true
                    moveItem(item.id, Math.round(dr.ox + dx), Math.round(dr.oy + dy))
                  }}
                  onPointerUp={(e) => {
                    const dr = dragRef.current
                    dragRef.current = null
                    if (dr?.id === item.id && dr.moved) {
                      dirtyRef.current = true
                      if (saveTimer.current) clearTimeout(saveTimer.current)
                      saveTimer.current = setTimeout(() => void persist(), 400)
                    }
                    void e
                  }}
                  onClick={() => {
                    if (connectMode) handleConnectClick(item.id)
                  }}
                  onDoubleClick={(e) => {
                    const el = e.target as HTMLElement
                    if (el.closest('button, input, textarea')) return
                    if (item.type === 'text') setEditingTextId(item.id)
                  }}
                >
                  {/* Tombol menu kartu */}
                  <div
                    className="absolute top-1 right-1 z-10 opacity-0 group-hover/card:opacity-100 transition-opacity"
                    data-nodrag
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-6 h-6 rounded-md bg-background/85 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Menu kartu">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                        <div className="flex gap-1 px-2 py-1.5">
                          {CARD_COLORS.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => patchItem(item.id, { color: c.id })}
                              aria-label={`Warna ${c.name}`}
                              className={cn('w-4.5 h-4.5 w-[18px] h-[18px] rounded-full border', item.color === c.id && 'ring-2 ring-ring ring-offset-1 ring-offset-background')}
                              style={{ background: TINTS[c.id]?.border ?? 'var(--border)' }}
                            />
                          ))}
                        </div>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => duplicateItem(item.id)}>
                          <Repeat2 className="w-3.5 h-3.5" /> Duplikat
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteItem(item.id)} className="text-destructive">
                          <Trash2 className="w-3.5 h-3.5" /> Hapus
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Isi kartu */}
                  <div className="w-full h-full p-3 overflow-hidden">
                    {item.type === 'text' && (
                      <TextCardBody
                        text={item.data.text ?? ''}
                        editing={editingTextId === item.id}
                        onChange={(t) => patchItem(item.id, { data: { ...item.data, text: t } })}
                        onCommit={() => setEditingTextId(null)}
                      />
                    )}
                    {item.type === 'note' && (
                      <>
                        <NoteCardBody note={notes.find((n) => n.id === item.data.noteId)} />
                        <button
                          data-nodrag
                          onClick={() => item.data.noteId && navigate('notes', item.data.noteId)}
                          className="absolute bottom-2 left-3 text-[11px] font-semibold text-primary hover:underline"
                        >
                          Buka catatan →
                        </button>
                      </>
                    )}
                    {item.type === 'todo' && (
                      <>
                        <TodoCardBody
                          listId={item.data.listId}
                          listName={lists.find((l) => l.id === item.data.listId)?.name ?? '—'}
                          listColor={lists.find((l) => l.id === item.data.listId)?.color ?? '#8a8a94'}
                          todos={lists.find((l) => l.id === item.data.listId)?.todos ?? []}
                          onToggle={toggleDone}
                        />
                        <button
                          data-nodrag
                          onClick={() => navigate('todos')}
                          className="absolute bottom-2 left-3 text-[11px] font-semibold text-primary hover:underline"
                        >
                          Kelola di Tugas →
                        </button>
                      </>
                    )}
                    {item.type === 'checklist' && <ChecklistCardBody item={item} onUpdate={updateData} />}
                    {item.type === 'image' && <ImageCardBody item={item} onUpdate={updateData} />}
                  </div>

                  {/* Handle resize */}
                  <div
                    data-nodrag
                    className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize touch-none"
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      resizeRef.current = { id: item.id, sx: e.clientX, sy: e.clientY, ow: item.w, oh: item.h }
                      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                    }}
                    onPointerMove={(e) => {
                      const rz = resizeRef.current
                      if (!rz || rz.id !== item.id) return
                      resizeItem(
                        item.id,
                        Math.max(MIN_W, Math.round(rz.ow + (e.clientX - rz.sx) / vpRef.current.k)),
                        Math.max(MIN_H, Math.round(rz.oh + (e.clientY - rz.sy) / vpRef.current.k)),
                      )
                    }}
                    onPointerUp={() => {
                      if (resizeRef.current) {
                        resizeRef.current = null
                        dirtyRef.current = true
                        saveTimer.current = setTimeout(() => void persist(), 400)
                      }
                    }}
                  >
                    <svg viewBox="0 0 20 20" className="w-full h-full text-muted-foreground/50">
                      <path d="M19 7 7 19M19 13l-6 6" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Kosong */}
        {board && data.items.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground pointer-events-none select-none">
            { }
            <img src="/icons/logo-64.png" alt="" className="w-12 h-12 rounded-xl opacity-70" />
            <p className="text-sm font-medium">Kanvas kosong</p>
            <p className="text-xs">Klik tombol + di kanan bawah, atau klik dua kali di sini</p>
          </div>
        )}
      </div>

      {/* Kontrol zoom & sambung */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5">
        <div className="flex items-center rounded-xl border border-border bg-background/90 backdrop-blur shadow-sm overflow-hidden">
          <button onClick={() => setVp((v) => ({ ...v, k: Math.max(0.25, v.k - 0.2) }))} className="w-9 h-9 flex items-center justify-center hover:bg-accent" aria-label="Perkecil">
            <Minus className="w-4 h-4" />
          </button>
          <button onClick={() => setVp({ x: 0, y: 0, k: 1 })} className="w-11 h-9 flex items-center justify-center text-xs font-bold hover:bg-accent" aria-label="Reset tampilan">
            {Math.round(vp.k * 100)}%
          </button>
          <button onClick={() => setVp((v) => ({ ...v, k: Math.min(2.5, v.k + 0.2) }))} className="w-9 h-9 flex items-center justify-center hover:bg-accent" aria-label="Perbesar">
            <Plus className="w-4 h-4" />
          </button>
          <button onClick={() => setVp((v) => ({ ...v, k: 1 }))} className="w-9 h-9 hidden sm:flex items-center justify-center hover:bg-accent border-l border-border" aria-label="Pusatkan">
            <Maximize className="w-4 h-4" />
          </button>
        </div>
        <Button
          variant={connectMode ? 'default' : 'outline'}
          size="sm"
          className="h-9 gap-1.5 text-xs"
          onClick={() => { setConnectMode((m) => !m); setConnectFrom(null) }}
        >
          <Repeat2 className="w-3.5 h-3.5" />
          {connectMode ? 'Batal Sambung' : 'Sambungkan'}
        </Button>
      </div>

      {connectMode && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-full font-semibold shadow-lg animate-fade-in">
          Klik kartu awal, lalu kartu tujuan
        </div>
      )}

      {/* FAB tambah */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            try {
              const { compressImage } = await import('@/lib/client')
              const src = await compressImage(f, 1400, 0.82)
              addItemAt('image', { src, caption: '' })
            } catch {
              toast.error('Gagal memproses gambar')
            }
          }}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
              aria-label="Tambah kartu"
            >
              <Plus className="w-6 h-6" strokeWidth={2.5} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="w-48">
            <DropdownMenuItem onClick={() => addItemAt('text')}>
              <Type className="w-4 h-4" /> Kartu Teks
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPicker('note')}>
              <StickyNote className="w-4 h-4" /> Dari Catatan…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPicker('todo')}>
              <ListTodo className="w-4 h-4" /> Daftar Tugas…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileRef.current?.click()}>
              <ImageIcon className="w-4 h-4" /> Gambar…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addItemAt('checklist', { checklist: { title: 'Checklist baru', items: [] } })}>
              <CheckCircle2 className="w-4 h-4" /> Checklist
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Picker catatan / daftar */}
      <Dialog open={!!picker} onOpenChange={(o) => !o && setPicker(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{picker === 'note' ? 'Pilih Catatan' : 'Pilih Daftar Tugas'}</DialogTitle>
          </DialogHeader>
          <div className="max-h-72 overflow-y-auto space-y-1.5 py-1">
            {picker === 'note' &&
              (notes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Belum ada catatan.</p>
              ) : (
                notes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      addItemAt('note', { noteId: n.id })
                      setPicker(null)
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl border border-border hover:bg-accent transition-colors"
                  >
                    <p className="text-sm font-semibold truncate">📝 {n.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.content.slice(0, 60) || 'Kosong'}</p>
                  </button>
                ))
              ))}
            {picker === 'todo' &&
              (lists.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Belum ada daftar tugas.</p>
              ) : (
                lists.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => {
                      addItemAt('todo', { listId: l.id })
                      setPicker(null)
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl border border-border hover:bg-accent transition-colors flex items-center gap-2"
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
                    <span className="text-sm font-semibold">{l.emoji} {l.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{l.todos.filter((t) => !t.done).length} aktif</span>
                  </button>
                ))
              ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename papan */}
      <RenameDialog
        key={renameBoard?.id ?? 'none'}
        board={renameBoard}
        onClose={() => setRenameBoard(null)}
        onSaved={(b) => {
          setBoards((prev) => (prev ? prev.map((x) => (x.id === b.id ? { ...x, name: b.name } : x)) : prev))
          setRenameBoard(null)
        }}
      />

      {/* Konfirmasi hapus papan */}
      <AlertDialog open={!!deleteBoard} onOpenChange={(o) => !o && setDeleteBoard(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus papan &ldquo;{deleteBoard?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>Semua kartu dan garis di papan ini akan hilang permanen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={removeBoard} className="bg-destructive text-white hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Klik garis untuk hapus */}
      <AlertDialog open={!!selectedEdge} onOpenChange={(o) => !o && setSelectedEdge(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus sambungan ini?</AlertDialogTitle>
            <AlertDialogDescription>Garis antara kedua kartu akan diputus.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (!selectedEdge) return
                updateData((d) => ({ ...d, edges: d.edges.filter((e) => e.id !== selectedEdge) }))
                setSelectedEdge(null)
              }}
            >
              Putuskan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function RenameDialog({
  board, onClose, onSaved,
}: {
  board: Board | null
  onClose: () => void
  onSaved: (b: Board) => void
}) {
  const [name, setName] = useState(board?.name ?? '')
  if (!board) return null
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Ganti Nama Papan</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="board-name">Nama</Label>
          <Input id="board-name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && name.trim() && onSaved({ ...board, name: name.trim() })} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}><X className="w-3.5 h-3.5" />Batal</Button>
          <Button disabled={!name.trim()} onClick={() => onSaved({ ...board, name: name.trim() })}>Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
