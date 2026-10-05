# 🍊 Noto — Catatan, Tugas & Kanvas (v2)

Workspace pribadi bergaya **Obsidian** yang jalan penuh di browser **dan** sebagai **APK Android asli**: catatan Markdown, todo list pintar, kanvas kreatif, **widget layar utama bawaan**, notifikasi bersuara kustom, 8 mode warna, dan **sinkronisasi cloud gratis via Supabase**.

> 📖 **Panduan super lengkap ada di [`PANDUAN.md`](./PANDUAN.md)** — langkah demi langkah dari nol: upload GitHub, deploy web Vercel, database Supabase, build APK otomatis via GitHub Actions, pasang widget 2×2, sampai sinkron HP ↔ laptop.

![Noto](public/icons/icon-192.png)

## ✨ Fitur

| Fitur | Detail |
| --- | --- |
| 📝 **Catatan Markdown** | Editor + pratinjau langsung, checklist interaktif, tag, pin, gambar terkompres, simpan otomatis |
| ✅ **Tugas** | Quick-add paham bahasa (`besok 10:00 !penting #kerja`), daftar berwarna, prioritas, tenggat, pengingat |
| 🎨 **Kanvas** | Kartu teks/catatan/todo/gambar/checklist — drag, resize, warna, sambungan bergaris, zoom & pan, banyak papan |
| 🌈 **8 Tema** | Noto Gelap/Terang, Tengah Malam, Sepia, Nord, Sakura, Rimba, Monokrom + aksen hex kustom, font & sudut bebas |
| 🔔 **Notifikasi** | 6 nada sintetis (tanpa file) + **upload suara kustom** (MP3/OGG/WAV), volume, notifikasi sistem |
| 📱 **APK Android asli** | Dibungkus Capacitor — build otomatis gratis via GitHub Actions, lalu install seperti aplikasi biasa |
| 🧩 **Widget layar utama 2×2** | Widget **bawaan aplikasi** (bukan KWGT/eksternal) — daftar tugas aktif + tombol "＋ Tugas" + refresh |
| ☁️ **Sinkron Supabase** | Data lokal-first (IndexedDB) + push/pull cloud dengan login email OTP — web laptop & APK HP selalu sinkron |
| 🔒 **RLS per pengguna** | Tiap user hanya bisa melihat datanya sendiri (Row Level Security Supabase) |
| 💾 **Cadangan** | Ekspor/impor seluruh data sebagai JSON |

## 🧠 Cara Kerja (arsitektur v2)

```
┌─────────────────────────── HP (APK Android) ───────────────────────────┐
│  WebView Capacitor → Noto (static web) + Widget Android native 2×2     │
│  Data: IndexedDB (offline-first)  ──push/pull──▶  Supabase Cloud ☁️    │
└────────────────────────────────────────┬───────────────────────────────┘
                                         │   login email OTP (RLS)
┌─────────────────────────── Laptop (Web) ───────────────┬───────────────┐
│  Browser → Noto (static web di Vercel/Netlify)         ▼               │
│  Data: IndexedDB (offline-first)  ◀──push/pull──  Supabase Cloud ☁️    │
└────────────────────────────────────────────────────────────────────────┘
```

- **100% client-side** — static export Next.js, tanpa server/API. Bisa di-host di mana saja secara gratis.
- **Offline-first** — semua operasi baca/tulis ke IndexedDB (Dexie); app tetap jalan penuh tanpa internet.
- **Sinkron** — push lalu pull berdasarkan `updated_at` (Last-Write-Wins), auto-sync 4 detik setelah tiap perubahan + saat app dibuka + saat koneksi kembali.
- **Widget native** — `NotoWidgetProvider` (Android AppWidget) membaca ringkasan tugas dari tabel `widget_summary` Supabase lewat token rahasia.
- **APK otomatis** — GitHub Actions membangun `Noto.apk` setiap push ke `main`, hasilnya muncul di tab **Releases**.

## 🚀 Jalankan Lokal

```bash
bun install        # atau npm install
bun run dev        # buka http://localhost:3000
```

Tidak perlu database — data tersimpan di IndexedDB browser. Untuk sync, isi Supabase di Pengaturan (lihat PANDUAN.md Bagian 5).

## ☁️ Deploy Web (±5 menit, tanpa env vars!)

1. Upload project ke GitHub (PANDUAN.md Bagian 3).
2. Vercel → **Add New → Project** → Import repo → **Deploy**. Selesai — static export butuh nol konfigurasi.
3. (Opsional) Aktifkan Supabase + login di aplikasi untuk sinkron antar perangkat.

## 📱 Build APK + Widget (tanpa Android Studio)

1. Set 3 Secrets di repo GitHub: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `WIDGET_TOKEN` (didapat dari Pengaturan Noto setelah login cloud).
2. Tab **Actions** → jalankan **Build APK Noto** (atau otomatis tiap push).
3. Unduh **Noto.apk** dari tab **Releases** → install di HP → pasang widget **Noto** 2×2 dari menu widget launcher.

Detail lengkap: PANDUAN.md Bagian 6.

## 🗂️ Struktur Proyek

```
src/app/page.tsx                # SPA root (hash router: #/notes, #/todos, #/canvas, #/settings, #/guide, #/widget)
src/app/layout.tsx              # Metadata PWA + splash screen berlogo
src/components/views/           # dashboard, notes, todos, canvas, settings, guide, widget
src/lib/db.ts                   # Database lokal IndexedDB (Dexie) + seed data
src/lib/repo.ts                 # Lapisan CRUD lokal (pengganti REST API)
src/lib/sync.ts                 # Mesin sinkronisasi Supabase (OTP, push/pull, widget_summary)
src/lib/client.ts               # Router api() lokal + utilitas format/tanggal/gambar
src/lib/themes.ts, sounds.ts    # 8 tema, nada sintetis Web Audio
public/sw.js + manifest         # PWA (web bisa dipasang juga)
supabase-schema.sql             # Skema + RLS Supabase (jalankan sekali di SQL Editor)
android/                        # Project Android Capacitor + NotoWidgetProvider (widget 2×2)
.github/workflows/build-apk.yml # CI build APK otomatis → Releases
```

## 🧰 Stack

Next.js 16 (static export) · TypeScript · Tailwind CSS 4 · shadcn/ui · Dexie (IndexedDB) · Supabase (Postgres + Auth OTP + RLS) · Capacitor 8 (Android) · react-markdown · Web Audio API · zustand · framer-motion
