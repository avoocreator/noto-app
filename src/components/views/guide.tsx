'use client'

import { useState } from 'react'
import {
  Bell, BookOpen, Cloud, HelpCircle, LayoutDashboard, Palette, PenLine,
  Save, Shapes, Smartphone, Sparkles, ListTodo,
} from 'lucide-react'
import { Markdown } from '@/components/markdown'
import { cn } from '@/lib/utils'

const SECTIONS: { id: string; title: string; icon: typeof BookOpen; content: string }[] = [
  {
    id: 'mulai',
    title: '1. Mulai Cepat',
    icon: Sparkles,
    content: `Selamat datang di **Noto** — workspace pribadimu yang menggabungkan catatan Markdown, daftar tugas, dan kanvas kreatif dalam satu aplikasi.

**3 hal yang bisa kamu coba sekarang:**

1. **Tulis catatan pertama** — buka menu **Catatan** di kiri, klik tombol **+**, lalu ketik apa saja. Gunakan panel *Pratinjau* di kanan untuk melihat hasil formatnya.
2. **Tambah tugas** — buka **Tugas**, ketik di kotak cepat, misalnya: \`Rapat besok 10:00 !penting #kerja\` lalu tekan Enter. Tanggal, prioritas, dan tag terpasang otomatis!
3. **Main kanvas** — buka **Kanvas**, klik tombol **+** oranye di kanan bawah untuk menambah kartu. Geser, ubah ukuran, beri warna, lalu sambungkan dengan garis.

> 💡 Tekan **Ctrl+K** (atau tombol 🔍) kapan saja untuk mencari catatan dan tugas.`,
  },
  {
    id: 'catatan',
    title: '2. Catatan (Markdown)',
    icon: PenLine,
    content: `Catatan di Noto ditulis dengan **Markdown** — cara menulis format ringan yang dipakai Obsidian, GitHub, dan Notion.

**Yang perlu kamu tahu:**

| Kamu tulis | Jadi |
| --- | --- |
| \`# Judul\` | Judul besar |
| \`**tebal**\` | **tebal** |
| \`*miring*\` | *miring* |
| \`- item\` | daftar berbutir |
| \`- [ ] tugas\` | checklist ✅ |
| \`> kutipan\` | blok kutipan |
| dua backtick: \`\`kode\`\` | kode inline |
| ~~~js ... ~~~ | blok kode berwarna |
| \`[teks](url)\` | tautan |
| \`![alt](gambar)\` | gambar |

**Fitur spesial:**

- **Checklist hidup** — di mode *Pratinjau*, kotak centang bisa langsung diklik dan teks aslinya otomatis diperbarui.
- **Toolbar** — tombol B, *I*, H1-H3, daftar, kutipan, kode, dan tautan tersedia di atas editor.
- **Gambar** — klik ikon 🖼️ di toolbar untuk menyisipkan gambar. Gambar dikompres otomatis agar hemat ruang.
- **Tag** — tambahkan tag seperti \`#ide\` lewat kolom "+ tag", lalu temukan lewat pencarian.
- **Pin** — catatan penting bisa dipin agar selalu di atas.
- **Simpan otomatis** — semua perubahan tersimpan sendiri ±0,7 detik setelah kamu berhenti mengetik. Lihat status "Tersimpan ✓".`,
  },
  {
    id: 'tugas',
    title: '3. Tugas & Quick-Add Pintar',
    icon: ListTodo,
    content: `Menu **Tugas** adalah pusat produktivitasmu: daftar berwarna, prioritas, tenggat, dan pengingat.

**Quick-add yang paham bahasamu** — satu baris, banyak arti:

| Kamu ketik | Hasil |
| --- | --- |
| \`#kerja\`, \`#rumah\` | tag otomatis |
| \`!penting\`, \`!urgent\`, \`!tinggi\` | prioritas 🔥 tinggi |
| \`!sedang\` / \`!rendah\` | prioritas ⚡ / 🫧 |
| \`hari ini\` | tenggat hari ini |
| \`besok\`, \`lusa\` | tenggat 1 / 2 hari lagi |
| \`senin\` … \`minggu\` | tenggat hari itu (terdekat berikutnya) |
| \`25/12\` atau \`25-12\` | tanggal 25 Desember |
| \`14:30\` atau \`jam 8.30\` | jam tenggat |

Contoh: \`Kumpulkan laporan jumat 14:00 !penting #kerja\` → jadi tugas prioritas tinggi, tenggat Jumat 14.00, ber-tag #kerja.

**Pengingat:** buka tugas (ikon ✏️), isi kolom **Pengingat**, atau pakai tombol cepat *+1 jam / Malam ini / Besok pagi*. Saat waktunya tiba dan aplikasi terbuka, Noto membunyikan alarm + mengirim notifikasi. Pastikan pengingat diaktifkan di **Pengaturan → Notifikasi & Suara**.

**Mengelola:** kelompokkan per daftar (buat lewat "Daftar baru"), urutkan dengan panah ↑↓, dan filter: Semua / Hari Ini / Akan Datang / Terlambat / Selesai.`,
  },
  {
    id: 'kanvas',
    title: '4. Kanvas',
    icon: Shapes,
    content: `Kanvas adalah papan bebas ala Obsidian Canvas — tempat ide-idemu bertemu.

**Menambah kartu** — klik tombol **+** oranye kanan bawah, pilih:
- **Kartu Teks** — tulis Markdown bebas (klik dua kali kartu untuk mengedit)
- **Dari Catatan…** — memasang catatanmu sebagai kartu yang ikut ter-update
- **Daftar Tugas…** — centang tugas langsung dari kanvas!
- **Gambar…** — unggah foto/illustrasi (otomatis dikompres)
- **Checklist** — checklist mandiri yang berdiri sendiri

**Gestur & kontrol:**

| Aksi | Cara |
| --- | --- |
| Geser papan (pan) | tahan & geser area kosong |
| Zoom | scroll mouse / cubit dua jari / tombol − % + |
| Pindah kartu | tahan & geser kartu |
| Ubah ukuran | tarik pojok kanan bawah kartu |
| Edit teks | klik dua kali kartu teks |
| Kartu baru cepat | klik dua kali area kosong |
| Warna/duplikat/hapus | menu ⋯ di pojok kartu |

**Menyambungkan kartu** — klik tombol **Sambungkan** (kiri bawah), klik kartu asal, lalu kartu tujuan. Garis lengkung dengan panah akan terbentuk. Klik garisnya untuk memutus.

Semua otomatis tersimpan. Bisa banyak papan — kelola lewat tab di atas.`,
  },
  {
    id: 'tema',
    title: '5. Tema & Tampilan',
    icon: Palette,
    content: `Noto punya **8 mode warna** yang dirancang khusus, plus kustomisasi total:

- 🍊 **Noto Gelap** — charcoal & oranye, wajah asli Noto (bawaan)
- ☀️ **Noto Terang** — putih hangat yang bersih
- 🌌 **Tengah Malam** — biru laut pekat beraksen emas
- 📜 **Kertas Sepia** — nuansa buku catatan lama
- 🏔️ **Fjord Nord** — abu-biru tenang ala Nord
- 🌸 **Sakura Lembut** — pink pastel yang ceria
- 🌿 **Rimba Hijau** — hijau segar setelah hujan
- ⚫ **Monokrom** — hitam-putih tanpa distraksi

**Kustomisasi:**

- **Aksen kustom** — 11 swatch warna + kolom kode hex bebas (mis. \`#FF6B9D\`). Seluruh tombol, highlight, dan checkbox mengikuti warnamu.
- **Font catatan** — Sans (modern), Serif (kesan buku), atau Mono (kode). Hanya mengubah isi catatan agar UI tetap rapi.
- **Kelengkungan sudut** — geser slider dari tajam (0.25) sampai bulat lucu (1.5).

Semua pilihan tersimpan otomatis di perangkatmu.`,
  },
  {
    id: 'notifikasi',
    title: '6. Notifikasi & Suara Kustom',
    icon: Bell,
    content: `Noto bisa berbunyi saat tugas jatuh tempo — dan suaranya **kamu tentukan**.

**Setup sekali saja:**

1. Buka **Pengaturan → Notifikasi & Suara**, nyalakan **Aktifkan pengingat**.
2. Klik **Minta izin** lalu pilih *Allow* pada pop-up browser — agar notifikasi sistem muncul meski kamu sedang di tab lain.
3. Atur **Volume** sesuai selera.
4. Pilih salah satu dari **6 nada bawaan** yang disintesis langsung (tanpa file!): 🎵 Chime Lembut, 🔔 Lonceng, 🪘 Marimba, 📟 Digital, 🕹️ Retro 8-bit, 🫧 Pop!
5. Klik **Uji suara** untuk mendengarnya.

**Pakai suaramu sendiri:**

1. Siapkan file MP3/OGG/WAV (maks 3 MB) — potongan lagu, suara lucu, suara CODM, apa pun.
2. Klik **Unggah suara** → pilih file → langsung terdengar.
3. Klik **Gunakan** agar jadi nada pengingat utama. Suara tersimpan di perangkat (IndexedDB).

**Penting dipahami:** notifikasi web hanya berbunyi saat aplikasi Noto terbuka di suatu tab (termasuk tab latar yang masih hidup). Ini aturan semua web app. Saran: pasang Noto sebagai aplikasi (lihat bagian PWA) dan biarkan tab widget terbuka di HP — pengingat tetap berbunyi.`,
  },
  {
    id: 'widget',
    title: '7. Widget 2×2 di HP',
    icon: Smartphone,
    content: `Noto menyediakan **dua cara** menampilkan tugas di layar utama HP.

**Cara 1 — Pintasan "Widget" (termudah, semua HP):**

1. Buka Noto di browser HP, menu ⋯ → **Tampilan Widget HP** (atau kunjungi \`alamat-app-mu/#/widget\`).
2. Di Android Chrome: menu ⋮ → **Tambahkan ke layar utama**. Di iPhone Safari: tombol *Share* → **Add to Home Screen**.
3. Ganti namanya jadi "Tugasku" — selesai! Ikon Noto muncul di layar utama; sekali ketuk langsung tampil daftar tugas dengan font besar yang bisa dicentang.

**Cara 2 — Widget KWGT asli (Android, tampil tanpa buka aplikasi):**

1. Pasang **KWGT (Kustom Widget Maker)** — gratis di Play Store.
2. Salin **URL Widget** dari **Pengaturan → Widget HP** (format teks: \`.../api/widget/todos?format=text\`).
3. Kosongkan satu slot layar utama (2×2) → tahan → pilih **Widgets** → **KWGT**.
4. Buka widget KWGT yang baru dipasang → tab **Background** → tambah item **Text**.
5. Di isi teks, ketik formula: \`$wf("URL-WIDGETMU")$\`
6. Atur ukuran font ±13, warna teks sesuai temamu → Save.

KWGT memuat ulang teks otomatis setiap beberapa menit, jadi daftar tugas selalu segar. *(Catatan: KWGT butuh izin "modify system settings" dan kadang dibatasi Android pada refresh latar — itu normal.)*

**iPhone:** widget layar utama native tidak tersedia untuk web app (batasan Apple). Gunakan Cara 1 + fitur *Lock Screen* pintasan iOS bila perlu.`,
  },
  {
    id: 'pwa',
    title: '8. Pasang Sebagai Aplikasi (PWA)',
    icon: LayoutDashboard,
    content: `Noto adalah PWA — bisa dipasang seperti aplikasi asli, lengkap dengan ikon logomu.

**Android (Chrome):** buka Noto → menu ⋮ → **Instal aplikasi** / **Tambahkan ke layar utama**.

**iPhone/iPad (Safari):** tombol *Share* → **Add to Home Screen** → Add.

**Desktop (Chrome/Edge):** ikon ⊕ di bilah alamat → **Install**.

Setelah terpasang, Noto terbuka tanpa bilah browser, punya ikon sendiri, dan terasa seperti aplikasi native. Data tetap tersimpan di database — aman saat ganti perangkat.`,
  },
  {
    id: 'deploy',
    title: '9. Deploy ke Vercel + Neon (Gratis)',
    icon: Cloud,
    content: `Aplikasi ini sudah disiapkan agar deploy **tanpa mengubah kode sama sekali**. Database memakai **Neon PostgreSQL** (gratis 0,5 GB) karena Vercel tidak menyimpan file lokal.

**Langkah lengkap (±10 menit):**

**A. Database Neon**
1. Daftar di \`neon.tech\` (pakai GitHub/Google) — gratis.
2. Klik **Create project** → beri nama \`noto\` → region terdekat (Singapore) → Create.
3. Setelah jadi, salin **Connection string** yang berawalan \`postgresql://...\` (pastikan ada \`?sslmode=require\`).

**B. Upload kode ke GitHub**
1. Buat repo baru di GitHub, mis. \`noto-app\` (boleh private).
2. Upload semua folder proyek ini (atau \`git push\`).

**C. Deploy di Vercel**
1. Buka \`vercel.com\` → daftar dengan GitHub.
2. **Add New → Project** → pilih repo \`noto-app\` → Import.
3. Sebelum klik Deploy, buka **Environment Variables**, tambahkan:
   - \`DATABASE_URL\` = connection string Neon tadi
   - \`APP_PASSWORD\` = kata sandi rahasia app-mu (opsional tapi disarankan)
4. Klik **Deploy**. Tunggu ±2 menit.

**D. Selesai!** Buka \`https://nama-appmu.vercel.app\`. Tabel database dibuat otomatis saat build pertama, lengkap dengan catatan selamat datang.

> 🔒 \`APP_PASSWORD\` membuat seluruh API butuh login — data catatanmu tidak bisa dibaca orang lain. Widget tetap bisa diberi akses lewat \`?key=KATA_SANDI\`.

> ⚠️ Neon free tier *sleep* setelah 5 menit kosong; request pertama berikutnya butuh ±1 detik untuk bangun. Itu normal dan tetap gratis.`,
  },
  {
    id: 'backup',
    title: '10. Cadangan & Pemulihan Data',
    icon: Save,
    content: `Datamu berharga — Noto membuatnya mudah diamankan.

**Ekspor:** **Pengaturan → Data & Cadangan → Ekspor JSON**. Kamu mendapat satu file berisi semua catatan, tugas, daftar, dan papan kanvas dengan tanggal lengkap.

**Impor:** klik **Impor JSON** dan pilih file cadangan. Semua data saat ini diganti dengan isi file (dengan konfirmasi muat ulang).

**Saran ritme:** ekspor seminggu sekali, atau sebelum update besar. File JSON juga bisa kamu baca langsung — formatnya terbuka, datamu tidak pernah terkunci di Noto.`,
  },
  {
    id: 'faq',
    title: '11. Pertanyaan Umum',
    icon: HelpCircle,
    content: `**T: Apakah benar-benar gratis?**
Ya. Lokal memakai SQLite; produksi memakai Neon free tier (0,5 GB) + Vercel Hobby — keduanya gratis, cukup untuk catatan bertahun-tahun.

**T: Notifikasi tidak berbunyi?**
Cek 4 hal: (1) pengingat aktif di Pengaturan, (2) izin notifikasi "Diizinkan", (3) volume > 0 dan tab Noto terbuka, (4) tugas benar-benar punya waktu pengingat. Browser juga kadang memblokir suara sebelum ada interaksi pertama — sentuh aplikasi sekali.

**T: Bisakah dipakai dari banyak perangkat?**
Bisa. Setelah deploy ke Vercel, buka URL yang sama dari HP & laptop — data sama, sinkron otomatis lewat database. Pengaturan tema tersimpan per perangkat.

**T: Gambar di kanvas membuat papan berat?**
Gambar dikompres ke maks 1400px. Jika papan terasa penuh, pisahkan ke papan baru — batas aman ±4 MB per papan.

**T: Lupa kata sandi (APP_PASSWORD)?**
Ganti nilai Environment Variable di dashboard Vercel, lalu redeploy. Tidak ada mekanisme pemulihan lain — jaga baik-baik.

**T: Ingin fitur lain?**
Kode sumbernya lengkap dan terstruktur — mulai dari \`src/components/views/\`. Selamat berkreasi! 🍊`,
  },
]

export function GuideView() {
  const [active, setActive] = useState(SECTIONS[0].id)

  const jump = (id: string) => {
    setActive(id)
    document.getElementById('g-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="max-w-5xl mx-auto w-full flex">
      {/* TOC — desktop */}
      <aside className="hidden lg:block w-56 shrink-0 sticky top-0 h-screen overflow-y-auto py-8 pr-4">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-2">Panduan Noto</p>
        <nav className="space-y-0.5">
          {SECTIONS.map((s) => {
            const Icon = s.icon
            return (
              <button
                key={s.id}
                onClick={() => jump(s.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-left transition-colors',
                  active === s.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" /> {s.title}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Konten */}
      <div className="flex-1 min-w-0 p-4 md:p-8 pb-28 md:pb-12">
        <header className="mb-8">
          <div className="flex items-center gap-3">
            { }
            <img src="/icons/logo-64.png" alt="Logo Noto" className="w-12 h-12 rounded-xl" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Panduan Lengkap Noto 🍊</h1>
              <p className="text-sm text-muted-foreground">Semua yang perlu kamu tahu, langkah demi langkah.</p>
            </div>
          </div>
          {/* TOC — mobile */}
          <div className="lg:hidden flex gap-1.5 overflow-x-auto no-scrollbar mt-4 pb-1">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => jump(s.id)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors',
                  active === s.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground',
                )}
              >
                {s.title}
              </button>
            ))}
          </div>
        </header>

        <div className="space-y-10">
          {SECTIONS.map((s) => {
            const Icon = s.icon
            return (
              <section key={s.id} id={'g-' + s.id} className="scroll-mt-20">
                <h2 className="text-lg font-bold flex items-center gap-2 mb-3 pb-2 border-b border-border/60">
                  <Icon className="w-5 h-5 text-primary" /> {s.title}
                </h2>
                <Markdown content={s.content} />
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
