import { basename, dirname, stripExt, type NoteMeta } from './analyze.ts';
import type { TaskItem } from './tasks.ts';

export interface Backlink {
  from: string;
  line: number;
  context: string;
}

export interface TaskWithSource extends TaskItem {
  path: string;
  title: string;
}

export interface VaultIndex {
  notes: Map<string, NoteMeta>;
  /** nama (huruf kecil) → daftar path; mencakup judul, nama file, dan alias */
  byName: Map<string, string[]>;
  backlinks: Map<string, Backlink[]>;
  /** target yang belum ada catatannya → jumlah penyebutan */
  unresolved: Map<string, number>;
  tags: Map<string, string[]>;
  tasks: TaskWithSource[];
  edges: { from: string; to: string }[];
}

const norm = (s: string) => s.trim().toLowerCase();

function addName(map: Map<string, string[]>, key: string, path: string) {
  const k = norm(key);
  if (!k) return;
  const arr = map.get(k);
  if (!arr) map.set(k, [path]);
  else if (!arr.includes(path)) arr.push(path);
}

export function resolveLink(target: string, fromPath: string | null, idx: Pick<VaultIndex, 'notes' | 'byName'>): string | null {
  let t = target.trim().replace(/\\/g, '/');
  if (!t) return null;
  t = t.replace(/\.(md|markdown)$/i, '');
  if (t.includes('/')) {
    const want = norm(t) + '.md';
    let best: string | null = null;
    for (const p of idx.notes.keys()) {
      const lp = p.toLowerCase();
      if (lp === want) return p;
      if (lp.endsWith('/' + want) && (!best || p.length < best.length)) best = p;
    }
    return best;
  }
  const c = idx.byName.get(norm(t));
  if (!c || c.length === 0) return null;
  if (c.length === 1) return c[0];
  const dir = fromPath ? dirname(fromPath) : '';
  return [...c].sort((a, b) => {
    const sa = dirname(a) === dir ? 0 : 1;
    const sb = dirname(b) === dir ? 0 : 1;
    return sa - sb || a.length - b.length;
  })[0];
}

export function buildIndex(list: NoteMeta[]): VaultIndex {
  const notes = new Map<string, NoteMeta>();
  const byName = new Map<string, string[]>();
  for (const n of list) {
    notes.set(n.path, n);
    addName(byName, stripExt(basename(n.path)), n.path);
    if (n.title !== stripExt(basename(n.path))) addName(byName, n.title, n.path);
    for (const a of n.aliases) addName(byName, a, n.path);
  }

  const backlinks = new Map<string, Backlink[]>();
  const unresolved = new Map<string, number>();
  const tags = new Map<string, string[]>();
  const tasks: TaskWithSource[] = [];
  const edges: { from: string; to: string }[] = [];
  const seen = new Set<string>();

  for (const n of list) {
    for (const t of n.tags) {
      const arr = tags.get(t);
      if (arr) arr.push(n.path);
      else tags.set(t, [n.path]);
    }
    for (const t of n.tasks) tasks.push({ ...t, path: n.path, title: n.title });
    for (const l of n.links) {
      const to = resolveLink(l.target, n.path, { notes, byName });
      if (to) {
        if (to !== n.path) {
          const arr = backlinks.get(to);
          const bl = { from: n.path, line: l.line, context: l.context };
          if (arr) arr.push(bl);
          else backlinks.set(to, [bl]);
          const key = n.path + '\0' + to;
          if (!seen.has(key)) {
            seen.add(key);
            edges.push({ from: n.path, to });
          }
        }
      } else if (!/\.[A-Za-z0-9]{2,5}$/.test(l.target) || /\.(md|markdown)$/i.test(l.target)) {
        const k = stripExt(l.target.trim());
        unresolved.set(k, (unresolved.get(k) ?? 0) + 1);
      }
    }
  }
  return { notes, byName, backlinks, unresolved, tags, tasks, edges };
}

/** Catatan lain yang menyebut judul catatan ini tanpa tautan. */
export function unlinkedMentions(
  path: string,
  idx: VaultIndex,
  getContent: (p: string) => string | undefined,
  limit = 30,
): Backlink[] {
  const note = idx.notes.get(path);
  if (!note) return [];
  const names = [note.title, stripExt(basename(path)), ...note.aliases].map(norm).filter((x) => x.length >= 3);
  if (names.length === 0) return [];
  const linkedFrom = new Set((idx.backlinks.get(path) ?? []).map((b) => b.from));
  const out: Backlink[] = [];
  for (const other of idx.notes.values()) {
    if (other.path === path || linkedFrom.has(other.path)) continue;
    const content = getContent(other.path);
    if (!content) continue;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      if (/\[\[/.test(ln)) continue;
      const low = ln.toLowerCase();
      if (names.some((n) => low.includes(n))) {
        out.push({ from: other.path, line: i, context: ln.trim().slice(0, 160) });
        break;
      }
    }
    if (out.length >= limit) break;
  }
  return out;
}

export function folderTree(paths: string[]): Map<string, string[]> {
  const dirs = new Map<string, string[]>();
  dirs.set('', []);
  for (const p of paths) {
    const parts = p.split('/');
    for (let i = 1; i < parts.length; i++) {
      const d = parts.slice(0, i).join('/');
      if (!dirs.has(d)) dirs.set(d, []);
    }
  }
  return dirs;
}
