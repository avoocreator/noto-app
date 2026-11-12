import type { Priority } from './smartParse.ts';
import { pad, ymd } from './dates.ts';

export type ReminderMode = 'notif' | 'alarm';

export interface ReminderPrefs {
  on: boolean;
  /** menit sebelum waktu tugas */
  lead: number;
  /** jam untuk tugas yang hanya punya tanggal; '' = jangan ingatkan */
  defaultTime: string;
  mode: ReminderMode;
  /** id nada: 'bell' | 'chime' | … atau 'custom:<id>' */
  sound: string;
  volume: number;
  /** alarm berbunyi berulang paling lama berapa detik */
  maxSeconds: number;
  /** menit tunda bawaan */
  snooze: number;
}

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = { on: false, lead: 0, defaultTime: '08:00', mode: 'alarm', sound: 'bell', volume: 0.8, maxSeconds: 60, snooze: 5 };

export interface ReminderTask { path: string; line: number; text: string; done: boolean; due?: string; time?: string; priority?: Priority }

/** Waktu (ms epoch) tugas harus berbunyi, atau null bila tidak diingatkan. */
export function reminderAt(t: ReminderTask, p: Pick<ReminderPrefs, 'lead' | 'defaultTime'>): number | null {
  if (t.done || !t.due) return null;
  const time = t.time ?? (p.defaultTime || null);
  if (!time) return null;
  const at = new Date(`${t.due}T${time.padStart(5, '0')}:00`).getTime();
  return Number.isNaN(at) ? null : at - p.lead * 60_000;
}

export const reminderKey = (t: ReminderTask) => `${t.path}:${t.line}:${t.text}:${t.due}:${t.time ?? ''}`;

/** Grace: pengingat yang terlewat paling lama segini masih dibunyikan (mis. aplikasi baru dibuka). */
export const GRACE_MS = 30 * 60_000;

/** Tugas yang harus berbunyi sekarang: sudah lewat waktunya, belum dibunyikan, atau tundanya sudah habis. */
export function dueReminders(tasks: ReminderTask[], now: number, p: ReminderPrefs, fired: ReadonlySet<string>, snoozed: ReadonlyMap<string, number>): ReminderTask[] {
  const out: ReminderTask[] = [];
  for (const t of tasks) {
    const k = reminderKey(t);
    const until = snoozed.get(k);
    if (until !== undefined) { if (now >= until && !t.done) out.push(t); continue; }
    if (fired.has(k)) continue;
    const at = reminderAt(t, p);
    if (at !== null && now >= at && now < at + GRACE_MS + p.lead * 60_000) out.push(t);
  }
  return out;
}

/** "10:00 · 10 menit lagi" / "Sekarang" */
export function reminderBody(t: ReminderTask, p: Pick<ReminderPrefs, 'lead' | 'defaultTime'>): string {
  const time = t.time ?? p.defaultTime;
  return `${time}${p.lead ? ` · ${p.lead} menit lagi` : ' · sekarang'}`;
}

export const todayKey = () => ymd(new Date());
export const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
