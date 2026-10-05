# 📱 PANDUAN LENGKAP NOTO v2

> Noto v2 sekarang **aplikasi Android asli + web**, dengan **database Supabase gratis** dan **widget layar utama bawaan** (tanpa KWGT). Panduan ini memandu kamu dari nol sampai semua jalan — tanpa menyentuh satu baris kode pun.

---

## 🗺️ Peta Panduan (bacakan sesuai kebutuhan)

| Bagian | Isi | Waktu |
| --- | --- | --- |
| [1](#bagian-1--apa-saja-yang-berubah-dari-versi-lama) | Apa yang berubah dari versi lama | 3 mnt baca |
| [2](#bagian-2--upload-project-ke-github) | Upload project ke GitHub | ±10 mnt |
| [3](#bagian-3--deploy-web-di-vercel-laptop) | Deploy web di Vercel (laptop) | ±5 mnt |
| [4](#bagian-4--database-supabase-gratis) | Database Supabase + login email | ±10 mnt |
| [5](#bagian-5--apk-android--widget-layar-utama-2x2) | **APK Android + Widget 2×2** | ±15 mnt |
| [6](#bagian-6--sinkronisasi-hp--laptop) | Sinkronisasi HP ↔ laptop | ±3 mnt |
| [7](#bagian-7--notifikasi--suara-kustom) | Notifikasi & suara kustom | ±3 mnt |
| [8](#bagian-8--cadangan--pemulihan-data) | Cadangan & pemulihan | ±2 mnt |
| [9](#bagian-9--troubleshooting--faq) | Troubleshooting & FAQ | — |
| [10](#bagian-10--jalankan-di-komputer-opsional) | Jalankan di komputer (opsional) | ±5 mnt |

**Alur tercepat sampai semua jalan:** Bagian 2 → 3 → 4 → 5. Sisanya opsional/tambahan.

---

## Bagian 1 — Apa Saja yang Berubah dari Versi Lama?

Noto v2 dibangun ulang dengan sistem yang sama dengan **Budgeto v2** — tampilan & fitur tidak berubah sama sekali, hanya "mesinnya":

| Aspek | Noto v1 (lama) | Noto v2 (baru) |
| --- | --- | --- |
| Penyimpanan | Database server (SQLite/Neon) via REST API | **IndexedDB di perangkat** (offline-first) + Supabase cloud |
| Login | Tidak ada (opsional kata sandi) | **Email OTP via Supabase** — tiap user terlindungi RLS |
| Sinkron antar perangkat | Hanya bila satu database server sama | **Push/pull otomatis** ke Supabase — HP & laptop selalu sinkron |
| Jadi aplikasi HP | Hanya PWA (pasang lewat browser) | **APK Android asli** (Capacitor) dibangun otomatis GitHub Actions |
| Widget 2×2 | Lewat aplikasi eksternal (KWGT) | **Widget bawaan aplikasi** — pasang langsung dari menu widget Android |
| Deploy | Vercel + env `DATABASE_URL` | Vercel **tanpa env vars sama sekali** (static export) |
| Offline | Terbatas (data di server) | **Penuh** — catat & centang tugas tanpa internet, sinkron saat online |

Yang **tidak berubah**: semua tampilan, 8 tema, suara notifikasi kustom, kanvas, catatan markdown, tugas pintar, splash screen berlogo.

---

## Bagian 2 — Upload Project ke GitHub

### Langkah 2.1 — Siapkan file

Extract ZIP Noto ke komputer (atau pakai folder yang sudah ada). Pastikan isi foldernya:

```
noto/
├── PANDUAN.md        ← sedang kamu baca
├── README.md
├── supabase-schema.sql  ← akan dipakai di Bagian 4
├── capacitor.config.ts
├── android/          ← project APK (jangan diubah)
├── .github/workflows/build-apk.yml  ← mesin build APK
├── src/ ... (kode aplikasi)
└── package.json
```

> ⚠️ **Jangan** upload folder `node_modules` (kalau ada) — besar & tidak perlu. File `.gitignore` sudah mengecualikan `node_modules`, `.next`, `out`, dan file database lokal otomatis.

### Langkah 2.2 — Buat repo & upload

**Cara A — lewat web GitHub (tanpa Git):**
1. Login **github.com** → tombol **+** → **New repository** → nama `noto-app` → **Private** (disarankan) → **Create**.
2. Klik link **uploading an existing file** → drag & drop **seluruh isi folder** (termasuk folder `android`, `src`, `.github`).
   - 💡 Gampangnya: compress isi folder jadi ZIP → drag ZIP itu ke halaman upload → GitHub mengekstrak otomatis.
   - ⚠️ Pastikan file/folder **tersembunyi** ikut ter-upload: `.github/`, `.gitignore`. (Kalau drag folder biasa, file titik kadang terlewat — paling aman lewat ZIP atau Git.)
3. Pesan commit: `Noto v2 siap deploy` → **Commit changes**.

**Cara B — lewat Git (lebih rapi):**
```bash
cd folder-noto
git init
git add .
git commit -m "Noto v2 siap deploy"
git remote add origin https://github.com/USERNAME/noto-app.git
git branch -M main
git push -u origin main
```
> Saat diminta login GitHub di terminal, gunakan **Personal Access Token** sebagai sandi (GitHub → Settings → Developer settings → Tokens).

### Langkah 2.3 — Pastikan file penting ter-upload

Buka repo di browser, cek ada: `supabase-schema.sql`, `capacitor.config.ts`, folder `android/app`, `.github/workflows/build-apk.yml`. Kalau ada yang kurang (biasanya folder titik), upload ulang lewat **Add file → Upload files**.

---

## Bagian 3 — Deploy Web di Vercel (Laptop)

Karena Noto v2 adalah static export, deploy-nya **tanpa konfigurasi apa pun** — tidak ada env vars, tidak ada database URL.

### Langkah 3.1 — Deploy

1. Buka **vercel.com** → login **Continue with GitHub**.
2. **Add New… → Project** → cari `noto-app` → **Import**.
3. Semua pengaturan biarkan **default** (Framework Preset: Next.js terdeteksi otomatis). **Tidak perlu mengisi Environment Variables.**
4. Klik **Deploy** → tunggu ±1–2 menit → klik domain yang muncul, mis. `https://noto-app.vercel.app`.

### Langkah 3.2 — Coba di browser

Dashboard dengan data contoh muncul (disimpan di browser). Coba tambah tugas dari kotak cepat, buka catatan, gambar kanvas — semuanya jalan.

### Langkah 3.3 — (Opsional) Pasang sebagai PWA di laptop/HP lama

- **Chrome/Edge laptop**: ikon install di address bar → *Install Noto*.
- **Android (alternatif kalau belum pakai APK)**: Chrome → menu ⋮ → *Tambahkan ke layar utama*.
- **iPhone**: Safari → tombol Bagikan → *Tambahkan ke Layar Utama*.

> 💡 Setiap kali kamu push kode baru ke GitHub, Vercel otomatis deploy ulang — tidak perlu sentuh apa pun.

---

## Bagian 4 — Database Supabase (Gratis)

Ini jantung sinkronisasi: satu database untuk web & APK, gratis, dengan proteksi data per pengguna.

### Langkah 4.1 — Buat project Supabase

1. Buka **supabase.com** → **Start your project** → daftar (bisa pakai GitHub).
2. **New project** → Name: `noto` → buat **Database Password** (simpan, jarang dipakai) → Region: **Singapore** → **Create new project**. Tunggu ±2 menit.

### Langkah 4.2 — Buat semua tabel (copy-paste)

1. Di dashboard Supabase, buka **SQL Editor** (ikon `>_` di sidebar kiri).
2. Klik **New query**.
3. Buka file **`supabase-schema.sql`** dari project Noto (buka pakai Notepad/teks editor) → **copy SEMUA isinya** → paste ke SQL Editor.
4. Klik **Run** (atau Ctrl+Enter). Muncul `Success. No rows returned` — artinya 5 tabel berhasil dibuat: `notes`, `todo_lists`, `todos`, `boards`, `widget_summary` — lengkap dengan proteksi RLS.

> ⏫ **Sudah pernah menjalankan schema lama sebelumnya?** Cukup jalankan juga isi file **`supabase-upgrade-widget-theme.sql`** di SQL Editor (sekali saja) — ini menambah 3 kolom baru agar widget HP bisa mengikuti tema aplikasi + menampilkan progress bar. Aman dijalankan berkali-kali, tidak menghapus data apa pun.

### Langkah 4.3 — Ambil 2 kunci

1. Buka **Project Settings** (ikon gerigi) → **API** (atau menu **Data API**).
2. Salin 2 hal ini:
   - **Project URL** → bentuknya `https://xxxxxxx.supabase.co`
   - **anon public key** → panjang, diawali `eyJhbGciOi…` (yang di bawah "Project API Keys" / "anon public")
3. Simpan sementara di Notepad.

> 🔑 Yang dipakai hanya **anon key** (kunci publik) — aman untuk aplikasi klien karena datamu tetap terkunci RLS per user login.

> ⚠️ Di dashboard Supabase sering tampil URL lengkap `https://xxxx.supabase.co/rest/v1` — akhiran `/rest/v1` **jangan ikut disalin** ke kolom Project URL. Kalau terlanjur, tidak apa-apa: Noto membersihkannya otomatis. Anon key juga otomatis dibersihkan dari spasi/enter yang ikut tersalin.

### Langkah 4.4 — Hubungkan di aplikasi Noto

1. Buka Noto (web Vercel tadi) → **Pengaturan** (gerigi) → bagian **Cloud & Sinkronisasi**.
2. Tempel **Project URL** dan **Anon Key** ke dua kolom yang tersedia.
3. Masukkan **email kamu** → klik **Kirim kode**.
4. Cek email → dapat **kode 6 digit** dari Supabase → masukkan di kolom kode → **Verifikasi**.
5. Status berubah jadi hijau "Semua data tersinkron" — dan data contoh + semua yang kamu buat langsung ter-unggah ke cloud. 🎉

> 📧 Supabase free tier mengirim email OTP lewat server bawaannya (batas ±2 email/jam). Login hanya dilakukan sekali per perangkat, jadi itu cukup. Kalau habis kuota, tunggu ±1 jam — atau pasang SMTP kustom gratis via Brevo (Langkah 4.5 A) biar kuotanya jadi 300 email/hari.

### Langkah 4.5 — WAJIB: aktifkan SMTP, ganti template email, atur Site URL (biar dapat KODE, bukan link)

Template bawaan Supabase mengirim **link login**, bukan kode 6 digit — dan linknya membuka `localhost:3000` (bisa nyasar ke proyek lain yang kebetulan jalan di laptopmu).

> ⚠️ **Halaman Templates terkunci?** Kalau di **Authentication → Emails → Templates** muncul tulisan *"Set up custom SMTP to edit templates"* dan tombol editnya tidak ada — memang begitu: **proyek Supabase baru mengunci semua template** sampai kamu memasang SMTP kustom. Kerjakan langkah **A** dulu (gratis, ±10 menit) — setelah itu template bisa diedit. Tidak mau pasang SMTP? Lompat ke langkah **C** lalu login dengan cara **klik link** di email (lihat kotak "Alternatif tanpa SMTP" di bawah).

**A. Pasang SMTP gratis via Brevo (membuka kunci template + kuota jadi 300 email/hari)**

1. Buka **brevo.com** → daftar gratis (pakai email yang sama dengan yang dipakai login di Noto).
2. Di dashboard Brevo, klik **nama akunmu (kanan atas)** → **Senders, Domains & Dedicated IPs** → tab **Senders** → **Add a sender** → isi nama `Noto` + emailmu → buka email konfirmasi dari Brevo → klik tombol verifikasinya.
3. Klik **nama akunmu → SMTP & API** → di kartu **SMTP** (bukan API) klik **Generate new SMTP key** kalau belum ada → salin **SMTP key**-nya (disimpan dulu, dipakai di langkah 5).
4. Kembali ke Supabase → **Authentication → Emails → tab SMTP Settings** → klik **Set up SMTP** → isi persis seperti ini:

   | Kolom | Isi |
   | --- | --- |
   | Sender email | email yang kamu verifikasi di Brevo (langkah 2) |
   | Sender name | `Noto` |
   | Host | `smtp-relay.brevo.com` |
   | Port | `587` |
   | Username | email akun Brevo kamu |
   | Password | SMTP key dari langkah 3 |
   | Minimum interval | biarkan default |

5. Klik **Save/Enable**. Sekarang email Noto terkirim lewat Brevo (300/hari, jauh di atas ±2/jam bawaan) **dan halaman Templates terbuka untuk diedit**.

**B. Ganti template email jadi KODE 6 digit**

1. Dashboard Supabase → **Authentication** (ikon perisai) → **Emails** → tab **Templates**.
2. Klik template **Magic link or OTP** (di sebagian proyek bernama "Login"). Hapus semua isinya, ganti dengan ini:

   ```html
   <h2>Kode Masuk Noto</h2>
   <p>Halo,</p>
   <p>Kode masuk kamu (berlaku 1 jam, hanya bisa dipakai sekali):</p>
   <p style="font-size:30px;font-weight:700;letter-spacing:6px;margin:16px 0;">{{ .Token }}</p>
   <p>Atau masuk langsung tanpa mengetik kode: <a href="{{ .ConfirmationURL }}">buka Noto</a></p>
   ```

3. Ubah **Subject**-nya juga jadi misal `Kode masuk Noto: {{ .Token }}` → klik **Save**.
4. Ulangi hal yang sama untuk template **Confirm signup** (dipakai saat emailmu pertama kali terdaftar).
5. Selesai — sekarang email berisi **kode 6 digit** yang tinggal diketik di Noto. Lebih aman: kode tidak bisa "terbakar" oleh pemindai link Gmail seperti magic link.

**C. Arahkan Site URL ke aplikasi Noto**

1. Dashboard Supabase → **Authentication** → **URL Configuration** (ada di menu kiri, di bawah Emails).
2. **Site URL** → ganti `http://localhost:3000` jadi URL Vercel kamu, misal `https://noto-app-mu.vercel.app`.
3. Di **Redirect URLs** → **Add URL** → masukkan URL Vercel yang sama.
4. **Save**. Sekarang kalau kamu pilih masuk lewat link di email, link itu membuka aplikasi Noto (bukan proyek lain) dan langsung login otomatis.

> 💡 Setelah mengubah template, kirim ulang kode di Noto (**Kirim kode**). Kode lama yang belum dipakai otomatis tidak berlaku setelah kode baru dikirim.

> 🧩 **Alternatif tanpa SMTP** (kalau tidak mau daftar Brevo): cukup kerjakan **langkah C** di atas. Lalu cara loginnya: tekan **Kirim kode** di Noto → buka email → **klik tautannya** (jangan cari kode, memang tidak ada) → kamu langsung masuk Noto tanpa mengetik apa pun. Klik linknya di laptop & browser yang sama saat menekan Kirim kode. Kelemahan cara ini: tetap kena kuota ±2 email/jam, dan kadang link terbakar duluan oleh pemindai link Gmail — kalau link tertulis sudah kedaluwarsa, kirim kode baru lalu klik lagi secepatnya.

---

## Bagian 5 — APK Android + Widget Layar Utama 2×2

APK dibangun **gratis oleh GitHub Actions** — kamu tidak perlu Android Studio, kabel, apa pun. APK muncul di tab **Releases** repo-mu.

### Langkah 5.1 — Build APK (tanpa secrets!)

> 🎉 **Tidak perlu mengisi Secrets apa pun.** Widget 2×2 sekarang bekerja **offline** — data diambil langsung dari aplikasi Noto di HP (bukan dari Supabase), jadi tidak ada kredensial yang perlu ditanam ke APK. Kalau dulu kamu sudah membuat secrets `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `WIDGET_TOKEN`, boleh dihapus atau dibiarkan — build tidak lagi memakainya.

Langkah build:

1. Push kode ke GitHub (Bagian 3) → tab **Actions** otomatis jalan.
2. Tunggu ±5–8 menit sampai centang hijau ✓.

### Langkah 5.2 — Jalankan build APK

1. Di repo, buka tab **Actions** → pilih workflow **Build APK Noto** → **Run workflow** → **Run workflow** (atau biarkan jalan otomatis karena push terbaru).
2. Tunggu ±5–8 menit. Kalau selesai dengan centang hijau ✓ → buka tab **Releases** (sidebar kanan repo) → unduh **Noto.apk** dari release *Noto APK (terbaru)*.
   - Alternatif: dari run di tab Actions → bagian **Artifacts** → `Noto-APK`.
3. Gagal? Buka run yang gagal → baca langkah merahnya. Penyebab paling umum: folder `android/` tidak ikut ter-upload. Setelah memperbaiki → **Re-run all jobs**.

### Langkah 5.3 — Install APK di HP Android

1. Kirim `Noto.apk` ke HP (WhatsApp Web, Google Drive, kabel USB — bebas).
2. Buka file APK di HP → muncul peringatan *"Install unknown apps"* → izinkan (**Settings → Izinkan dari sumber ini**) → **Install**.
   - Ini normal karena APK di luar Play Store. APK hanya berisi aplikasimu.
3. Buka **Noto** — splash berlogo muncul → dashboard.

### Langkah 5.4 — (Opsional) Login cloud di APK

Widget tidak butuh cloud, tapi kalau kamu ingin **sinkron HP ↔ laptop**, tetap lakukan Bagian 4.4 di APK: **Pengaturan → Cloud & Sinkronisasi** → tempel URL & anon key → email → kode OTP → verifikasi. Tanpa langkah ini pun Noto di HP tetap berfungsi penuh (offline-first).

### Langkah 5.5 — Pasang widget 2×2 di layar utama

1. Buka aplikasi **Noto** di HP sekali dulu (biar widget punya data).
2. Di layar utama Android: **tekan lama area kosong** → **Widgets**.
3. Cari **Noto** → pilih widget **Noto** (2×2) → taruh di layar utama.
4. Widget tampil sebagai kartu daftar tugas: brand **Noto** + jumlah aktif di atas, **daftar tugas dengan kotak centang** (selesai = terisi oranye + dicoret), **progress bar** + rasio "2/5" (selesai vs total), dan **tombol bulat ＋**.
   - Ketuk kartu → app terbuka. Ketuk **＋** → app langsung terbuka di form tambah tugas.
   - Ketuk **⟳** untuk membaca ulang data. Widget juga ikut memperbarui dirinya setiap kamu menambah/mengubah tugas di app (±1 detik) + otomatis ±30 menit + tiap HP restart.
5. **100% offline**: widget membaca data dari aplikasi Noto di HP ini — tidak ada koneksi ke Supabase sama sekali. Tambah tugas saat pesawat mode? Widget tetap ikut.
6. **Warna widget mengikuti tema aplikasi** — ganti tema/aksen di Pengaturan → widget langsung ikut berubah (latar, garis, progress bar, tombol).
7. **Ingin lebih banyak tugas terlihat sekaligus?** Perbesar widget: tekan lama → **Ubah ukuran** → tarik jadi 2×3 atau 2×4. Jumlah baris daftar otomatis bertambah mengikuti tinggi widget (2×2 muat ±2 tugas, 2×4 muat ±6).

> ℹ️ Kalau widget bilang **"BUKA NOTO DULU"**: artinya app belum pernah dibuka sejak widget dipasang. Buka Noto sekali — kartu langsung terisi.

### Langkah 5.6 — Update aplikasi di kemudian hari

Push perubahan ke GitHub → Actions membangun ulang APK otomatis → unduh lagi dari **Releases** → install di atas yang lama (data aman, tidak perlu uninstall). Bagian web (Vercel) sudah ter-update otomatis.

---

## Bagian 6 — Sinkronisasi HP ↔ Laptop

### Cara kerjanya (singkat saja)

- Semua data **ditulis dulu ke perangkat** (IndexedDB) — aplikasi selalu responsif & jalan offline.
- Setiap perubahan → **±4 detik kemudian** dikirim ke Supabase (kalau online & login).
- Saat app dibuka / koneksi kembali → **pull** perubahan dari perangkat lain.
- Konflik diselesaikan **Last-Write-Wins**: versi yang terakhir disimpan menang.

### Yang perlu kamu lakukan

1. Login **email yang sama** di semua perangkat (web + APK).
2. Selesai. Coba: tambah tugas di laptop → buka app di HP (atau ketuk ⟳ di widget) → tugas muncul. Ubah di HP → refresh web → ikut berubah.

> ⚠️ Sync membutuhkan internet. Tanpa internet, kerja offline normal — saat online lagi, data otomatis terkirim.
> ℹ️ Pengaturan tampilan (tema/suara) memang per-perangkat — biar tiap perangkat bisa beda selera.

---

## Bagian 7 — Notifikasi & Suara Kustom

Bekerja di web maupun APK — di APK kini lewat **izin & notifikasi asli Android**:

1. **Pengaturan → Notifikasi & Suara** → aktifkan **pengingat**.
2. **Izin notifikasi sistem** → klik **Minta izin**:
   - **Di APK**: muncul **dialog izin Android bawaan** (Android 13+) — pilih *Izinkan*. Setelah itu pengingat muncul sebagai **notifikasi sistem asli** di layar & status bar.
   - **Di browser**: muncul prompt notifikasi browser seperti biasa.
   - Izin pernah ditolak? Tahan ikon Noto → **Info aplikasi → Notifikasi** → aktifkan manual.
3. **Pilih nada bawaan** (6 pilihan sintetis) atau **unggah suara sendiri** — MP3/OGG/WAV maks 3 MB (lagu, efek, suara ketukan, bebas!).
4. Atur **volume** → **Uji suara**.
5. Pada tugas tertentu: buka detail tugas → **Pengingat** → pilih tanggal & jam. Saat waktunya tiba (app terbuka atau di latar Android), notifikasi muncul dengan **suaramu**.

> 💡 Pengingat diperiksa tiap ±20 detik selama app terbuka/berjalan di latar. iOS: notifikasi web hanya berbunyi saat app terbuka (batasan Apple).

---

## Bagian 8 — Cadangan & Pemulihan Data

- **Ekspor**: **Pengaturan → Data & Cadangan → Ekspor JSON** → file cadangan terunduh (berisi catatan, tugas, daftar, papan kanvas).
- **Impor**: tombol **Impor JSON** → pilih file cadangan → data diterapkan (data lama di perangkat itu diganti).
- **Pindah HP/laptop baru**: cukup login email yang sama → data ter-pull otomatis. Impor JSON hanya perlu kalau tanpa cloud.
- Cadangan cloud = data ada di Supabase (server). Free tier Supabase tidak kedaluwarsa & kapasitas 500 MB — setara ratusan ribu catatan.

---

## Bagian 9 — Troubleshooting & FAQ

**🔴 Build APK di Actions gagal (tanda ✗)**
Buka run yang gagal → baca langkah merahnya. Penyebab umum: 1) folder `android/` tidak ikut ter-upload, 2) build web (`bun run build`) gagal karena file ter-edit salah. Setelah memperbaiki → **Re-run all jobs**.

**🔴 Widget tampil "BUKA NOTO DULU"**
Artinya aplikasi Noto belum pernah dibuka di HP itu sejak widget dipasang (atau baru saja di-install ulang). Buka **Noto** sekali — kartu langsung terisi dari data di HP. Widget bekerja offline, jadi ini satu-satunya syaratnya.

**🔴 Widget cuma menampilkan 1–2 tugas, sisanya tidak terlihat**
Itu wajar untuk ukuran 2×2 — satu layar kotak memang sempit. Perbesar widget: tekan lama kartu → **Ubah ukuran** → tarik jadi **2×3** atau **2×4**; jumlah baris tugas otomatis bertambah mengikuti tinggi widget.

**🔴 Widget tidak ikut berubah saat tugas ditambah/diubah**
1) Pastikan perubahan dilakukan lewat aplikasi Noto di HP yang sama dengan widgetnya (data widget = data lokal HP, bukan cloud). 2) Ketuk **⟳** di widget untuk membaca ulang. 3) Kalau masih mentok, buka app Noto lalu tutup lagi — widget menyegarkan diri tiap app dibuka.

**🔴 Widget warnanya tidak mengikuti tema**
Widget membaca tema dari data lokal HP. Ganti tema/aksen di **Pengaturan** saat app HP terbuka → widget ikut dalam ±1 detik. Kalau kamu ganti tema di laptop, buka app di HP dulu (biar tema tersalin lewat cloud atau di-set manual) → widget ikut.

**🔴 Notifikasi: izin gagal / tidak muncul dialog di APK**
1) Update ke APK versi terbaru (yang sudah memakai izin notifikasi asli Android). 2) Kalau izin pernah ditolak, Android tidak menampilkan dialog lagi: tahan ikon Noto → **Info aplikasi → Notifikasi** → aktifkan manual. 3) Cek juga *Pengaturan → Notifikasi & Suara → Aktifkan pengingat* dalam posisi ON.

**🔴 Suara notifikasi terlalu pelan / terlalu kencang**
Atur slider **Volume notifikasi** di Pengaturan (0–100%). Suara bawaan sudah dikencangkan + dilindungi limiter agar keras tapi tidak pecah. Volume HP yang aktif adalah volume media — naikkan juga lewat tombol volume saat app dipakai.

**🔴 Status cloud "Terjadi galat sinkronisasi"**
1) Cek URL & anon key tidak ada spasi/enter ikut ter-tempel. 2) Pastikan SQL schema sudah di-Run (Bagian 4.2) — kalau tabel belum ada, push gagal. 3) Cek koneksi internet.

**🔴 Email OTP tidak datang**
Cek folder spam. Kalau pakai server email bawaan Supabase, kuotanya ±2/jam — tunggu lalu kirim ulang, atau pasang SMTP Brevo gratis (Langkah 4.5 A) biar kuotanya 300/hari.

**🔴 Email berisi LINK "Your sign-in link", bukan kode 6 digit**
Template email masih bawaan. Di halaman **Authentication → Emails → Templates** biasanya juga muncul tulisan "Set up custom SMTP to edit templates" — artinya template terkunci. Ikuti **Langkah 4.5 A lalu B** (Brevo → template `{{ .Token }}`). Kalau tidak mau pakai SMTP: ikuti saja Langkah 4.5 C lalu login dengan cara klik link di email (kotak "Alternatif tanpa SMTP").

**🔴 Link di email malah membuka proyek lain / localhost:3000 / error otp_expired**
Site URL Supabase masih default. Ikuti **Langkah 4.5 C** — isi Site URL & Redirect URLs dengan URL Vercel Noto kamu. Sementara itu abaikan link lama dan pakai kode 6 digit (Langkah 4.5 A–B) — pemindai link Gmail juga bisa membuat magic link kedaluwarsa lebih cepat.

**🔴 Data contoh muncul lagi di perangkat baru?**
Seed data contoh hanya muncul bila database perangkat kosong. Setelah sync berjalan, data aslimu menimpa; contoh bisa dihapus manual (menu daftar ⋯ untuk tugas, ikon 🗑 untuk catatan).

**🔴 "Install blocked" saat pasang APK**
Izinkan *Install unknown apps* untuk aplikasi yang kamu pakai membuka APK (Bagian 5.3 langkah 2). Aman — APK buatanmu sendiri.

**🔴 Perubahan di HP tidak muncul di laptop**
1) Pastikan **keduanya login email sama**. 2) Refresh halaman web (F5) — pull berjalan saat app dibuka. 3) Cek status cloud di Pengaturan keduanya hijau.

**🔴 "Invalid API key" saat kirim kode**
Anon Key belum tersalin utuh (ada spasi/enter terpotong) atau bukan key yang benar. Hapus kolom key → tempel ulang (Noto otomatis membuang spasi) → kirim kode lagi. Gunakan key yang diawali `eyJhbGciOi…` (anon public) atau `sb_publishable_…` — jangan `sb_secret_…`.

**🔴 "Invalid path specified in request URL" saat kirim kode**
Project URL mengandung akhiran `/rest/v1`. Hapus akhirannya (cukup `https://xxxx.supabase.co`) atau cukup ketuk di luar kolom — Noto membersihkan otomatis — lalu **Kirim kode** lagi.

**🔴 Vercel gagal build?**
Hampir mustahil — static export tanpa env. Kalau gagal: cek build log; biasanya karena folder `src` tidak lengkap ter-upload. Push ulang semua file.

**❓ APK-nya ke mana setelah build?**
Tab **Releases** repo (sidebar kanan) → release *Noto APK (terbaru)* → aset `Noto.apk`. Juga tersedia di run Actions → Artifacts.

**❓ Apakah PWA masih bisa dipasang?**
Bisa — web tetap PWA (Chrome: *Tambahkan ke layar utama*). Tapi APK lebih lengkap: widget asli + notifikasi latar + ikon di app drawer.

**❓ Berapa biaya totalnya?** Rp0 — Vercel Hobby, Supabase Free, GitHub Actions gratis untuk repo private (2.000 menit/bulan; build APK ±7 menit sekali build).

**❓ Ganti logo/nama aplikasi?** Logo: ganti PNG di `public/icons/` + `scripts/make-android-icons.py` lalu push. Nama: `android/app/src/main/res/values/strings.xml` (app_name) & `capacitor.config.ts`.

---

## Bagian 10 — Jalankan di Komputer (Opsional)

1. Pasang **Node.js 20+** (nodejs.org) dan **Bun** (bun.sh) — sekali saja.
2. Terminal di folder project:
   ```bash
   bun install     # atau npm install
   bun run dev     # mode pengembangan di http://localhost:3000
   ```
3. Untuk uji build produksi (menghasilkan folder `out/` yang sama dengan yang dipakai APK):
   ```bash
   bun run build          # static export ke out/
   npx cap sync android   # salin out/ ke project Android
   ```

---

*Sampai jumpa di Noto! Catat, centang, kanvas — dari HP, dari laptop, selalu sinkron. 🍊*
