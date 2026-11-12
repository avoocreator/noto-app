import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patchTaskLine, parseTaskLine } from '../src/lib/tasks.ts';
import { dueReminders, reminderAt, DEFAULT_REMINDER_PREFS as P, type ReminderTask } from '../src/lib/reminders.ts';

test('patchTaskLine: ubah tanggal & jam, teks/tag tetap', () => {
  const out = patchTaskLine('- [ ] Rapat #kerja ⏫ ⏰ 10:00 📅 2026-11-12', { due: '2026-11-20', time: '14:30' });
  const t = parseTaskLine(out)!;
  assert.equal(t.due, '2026-11-20'); assert.equal(t.time, '14:30'); assert.equal(t.priority, 'high'); assert.deepEqual(t.tags, ['kerja']);
  assert.match(t.text, /^Rapat/);
});
test('patchTaskLine: hapus & tambah, selesai dipertahankan', () => {
  const a = patchTaskLine('  - [x] Beli susu 📅 2026-11-12 ✅ 2026-11-12', { time: '09:00', due: null, recur: 'week', priority: 'low' });
  const t = parseTaskLine(a)!;
  assert.equal(t.due, undefined); assert.equal(t.time, '09:00'); assert.equal(t.recur, 'week'); assert.equal(t.priority, 'low');
  assert.equal(t.done, true); assert.equal(t.doneDate, '2026-11-12'); assert.ok(a.startsWith('  - [x] '));
  assert.equal(patchTaskLine('bukan tugas', { due: '2026-01-01' }), 'bukan tugas');
});
test('patchTaskLine: undefined = biarkan', () => {
  const l = '- [ ] A 🔁 every day ⏰ 08:00 📅 2026-11-12';
  assert.equal(patchTaskLine(l, {}), l);
});

const task = (o: Partial<ReminderTask> = {}): ReminderTask => ({ path: 'a.md', line: 1, text: 'Rapat', done: false, due: '2026-11-12', time: '10:00', ...o });
const at = (s: string) => new Date(s).getTime();

test('reminderAt: lead, jam bawaan, selesai/tanpa tanggal', () => {
  assert.equal(reminderAt(task(), { lead: 10, defaultTime: '08:00' }), at('2026-11-12T09:50:00'));
  assert.equal(reminderAt(task({ time: undefined }), { lead: 0, defaultTime: '08:00' }), at('2026-11-12T08:00:00'));
  assert.equal(reminderAt(task({ time: undefined }), { lead: 0, defaultTime: '' }), null);
  assert.equal(reminderAt(task({ done: true }), { lead: 0, defaultTime: '08:00' }), null);
  assert.equal(reminderAt(task({ due: undefined }), { lead: 0, defaultTime: '08:00' }), null);
});
test('dueReminders: belum waktunya / tepat / terlambat / sudah berbunyi / tunda', () => {
  const p = { ...P, on: true, lead: 0 };
  const tk = [task()];
  assert.equal(dueReminders(tk, at('2026-11-12T09:59:00'), p, new Set(), new Map()).length, 0);
  assert.equal(dueReminders(tk, at('2026-11-12T10:00:10'), p, new Set(), new Map()).length, 1);
  assert.equal(dueReminders(tk, at('2026-11-12T10:20:00'), p, new Set(), new Map()).length, 1);
  assert.equal(dueReminders(tk, at('2026-11-12T11:00:00'), p, new Set(), new Map()).length, 0);
  const key = 'a.md:1:Rapat:2026-11-12:10:00';
  assert.equal(dueReminders(tk, at('2026-11-12T10:00:10'), p, new Set([key]), new Map()).length, 0);
  const sn = new Map([[key, at('2026-11-12T10:05:00')]]);
  assert.equal(dueReminders(tk, at('2026-11-12T10:03:00'), p, new Set([key]), sn).length, 0);
  assert.equal(dueReminders(tk, at('2026-11-12T10:05:01'), p, new Set([key]), sn).length, 1);
});
