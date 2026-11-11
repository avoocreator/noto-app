import { parseFrontmatter } from './frontmatter.ts';
import { ymd } from './dates.ts';
import type { NoteMeta } from './analyze.ts';
import type { TaskWithSource } from './vaultIndex.ts';

/** Isi widget (2×2 di HP, jendela tempel di desktop). Dihitung dari vault, dikirim ke native sebagai JSON. */
export interface WidgetLine {
  text: string;
  /** hanya untuk tugas: bisa dicentang */
  task?: { path: string; line: number; done: boolean };
  sub?: string;
}
export interface WidgetSummary {
  kind: 'tasks' | 'note';
  title: string;
  subtitle: string;
  lines: WidgetLine[];
  more: number;
  updated: number;
}

const MAX_LINES = 5;

export function widgetSummary(
  now: Date,
  widgetPath: string | null,
  notes: Map<string, NoteMeta>,
  tasks: TaskWithSource[],
  content: (p: string) => string | undefined,
): WidgetSummary {
  const note = widgetPath ? notes.get(widgetPath) : undefined;
  if (note) {
    const body = parseFrontmatter(content(note.path) ?? '').body;
    const all: WidgetLine[] = [];
    for (const raw of body.split('\n')) {
      const t = raw.trim();
      if (!t || /^#{1,6}\s/.test(t) && all.length === 0 && t.replace(/^#+\s*/, '') === note.title) continue;
      const task = /^[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(t);
      if (task) { all.push({ text: task[2].replace(/\s*(📅|⏰|🔁|✅)\s*\S+/g, '').trim(), task: { path: note.path, line: -1, done: task[1] !== ' ' } }); continue; }
      all.push({ text: t.replace(/^#{1,6}\s+/, '').replace(/^[-*+>]\s+/, '').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b ?? a).replace(/[*_`~=]/g, '') });
    }
    return {
      kind: 'note',
      title: note.title,
      subtitle: `${note.words} kata`,
      lines: all.slice(0, MAX_LINES),
      more: Math.max(0, all.length - MAX_LINES),
      updated: now.getTime(),
    };
  }
  const today = ymd(now);
  const open = tasks
    .filter((t) => !t.done && t.due !== undefined && t.due <= today)
    .sort((a, b) => (a.due! < b.due! ? -1 : a.due! > b.due! ? 1 : (a.time ?? '99').localeCompare(b.time ?? '99')));
  const lines: WidgetLine[] = open.slice(0, MAX_LINES).map((t) => ({
    text: t.text.replace(/\s*#\S+/g, '').trim(),
    sub: t.due! < today ? 'terlambat' : t.time,
    task: { path: t.path, line: t.line, done: false },
  }));
  return {
    kind: 'tasks',
    title: 'Hari ini',
    subtitle: open.length === 0 ? 'Semua beres ✨' : `${open.length} tugas`,
    lines,
    more: Math.max(0, open.length - MAX_LINES),
    updated: now.getTime(),
  };
}
