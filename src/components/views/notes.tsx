'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, Bold, Code, Eye, Heading1, Heading2, Heading3, Image as ImageIcon, Italic,
  Link2, List, ListTodo, Loader2, Minus, PenLine, Pin, PinOff, Plus, Quote,
  Search, Strikethrough, Trash2, X,
} from 'lucide-react'
import { api, compressImage, relTime } from '@/lib/client'
import type { Note } from '@/lib/types'
import { useSettings } from '@/lib/store'
import { Markdown, toggleMarkdownCheck } from '@/components/markdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const FONT_CLASS: Record<string, string> = {
  sans: 'font-sans',
  serif: 'font-serif',
  mono: 'font-mono',
}

// Toolbar markdown — di scope modul agar tidak membuat closure ref saat render
export type ToolId =
  | 'bold' | 'italic' | 'strike' | 'h1' | 'h2' | 'h3'
  | 'list' | 'check' | 'quote' | 'code' | 'link' | 'hr'

const TOOL_DEFS: { id: ToolId; icon: typeof Bold; label: string }[] = [
  { id: 'bold', icon: Bold, label: 'Tebal' },
  { id: 'italic', icon: Italic, label: 'Miring' },
  { id: 'strike', icon: Strikethrough, label: 'Coret' },
  { id: 'h1', icon: Heading1, label: 'Judul 1' },
  { id: 'h2', icon: Heading2, label: 'Judul 2' },
  { id: 'h3', icon: Heading3, label: 'Judul 3' },
  { id: 'list', icon: List, label: 'Daftar' },
  { id: 'check', icon: ListTodo, label: 'Checklist' },
  { id: 'quote', icon: Quote, label: 'Kutipan' },
  { id: 'code', icon: Code, label: 'Kode' },
  { id: 'link', icon: Link2, label: 'Tautan' },
  { id: 'hr', icon: Minus, label: 'Garis' },
]

export function NotesView({ param, navigate }: { param: string | null; navigate: (v: string, p?: string) => void }) {
  const settings = useSettings()
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(param)
  const [search, setSearch] = useState('')
  const [mobilePane, setMobilePane] = useState<'edit' | 'preview'>('edit')
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Konten editor aktif
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [pinned, setPinned] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [dirty, setDirty] = useState(false)
  // Target catatan yang sudah disinkronkan ke editor (undefined = belum pernah)
  const [synced, setSynced] = useState<string | null | undefined>(undefined)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    api<Note[]>('/api/notes')
      .then((list) => {
        if (alive) setNotes(list)
      })
      .catch(() => {
        if (!alive) return
        setNotes([])
        toast.error('Gagal memuat catatan')
      })
    return () => {
      alive = false
    }
  }, [])

  // Sinkronkan editor saat target catatan berubah — pola "adjust state
  // during render" (https://react.dev/learn/you-might-not-need-an-effect)
  const target = notes ? (param ?? notes[0]?.id ?? null) : null
  if (notes && target !== synced) {
    setSynced(target)
    setActiveId(target)
    const note = notes.find((n) => n.id === target)
    if (note) {
      setTitle(note.title)
      setContent(note.content)
      setTags(note.tags)
      setPinned(note.pinned)
    } else if (target === null) {
      setTitle('')
      setContent('')
      setTags([])
      setPinned(false)
    }
    setDirty(false)
  }

  // Auto-save (debounce 700ms)
  useEffect(() => {
    if (!activeId || !dirty) return
    const iv = setTimeout(async () => {
      setSaving('saving')
      try {
        const updated = await api<Note>(`/api/notes/${activeId}`, {
          method: 'PUT',
          body: JSON.stringify({ title, content, tags, pinned }),
        })
        setNotes((prev) =>
          prev
            ? prev
                .map((n) => (n.id === updated.id ? { ...updated, tags: updated.tags } : n))
                .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
            : prev,
        )
        setDirty(false)
        setSaving('saved')
      } catch {
        setSaving('idle')
        toast.error('Gagal menyimpan catatan')
      }
    }, 700)
    return () => clearTimeout(iv)
  }, [title, content, tags, pinned, activeId, dirty])

  const edit = (fn: () => void) => {
    setDirty(true)
    fn()
  }

  const createNote = async () => {
    try {
      const n = await api<Note>('/api/notes', {
        method: 'POST',
        body: JSON.stringify({ title: 'Catatan tanpa judul', content: '' }),
      })
      setNotes((prev) => [n, ...(prev ?? [])])
      navigate('notes', n.id)
      setTitle(n.title)
      setContent(n.content)
      setTags(n.tags)
      setPinned(n.pinned)
      setTimeout(() => taRef.current?.focus(), 100)
    } catch {
      toast.error('Gagal membuat catatan')
    }
  }

  const deleteNote = async () => {
    if (!activeId) return
    try {
      await api(`/api/notes/${activeId}`, { method: 'DELETE' })
      const rest = (notes ?? []).filter((n) => n.id !== activeId)
      setNotes(rest)
      navigate('notes')
      setDeleteOpen(false)
      toast.success('Catatan dihapus')
    } catch {
      toast.error('Gagal menghapus catatan')
    }
  }

  const togglePin = () => edit(() => setPinned((p) => !p))

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '').toLowerCase()
    if (!t || tags.includes(t)) return setTagInput('')
    edit(() => setTags((prev) => [...prev, t]))
    setTagInput('')
  }

  const toggleCheck = useCallback((line: number) => {
    edit(() => setContent((c) => toggleMarkdownCheck(c, line)))
     
  }, [])

  // ── Toolbar markdown ──────────────────────────────────────────────
  const surround = (before: string, after = before, placeholder = 'teks') => {
    const ta = taRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value: v } = ta
    const selected = v.slice(s, e) || placeholder
    const next = v.slice(0, s) + before + selected + after + v.slice(e)
    edit(() => setContent(next))
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(s + before.length, s + before.length + selected.length)
    })
  }

  const prefixLine = (prefix: string) => {
    const ta = taRef.current
    if (!ta) return
    const { selectionStart: s, value: v } = ta
    const lineStart = v.lastIndexOf('\n', s - 1) + 1
    const next = v.slice(0, lineStart) + prefix + v.slice(lineStart)
    edit(() => setContent(next))
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(s + prefix.length, s + prefix.length)
    })
  }

  const insertAtCursor = (text: string) => {
    const ta = taRef.current
    if (!ta) return
    const { selectionStart: s, value: v } = ta
    edit(() => setContent(v.slice(0, s) + text + v.slice(s)))
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(s + text.length, s + text.length)
    })
  }

  const insertImage = async (file: File) => {
    try {
      const dataUrl = await compressImage(file, 1200, 0.82)
      insertAtCursor(`\n![gambar](${dataUrl})\n`)
      toast.success('Gambar disisipkan')
    } catch {
      toast.error('Gagal memproses gambar')
    }
  }

  const filtered = useMemo(() => {
    if (!notes) return []
    const q = search.trim().toLowerCase()
    if (!q) return notes
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.includes(q)),
    )
  }, [notes, search])

  const wordCount = useMemo(
    () => content.trim().split(/\s+/).filter(Boolean).length,
    [content],
  )

  const applyTool = (id: ToolId) => {
    switch (id) {
      case 'bold': return surround('**', '**', 'tebal')
      case 'italic': return surround('*', '*', 'miring')
      case 'strike': return surround('~~', '~~', 'coret')
      case 'h1': return prefixLine('# ')
      case 'h2': return prefixLine('## ')
      case 'h3': return prefixLine('### ')
      case 'list': return prefixLine('- ')
      case 'check': return prefixLine('- [ ] ')
      case 'quote': return prefixLine('> ')
      case 'code': return surround('`', '`', 'kode')
      case 'link': return surround('[', '](https://)', 'teks')
      case 'hr': return insertAtCursor('\n---\n')
    }
  }

  return (
    // Tinggi mobile = layar − header atas (3,5rem) − nav bawah (4rem) supaya
    // tombol tidak perlu terbenam di bawah navigasi. Desktop tetap layar penuh.
    <div className="flex h-[calc(100dvh-7.5rem)] md:h-screen">
      {/* Panel daftar */}
      <aside
        className={cn(
          'flex flex-col w-full md:w-80 shrink-0 border-r border-border/60 bg-card/30',
          activeId && 'hidden md:flex',
        )}
      >
        <div className="p-3 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari catatan…"
                className="pl-8 h-9 bg-background"
              />
            </div>
            <Button size="icon" className="h-9 w-9" onClick={createNote} aria-label="Catatan baru">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
          {notes === null ? (
            <div className="space-y-2 p-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-10 px-4">
              {search ? 'Tidak ada catatan yang cocok.' : (
                <>
                  <p>Belum ada catatan.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={createNote}>
                    <Plus className="w-3.5 h-3.5" /> Buat catatan pertama
                  </Button>
                </>
              )}
            </div>
          ) : (
            filtered.map((n) => (
              <button
                key={n.id}
                onClick={() => navigate('notes', n.id)}
                className={cn(
                  'w-full text-left rounded-xl p-3 transition-colors border',
                  n.id === activeId
                    ? 'bg-primary/10 border-primary/30'
                    : 'border-transparent hover:bg-accent',
                )}
              >
                <div className="flex items-center gap-1.5">
                  {n.pinned && <Pin className="w-3 h-3 text-primary shrink-0" />}
                  <p className="text-sm font-semibold truncate flex-1">{n.title}</p>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {n.content.replace(/[#*`>\-[\]!()]/g, '').trim().slice(0, 90) || 'Catatan kosong'}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] text-muted-foreground">{relTime(n.updatedAt)}</span>
                  {n.tags.slice(0, 2).map((t) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      #{t}
                    </span>
                  ))}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Panel editor */}
      <section className={cn('flex-1 flex flex-col min-w-0', !activeId && 'hidden md:flex')}>
        {!activeId ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            { }
            <img src="/icons/logo-64.png" alt="" className="w-14 h-14 rounded-2xl opacity-80" />
            <p className="text-sm">Pilih catatan di samping, atau buat yang baru.</p>
            <Button variant="outline" size="sm" onClick={createNote}>
              <Plus className="w-4 h-4" /> Catatan baru
            </Button>
          </div>
        ) : (
          <TooltipProvider delayDuration={300}>
            <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-border/60 flex-wrap">
              {/* Mobile: kembali ke daftar + catatan baru — SELALU terlihat,
                  supaya menambah catatan tidak perlu mencari tombol yang tersembunyi */}
              <div className="flex md:hidden items-center gap-1">
                <Button
                  variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => navigate('notes')} aria-label="Kembali ke daftar catatan"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button size="icon" className="h-8 w-8" onClick={createNote} aria-label="Catatan baru">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {/* Toolbar */}
              <div className="flex items-center gap-0.5 flex-wrap">
                {TOOL_DEFS.map((t) => (
                  <Tooltip key={t.label}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => applyTool(t.id)}
                        aria-label={t.label}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        <t.icon className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">{t.label}</TooltipContent>
                  </Tooltip>
                ))}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => fileRef.current?.click()}
                      aria-label="Sisipkan gambar"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">Sisipkan gambar</TooltipContent>
                </Tooltip>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void insertImage(f)
                  e.target.value = ''
                }}
              />
              <div className="flex-1" />
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {saving === 'saving' ? (
                  <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Menyimpan…</span>
                ) : saving === 'saved' ? 'Tersimpan ✓' : `${wordCount} kata`}
              </span>
              <div className="md:hidden flex rounded-lg bg-muted p-0.5">
                <button
                  onClick={() => setMobilePane('edit')}
                  className={cn('px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1', mobilePane === 'edit' && 'bg-background shadow-sm')}
                >
                  <PenLine className="w-3 h-3" /> Edit
                </button>
                <button
                  onClick={() => setMobilePane('preview')}
                  className={cn('px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1', mobilePane === 'preview' && 'bg-background shadow-sm')}
                >
                  <Eye className="w-3 h-3" /> Pratinjau
                </button>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={togglePin} aria-label="Pin catatan">
                {pinned ? <Pin className="w-4 h-4 text-primary" /> : <PinOff className="w-4 h-4 text-muted-foreground" />}
              </Button>
              <Button
                variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)} aria-label="Hapus catatan"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            <div className="px-4 pt-3 pb-1">
              <input
                value={title}
                onChange={(e) => edit(() => setTitle(e.target.value))}
                placeholder="Judul catatan…"
                className="w-full bg-transparent text-xl md:text-2xl font-bold outline-none placeholder:text-muted-foreground/50"
              />
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                {tags.map((t) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-1">
                    #{t}
                    <button
                      onClick={() => edit(() => setTags((prev) => prev.filter((x) => x !== t)))}
                      aria-label={`Hapus tag ${t}`}
                      className="hover:opacity-70"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addTag() }
                    if (e.key === 'Backspace' && !tagInput && tags.length) {
                      edit(() => setTags((prev) => prev.slice(0, -1)))
                    }
                  }}
                  onBlur={addTag}
                  placeholder="+ tag"
                  className="text-xs bg-transparent outline-none w-20 placeholder:text-muted-foreground/60"
                />
              </div>
            </div>

            <div className="flex-1 min-h-0 flex">
              {/* Textarea */}
              <div className={cn('flex-1 min-w-0 flex flex-col', mobilePane === 'preview' && 'hidden md:flex')}>
                <textarea
                  ref={taRef}
                  value={content}
                  onChange={(e) => edit(() => setContent(e.target.value))}
                  placeholder="Tulis dengan Markdown… (# judul, **tebal**, - [ ] checklist)"
                  className={cn(
                    'flex-1 w-full resize-none bg-transparent px-4 py-3 outline-none text-[15px] leading-relaxed placeholder:text-muted-foreground/50',
                    FONT_CLASS[settings.noteFont],
                  )}
                  spellCheck={false}
                />
              </div>
              {/* Pratinjau */}
              <div
                className={cn(
                  'flex-1 min-w-0 overflow-y-auto border-l border-border/40',
                  mobilePane === 'edit' && 'hidden lg:block',
                  'px-1',
                )}
              >
                {content.trim() ? (
                  <Markdown content={content} onToggleCheck={toggleCheck} />
                ) : (
                  <p className="text-sm text-muted-foreground p-4">
                    Pratinjau akan tampil di sini. Coba tulis sesuatu… ✨
                  </p>
                )}
              </div>
            </div>
          </TooltipProvider>
        )}
      </section>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus catatan ini?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{title}&rdquo; akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={deleteNote} className="bg-destructive text-white hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
