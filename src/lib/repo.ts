// ============================================================
// NOTO v2 — Repo (lapisan data lokal, pengganti REST API server)
// Semua operasi CRUD jalan langsung di IndexedDB (Dexie) — 100%
// client-side, tetap sinkron ke Supabase lewat scheduleSync().
// Semantik & bentuk data dibuat identik dengan API versi lama
// agar tampilan tidak berubah sama sekali.
// ============================================================

"use client";

import { db, nowIso, uid, type BoardRow, type NoteRow, type TodoListRow, type TodoRow } from "./db";
import { scheduleSync } from "./sync";
import type { Board, BoardData, Note, Todo, TodoList } from "./types";

// ─── Util ────────────────────────────────────────────────────

const alive = <T extends { deleted?: boolean }>(rows: T[]): T[] =>
  rows.filter((r) => !r.deleted);

const byUpdatedDesc = (a: NoteRow, b: NoteRow) =>
  Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt);

const byTodoOrder = (a: TodoRow, b: TodoRow) =>
  a.order - b.order || b.createdAt.localeCompare(a.createdAt);

async function attachLists(todos: TodoRow[]): Promise<Todo[]> {
  const lists = await db.todoLists.toArray();
  const map = new Map(lists.map((l) => [l.id, l]));
  return todos.map((t) => ({ ...t, list: t.listId ? map.get(t.listId) ?? null : null }));
}

const clampPriority = (p: unknown): number =>
  typeof p === "number" && isFinite(p) ? Math.max(0, Math.min(2, Math.trunc(p))) : 1;

function cleanTags(tags: unknown): string[] {
  return Array.isArray(tags) ? tags.filter((x) => typeof x === "string").slice(0, 20) : [];
}

// ─── CATATAN ─────────────────────────────────────────────────

export async function listNotes(): Promise<Note[]> {
  const rows = await db.notes.toArray();
  return alive(rows).sort(byUpdatedDesc);
}

export async function createNote(body: { title?: string; content?: string }): Promise<Note> {
  const t = nowIso();
  const note: NoteRow = {
    id: uid(),
    title: (body.title ?? "Catatan tanpa judul").trim().slice(0, 200) || "Catatan tanpa judul",
    content: (body.content ?? "").slice(0, 500_000),
    tags: [],
    pinned: false,
    color: "",
    createdAt: t,
    updatedAt: t,
  };
  await db.notes.add(note);
  scheduleSync();
  return note;
}

export async function updateNote(
  id: string,
  body: { title?: string; content?: string; tags?: string[]; pinned?: boolean; color?: string },
): Promise<Note> {
  const patch: Partial<NoteRow> = { updatedAt: nowIso() };
  if (typeof body.title === "string") patch.title = body.title.trim().slice(0, 200) || "Catatan tanpa judul";
  if (typeof body.content === "string") patch.content = body.content.slice(0, 500_000);
  if (Array.isArray(body.tags)) patch.tags = cleanTags(body.tags);
  if (typeof body.pinned === "boolean") patch.pinned = body.pinned;
  if (typeof body.color === "string") patch.color = body.color;
  await db.notes.update(id, patch);
  scheduleSync();
  const updated = await db.notes.get(id);
  if (!updated) throw new Error("Catatan tidak ditemukan");
  return updated;
}

export async function deleteNote(id: string): Promise<void> {
  await db.notes.update(id, { deleted: true, updatedAt: nowIso() });
  scheduleSync();
}

// ─── DAFTAR TUGAS (TodoList) ─────────────────────────────────

export interface ListWithTodos extends TodoList {
  todos: Todo[];
}

export async function listLists(): Promise<ListWithTodos[]> {
  const [lists, todos] = await Promise.all([db.todoLists.toArray(), db.todos.toArray()]);
  const live = alive(lists).sort((a, b) => a.order - b.order);
  const grouped = alive(todos).sort(byTodoOrder);
  return live.map((l) => ({ ...l, todos: grouped.filter((t) => t.listId === l.id) }));
}

export async function createList(body: { name?: string; color?: string; emoji?: string }): Promise<TodoList> {
  const name = (body.name ?? "").trim();
  if (!name) throw new Error("Nama daftar wajib diisi");
  const all = await db.todoLists.toArray();
  const maxOrder = all.reduce((m, l) => Math.max(m, l.order), 0);
  const list: TodoListRow = {
    id: uid(),
    name: name.slice(0, 100),
    color: body.color ?? "#f97316",
    emoji: body.emoji ?? "📋",
    order: maxOrder + 1,
    createdAt: nowIso(),
  };
  await db.todoLists.add(list);
  scheduleSync();
  return list;
}

export async function updateList(
  id: string,
  body: { name?: string; color?: string; emoji?: string; order?: number },
): Promise<TodoList> {
  const patch: Partial<TodoListRow> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 100);
  if (typeof body.color === "string") patch.color = body.color;
  if (typeof body.emoji === "string") patch.emoji = body.emoji;
  if (typeof body.order === "number") patch.order = body.order;
  await db.todoLists.update(id, patch);
  scheduleSync();
  const updated = await db.todoLists.get(id);
  if (!updated) throw new Error("Daftar tidak ditemukan");
  return updated;
}

export async function deleteList(id: string): Promise<void> {
  // Todo lama tetap ada, hanya lepas dari daftar (perilaku lama: SetNull)
  const todos = await db.todos.where("listId").equals(id).toArray();
  await Promise.all(
    todos.map((t) => db.todos.update(t.id, { listId: null, updatedAt: nowIso() })),
  );
  await db.todoLists.update(id, { deleted: true, updatedAt: nowIso() });
  scheduleSync();
}

// ─── TUGAS (Todo) ────────────────────────────────────────────

export async function listTodos(): Promise<Todo[]> {
  const rows = await db.todos.toArray();
  const sorted = alive(rows).sort(byTodoOrder);
  return attachLists(sorted);
}

export interface CreateTodoBody {
  title?: string
  notes?: string
  listId?: string | null
  priority?: number
  dueDate?: string | null
  reminderAt?: string | null
  tags?: string[]
  done?: boolean
  order?: number
}

export async function createTodo(body: CreateTodoBody): Promise<Todo> {
  const title = (body.title ?? "").trim();
  if (!title) throw new Error("Judul tugas wajib diisi");
  const all = await db.todos.toArray();
  const maxOrder = all.reduce((m, t) => Math.max(m, t.order), 0);
  const t = nowIso();
  const todo: TodoRow = {
    id: uid(),
    title: title.slice(0, 500),
    notes: (body.notes ?? "").slice(0, 5000),
    done: body.done ?? false,
    priority: clampPriority(body.priority),
    dueDate: body.dueDate ?? null,
    reminderAt: body.reminderAt ?? null,
    listId: body.listId || null,
    tags: cleanTags(body.tags),
    order: typeof body.order === "number" ? body.order : maxOrder + 1,
    createdAt: t,
    updatedAt: t,
    completedAt: body.done ? t : null,
  };
  await db.todos.add(todo);
  scheduleSync();
  return { ...todo, list: null };
}

export interface UpdateTodoBody {
  title?: string
  notes?: string
  done?: boolean
  listId?: string | null
  priority?: number
  dueDate?: string | null
  reminderAt?: string | null
  tags?: string[]
  order?: number
}

export async function updateTodo(id: string, body: UpdateTodoBody): Promise<Todo> {
  const patch: Partial<TodoRow> = { updatedAt: nowIso() };
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, 500);
  if (typeof body.notes === "string") patch.notes = body.notes.slice(0, 5000);
  if (typeof body.done === "boolean") {
    patch.done = body.done;
    patch.completedAt = body.done ? nowIso() : null;
  }
  if (body.listId !== undefined) patch.listId = body.listId || null;
  if (body.priority !== undefined) patch.priority = clampPriority(body.priority);
  if (body.dueDate !== undefined) patch.dueDate = body.dueDate || null;
  if (body.reminderAt !== undefined) patch.reminderAt = body.reminderAt || null;
  if (Array.isArray(body.tags)) patch.tags = cleanTags(body.tags);
  if (typeof body.order === "number") patch.order = body.order;

  await db.todos.update(id, patch);
  scheduleSync();
  const updated = await db.todos.get(id);
  if (!updated) throw new Error("Tugas tidak ditemukan");
  return attachLists([updated]).then((r) => r[0]);
}

export async function deleteTodo(id: string): Promise<void> {
  await db.todos.update(id, { deleted: true, updatedAt: nowIso() });
  scheduleSync();
}

/** Tugas aktif terurut prioritas → tenggat (untuk widget & dashboard). */
export async function activeTodosSorted(limit = 50): Promise<Todo[]> {
  const rows = await db.todos.toArray();
  const sorted = alive(rows)
    .filter((t) => !t.done)
    .sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const dbb = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return da - dbb;
    })
    .slice(0, limit);
  return attachLists(sorted);
}

// ─── PAPAN (Board / Kanvas) ──────────────────────────────────

const EMPTY_BOARD: BoardData = { items: [], edges: [] };

function normalizeBoardData(raw: unknown): BoardData {
  if (raw && typeof raw === "object" && Array.isArray((raw as BoardData).items)) {
    const d = raw as BoardData;
    return { items: d.items, edges: Array.isArray(d.edges) ? d.edges : [] };
  }
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as BoardData;
      if (p && Array.isArray(p.items)) return { items: p.items, edges: Array.isArray(p.edges) ? p.edges : [] };
    } catch {
      /* fallback ke kosong */
    }
  }
  return EMPTY_BOARD;
}

export async function listBoards(): Promise<Board[]> {
  const rows = await db.boards.toArray();
  return alive(rows)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((b) => ({ ...b, data: normalizeBoardData(b.data) }));
}

export async function createBoard(body: { name?: string }): Promise<Board> {
  const t = nowIso();
  const board: BoardRow = {
    id: uid(),
    name: (body.name ?? "").trim().slice(0, 100) || "Papan baru",
    data: EMPTY_BOARD,
    createdAt: t,
    updatedAt: t,
  };
  await db.boards.add(board);
  scheduleSync();
  return board;
}

export async function updateBoard(
  id: string,
  body: { name?: string; data?: BoardData },
): Promise<Board> {
  const patch: Partial<BoardRow> = { updatedAt: nowIso() };
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 100);
  if (body.data && Array.isArray(body.data.items)) {
    const json = JSON.stringify(body.data);
    if (json.length > 4_000_000) throw new Error("Papan terlalu besar (gambar terlalu banyak)");
    patch.data = body.data;
  }
  await db.boards.update(id, patch);
  scheduleSync();
  const updated = await db.boards.get(id);
  if (!updated) throw new Error("Papan tidak ditemukan");
  return { ...updated, data: normalizeBoardData(updated.data) };
}

export async function deleteBoard(id: string): Promise<void> {
  await db.boards.update(id, { deleted: true, updatedAt: nowIso() });
  scheduleSync();
}

// ─── CADANGAN (backup JSON) ──────────────────────────────────

export async function exportBackup(): Promise<Record<string, unknown>> {
  const [notes, lists, todos, boards] = await Promise.all([
    listNotes(),
    listLists(),
    listTodos(),
    listBoards(),
  ]);
  return {
    app: "Noto",
    version: 2,
    exportedAt: nowIso(),
    notes,
    lists: lists.map(({ todos: _todos, ...l }) => l),
    todos,
    boards,
  };
}

const asStr = (v: unknown, fb = ""): string => (typeof v === "string" ? v : fb);
const asBool = (v: unknown, fb = false): boolean => (typeof v === "boolean" ? v : fb);
const asNum = (v: unknown, fb = 0): number => (typeof v === "number" && isFinite(v) ? v : fb);
const asDate = (v: unknown, fb: string | null = null): string | null => {
  if (typeof v !== "string") return fb;
  const d = new Date(v);
  return isNaN(d.getTime()) ? fb : d.toISOString();
};

export async function importBackup(data: Record<string, unknown>): Promise<void> {
  const d = (data?.data ?? data) as {
    notes?: Record<string, unknown>[]
    lists?: Record<string, unknown>[]
    todos?: Record<string, unknown>[]
    boards?: Record<string, unknown>[]
  };
  if (!d || typeof d !== "object") throw new Error("Format impor tidak valid");

  const t = nowIso();
  const lists: TodoListRow[] = (d.lists ?? []).map((l, i) => ({
    id: asStr(l.id) || uid(),
    name: asStr(l.name, "Daftar").slice(0, 100),
    color: asStr(l.color, "#f97316"),
    emoji: asStr(l.emoji, "📋"),
    order: asNum(l.order, i),
    createdAt: asDate(l.createdAt, t) as string,
  }));
  const notes: NoteRow[] = (d.notes ?? []).map((n) => ({
    id: asStr(n.id) || uid(),
    title: asStr(n.title, "Catatan tanpa judul").slice(0, 200),
    content: asStr(n.content),
    tags: cleanTags(typeof n.tags === "string" ? JSON.parse(n.tags || "[]") : n.tags),
    pinned: asBool(n.pinned),
    color: asStr(n.color),
    createdAt: (asDate(n.createdAt, t) as string),
    updatedAt: (asDate(n.updatedAt, t) as string),
  }));
  const todos: TodoRow[] = (d.todos ?? []).map((x) => ({
    id: asStr(x.id) || uid(),
    title: asStr(x.title, "Tugas").slice(0, 500),
    notes: asStr(x.notes),
    done: asBool(x.done),
    priority: clampPriority(x.priority),
    dueDate: asDate(x.dueDate),
    reminderAt: asDate(x.reminderAt),
    listId: asStr(x.listId) || null,
    tags: cleanTags(typeof x.tags === "string" ? JSON.parse(x.tags || "[]") : x.tags),
    order: asNum(x.order),
    createdAt: (asDate(x.createdAt, t) as string),
    completedAt: asDate(x.completedAt),
    updatedAt: (asDate(x.updatedAt, t) as string),
  }));
  const boards: BoardRow[] = (d.boards ?? []).map((b) => ({
    id: asStr(b.id) || uid(),
    name: asStr(b.name, "Papan tanpa nama").slice(0, 100),
    data: normalizeBoardData(b.data),
    createdAt: (asDate(b.createdAt, t) as string),
    updatedAt: (asDate(b.updatedAt, t) as string),
  }));

  await db.transaction("rw", db.notes, db.todoLists, db.todos, db.boards, async () => {
    await Promise.all([db.notes.clear(), db.todoLists.clear(), db.todos.clear(), db.boards.clear()]);
    if (lists.length) await db.todoLists.bulkAdd(lists);
    if (notes.length) await db.notes.bulkAdd(notes);
    if (todos.length) await db.todos.bulkAdd(todos);
    if (boards.length) await db.boards.bulkAdd(boards);
  });
  scheduleSync();
}
