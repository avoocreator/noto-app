import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../src/lib/format.ts';

const run = (text: string, r: F.Result) => ({ out: F.applyChanges(text, r.changes), sel: [r.from, r.to] as [number, number] });
const sel = (text: string, a: string) => { const i = text.indexOf(a); return [i, i + a.length] as const; };

test('toggleWrap: bungkus, lepas, kata di kursor', () => {
  const t = 'halo dunia';
  let r = run(t, F.toggleWrap(t, ...sel(t, 'dunia'), '**'));
  assert.equal(r.out, 'halo **dunia**'); assert.equal(t.slice(0), t);
  assert.equal(r.out.slice(r.sel[0], r.sel[1]), 'dunia');
  const r2 = run(r.out, F.toggleWrap(r.out, r.sel[0], r.sel[1], '**'));
  assert.equal(r2.out, t);
  // kursor di dalam kata
  const r3 = run(t, F.toggleWrap(t, 2, 2, '*'));
  assert.equal(r3.out, '*halo* dunia');
  // kursor di spasi kosong → sisip pasangan
  const r4 = run('', F.toggleWrap('', 0, 0, '**'));
  assert.equal(r4.out, '****'); assert.deepEqual(r4.sel, [2, 2]);
});
test('toggleWrap: miring di dalam tebal tidak salah lepas', () => {
  const t = '**dunia**';
  const [a, b] = sel(t, 'dunia');
  const r = run(t, F.toggleWrap(t, a, b, '*'));
  assert.equal(r.out, '***dunia***');
  const back = run(r.out, F.toggleWrap(r.out, r.sel[0], r.sel[1], '*'));
  assert.equal(back.out, '**dunia**');
  const bold = run('***x***', F.toggleWrap('***x***', 3, 4, '**'));
  assert.equal(bold.out, '*x*');
});
test('toggleWrap: garis bawah & seleksi memuat pembungkus', () => {
  const t = 'a teks b';
  const r = run(t, F.toggleWrap(t, ...sel(t, 'teks'), '<u>', '</u>'));
  assert.equal(r.out, 'a <u>teks</u> b');
  const u = '<u>teks</u>';
  assert.equal(run(u, F.toggleWrap(u, 0, u.length, '<u>', '</u>')).out, 'teks');
});
test('warna teks & stabilo: pasang, ganti, hapus', () => {
  const t = 'ini penting banget';
  const [a, b] = sel(t, 'penting');
  let r = run(t, F.setTextColor(t, a, b, '#e03131'));
  assert.equal(r.out, 'ini <span style="color:#e03131">penting</span> banget');
  const r2 = run(r.out, F.setTextColor(r.out, r.sel[0], r.sel[1], '#1c7ed6'));
  assert.equal(r2.out, 'ini <span style="color:#1c7ed6">penting</span> banget');
  const r3 = run(r2.out, F.setTextColor(r2.out, r2.sel[0], r2.sel[1], null));
  assert.equal(r3.out, t);
  const h = run(t, F.setHighlight(t, a, b, '#ffe066'));
  assert.equal(h.out, 'ini ==penting== banget');
  const h2 = run(h.out, F.setHighlight(h.out, h.sel[0], h.sel[1], '#a5d8ff'));
  assert.equal(h2.out, 'ini <mark style="background:#a5d8ff">penting</mark> banget');
  const h3 = run(h2.out, F.setHighlight(h2.out, h2.sel[0], h2.sel[1], null));
  assert.equal(h3.out, t);
  // warna berbahaya ditolak
  assert.deepEqual(F.setTextColor(t, a, b, 'red" onload="x').changes, []);
});
test('clearFormat membuang tag & penanda', () => {
  const t = '**tebal** dan <u>garis</u> <span style="color:#e03131">merah</span> ==stabilo==';
  const r = run(t, F.clearFormat(t, 0, t.length));
  assert.equal(r.out, 'tebal dan garis merah stabilo');
});
test('setHeading: pasang, ganti, kembali', () => {
  const t = 'Judul\nisi';
  assert.equal(run(t, F.setHeading(t, 0, 0, 2)).out, '## Judul\nisi');
  assert.equal(run('## Judul', F.setHeading('## Judul', 0, 0, 2)).out, 'Judul');
  assert.equal(run('# Judul', F.setHeading('# Judul', 0, 0, 3)).out, '### Judul');
  assert.equal(run('- poin', F.setHeading('- poin', 0, 0, 1)).out, '# poin');
});
test('toggleList: nomor berurut, lepas, tukar jenis', () => {
  const t = 'satu\ndua\n\ntiga';
  const n = run(t, F.toggleList(t, 0, t.length, 'number'));
  assert.equal(n.out, '1. satu\n2. dua\n\n3. tiga');
  assert.equal(run(n.out, F.toggleList(n.out, 0, n.out.length, 'number')).out, t);
  assert.equal(run(n.out, F.toggleList(n.out, 0, n.out.length, 'bullet')).out, '- satu\n- dua\n\n- tiga');
  assert.equal(run('a', F.toggleList('a', 0, 1, 'task')).out, '- [ ] a');
  assert.equal(run('a', F.toggleList('a', 0, 1, 'quote')).out, '> a');
  // kursor tetap di tempatnya setelah awalan
  const c = run('abc', F.toggleList('abc', 1, 1, 'bullet'));
  assert.equal(c.out, '- abc'); assert.equal(c.sel[0], 3);
});
test('renumber memperbaiki urutan setelah sisip/hapus', () => {
  const t = '1. a\n2. b\n5. c\n    1. x\n    7. y\n9. d';
  assert.equal(run(t, F.renumber(t, 0, 0)).out, '1. a\n2. b\n3. c\n    1. x\n    2. y\n4. d');
  assert.deepEqual(F.renumber('bukan daftar', 0, 0).changes, []);
});
test('indent & rata teks', () => {
  assert.equal(run('- a\n- b', F.indentLines('- a\n- b', 0, 7, 1)).out, '    - a\n    - b');
  assert.equal(run('    - a', F.indentLines('    - a', 0, 0, -1)).out, '- a');
  const c = run('# Judul', F.setAlign('# Judul', 0, 0, 'center'));
  assert.equal(c.out, '# Judul <!--align:center-->');
  assert.equal(F.alignOf(c.out), 'center');
  assert.equal(run(c.out, F.setAlign(c.out, 0, 0, 'left')).out, '# Judul');
  assert.equal(run(c.out, F.setAlign(c.out, 0, 0, 'right')).out, '# Judul <!--align:right-->');
});
test('tabel: sisip, parse, ops, tab', () => {
  const ins = run('Halo', F.insertTable('Halo', 4, 3, 2));
  assert.match(ins.out, /^Halo\n\n\| Kolom 1 \| Kolom 2 \|\n\| -+ \| -+ \|\n\| +\| +\|\n\| +\| +\|\n$/);
  assert.equal(ins.out.slice(ins.sel[0], ins.sel[1]), 'Kolom 1');
  const tbl = '| a | b |\n| --- | --- |\n| 1 | 2 |';
  const at = F.tableAt(tbl, tbl.indexOf('1'))!;
  assert.deepEqual(at.table.cells, [['a', 'b'], ['1', '2']]); assert.equal(at.row, 1); assert.equal(at.col, 0);
  const rb = run(tbl, F.tableOp(tbl, tbl.indexOf('1'), 'rowBelow')!).out.split('\n');
  assert.equal(rb.length, 4); assert.match(rb[3], /^\| +\| +\|$/);
  const cr = run(tbl, F.tableOp(tbl, tbl.indexOf('a'), 'colRight')!).out;
  assert.equal(F.parseTable(cr.split('\n'))!.aligns.length, 3);
  const dc = run(tbl, F.tableOp(tbl, tbl.indexOf('b'), 'delCol')!).out;
  assert.deepEqual(F.parseTable(dc.split('\n'))!.cells, [['a'], ['1']]);
  assert.equal(F.tableOp(tbl, tbl.indexOf('a'), 'delRow'), null); // header tak bisa dihapus
  const al = run(tbl, F.tableOp(tbl, tbl.indexOf('b'), 'alignRight')!).out;
  assert.match(al.split('\n')[1], /-:\s*\|$/);
  // Tab: ke sel berikut, di sel terakhir menambah baris
  const t1 = F.tableTab(tbl, tbl.indexOf('a'), 1)!;
  const n1 = F.applyChanges(tbl, t1.changes);
  assert.equal(n1[t1.from], 'b');
  const last = tbl.lastIndexOf('2');
  const t2 = F.tableTab(tbl, last, 1)!;
  assert.equal(F.applyChanges(tbl, t2.changes).split('\n').length, 4);
  assert.equal(F.tableAt('bukan tabel', 2), null);
  assert.equal(F.parseTable(['| a |', 'x']), null);
});
test('tabel: sel dengan pipa ter-escape', () => {
  assert.deepEqual(F.splitRow('| a \\| b | c |'), ['a \\| b', 'c']);
});
test('catatan kaki: nomor, sisip, definisi di akhir', () => {
  const t = 'Satu[^a] dua[^b].\n\n[^a]: A\n[^b]: B';
  assert.deepEqual([...F.footnoteIndex(t)], [['a', 1], ['b', 2]]);
  const r = run('Paragraf satu.\n\nParagraf dua.', F.insertFootnote('Paragraf satu.\n\nParagraf dua.', 14, 14));
  assert.equal(r.out, 'Paragraf satu.[^1]\n\nParagraf dua.\n\n[^1]: ');
  assert.equal(r.sel[0], r.out.length);
  const t2 = r.out + 'isi';
  const r2 = run(t2, F.insertFootnote(t2, 0, 0));
  assert.equal(r2.out, '[^2]Paragraf satu.[^1]\n\nParagraf dua.\n\n[^1]: isi\n[^2]: ');
  // kursor di akhir dokumen
  const r3 = run('abc', F.insertFootnote('abc', 3, 3));
  assert.equal(r3.out, 'abc[^1]\n\n[^1]: ');
  assert.equal(r3.sel[0], r3.out.length);
  assert.equal(F.footnoteDefId('[^x]: isi'), 'x');
});
test('sisipan blok: garis & kode', () => {
  assert.equal(run('a', F.insertHr('a', 1)).out, 'a\n\n---\n');
  const c = run('a', F.insertCodeBlock('a', 1));
  assert.equal(c.out, 'a\n\n```\n\n```\n'); assert.equal(c.sel[0], 7);
  assert.equal(run('x teks', F.insertLinkAt('x teks', 2, 6)).out, 'x [teks](url)');
});

test('applyFormat: pintu tunggal', () => {
  const t = 'halo';
  assert.equal(run(t, F.applyFormat(t, 0, 4, 'bold')!).out, '**halo**');
  assert.equal(run(t, F.applyFormat(t, 0, 4, 'hl:#b2f2bb')!).out, '<mark style="background:#b2f2bb">halo</mark>');
  assert.equal(run(t, F.applyFormat(t, 0, 0, 'h:1')!).out, '# halo');
  assert.equal(run(t, F.applyFormat(t, 0, 4, 'table:3x2')!).out.includes('| Kolom 1 | Kolom 2 |'), true);
  assert.equal(F.applyFormat(t, 0, 4, 'ngawur'), null);
  assert.equal(F.applyFormat(t, 0, 4, 'tbl:rowBelow'), null); // bukan di tabel
});
