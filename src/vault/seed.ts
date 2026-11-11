import { serializeCanvas, type CanvasData } from '../lib/jsoncanvas.ts';
import { addDays, ymd } from '../lib/dates.ts';
import type { Vault } from './vault.ts';

/** Isi awal vault baru: panduan singkat yang sekaligus memamerkan fitur. */
export async function seedVault(v: Vault, now = new Date()): Promise<void> {
  if (v.notes.length > 0) return;
  const today = ymd(now);
  const tomorrow = ymd(addDays(now, 1));
  const yesterday = ymd(addDays(now, -1));

  await v.write('Selamat datang.md', `---
tags: [panduan]
---
# Selamat datang di Noto 🍊

Noto menyimpan semuanya sebagai **file Markdown biasa** di vault ini — bisa dibuka juga di Obsidian atau editor lain.

## Mulai cepat
- Tekan \`Ctrl+O\` untuk membuka catatan, \`Ctrl+P\` untuk perintah, \`Ctrl+N\` untuk catatan baru.
- Ketik \`/\` di baris kosong untuk menyisipkan blok (judul, tugas, callout, tabel…).
- Hubungkan catatan dengan tautan ganda: [[Wikilink dan backlink]].
- Atur tugas langsung di dalam catatan: [[Tugas di dalam catatan]].
- Susun ide secara visual di [[Peta ide.canvas|Peta ide]].

> [!tip] Tema
> Buka **Pengaturan → Tampilan** untuk mengganti mode terang/gelap dan palet warna.

- [ ] Coba centang tugas ini ⏫ 📅 ${today}
- [ ] Tulis catatan pertamamu #mulai 📅 ${tomorrow}
- [x] Buka Noto ✅ ${yesterday}
`);

  await v.write('Panduan/Wikilink dan backlink.md', `---
tags: [panduan, tautan]
aliases: [Wikilink]
---
# Wikilink dan backlink

Ketik \`[[\` lalu pilih catatan. Catatan yang ditautkan akan menampilkan **backlink** di panel kanan.

- Tautan dengan alias: \`[[Selamat datang|halaman awal]]\`
- Ke judul tertentu: \`[[Selamat datang#Mulai cepat]]\`
- Sematkan catatan lain: \`![[Tugas di dalam catatan]]\`

Kembali ke [[Selamat datang]].
`);

  await v.write('Panduan/Tugas di dalam catatan.md', `---
tags: [panduan, tugas]
---
# Tugas di dalam catatan

Tugas adalah daftar centang biasa. Tambahkan tanggal, prioritas, dan pengulangan:

- [ ] Bayar listrik 📅 ${today} ⏰ 19:00 #rumah
- [ ] Olahraga 🔁 every week 📅 ${tomorrow}
- [ ] Balas email penting ⏫ 📅 ${yesterday}

Halaman **Tugas** mengumpulkan semua tugas dari seluruh vault dan mengelompokkannya: *Terlambat*, *Hari ini*, *Mendatang*.

Di kotak tambah-cepat kamu bisa mengetik bahasa biasa, misalnya \`beli susu besok jam 10 !penting #belanja\`.
`);

  const canvas: CanvasData = {
    nodes: [
      { id: 'n1', type: 'text', x: -160, y: -60, width: 280, height: 120, text: '## Ide utama\nTulis apa saja di sini', color: '1' },
      { id: 'n2', type: 'file', x: 220, y: -150, width: 320, height: 220, file: 'Selamat datang.md' },
      { id: 'n3', type: 'text', x: 220, y: 120, width: 260, height: 110, text: 'Tarik garis dari titik di tepi kartu untuk menghubungkan.', color: '4' },
      { id: 'g1', type: 'group', x: -200, y: -120, width: 360, height: 240, label: 'Brainstorm' },
    ],
    edges: [
      { id: 'e1', fromNode: 'n1', fromSide: 'right', toNode: 'n2', toSide: 'left', toEnd: 'arrow', label: 'terkait' },
      { id: 'e2', fromNode: 'n2', fromSide: 'bottom', toNode: 'n3', toSide: 'top', toEnd: 'arrow' },
    ],
  };
  await v.write('Peta ide.canvas', serializeCanvas(canvas));
  await v.createFolder('Harian');
  await v.createFolder('Lampiran');
}
