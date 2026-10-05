'use client'

import { memo, useState } from 'react'
import { Check, X } from 'lucide-react'
import { Markdown } from '@/components/markdown'
import { uid, fmtDue } from '@/lib/client'
import type { BoardData, CanvasItem, ChecklistItem, Note, Todo } from '@/lib/types'
import { cn } from '@/lib/utils'

// ── Kartu teks: markdown mini ───────────────────────────────────────
export const TextCardBody = memo(function TextCardBody({
  text, editing, onChange, onCommit,
}: {
  text: string
  editing: boolean
  onChange: (t: string) => void
  onCommit: () => void
}) {
  if (editing) {
    return (
      <textarea
        data-nodrag
        autoFocus
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        className="w-full h-full resize-none bg-transparent outline-none text-[13px] leading-relaxed"
        placeholder="Tulis apa saja… (Markdown didukung)"
      />
    )
  }
  return (
    <div className="w-full h-full overflow-hidden pointer-events-none select-none">
      <Markdown content={text || '*Kartu kosong — klik dua kali untuk menulis.*'} compact />
    </div>
  )
})

// ── Kartu catatan: embed isi note ───────────────────────────────────
export const NoteCardBody = memo(function NoteCardBody({ note }: { note?: Note }) {
  if (!note) {
    return <p className="text-xs text-muted-foreground italic">Catatan sudah dihapus.</p>
  }
  return (
    <div className="w-full h-full overflow-hidden select-none">
      <p className="text-[11px] font-bold text-primary mb-1 truncate">📝 {note.title}</p>
      <div className="h-[calc(100%-1.75rem)] overflow-hidden pointer-events-none">
        <Markdown content={note.content.slice(0, 700) || '_Catatan kosong_'} compact />
      </div>
    </div>
  )
})

// ── Kartu todo: daftar tugas live ───────────────────────────────────
export const TodoCardBody = memo(function TodoCardBody({
  listId, listName, listColor, todos, onToggle,
}: {
  listId?: string
  listName: string
  listColor: string
  todos: Todo[]
  onToggle: (t: Todo) => void
}) {
  const active = todos.filter((t) => !t.done)
  const done = todos.filter((t) => t.done)
  const shown = [...active, ...done].slice(0, 8)
  if (!listId) {
    return <p className="text-xs text-muted-foreground italic">Daftar tugas sudah dihapus.</p>
  }
  return (
    <div className="w-full h-full flex flex-col select-none">
      <p className="text-[11px] font-bold mb-1.5 flex items-center gap-1.5 truncate">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: listColor }} />
        ✅ {listName}
        <span className="text-muted-foreground font-medium ml-auto">{active.length} aktif</span>
      </p>
      <div className="flex-1 overflow-hidden space-y-1" data-nodrag>
        {shown.length === 0 ? (
          <p className="text-xs text-muted-foreground italic pt-2">Tidak ada tugas di daftar ini.</p>
        ) : (
          shown.map((t) => (
            <button
              key={t.id}
              onClick={() => onToggle(t)}
              className="w-full flex items-center gap-1.5 text-left group"
            >
              <span
                className={cn(
                  'w-3.5 h-3.5 rounded border-[1.5px] shrink-0 flex items-center justify-center transition-colors',
                  t.done ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/50',
                )}
              >
                {t.done && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
              </span>
              <span className={cn('text-[11.5px] leading-tight truncate', t.done && 'line-through text-muted-foreground')}>
                {t.title}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
})

// ── Kartu checklist mandiri ─────────────────────────────────────────
export function ChecklistCardBody({
  item, onUpdate,
}: {
  item: CanvasItem
  onUpdate: (fn: (d: BoardData) => BoardData) => void
}) {
  const cl = item.data.checklist ?? { title: 'Checklist', items: [] }
  const [editingId, setEditingId] = useState<string | null>(null)

  const setChecklist = (next: NonNullable<CanvasItem['data']['checklist']>) => {
    onUpdate((d) => ({
      ...d,
      items: d.items.map((it) => (it.id === item.id ? { ...it, data: { ...it.data, checklist: next } } : it)),
    }))
  }

  const toggle = (id: string) =>
    setChecklist({ ...cl, items: cl.items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)) })

  const add = (text: string) => {
    if (!text.trim()) return
    setChecklist({ ...cl, items: [...cl.items, { id: uid(), text: text.trim(), done: false }] })
  }

  const remove = (id: string) => setChecklist({ ...cl, items: cl.items.filter((i) => i.id !== id) })

  const rename = (id: string, text: string) =>
    setChecklist({ ...cl, items: cl.items.map((i) => (i.id === id ? { ...i, text } : i)) })

  const doneCount = cl.items.filter((i) => i.done).length

  return (
    <div className="w-full h-full flex flex-col" data-nodrag>
      <p className="text-[11px] font-bold mb-1.5 truncate">
        ☑️ {cl.title || 'Checklist'}
        <span className="text-muted-foreground font-medium ml-1.5">
          {doneCount}/{cl.items.length}
        </span>
      </p>
      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {cl.items.map((i) => (
          <div key={i.id} className="group flex items-center gap-1.5">
            <button
              onClick={() => toggle(i.id)}
              className={cn(
                'w-3.5 h-3.5 rounded border-[1.5px] shrink-0 flex items-center justify-center transition-colors',
                i.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-muted-foreground/50',
              )}
              aria-label="Centang"
            >
              {i.done && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
            </button>
            {editingId === i.id ? (
              <input
                autoFocus
                defaultValue={i.text}
                onBlur={(e) => { rename(i.id, e.target.value.trim() || i.text); setEditingId(null) }}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                className="flex-1 min-w-0 text-[11.5px] bg-transparent outline-none border-b border-primary/50"
              />
            ) : (
              <button
                onDoubleClick={() => setEditingId(i.id)}
                className={cn(
                  'flex-1 min-w-0 text-left text-[11.5px] truncate',
                  i.done ? 'line-through text-muted-foreground' : '',
                )}
                title="Klik dua kali untuk mengubah"
              >
                {i.text}
              </button>
            )}
            <button
              onClick={() => remove(i.id)}
              aria-label="Hapus item"
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <input
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            add(e.currentTarget.value)
            e.currentTarget.value = ''
          }
        }}
        placeholder="+ item, Enter"
        className="mt-1.5 text-[11.5px] bg-transparent outline-none placeholder:text-muted-foreground/60 border-t border-border/50 pt-1.5"
      />
    </div>
  )
}

// ── Kartu gambar ────────────────────────────────────────────────────
export function ImageCardBody({
  item, onUpdate,
}: {
  item: CanvasItem
  onUpdate: (fn: (d: BoardData) => BoardData) => void
}) {
  const setCaption = (caption: string) =>
    onUpdate((d) => ({
      ...d,
      items: d.items.map((it) => (it.id === item.id ? { ...it, data: { ...it.data, caption } } : it)),
    }))

  if (!item.data.src) {
    return <p className="text-xs text-muted-foreground italic flex items-center justify-center h-full">🖼️ Gambar kosong</p>
  }
  return (
    <div className="w-full h-full flex flex-col select-none">
      { }
      <img src={item.data.src} alt={item.data.caption || 'Gambar kanvas'} className="flex-1 min-h-0 w-full object-cover rounded-lg pointer-events-none" draggable={false} />
      <input
        data-nodrag
        value={item.data.caption ?? ''}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Keterangan…"
        className="text-[11px] mt-1 bg-transparent outline-none placeholder:text-muted-foreground/60 shrink-0"
      />
    </div>
  )
}

// util kecil untuk footer kartu todo
export function todoDueLabel(t: Todo): string | null {
  const d = fmtDue(t.dueDate)
  return d ? d.text : null
}
