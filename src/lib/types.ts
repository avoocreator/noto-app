// ── Tipe data bersama Noto ──────────────────────────────────────────
export interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  pinned: boolean
  color: string
  createdAt: string
  updatedAt: string
}

export interface TodoList {
  id: string
  name: string
  color: string
  emoji: string
  order: number
  createdAt: string
}

export interface Todo {
  id: string
  title: string
  notes: string
  done: boolean
  priority: number // 0 = rendah, 1 = sedang, 2 = tinggi
  dueDate: string | null
  reminderAt: string | null
  listId: string | null
  list?: TodoList | null
  tags: string[]
  order: number
  createdAt: string
  completedAt: string | null
}

export type CanvasItemType = 'text' | 'note' | 'todo' | 'image' | 'checklist'

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface ChecklistData {
  title: string
  items: ChecklistItem[]
}

export interface CanvasItemData {
  text?: string
  noteId?: string
  listId?: string
  src?: string
  caption?: string
  checklist?: ChecklistData
}

export interface CanvasItem {
  id: string
  type: CanvasItemType
  x: number
  y: number
  w: number
  h: number
  color?: string
  data: CanvasItemData
}

export interface CanvasEdge {
  id: string
  from: string
  to: string
  color?: string
}

export interface BoardData {
  items: CanvasItem[]
  edges: CanvasEdge[]
}

export interface Board {
  id: string
  name: string
  data: BoardData
  createdAt: string
  updatedAt: string
}

export const CARD_COLORS = [
  { id: '', name: 'Default' },
  { id: 'orange', name: 'Oranye' },
  { id: 'amber', name: 'Kuning' },
  { id: 'emerald', name: 'Hijau' },
  { id: 'rose', name: 'Merah Muda' },
  { id: 'violet', name: 'Ungu' },
  { id: 'slate', name: 'Abu-abu' },
] as const

export const TINTS: Record<string, { bg: string; border: string }> = {
  '': { bg: 'var(--card)', border: 'var(--border)' },
  orange: { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.55)' },
  amber: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.55)' },
  emerald: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.55)' },
  rose: { bg: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.55)' },
  violet: { bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.55)' },
  slate: { bg: 'rgba(125,125,135,0.12)', border: 'rgba(125,125,135,0.5)' },
}

export const PRIORITY: { value: number; label: string; color: string; emoji: string }[] = [
  { value: 0, label: 'Rendah', color: '#8a8a94', emoji: '🫧' },
  { value: 1, label: 'Sedang', color: '#f59e0b', emoji: '⚡' },
  { value: 2, label: 'Tinggi', color: '#ef4444', emoji: '🔥' },
]

export const LIST_COLORS = [
  '#f97316', '#ef4444', '#f59e0b', '#84cc16', '#10b981',
  '#14b8a6', '#ec4899', '#a855f7', '#8a8a94',
]

export const LIST_EMOJIS = ['📋', '🏠', '💼', '🛒', '🎯', '💡', '📚', '💪', '🎨', '⭐', '🔥', '🌱']
