'use client'

import { useEffect, useState } from 'react'
import { FileText, ListTodo, Loader2 } from 'lucide-react'
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import { api } from '@/lib/client'
import type { Note, Todo } from '@/lib/types'

export function CommandPalette({
  open,
  setOpen,
  navigate,
}: {
  open: boolean
  setOpen: (v: boolean) => void
  navigate: (v: string, p?: string) => void
}) {
  const [notes, setNotes] = useState<Note[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    const run = async () => {
      setLoading(true)
      try {
        const [n, t] = await Promise.all([api<Note[]>('/api/notes'), api<Todo[]>('/api/todos')])
        setNotes(n)
        setTodos(t)
      } catch {
        // abaikan — tampilkan hasil kosong
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [open])

  const run = (fn: () => void) => {
    setOpen(false)
    fn()
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Cari catatan, tugas, atau halaman…" />
      <CommandList>
        <CommandEmpty>
          {loading ? (
            <span className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat…
            </span>
          ) : (
            'Tidak ada hasil.'
          )}
        </CommandEmpty>
        <CommandGroup heading="Halaman">
          <CommandItem onSelect={() => run(() => navigate('dashboard'))}>🏠 Beranda</CommandItem>
          <CommandItem onSelect={() => run(() => navigate('notes'))}>📝 Catatan</CommandItem>
          <CommandItem onSelect={() => run(() => navigate('todos'))}>✅ Tugas</CommandItem>
          <CommandItem onSelect={() => run(() => navigate('canvas'))}>🎨 Kanvas</CommandItem>
          <CommandItem onSelect={() => run(() => navigate('settings'))}>⚙️ Pengaturan</CommandItem>
          <CommandItem onSelect={() => run(() => navigate('guide'))}>📖 Panduan</CommandItem>
          <CommandItem onSelect={() => run(() => navigate('widget'))}>📱 Tampilan Widget</CommandItem>
        </CommandGroup>
        {notes.length > 0 && (
          <CommandGroup heading="Catatan">
            {notes.slice(0, 8).map((n) => (
              <CommandItem key={n.id} onSelect={() => run(() => navigate('notes', n.id))}>
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="truncate">{n.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {todos.some((t) => !t.done) && (
          <CommandGroup heading="Tugas Belum Selesai">
            {todos.filter((t) => !t.done).slice(0, 6).map((t) => (
              <CommandItem key={t.id} onSelect={() => run(() => navigate('todos'))}>
                <ListTodo className="w-4 h-4 text-muted-foreground" />
                <span className="truncate">{t.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
