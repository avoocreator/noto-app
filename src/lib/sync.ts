// ============================================================
// NOTO v2 — Sinkronisasi Cloud (Supabase, GRATIS)
// Pola identik Budgeto v2:
// - Login pakai email OTP (tiap user hanya lihat datanya — RLS)
// - Last-Write-Wins berdasarkan updatedAt
// - Auto sync: saat app dibuka, setelah tiap perubahan (debounce 4 dtk),
//   dan saat koneksi kembali online
// - Widget Android 2×2 tidak lagi lewat sini — ia OFFLINE,
//   membaca data lokal lewat widget-local.ts
// ============================================================

"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Table } from "dexie";
import { db, type BoardRow, type NoteRow, type TodoListRow, type TodoRow } from "./db";
import { useSettings } from "./store";
import { pushWidgetLocal, scheduleWidgetLocal } from "./widget-local";
import type { Board, Note, Todo, TodoList } from "./types";

type SyncState = "idle" | "syncing" | "ok" | "error" | "offline" | "unconfigured";
export type { SyncState as CloudSyncState };
type Listener = (state: SyncState, message?: string) => void;

let client: SupabaseClient | null = null;
let clientUrl = "";
let clientKey = "";
let currentState: SyncState = "unconfigured";
let currentMessage = "";
const listeners = new Set<Listener>();
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false;

export function getSyncState(): { state: SyncState; message: string } {
  return { state: currentState, message: currentMessage };
}

export function onSyncChange(listener: Listener): () => void {
  listeners.add(listener);
  listener(currentState, currentMessage);
  return () => listeners.delete(listener);
}

function setState(state: SyncState, message = ""): void {
  currentState = state;
  currentMessage = message;
  listeners.forEach((l) => l(state, message));
}

function getClient(): SupabaseClient | null {
  const { supabaseUrl, supabaseAnonKey } = useSettings.getState();
  const cleanUrl = normalizeSupabaseUrl(supabaseUrl ?? "");
  const cleanKey = normalizeSupabaseKey(supabaseAnonKey ?? "");
  if (!cleanUrl || !cleanKey) {
    setState("unconfigured");
    return null;
  }
  if (!client || clientUrl !== cleanUrl || clientKey !== cleanKey) {
    try {
      client = createClient(cleanUrl, cleanKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      });
      clientUrl = cleanUrl;
      clientKey = cleanKey;
    } catch {
      setState("error", "URL/kunci Supabase tidak valid");
      return null;
    }
  }
  return client;
}

// ─── NORMALISASI INPUT (kebal paste kurang rapi) ─────────────

/** URL proyek Supabase yang benar selalu berupa origin saja (https://xxxx.supabase.co).
 *  Akhiran seperti /rest/v1 yang sering ikut tersalin dari dashboard dibuang otomatis. */
export function normalizeSupabaseUrl(raw: string): string {
  let s = (raw ?? "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (/\/(rest|auth|storage|realtime|functions)\/v1/i.test(u.pathname)) return u.origin;
    return u.origin + u.pathname.replace(/\/+$/, "");
  } catch {
    return s.replace(/\/+$/, "");
  }
}

/** Anon key tidak boleh mengandung spasi/enter — menyalin JWT panjang sering menyisipkannya. */
export function normalizeSupabaseKey(raw: string): string {
  return (raw ?? "").replace(/\s+/g, "");
}

/** Pesan error Supabase → bahasa yang mudah dipahami. */
function friendlyError(message: string): string {
  if (/invalid api key/i.test(message))
    return "API key ditolak Supabase — pastikan Anon Key tersalin utuh tanpa spasi/enter, lalu coba lagi.";
  if (/invalid path/i.test(message))
    return "URL Supabase salah — cukup https://xxxx.supabase.co tanpa akhiran /rest/v1 (otomatis dibersihkan — coba lagi).";
  if (/rate limit/i.test(message))
    return "Kuota email Supabase sementara habis (±2/jam) — tunggu sebentar lalu kirim ulang.";
  if (/failed to fetch|load failed|networkerror/i.test(message))
    return "Tidak bisa menghubungi Supabase — periksa koneksi internet.";
  return message;
}

// ─── AUTH (email OTP, tanpa sandi) ───────────────────────────

export async function sendOtp(email: string): Promise<{ ok: boolean; message: string }> {
  const c = getClient();
  if (!c) return { ok: false, message: "Isi dulu URL & anon key Supabase" };
  setState("syncing", "Mengirim kode...");
  const { error } = await c.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      // Setelah link di email diklik, balik ke halaman Noto ini sendiri
      // (URL-nya harus terdaftar di Supabase → Authentication → URL Configuration → Redirect URLs).
      emailRedirectTo:
        typeof window !== "undefined"
          ? window.location.href.split("#")[0].split("?")[0]
          : undefined,
    },
  });
  if (error) {
    const msg = friendlyError(error.message);
    setState("error", msg);
    return { ok: false, message: msg };
  }
  return { ok: true, message: "Kode 6 digit dikirim ke email kamu" };
}

export async function verifyOtp(email: string, token: string): Promise<{ ok: boolean; message: string }> {
  const c = getClient();
  if (!c) return { ok: false, message: "Konfigurasi belum lengkap" };
  const { error } = await c.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: "email",
  });
  if (error) {
    const msg = friendlyError(error.message);
    setState("error", msg);
    return { ok: false, message: msg };
  }
  void syncNow();
  return { ok: true, message: "Berhasil masuk! Sinkronisasi aktif." };
}

export async function signOutCloud(): Promise<void> {
  const c = getClient();
  if (c) await c.auth.signOut();
  setState("unconfigured");
}

export async function getSessionEmail(): Promise<string | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const { data } = await c.auth.getSession();
    return data.session?.user?.email ?? null;
  } catch {
    return null;
  }
}

// ─── PETA KOLOM (lokal camelCase ↔ Supabase snake_case) ─────

type Row = Record<string, unknown>;

const NOTE_COLS: Record<string, string> = {
  id: "id", title: "title", content: "content", tags: "tags", pinned: "pinned",
  color: "color", createdAt: "created_at", updatedAt: "updated_at", deleted: "deleted",
};
const LIST_COLS: Record<string, string> = {
  id: "id", name: "name", color: "color", emoji: "emoji",
  order: "sort_order", createdAt: "created_at", deleted: "deleted",
};
const TODO_COLS: Record<string, string> = {
  id: "id", title: "title", notes: "notes", done: "done", priority: "priority",
  dueDate: "due_date", reminderAt: "reminder_at", listId: "list_id", tags: "tags",
  order: "sort_order", createdAt: "created_at", completedAt: "completed_at",
  updatedAt: "updated_at", deleted: "deleted",
};
const BOARD_COLS: Record<string, string> = {
  id: "id", name: "name", data: "data",
  createdAt: "created_at", updatedAt: "updated_at", deleted: "deleted",
};

function mapOut(row: Row, cols: Record<string, string>): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(cols)) {
    if (row[k] !== undefined) out[v] = row[k];
  }
  return out;
}

function mapIn(row: Row, cols: Record<string, string>): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(cols)) {
    if (row[v] !== undefined) out[k] = row[v];
  }
  return out;
}

// ─── SYNC ENGINE ─────────────────────────────────────────────

const LAST_SYNC_KEY = "noto-last-sync";

async function pushTable(
  table: "notes" | "todo_lists" | "todos" | "boards",
  rows: Row[],
  cols: Record<string, string>,
  c: SupabaseClient,
  userId: string,
): Promise<void> {
  if (rows.length === 0) return;
  const payload = rows
    .filter((r) => !("list" in r)) // relasi turunan, bukan kolom asli
    .map((r) => ({ ...mapOut(r, cols), user_id: userId }));
  const { error } = await c.from(table).upsert(payload, { onConflict: "id" });
  if (error) throw new Error(`push ${table}: ${error.message}`);
}

async function pullTable(
  table: "notes" | "todo_lists" | "todos" | "boards",
  store: Table<Record<string, unknown>, string>,
  cols: Record<string, string>,
  c: SupabaseClient,
  userId: string,
  sinceIso: string,
): Promise<number> {
  const { data, error } = await c
    .from(table)
    .select("*")
    .eq("user_id", userId)
    .gt("updated_at", sinceIso);
  if (error) throw new Error(`pull ${table}: ${error.message}`);
  if (!data || data.length === 0) return 0;
  for (const raw of data as Row[]) {
    const row = mapIn(raw, cols) as Row;
    const { user_id: _u, ...rest } = row;
    if (rest.deleted) {
      // Tombstone dari perangkat lain → hapus lokal
      await store.delete(rest.id as string);
    } else {
      await store.put(rest);
    }
  }
  return data.length;
}

export async function syncNow(): Promise<{ ok: boolean; message: string }> {
  if (syncing) return { ok: true, message: "Sedang sinkron" };
  const c = getClient();
  if (!c) return { ok: false, message: "Belum dikonfigurasi" };
  syncing = true;
  setState("syncing");
  try {
    if (navigator.onLine === false) {
      setState("offline");
      return { ok: false, message: "Tidak ada koneksi internet" };
    }
    const { data } = await c.auth.getSession();
    const user = data.session?.user;
    if (!user) {
      setState("idle", "Belum login");
      syncing = false;
      return { ok: false, message: "Login dulu dengan kode email" };
    }
    const lastSyncMs = Number(localStorage.getItem(LAST_SYNC_KEY) ?? 0);
    const sinceIso = new Date(lastSyncMs ? lastSyncMs - 60_000 : 0).toISOString(); // toleransi 1 menit jam perangkat

    // PUSH dulu (lokal → cloud), lalu PULL (cloud → lokal)
    const [notes, lists, todos, boards] = await Promise.all([
      db.notes.toArray() as Promise<NoteRow[]>,
      db.todoLists.toArray() as Promise<TodoListRow[]>,
      db.todos.toArray() as Promise<TodoRow[]>,
      db.boards.toArray() as Promise<BoardRow[]>,
    ]);
    await pushTable("notes", notes as unknown as Row[], NOTE_COLS, c, user.id);
    await pushTable("todo_lists", lists as unknown as Row[], LIST_COLS, c, user.id);
    await pushTable("todos", todos as unknown as Row[], TODO_COLS, c, user.id);
    await pushTable("boards", boards as unknown as Row[], BOARD_COLS, c, user.id);

    let pulled = 0;
    const asStore = (t: Table<unknown, string>) => t as unknown as Table<Record<string, unknown>, string>;
    pulled += await pullTable("notes", asStore(db.notes), NOTE_COLS, c, user.id, sinceIso);
    pulled += await pullTable("todo_lists", asStore(db.todoLists), LIST_COLS, c, user.id, sinceIso);
    pulled += await pullTable("todos", asStore(db.todos), TODO_COLS, c, user.id, sinceIso);
    pulled += await pullTable("boards", asStore(db.boards), BOARD_COLS, c, user.id, sinceIso);

    localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
    setState("ok", pulled > 0 ? `${pulled} perubahan diterima` : "");
    // Data baru dari cloud sudah masuk database lokal → segarkan widget offline
    void pushWidgetLocal();
    return { ok: true, message: pulled > 0 ? `Sinkron OK (${pulled} perubahan baru)` : "Semua data sudah tersinkron" };
  } catch (err) {
    const msg = friendlyError(err instanceof Error ? err.message : "Gagal sinkron");
    setState("error", msg);
    return { ok: false, message: msg };
  } finally {
    syncing = false;
  }
}

/** Auto-sync dengan debounce 4 detik — dipanggil repo setiap ada perubahan.
 *  Widget Android 2×2 ikut diperbarui di sini — SELALU, walau cloud tidak dipakai. */
export function scheduleSync(): void {
  scheduleWidgetLocal();
  const { cloudAutoSync, supabaseUrl, supabaseAnonKey } = useSettings.getState();
  if (!cloudAutoSync || !supabaseUrl || !supabaseAnonKey) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void syncNow(), 4000);
}

/** Dipanggil sekali saat app dibuka. */
export function initSync(): void {
  const { supabaseUrl, supabaseAnonKey, cloudAutoSync } = useSettings.getState();

  // Widget Android OFFLINE: tulis ringkasan dari data lokal saat app dibuka —
  // berjalan tanpa Supabase. Ganti tema/aksen → widget ikut berubah.
  setTimeout(() => void pushWidgetLocal(), 2000);
  useSettings.subscribe((s, prev) => {
    if (s.themeId !== prev.themeId || s.accent !== prev.accent) scheduleSync();
  });

  if (!supabaseUrl || !supabaseAnonKey) {
    setState("unconfigured");
    return;
  }
  if (cloudAutoSync) {
    setTimeout(() => void syncNow(), 1500);
  }
  window.addEventListener("online", () => {
    const { cloudAutoSync: auto } = useSettings.getState();
    if (auto) void syncNow();
  });
}

/** Cek status login (untuk UI settings). */
export async function checkAuthState(): Promise<string | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const { data } = await c.auth.getSession();
    return data.session?.user?.email ?? null;
  } catch {
    return null;
  }
}

// Tipe dipakai ulang repo.ts
export type { Note, Todo, TodoList, Board };
