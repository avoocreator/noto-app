# Noto v3

Vault catatan Markdown + canvas, lokal-first. Sinkron opsional ke Supabase (HP ⇄ PC). Widget 2×2 di Android dan jendela tempel di desktop.

## Jalankan

```bash
npm install
npm test          # tes logika murni (parser tugas, sinkron, canvas, tema, dll.)
npm run dev       # http://localhost:5173
npm run build     # typecheck + build produksi ke dist/
```

> Catatan jujur: kode UI (React/CodeMirror/Supabase/Tauri/Android) ditulis tanpa bisa `npm install` di lingkungan pembuatnya, jadi **belum pernah di-build**. Logika murni teruji (`npm test`). Jika `npm run build` mengeluarkan error tipe, itu perbaikan kecil — kirim pesannya.

## Fitur utama
- **Vault** = folder berisi `.md` dan `.canvas` (JSON Canvas, kompatibel Obsidian). Browser: folder asli (Chrome/Edge) atau penyimpanan internal; desktop (Tauri): folder asli; Android: penyimpanan privat aplikasi.
- **Editor live-preview** (CodeMirror 6): `[[wikilink]]`, `#tag`, callout, tugas, gambar tempel/seret, menu `/`.
- **Tugas di dalam catatan** (format Obsidian Tasks): tanggal, jam, prioritas, ulang; ketik bahasa alami ("besok jam 9 rapat").
- **Menu tanggal & jam** di kolom tambah tugas (dan ikon kalender di tiap tugas untuk mengubah): pilihan cepat, kalender, jam, prioritas, ulang.
- **Pengingat & alarm**: gaya Notifikasi atau Alarm (nada berulang + layar Selesai/Tunda/Matikan), 6 nada bawaan, impor suara `.mp3`, volume, jam bawaan untuk tugas tanpa jam. Android memakai notifikasi terjadwal OS (nada bawaan dirender ke `res/raw` oleh `scripts/make-sounds.py`).
- **Canvas** tak terbatas: kartu, catatan, gambar, tautan, grup, panah, minimap, undo/redo.
- **Graf**, backlink, tautan tak tertaut, riwayat versi, tong sampah, template, catatan harian.
- **Tema**: terang/gelap/sistem × palet (Sorbet, Jeruk, Mint, Lavender, Nord, Mono, Custom) dengan audit kontras.
- **Sinkron Supabase**: tiga arah, konflik disimpan sebagai salinan, hapus jarak jauh masuk tong sampah lokal.
- **Widget**: Android 2×2, desktop jendela tempel (`?widget=1`), tautan `noto://new|task|open|daily`.
- **Pintasan**: Ctrl/Cmd+K palet, +O buka, +P cari, +N baru, +D hari ini, +, pengaturan, +\ panel kanan.

## Supabase (opsional)
1. Buat proyek, jalankan `supabase/schema.sql` di SQL Editor.
2. Isi `.env` (lihat `.env.example`) atau masukkan URL + anon key di Pengaturan → Sinkron.
3. Masuk dengan kode OTP email, lalu "Aktifkan sinkron" di vault.

Data tidak dienkripsi end-to-end; dilindungi RLS per pengguna.

## Desktop (Tauri 2)
Butuh Rust. `npm run tauri dev` / `npm run tauri build`. Jika ikon `.icns` diperlukan (macOS): `npx tauri icon src-tauri/icons/icon.png`.

## Android (Capacitor)
```bash
npm run build && npm run cap:add && npm run cap:sync
cd android && ./gradlew assembleDebug
```
`cap:sync` juga memasang widget 2×2, ikon, dan tautan `noto://`. Atau jalankan workflow GitHub "Build APK".
Batasan: vault Android ada di penyimpanan privat aplikasi (belum ada pemilih folder SAF); gunakan Ekspor ZIP / sinkron untuk memindahkan data.

## Struktur
`src/lib` logika murni · `src/vault` adaptor penyimpanan · `src/sync` sinkron · `src/editor` CodeMirror · `src/views` halaman · `src/theme` warna · `native/` widget Android · `src-tauri/` desktop · `scripts/make-brand.py` generator logo/ikon.
