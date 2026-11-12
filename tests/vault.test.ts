import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runPython } from './py.ts';
import { Vault } from '../src/vault/vault.ts';
import { MemoryFS } from '../src/vault/memoryFs.ts';
import { rewriteLinks } from '../src/lib/links.ts';
import { applyTemplate } from '../src/lib/template.ts';
import { SearchIndex } from '../src/lib/search.ts';
import { analyzeNote } from '../src/lib/analyze.ts';
import { safeName, uniquePath } from '../src/vault/fs.ts';

async function demo() {
  let t = 1000;
  const fs = new MemoryFS('t', () => ++t);
  await fs.writeText('Alpha.md', '# Alpha\nLihat [[Beta]] dan [[Proyek/Beta|bee]] #proyek\n- [ ] tugas alpha 📅 2026-11-10\n');
  await fs.writeText('Proyek/Beta.md', '# Beta\nKembali ke [[Alpha]]. Kata kunci unik: zebra\n');
  await fs.writeText('Gamma.md', 'Hanya teks `[[Beta]]` kode, dan [[Beta#Bagian]]\n');
  await fs.writeBinary('Lampiran/x.png', new Uint8Array([1, 2, 3]));
  await fs.writeText('.obsidian/app.json', '{}');
  const v = new Vault(fs);
  await v.load();
  return { v, fs };
}

test('vault: muat, indeks, backlink, abaikan folder tersembunyi', async () => {
  const { v } = await demo();
  assert.equal(v.notes.length, 3);
  assert.equal(v.files.some((f) => f.path.startsWith('.obsidian')), false);
  assert.equal(v.resolve('Alpha'), 'Alpha.md');
  assert.equal(v.index.backlinks.get('Alpha.md')!.length, 1);
  assert.equal(v.index.tasks.length, 1);
  assert.ok(v.config.deviceId.startsWith('dev-'));
});

test('vault: rename memperbarui wikilink di catatan lain (bukan di kode)', async () => {
  const { v } = await demo();
  const r = await v.rename('Proyek/Beta.md', 'Bravo');
  assert.equal(r.path, 'Proyek/Bravo.md');
  assert.ok(r.updated >= 2);
  const a = v.content('Alpha.md')!;
  assert.match(a, /\[\[Bravo\]\]/);
  assert.match(a, /\[\[Proyek\/Bravo\|bee\]\]/);
  assert.equal(v.content('Gamma.md'), 'Hanya teks `[[Beta]]` kode, dan [[Bravo#Bagian]]\n');
  assert.equal(v.has('Proyek/Beta.md'), false);
  assert.equal(v.index.backlinks.get('Proyek/Bravo.md')!.length, 3); // 2 dari Alpha + 1 dari Gamma
  assert.equal(await v.fs.exists('Proyek/Bravo.md'), true);
  assert.equal(await v.fs.exists('Proyek/Beta.md'), false);
});

test('vault: buat catatan unik, template, harian', async () => {
  const { v } = await demo();
  const a = await v.createNote({ title: 'Alpha' });
  assert.equal(a, 'Alpha 1.md');
  assert.equal(v.content(a), '# Alpha\n\n');
  const m = await v.createNote({ title: 'Rapat: Q4/Review', template: 'Rapat', now: new Date(2026, 10, 10) });
  assert.equal(m, 'Rapat Q4 Review.md');
  assert.match(v.content(m)!, /tanggal: 2026-11-10/);
  assert.match(v.content(m)!, /# Rapat Q4 Review/);
  const d = await v.openDaily(new Date(2026, 10, 10));
  assert.equal(d, 'Harian/2026-11-10.md');
  assert.match(v.content(d)!, /# Selasa, 10 November 2026/);
  assert.equal(await v.openDaily(new Date(2026, 10, 10)), d); // idempoten
  const c = await v.createCanvas('', 'Peta');
  assert.equal(c, 'Peta.canvas');
  assert.deepEqual(JSON.parse(v.content(c)!), { nodes: [], edges: [] });
});

test('vault: trash + restore', async () => {
  const { v } = await demo();
  await v.remove('Gamma.md');
  assert.equal(v.has('Gamma.md'), false);
  assert.equal(await v.fs.exists('Gamma.md'), false);
  const trash = await v.listTrash();
  assert.equal(trash.length, 1);
  const back = await v.restore(trash[0]);
  assert.equal(back, 'Gamma.md');
  assert.equal(v.has('Gamma.md'), true);
  assert.match(v.content('Gamma.md')!, /Hanya teks/);
  assert.equal((await v.listTrash()).length, 0);
});

test('vault: riwayat versi + restore', async () => {
  const { v } = await demo();
  const orig = v.content('Alpha.md')!;
  await v.write('Alpha.md', orig + 'edit 1\n');
  await v.write('Alpha.md', orig + 'edit 2\n'); // dalam 5 menit → tidak snapshot lagi
  const h = await v.getHistory('Alpha.md');
  assert.equal(h.length, 1);
  assert.equal(h[0].content, orig);
  await v.restoreVersion('Alpha.md', h[0].ts);
  assert.equal(v.content('Alpha.md'), orig);
});

test('vault: refresh mendeteksi perubahan dari luar', async () => {
  const { v, fs } = await demo();
  await fs.writeText('Baru.md', '# Baru\nhalo dunia\n');
  await fs.writeText('Alpha.md', '# Alpha diubah luar\n');
  await fs.remove('Gamma.md');
  const changed = await v.refresh();
  assert.deepEqual(changed.sort(), ['Alpha.md', 'Baru.md', 'Gamma.md']);
  assert.equal(v.has('Baru.md'), true);
  assert.equal(v.has('Gamma.md'), false);
  assert.match(v.content('Alpha.md')!, /diubah luar/);
  assert.deepEqual(await v.refresh(), []);
});

test('vault: pencarian + filter + pin ikut rename', async () => {
  const { v } = await demo();
  assert.equal(v.search('zebra')[0].path, 'Proyek/Beta.md');
  assert.match(v.search('zebra')[0].snippet, /zebra/);
  assert.deepEqual(v.search('tag:proyek').map((h) => h.path), ['Alpha.md']);
  assert.deepEqual(v.search('path:proyek zebra').map((h) => h.path), ['Proyek/Beta.md']);
  assert.equal(v.search('tidakadakatainI').length, 0);
  await v.togglePin('Alpha.md');
  await v.rename('Alpha.md', 'Alfa');
  assert.deepEqual(v.config.pinned, ['Alfa.md']);
});

test('vault: ekspor zip valid', async (t) => {
  const { v } = await demo();
  const zip = await v.exportZip();
  const dir = mkdtempSync(join(tmpdir(), 'vz-'));
  const f = join(dir, 'v.zip');
  writeFileSync(f, zip);
  const out = runPython(['-c', 'import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(sorted(z.namelist()))', f]);
  if (out === null) return t.skip('Python tidak ditemukan di PATH');
  assert.match(out, /Alpha\.md/);
  assert.match(out, /Lampiran\/x\.png/);
  assert.doesNotMatch(out, /obsidian/);
});

test('links.rewriteLinks', () => {
  const r = rewriteLinks('a [[Beta]] b ![[beta|x]] c [[Lain]] `[[Beta]]`\n```\n[[Beta]]\n```', {
    oldName: 'Beta', newName: 'Bravo', oldPath: 'Beta', newPath: 'Bravo',
  });
  assert.equal(r.count, 2);
  assert.equal(r.content, 'a [[Bravo]] b ![[Bravo|x]] c [[Lain]] `[[Beta]]`\n```\n[[Beta]]\n```');
});

test('template + safeName + uniquePath', async () => {
  const r = applyTemplate('# {{title}} {{date:DD MMMM YYYY}} {{time}}\n{{cursor}}x', { title: 'T', now: new Date(2026, 0, 5, 7, 8) });
  assert.equal(r.text, '# T 05 Januari 2026 07:08\nx');
  assert.equal(r.cursor, '# T 05 Januari 2026 07:08\n'.length);
  assert.equal(safeName('a/b:c*?"<>|#^[x]'), 'a b c x');
  assert.equal(safeName('...'), 'Tanpa judul');
  const fs = new MemoryFS();
  await fs.writeText('a.md', '');
  await fs.writeText('a 1.md', '');
  assert.equal(await uniquePath(fs, '', 'a', '.md'), 'a 2.md');
});

test('search: prefix, bobot judul, diakritik', () => {
  const s = new SearchIndex();
  const add = (p: string, c: string) => s.set(analyzeNote(p, c), c);
  add('Resep.md', '# Resep\nnasi goreng spesial\n');
  add('Catatan.md', 'ide: nasi goreng versi baru. café au lait\n');
  add('Nasi.md', '# Nasi\nberas\n');
  const hits = s.search('nasi');
  assert.equal(hits[0].path, 'Nasi.md'); // cocok judul
  assert.equal(hits.length, 3);
  assert.equal(s.search('cafe')[0].path, 'Catatan.md'); // diakritik dilipat
  assert.equal(s.search('gore')[0] !== undefined, true); // prefix
  assert.equal(s.search('nasi zzz').length, 0); // semua term harus cocok
});
