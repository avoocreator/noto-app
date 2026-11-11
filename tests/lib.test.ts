import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, setProperty, removeProperty } from '../src/lib/frontmatter.ts';
import { smartParse } from '../src/lib/smartParse.ts';
import { parseTaskLine, formatTaskLine, toggleTaskLine, toggleTaskInContent, extractTasks } from '../src/lib/tasks.ts';
import { analyzeNote } from '../src/lib/analyze.ts';
import { buildIndex, resolveLink, unlinkedMentions } from '../src/lib/vaultIndex.ts';
import { parseQuery } from '../src/lib/query.ts';
import { planSync, conflictPath } from '../src/lib/syncPlan.ts';
import { parseCanvas, serializeCanvas, bestSides, newTextNode } from '../src/lib/jsoncanvas.ts';
import { monthMatrix, isoWeek, ymd } from '../src/lib/dates.ts';
import { seedNodes, stepForce } from '../src/lib/graphLayout.ts';

// Rabu, 10 Nov 2026
const NOW = new Date(2026, 10, 10, 9, 0);

test('frontmatter: parse + set + remove', () => {
  const src = '---\ntitle: Halo\ntags: [a, "b c"]\nlist:\n  - x\n  - y\ndone: true\n---\n# Isi\n';
  const r = parseFrontmatter(src);
  assert.equal(r.hasFm, true);
  assert.equal(r.data.title, 'Halo');
  assert.deepEqual(r.data.tags, ['a', 'b c']);
  assert.deepEqual(r.data.list, ['x', 'y']);
  assert.equal(r.data.done, true);
  assert.equal(r.body, '# Isi\n');
  const s2 = setProperty(src, 'status', 'aktif');
  assert.match(s2, /status: aktif\n---/);
  assert.equal(parseFrontmatter(s2).data.status, 'aktif');
  const s3 = setProperty(src, 'list', ['q']);
  assert.deepEqual(parseFrontmatter(s3).data.list, ['q']);
  assert.equal(parseFrontmatter(s3).data.title, 'Halo');
  const s4 = removeProperty(src, 'list');
  assert.equal('list' in parseFrontmatter(s4).data, false);
  assert.equal(parseFrontmatter(s4).data.done, true);
  const bare = setProperty('# Judul\n', 'tags', ['x']);
  assert.equal(bare, '---\ntags: [x]\n---\n# Judul\n');
});

test('smartParse: indonesia', () => {
  const r = smartParse('beli susu besok jam 10 !penting #belanja', NOW);
  assert.equal(r.text, 'beli susu');
  assert.equal(r.due, '2026-11-11');
  assert.equal(r.time, '10:00');
  assert.equal(r.priority, 'high');
  assert.deepEqual(r.tags, ['belanja']);
  const w = smartParse('rapat jumat 14:30', NOW);
  assert.equal(w.due, '2026-11-13');
  assert.equal(w.time, '14:30');
  assert.equal(w.text, 'rapat');
  const rec = smartParse('olahraga tiap minggu senin', NOW);
  assert.equal(rec.recur, 'week');
  assert.equal(rec.due, '2026-11-16');
  const d = smartParse('bayar listrik tgl 15', NOW);
  assert.equal(d.due, '2026-11-15');
  const m = smartParse('ulang tahun 3 des', NOW);
  assert.equal(m.due, '2026-12-03');
  const sore = smartParse('makan jam 7 malam', NOW);
  assert.equal(sore.time, '19:00');
  assert.equal(smartParse('catat saja', NOW).due, undefined);
});

test('tasks: parse, format, toggle, recurring', () => {
  const p = smartParse('beli susu besok jam 10 !penting #belanja', NOW);
  const line = formatTaskLine(p);
  assert.equal(line, '- [ ] beli susu #belanja ⏫ ⏰ 10:00 📅 2026-11-11');
  const t = parseTaskLine(line)!;
  assert.equal(t.text, 'beli susu #belanja');
  assert.equal(t.due, '2026-11-11');
  assert.equal(t.priority, 'high');
  assert.deepEqual(t.tags, ['belanja']);
  const done = toggleTaskLine(line, NOW)!;
  assert.match(done.line, /^- \[x\] .* ✅ 2026-11-10$/);
  assert.equal(toggleTaskLine(done.line, NOW)!.line, line);
  const rec = toggleTaskLine('- [ ] olahraga 🔁 every week 📅 2026-11-09', NOW)!;
  assert.equal(rec.extra, '- [ ] olahraga 🔁 every week 📅 2026-11-16');
  const content = '# t\n- [ ] a\n```\n- [ ] kode\n```\n- [x] b\n';
  assert.equal(extractTasks(content).length, 2);
  assert.equal(toggleTaskInContent(content, 1, NOW).split('\n')[1].startsWith('- [x] a'), true);
});

test('analyze + index: link, backlink, alias, tag, kode diabaikan', () => {
  const a = analyzeNote('Proyek/Alpha.md', '---\naliases: [A1]\ntags: [proyek]\n---\n# Alpha\nLihat [[Beta]] dan [[beta#Bagian|b]] #aktif\n`[[abaikan]] #juga`\n```\n[[kode]]\n```\n- [ ] tugas\n', 1);
  const b = analyzeNote('Beta.md', '# Beta\nKembali ke [[A1]] dan [[Tidak Ada]]. Alpha disebut di sini.\n', 2);
  const c = analyzeNote('Gamma.md', 'Menyebut alpha tanpa tautan\n', 3);
  assert.deepEqual(a.tags.sort(), ['aktif', 'proyek']);
  assert.equal(a.links.length, 2);
  assert.equal(a.links[1].heading, 'Bagian');
  assert.equal(a.links[1].alias, 'b');
  assert.equal(a.tasks.length, 1);
  assert.equal(a.headings[0].text, 'Alpha');
  const idx = buildIndex([a, b, c]);
  assert.equal(resolveLink('beta', null, idx), 'Beta.md');
  assert.equal(resolveLink('A1', null, idx), 'Proyek/Alpha.md');
  assert.equal(resolveLink('Proyek/Alpha', null, idx), 'Proyek/Alpha.md');
  assert.equal(idx.backlinks.get('Beta.md')!.length, 2);
  assert.equal(idx.backlinks.get('Proyek/Alpha.md')!.length, 1);
  assert.equal(idx.unresolved.get('Tidak Ada'), 1);
  assert.equal(idx.unresolved.has('abaikan'), false);
  assert.equal(idx.tags.get('proyek')![0], 'Proyek/Alpha.md');
  const files: Record<string, string> = { 'Gamma.md': 'Menyebut alpha tanpa tautan\n', 'Beta.md': 'x' };
  const um = unlinkedMentions('Proyek/Alpha.md', idx, (p) => files[p]);
  assert.deepEqual(um.map((x) => x.from), ['Gamma.md']);
});

test('query', () => {
  const q = parseQuery('tag:#kerja path:Proyek rapat mingguan');
  assert.deepEqual(q.tags, ['kerja']);
  assert.deepEqual(q.paths, ['proyek']);
  assert.equal(q.text, 'rapat mingguan');
});

test('syncPlan: tiga arah', () => {
  const base = { a: '1', b: '1', c: '1', d: '1', e: '1' };
  const local = { a: '2', b: '1', c: '2', e: '1', f: '9' }; // d dihapus lokal
  const remote = { a: '1', b: '3', c: '3', d: '1', e: '1', g: '7' };
  const acts = planSync(local, remote, base);
  const by = Object.fromEntries(acts.map((x) => [x.path, x.type]));
  assert.equal(by.a, 'push');
  assert.equal(by.b, 'pull');
  assert.equal(by.c, 'conflict');
  assert.equal(by.d, 'deleteRemote');
  assert.equal(by.e, undefined);
  assert.equal(by.f, 'push');
  assert.equal(by.g, 'pull');
  assert.deepEqual(planSync({ x: '1' }, { x: '1' }, {}), [{ type: 'adopt', path: 'x', hash: '1' }]);
  assert.equal(planSync({}, { z: '1' }, { z: '1' })[0].type, 'deleteRemote'); // dihapus lokal
  assert.equal(planSync({ z: '1' }, {}, { z: '1' })[0].type, 'deleteLocal'); // dihapus di remote
  assert.equal(planSync({ z: '2' }, {}, { z: '1' })[0].type, 'push'); // edit lokal vs hapus remote → edit menang
  assert.equal(planSync({}, { z: '2' }, { z: '1' })[0].type, 'pull'); // hapus lokal vs edit remote → edit menang
  assert.match(conflictPath('Proyek/Alpha.md', 'laptop', new Date('2026-11-10T09:05:00Z')), /^Proyek\/Alpha \(konflik laptop 2026-11-10 09\.05\)\.md$/);
});

test('jsoncanvas', () => {
  const n = newTextNode(0, 0, 'hai');
  const src = serializeCanvas({ nodes: [n], edges: [{ id: 'e', fromNode: n.id, toNode: 'hilang' }] });
  const back = parseCanvas(src);
  assert.equal(back.nodes.length, 1);
  assert.equal(back.edges.length, 0); // edge ke node yang tidak ada dibuang
  assert.deepEqual(bestSides({ ...n, x: 0, y: 0 }, { ...n, x: 500, y: 0 }), ['right', 'left']);
  assert.equal(parseCanvas('bukan json').nodes.length, 0);
});

test('tanggal', () => {
  const m = monthMatrix(2026, 10);
  assert.equal(m.length, 6);
  assert.equal(m[0][0].getDay(), 1); // Senin
  assert.equal(ymd(m[1][2]), '2026-11-04');
  assert.equal(isoWeek(new Date(2026, 0, 1)), 1);
});

test('graph layout menyebar & stabil', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const nodes = seedNodes(ids);
  const edges = [{ a: 0, b: 1 }, { a: 1, b: 2 }, { a: 2, b: 3 }];
  let e = Infinity;
  for (let i = 0; i < 300; i++) e = stepForce(nodes, edges, 1);
  assert.ok(e < 1, 'energi turun');
  assert.ok(nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)));
});
