# Noto untuk Windows (.exe)

Noto desktop memakai Tauri 2. Vault = folder biasa di File Explorer (isinya `.md` / `.canvas` asli).

## Prasyarat (sekali saja)
1. Node.js 22+
2. Rust: https://rustup.rs
3. Visual Studio Build Tools (workload "Desktop development with C++")
4. WebView2 (sudah ada di Windows 10/11 terbaru)

## Jalankan / build
```
npm install
npm run desktop:dev     # mode dev (jendela desktop)
npm run desktop:build   # bikin installer
```
Hasil:
- Installer: `src-tauri/target/release/bundle/nsis/Noto_3.0.0_x64-setup.exe`
- MSI: `src-tauri/target/release/bundle/msi/`
- Portable: `src-tauri/target/release/noto.exe`

Tanpa PC Windows: push tag `v*` atau jalankan workflow **Build Desktop** di GitHub Actions, lalu unduh artifact `noto-windows`.

## Memakai folder sebagai vault
Pertama buka → **Buka folder…** → pilih folder mana pun. Pilihan diingat (persisted-scope). Klik kanan file/folder → *Tampilkan di Explorer* untuk membukanya.
Folder `.noto/` di dalam vault menyimpan config (ikon, pin, dll).
