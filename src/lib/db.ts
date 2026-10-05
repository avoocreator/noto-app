// ============================================================
// NOTO v2 — Database Lokal (IndexedDB via Dexie)
// Offline-first: semua data tersimpan di perangkat (browser/HP),
// lalu disinkronkan ke Supabase (lihat sync.ts) agar web & APK
// selalu sinkron. Pola sama dengan Budgeto v2.
// ============================================================

import Dexie, { type Table } from 'dexie'
import type { Note, Todo, TodoList, Board, BoardData } from './types'

/** Rekaman dengan penanda sinkronisasi (soft-delete / tombstone). */
export interface SyncMeta {
  deleted?: boolean
}

export type NoteRow = Note & SyncMeta
export type TodoRow = Todo & SyncMeta & { updatedAt?: string }
/** Baris daftar tugas — updatedAt opsional (khusus kebutuhan sinkronisasi). */
export type TodoListRow = TodoList & SyncMeta & { updatedAt?: string }
export type BoardRow = Board & SyncMeta

export class NotoDB extends Dexie {
  notes!: Table<NoteRow, string>
  todoLists!: Table<TodoListRow, string>
  todos!: Table<TodoRow, string>
  boards!: Table<BoardRow, string>

  constructor() {
    super('noto-v2')
    this.version(1).stores({
      notes: 'id, updatedAt, pinned',
      todoLists: 'id, order',
      todos: 'id, listId, order, done, dueDate, reminderAt',
      boards: 'id, createdAt',
    })
  }
}

export const db = new NotoDB()

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function nowIso(): string {
  return new Date().toISOString()
}

// ── SEED DATA (idempoten — hanya jika database kosong) ──────

const WELCOME_NOTE = `# Selamat datang di Noto! 🍊

**Noto** adalah workspace pribadimu — seperti Obsidian, langsung jalan di browser & HP.

## Apa yang bisa kamu lakukan?

- **📝 Catatan** — tulis dengan *Markdown*, ada pratinjau langsung. Coba centang kotak di bawah ini dari mode pratinjau!
- [ ] Klik saya di mode Pratinjau ✨
- [ ] Tulis catatan pertamaku
- [ ] Pasang Noto sebagai aplikasi di HP
- [ ] Aktifkan sinkronisasi cloud di Pengaturan

## Konten mendukung:

| Format | Hasil |
| --- | --- |
| \`**tebal**\` | **tebal** |
| \`*miring*\` | *miring* |
| \`- [ ] tugas\` | checklist |
| \`> kutip\` | blockquote |

> Pisahkan ide pakai **Kanvas** — tarik-lepas kartu catatan, todo, gambar, dan sambungkan dengan garis.

Selamat berkarya! 🚀`

const WELCOME_BOARD: BoardData = {
  items: [
    {
      id: 'welcome-text', type: 'text', x: 60, y: 80, w: 300, h: 170, color: 'orange',
      data: { text: '# 👋 Selamat datang!\nIni **Kanvas** Noto.\n\nKartu bisa di-*drag*, di-*resize*, dan diberi warna.\n\nKlik tombol **+** di kanan bawah untuk menambah kartu.' },
    },
    {
      id: 'welcome-checklist', type: 'checklist', x: 420, y: 80, w: 290, h: 230, color: 'emerald',
      data: {
        checklist: {
          title: 'Mulai dengan Noto',
          items: [
            { id: 'c1', text: 'Coba geser kartu ini', done: false },
            { id: 'c2', text: 'Buat catatan pertama', done: false },
            { id: 'c3', text: 'Tambah tugas di menu Tugas', done: false },
            { id: 'c4', text: 'Ganti tema favoritmu', done: false },
          ],
        },
      },
    },
  ],
  edges: [] as { id: string; from: string; to: string; color?: string }[],
} satisfies BoardData

/** Isi data contoh sekali saja saat database masih kosong. */
export async function seedIfEmpty(): Promise<void> {
  await db.transaction('rw', db.notes, db.todoLists, db.todos, db.boards, async () => {
    if ((await db.notes.count()) === 0) {
      const t = nowIso()
      await db.notes.add({
        id: uid(), title: 'Selamat datang di Noto 🍊', content: WELCOME_NOTE,
        tags: ['panduan'], pinned: true, color: '', createdAt: t, updatedAt: t,
      })
    }
    if ((await db.todoLists.count()) === 0) {
      const t = nowIso()
      const pribadi: TodoListRow = { id: uid(), name: 'Pribadi', color: '#f97316', emoji: '🏠', order: 1, createdAt: t }
      const kerja: TodoListRow = { id: uid(), name: 'Kerja', color: '#10b981', emoji: '💼', order: 2, createdAt: t }
      const belanja: TodoListRow = { id: uid(), name: 'Belanja', color: '#ec4899', emoji: '🛒', order: 3, createdAt: t }
      await db.todoLists.bulkAdd([pribadi, kerja, belanja])
      await db.todos.bulkAdd([
        { id: uid(), title: 'Jelajahi fitur Noto satu per satu', notes: '', done: false, priority: 2, dueDate: null, reminderAt: null, listId: pribadi.id, tags: [], order: 1, createdAt: t, completedAt: null },
        { id: uid(), title: 'Centang tugas ini untuk merasakan progresnya', notes: '', done: false, priority: 0, dueDate: null, reminderAt: null, listId: pribadi.id, tags: [], order: 2, createdAt: t, completedAt: null },
      ])
    }
    if ((await db.boards.count()) === 0) {
      const t = nowIso()
      await db.boards.add({ id: uid(), name: 'Papan Utama', data: WELCOME_BOARD, createdAt: t, updatedAt: t })
    }
  })
}
