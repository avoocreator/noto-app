// ── Utilitas sisi klien: akses data lokal, format tanggal, gambar ──
// NOTO v2: 100% client-side (static export). Fungsi api() kini
// menerjemahkan panggilan REST lama ke operasi lokal (Dexie via repo)
// sehingga SEMUA tampilan tetap berjalan tanpa perubahan.
'use client'

import * as repo from './repo'

/** Router lokal: '/api/...' → operasi IndexedDB. Bentuk & semantik
 * respons identik dengan API server versi lama. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const body: unknown = init?.body ? JSON.parse(init.body as string) : null
  const path = url.split('?')[0].replace(/\/$/, '')
  const seg = path.split('/').filter(Boolean) // ['api', resource, id?]
  const resource = seg[1] ?? ''
  const id = seg[2] ?? ''

  switch (resource) {
    case 'notes': {
      if (method === 'GET') return repo.listNotes() as Promise<T>
      if (method === 'POST') return repo.createNote((body ?? {}) as { title?: string; content?: string }) as Promise<T>
      if (method === 'PUT') return repo.updateNote(id, (body ?? {}) as never) as Promise<T>
      if (method === 'DELETE') { await repo.deleteNote(id); return { ok: true } as T }
      break
    }
    case 'todos': {
      if (method === 'GET') return repo.listTodos() as Promise<T>
      if (method === 'POST') return repo.createTodo((body ?? {}) as never) as Promise<T>
      if (method === 'PUT') return repo.updateTodo(id, (body ?? {}) as never) as Promise<T>
      if (method === 'DELETE') { await repo.deleteTodo(id); return { ok: true } as T }
      break
    }
    case 'lists': {
      if (method === 'GET') return repo.listLists() as Promise<T>
      if (method === 'POST') return repo.createList((body ?? {}) as never) as Promise<T>
      if (method === 'PUT') return repo.updateList(id, (body ?? {}) as never) as Promise<T>
      if (method === 'DELETE') { await repo.deleteList(id); return { ok: true } as T }
      break
    }
    case 'boards': {
      if (method === 'GET') return repo.listBoards() as Promise<T>
      if (method === 'POST') return repo.createBoard((body ?? {}) as { name?: string }) as Promise<T>
      if (method === 'PUT') return repo.updateBoard(id, (body ?? {}) as never) as Promise<T>
      if (method === 'DELETE') { await repo.deleteBoard(id); return { ok: true } as T }
      break
    }
    case 'backup': {
      if (method === 'GET') return repo.exportBackup() as Promise<T>
      if (method === 'POST') {
        const payload = body as { mode?: string; data?: Record<string, unknown> } | null
        if (!payload || payload.mode !== 'replace' || !payload.data) {
          throw new Error('Format impor tidak valid')
        }
        await repo.importBackup(payload.data)
        return { ok: true } as T
      }
      break
    }
    case 'widget': {
      if (method === 'GET') return repo.activeTodosSorted(10) as Promise<T>
      break
    }
    case 'auth':
    case 'bootstrap': {
      return { ok: true } as T
    }
  }
  throw new Error(`Endpoint lokal tidak dikenal: ${method} ${url}`)
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const dayDiff = (iso: string) => {
  const d = new Date(iso)
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const now = new Date()
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((a - b) / 86400000)
}

export interface DueInfo {
  text: string
  tone: 'over' | 'today' | 'soon' | 'far'
  color: string
}

export function fmtDue(iso: string | null): DueInfo | null {
  if (!iso) return null
  const diff = dayDiff(iso)
  if (diff < 0) return { text: diff === -1 ? 'Kemarin' : `Terlambat ${Math.abs(diff)} hari`, tone: 'over', color: '#ef4444' }
  if (diff === 0) return { text: 'Hari ini', tone: 'today', color: '#f59e0b' }
  if (diff === 1) return { text: 'Besok', tone: 'soon', color: '#f59e0b' }
  if (diff <= 6) {
    const s = new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(new Date(iso))
    return { text: s, tone: 'soon', color: '#8a8a94' }
  }
  const s = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(iso))
  return { text: s, tone: 'far', color: '#8a8a94' }
}

export function fmtDateTimeID(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

export function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'baru saja'
  if (m < 60) return `${m} menit lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} hari lalu`
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(iso))
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h >= 4 && h < 11) return 'Selamat pagi'
  if (h >= 11 && h < 15) return 'Selamat siang'
  if (h >= 15 && h < 18.5) return 'Selamat sore'
  return 'Selamat malam'
}

export function fmtDateIDLong(d = new Date()): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(d)
}

/** Kompres gambar jadi dataURL JPEG agar hemat penyimpanan. */
export function compressImage(file: File, maxSize = 1400, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Gagal membaca file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('File bukan gambar yang valid'))
      img.onload = () => {
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas tidak tersedia'))
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export function toDateInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function toDateTimeInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
