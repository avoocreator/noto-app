// ============================================================
// NOTO — Widget Android 2×2 (mode OFFLINE)
// Widget tidak lagi mengambil data dari Supabase. Aplikasi
// menulis ringkasan tugas + warna tema aktif ke file
// widget-data.json di folder data aplikasi (Directory.Data),
// lalu memicu refresh widget lewat plugin native "WidgetSync".
// Widget membaca file itu langsung → 100% offline, tanpa
// Supabase, tanpa token, tanpa internet.
// ============================================================

"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { db, nowIso } from "./db";
import { useSettings } from "./store";
import { getTheme, readableFg } from "./themes";

/** Plugin native kecil (WidgetSyncPlugin.java) untuk memicu redraw widget. */
const WidgetSync = registerPlugin<{ refresh: () => Promise<void> }>("WidgetSync");

const WIDGET_FILE = "widget-data.json";
let pushTimer: ReturnType<typeof setTimeout> | null = null;

/** true bila Noto berjalan sebagai app Android (Capacitor), bukan di browser. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** Susun ringkasan tugas + warna tema aktif — bentuk data sama dengan
 *  widget_summary versi cloud sehingga kode penggambar widget tidak berubah. */
async function buildSummary() {
  const todos = await db.todos.toArray();
  const active = todos
    .filter((t) => !t.done && !t.deleted)
    .sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const dbb = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return da - dbb;
    });

  // Daftar terstruktur untuk widget: tugas aktif dulu, lalu yang baru
  // selesai (dicoret) — supaya widget terasa "semua tugas", bukan sebagian.
  const recentDone = todos
    .filter((t) => t.done && !t.deleted)
    .sort((a, b) =>
      (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt),
    )
    .slice(0, 4);

  const items = [
    ...active.map((t) => ({
      t: t.title + (t.priority === 2 ? " \u{1F525}" : ""),
      d: 0,
    })),
    ...recentDone.map((t) => ({ t: t.title, d: 1 })),
  ].slice(0, 10);

  const lines = active
    .slice(0, 8)
    .map((t) => `○ ${t.title}${t.priority === 2 ? " 🔥" : ""}`);
  const text = lines.length ? lines.join("\n") : "Semua tugas selesai! 🎉";

  // Progres untuk bar widget: selesai / total (tugas yang tidak dihapus)
  const alive = todos.filter((t) => !t.deleted);
  const total = alive.length;
  const done = alive.filter((t) => t.done).length;

  // Warna tema aktif + aksen kustom → widget tampil seragam dengan aplikasi
  const { themeId, accent: accentOverride } = useSettings.getState();
  const th = getTheme(themeId);
  const accent = accentOverride || th.vars.primary;

  return {
    items,
    todos_text: text,
    todo_count: active.length,
    todo_done: done,
    todo_total: total,
    theme_json: {
      bg: th.vars.background,
      bg2: th.vars.card,
      border: th.vars.border,
      fg: th.vars.foreground,
      muted: th.vars.mutedForeground,
      accent,
      accentFg: readableFg(accent),
    },
    updated_at: nowIso(),
  };
}

/** Tulis data widget ke file lokal + picu refresh widget (khusus app Android). */
export async function pushWidgetLocal(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const data = JSON.stringify(await buildSummary());
    await Filesystem.writeFile({
      path: WIDGET_FILE,
      directory: Directory.Data,
      data,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    await WidgetSync.refresh();
  } catch {
    // diam — widget tetap menampilkan data terakhir yang berhasil ditulis
  }
}

/** Versi debounce — dipanggil tiap ada perubahan data di repo. */
export function scheduleWidgetLocal(): void {
  if (!isNativeApp()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void pushWidgetLocal(), 1200);
}
