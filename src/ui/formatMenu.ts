import { HIGHLIGHT_COLORS, TEXT_COLORS } from '../lib/format.ts';
import type { FormatTarget } from '../editor/formatTarget.ts';
import type { MenuItem } from './ContextMenu.tsx';

/** Potong / Salin / Tempel / Pilih semua untuk sasaran format mana pun (CodeMirror atau textarea). */
export function clipboardItems(t: FormatTarget, toast: (msg: string, kind?: 'info' | 'ok' | 'error') => void, selectAll: () => void): MenuItem[] {
  const has = !!t.selected();
  const clip = async (kind: 'cut' | 'copy' | 'paste') => {
    try {
      if (kind === 'paste') { const txt = await navigator.clipboard.readText(); if (txt) t.replaceSelection(txt); return; }
      await navigator.clipboard.writeText(t.selected());
      if (kind === 'cut') t.replaceSelection('');
    } catch { toast('Akses papan klip ditolak — pakai Ctrl+C / Ctrl+V', 'error'); }
  };
  return [
    { label: 'Potong', icon: 'scissors', hint: 'Ctrl+X', disabled: !has, run: () => void clip('cut') },
    { label: 'Salin', icon: 'copy', hint: 'Ctrl+C', disabled: !has, run: () => void clip('copy') },
    { label: 'Tempel', icon: 'paste', hint: 'Ctrl+V', run: () => void clip('paste') },
    { label: 'Pilih semua', icon: 'text', hint: 'Ctrl+A', run: selectAll },
  ];
}

/** Menu "Format / Paragraf / Sisipkan / Tabel" ala Word, dipakai klik kanan di editor catatan dan kartu canvas. */
export function formatMenu(run: (op: string) => void, inTable: boolean): MenuItem[] {
  const colorRow = (label: string, icon: MenuItem['icon'], list: { hex: string; label: string }[], prefix: 'color' | 'hl', none: string): MenuItem => ({
    label, icon,
    swatches: [...list.map((c) => ({ value: c.hex, label: c.label, color: c.hex })), { value: null, label: none }],
    onPick: (v) => run(`${prefix}:${v ?? 'none'}`),
  });
  const items: MenuItem[] = [
    {
      label: 'Format', icon: 'bold',
      children: [
        { label: 'Tebal', icon: 'bold', hint: 'Ctrl+B', run: () => run('bold') },
        { label: 'Miring', icon: 'italic', hint: 'Ctrl+I', run: () => run('italic') },
        { label: 'Garis bawah', icon: 'underline', hint: 'Ctrl+U', run: () => run('underline') },
        { label: 'Coret', icon: 'strike', hint: 'Ctrl+Shift+X', run: () => run('strike') },
        { label: 'Kode', icon: 'code', hint: 'Ctrl+E', run: () => run('code') },
        { label: 'Superskrip', icon: 'sup', run: () => run('sup') },
        { label: 'Subskrip', icon: 'sub', run: () => run('sub') },
        colorRow('Stabilo', 'highlighter', HIGHLIGHT_COLORS, 'hl', 'Hapus stabilo'),
        colorRow('Warna teks', 'textColor', TEXT_COLORS, 'color', 'Warna bawaan'),
        { label: 'Hapus format', icon: 'eraser', sep: true, run: () => run('clear') },
      ],
    },
    {
      label: 'Paragraf', icon: 'heading',
      children: [
        { label: 'Teks biasa', run: () => run('h:0'), hint: 'Ctrl+Alt+0' },
        { label: 'Judul 1', run: () => run('h:1'), hint: 'Ctrl+Alt+1' },
        { label: 'Judul 2', run: () => run('h:2'), hint: 'Ctrl+Alt+2' },
        { label: 'Judul 3', run: () => run('h:3'), hint: 'Ctrl+Alt+3' },
        { label: 'Daftar poin', icon: 'list', sep: true, run: () => run('bullet'), hint: 'Ctrl+Shift+8' },
        { label: 'Daftar bernomor', icon: 'listOl', run: () => run('number'), hint: 'Ctrl+Shift+7' },
        { label: 'Daftar tugas', icon: 'tasks', run: () => run('task') },
        { label: 'Nomori ulang', icon: 'repeat', run: () => run('renumber') },
        { label: 'Kutipan', icon: 'quote', run: () => run('quote') },
        { label: 'Geser masuk', icon: 'indent', sep: true, run: () => run('indent') },
        { label: 'Geser keluar', icon: 'outdent', run: () => run('outdent') },
        { label: 'Rata kiri', icon: 'alignL', sep: true, run: () => run('align:left') },
        { label: 'Rata tengah', icon: 'alignC', run: () => run('align:center') },
        { label: 'Rata kanan', icon: 'alignR', run: () => run('align:right') },
        { label: 'Rata kiri-kanan', icon: 'alignJ', run: () => run('align:justify') },
      ],
    },
    {
      label: 'Sisipkan', icon: 'plus',
      children: [
        { label: 'Tabel 3 × 3', icon: 'table', run: () => run('table:4x3') },
        { label: 'Tabel 5 × 4', icon: 'table', run: () => run('table:6x4') },
        { label: 'Catatan kaki', icon: 'footnote', hint: 'Ctrl+Alt+F', run: () => run('footnote') },
        { label: 'Tautan', icon: 'link', hint: 'Ctrl+K', run: () => run('link') },
        { label: 'Garis pemisah', icon: 'hr', run: () => run('hr') },
        { label: 'Blok kode', icon: 'code', run: () => run('codeblock') },
      ],
    },
  ];
  if (inTable) {
    items.push({
      label: 'Tabel', icon: 'table',
      children: [
        { label: 'Tambah baris di bawah', icon: 'plus', run: () => run('tbl:rowBelow') },
        { label: 'Tambah baris di atas', icon: 'plus', run: () => run('tbl:rowAbove') },
        { label: 'Tambah kolom di kanan', icon: 'plus', run: () => run('tbl:colRight') },
        { label: 'Tambah kolom di kiri', icon: 'plus', run: () => run('tbl:colLeft') },
        { label: 'Hapus baris', icon: 'minus', sep: true, run: () => run('tbl:delRow') },
        { label: 'Hapus kolom', icon: 'minus', run: () => run('tbl:delCol') },
        { label: 'Kolom rata kiri', icon: 'alignL', sep: true, run: () => run('tbl:alignLeft') },
        { label: 'Kolom rata tengah', icon: 'alignC', run: () => run('tbl:alignCenter') },
        { label: 'Kolom rata kanan', icon: 'alignR', run: () => run('tbl:alignRight') },
        { label: 'Rapikan tabel', icon: 'eraser', run: () => run('tbl:format') },
        { label: 'Hapus tabel', icon: 'trash', danger: true, sep: true, run: () => run('tbl:delTable') },
      ],
    });
  }
  return items;
}
