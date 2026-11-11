import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vault } from '../src/vault/vault.ts';
import { MemoryFS } from '../src/vault/memoryFs.ts';
import { widgetSummary } from '../src/lib/widget.ts';

const NOW = new Date(2026, 10, 10, 9, 0);

async function mk() {
  const fs = new MemoryFS();
  await fs.writeText('A.md', '- [ ] bayar listrik ⏰ 19:00 📅 2026-11-10 #rumah\n- [ ] telat banget ⏫ 📅 2026-11-01\n- [ ] besok 📅 2026-11-11\n- [x] selesai ✅ 2026-11-10 📅 2026-11-10\n- [ ] tanpa tanggal\n');
  await fs.writeText('Catatan.md', '---\ntags: [x]\n---\n# Catatan\nBaris satu dengan [[A|tautan]]\n- poin\n- [ ] tugas kecil 📅 2026-11-12\n\n> kutipan\nbaris 5\nbaris 6\nbaris 7\n');
  const v = new Vault(fs);
  await v.load();
  return v;
}

test('widget: mode tugas = terlambat + hari ini, urut tanggal', async () => {
  const v = await mk();
  const w = widgetSummary(NOW, null, new Map(v.notes.map((n) => [n.path, n])), v.index.tasks, (p) => v.content(p));
  assert.equal(w.kind, 'tasks');
  assert.equal(w.title, 'Hari ini');
  assert.deepEqual(w.lines.map((l) => l.text), ['telat banget', 'bayar listrik']);
  assert.equal(w.lines[0].sub, 'terlambat');
  assert.equal(w.lines[1].sub, '19:00');
  assert.equal(w.subtitle, '2 tugas');
  assert.equal(w.more, 0);
});

test('widget: mode catatan, judul tidak diulang, markup dibersihkan, dibatasi 5 baris', async () => {
  const v = await mk();
  const w = widgetSummary(NOW, 'Catatan.md', new Map(v.notes.map((n) => [n.path, n])), v.index.tasks, (p) => v.content(p));
  assert.equal(w.kind, 'note');
  assert.equal(w.title, 'Catatan');
  assert.equal(w.lines.length, 5);
  assert.equal(w.lines[0].text, 'Baris satu dengan tautan');
  assert.equal(w.lines[2].task?.done, false);
  assert.equal(w.lines[2].text, 'tugas kecil');
  assert.ok(w.more >= 1);
});

test('widget: path tidak ada → kembali ke mode tugas; kosong → pesan beres', async () => {
  const v = await mk();
  const w = widgetSummary(NOW, 'Hilang.md', new Map(v.notes.map((n) => [n.path, n])), v.index.tasks, (p) => v.content(p));
  assert.equal(w.kind, 'tasks');
  const empty = widgetSummary(NOW, null, new Map(), [], () => undefined);
  assert.equal(empty.subtitle, 'Semua beres ✨');
  assert.equal(empty.lines.length, 0);
});
