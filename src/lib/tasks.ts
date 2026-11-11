import { addDays, addMonths, addYears, parseYmd, ymd } from './dates.ts';
import type { ParsedTask, Priority, Recur } from './smartParse.ts';

/**
 * Format tugas di Markdown (kompatibel dengan plugin Obsidian Tasks):
 *   - [ ] Beli susu ⏫ 🔁 every week ⏰ 10:00 📅 2026-11-12 #belanja
 *   - [x] Selesai ✅ 2026-11-10
 */

export interface TaskItem {
  line: number; // indeks baris (0-based) di file
  indent: number;
  done: boolean;
  raw: string;
  text: string; // teks bersih tanpa token
  due?: string;
  time?: string;
  priority?: Priority;
  recur?: Recur;
  doneDate?: string;
  tags: string[];
}

export const TASK_LINE = /^(\s*)([-*+])\s+\[([ xX])\]\s+(.*?)\s*$/;

const PRI_ICON: Record<Priority, string> = { high: '⏫', medium: '🔼', low: '🔽' };

export function parseTaskLine(line: string, lineNo = 0): TaskItem | null {
  const m = TASK_LINE.exec(line);
  if (!m) return null;
  let rest = m[4];
  const item: TaskItem = {
    line: lineNo,
    indent: m[1].replace(/\t/g, '    ').length,
    done: m[3] !== ' ',
    raw: line,
    text: '',
    tags: [],
  };
  const grab = (re: RegExp): RegExpExecArray | null => {
    const x = re.exec(rest);
    if (x) rest = rest.replace(re, ' ');
    return x;
  };
  let x = grab(/📅\s*(\d{4}-\d{2}-\d{2})/);
  if (x) item.due = x[1];
  x = grab(/⏰\s*(\d{1,2}:\d{2})/);
  if (x) item.time = x[1].padStart(5, '0');
  x = grab(/✅\s*(\d{4}-\d{2}-\d{2})/);
  if (x) item.doneDate = x[1];
  x = grab(/🔁\s*every\s+(day|week|month|year)/i);
  if (x) item.recur = x[1].toLowerCase() as Recur;
  else {
    x = grab(/🔁\s*(daily|weekly|monthly|yearly)/i);
    if (x) {
      const w = x[1].toLowerCase();
      item.recur = w === 'daily' ? 'day' : w === 'weekly' ? 'week' : w === 'monthly' ? 'month' : 'year';
    }
  }
  x = grab(/(⏫|🔼|🔽)/);
  if (x) item.priority = x[1] === '⏫' ? 'high' : x[1] === '🔼' ? 'medium' : 'low';
  const tagRe = /(?:^|\s)#([\p{L}\p{N}_/-]+)/gu;
  let tm: RegExpExecArray | null;
  while ((tm = tagRe.exec(rest))) item.tags.push(tm[1]);
  item.text = rest.replace(/\s+/g, ' ').trim();
  return item;
}

export function formatTaskLine(t: ParsedTask, opts: { done?: boolean; indent?: string } = {}): string {
  const parts: string[] = [t.text];
  for (const tag of t.tags) parts.push(`#${tag}`);
  if (t.priority) parts.push(PRI_ICON[t.priority]);
  if (t.recur) parts.push(`🔁 every ${t.recur}`);
  if (t.time) parts.push(`⏰ ${t.time}`);
  if (t.due) parts.push(`📅 ${t.due}`);
  return `${opts.indent ?? ''}- [${opts.done ? 'x' : ' '}] ${parts.join(' ')}`;
}

function advance(due: string, recur: Recur): string {
  const d = parseYmd(due) ?? new Date();
  const n = recur === 'day' ? addDays(d, 1) : recur === 'week' ? addDays(d, 7) : recur === 'month' ? addMonths(d, 1) : addYears(d, 1);
  return ymd(n);
}

export interface ToggleResult {
  line: string;
  /** baris baru untuk tugas berulang (disisipkan tepat di bawah) */
  extra?: string;
}

export function toggleTaskLine(line: string, now = new Date()): ToggleResult | null {
  const m = TASK_LINE.exec(line);
  if (!m) return null;
  const wasDone = m[3] !== ' ';
  if (wasDone) {
    const un = line.replace(/\[[xX]\]/, '[ ]').replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/, '');
    return { line: un };
  }
  const item = parseTaskLine(line);
  let done = line.replace(/\[ \]/, '[x]');
  if (!/✅/.test(done)) done = done.replace(/\s+$/, '') + ` ✅ ${ymd(now)}`;
  const res: ToggleResult = { line: done };
  if (item?.recur) {
    const base = item.due ?? ymd(now);
    let next = advance(base, item.recur);
    // lewati ke depan bila jadwal berikutnya masih di masa lalu
    for (let i = 0; i < 400 && next < ymd(now); i++) next = advance(next, item.recur);
    let fresh = line.replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/, '');
    fresh = /📅\s*\d{4}-\d{2}-\d{2}/.test(fresh)
      ? fresh.replace(/📅\s*\d{4}-\d{2}-\d{2}/, `📅 ${next}`)
      : fresh.replace(/\s+$/, '') + ` 📅 ${next}`;
    res.extra = fresh;
  }
  return res;
}

export function toggleTaskInContent(content: string, lineIdx: number, now = new Date()): string {
  const lines = content.split('\n');
  const cur = lines[lineIdx];
  if (cur === undefined) return content;
  const r = toggleTaskLine(cur, now);
  if (!r) return content;
  lines[lineIdx] = r.line;
  if (r.extra) lines.splice(lineIdx + 1, 0, r.extra);
  return lines.join('\n');
}

export function extractTasks(content: string, startLine = 0): TaskItem[] {
  const out: TaskItem[] = [];
  const lines = content.split('\n');
  let fence = false;
  for (let i = startLine; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(```|~~~)/.test(l)) { fence = !fence; continue; }
    if (fence) continue;
    const t = parseTaskLine(l, i);
    if (t) out.push(t);
  }
  return out;
}

export type TaskBucket = 'overdue' | 'today' | 'upcoming' | 'nodate' | 'done';

export function bucketOf(t: TaskItem, today: string): TaskBucket {
  if (t.done) return 'done';
  if (!t.due) return 'nodate';
  if (t.due < today) return 'overdue';
  if (t.due === today) return 'today';
  return 'upcoming';
}
