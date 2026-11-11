import type { NoteMeta } from './analyze.ts';
import { parseQuery } from './query.ts';

/** Pencarian teks penuh ringan: token + prefix, skor berbobot (judul > tag > heading > isi). */

export interface SearchHit {
  path: string;
  score: number;
  /** cuplikan isi di sekitar kecocokan pertama */
  snippet: string;
  line: number;
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const tokenize = (s: string): string[] => fold(s).match(/[\p{L}\p{N}]+/gu) ?? [];

interface Doc {
  path: string;
  title: string[];
  tags: string[];
  heads: string[];
  body: Map<string, number>;
  lines: string[];
  folder: string;
  tagSet: Set<string>;
}

export class SearchIndex {
  private docs = new Map<string, Doc>();

  set(meta: NoteMeta, content: string) {
    const body = new Map<string, number>();
    for (const t of tokenize(content)) body.set(t, (body.get(t) ?? 0) + 1);
    this.docs.set(meta.path, {
      path: meta.path,
      title: tokenize([meta.title, ...meta.aliases, meta.path.replace(/\.md$/i, '')].join(' ')),
      tags: meta.tags.flatMap(tokenize),
      heads: meta.headings.flatMap((h) => tokenize(h.text)),
      body,
      lines: content.split('\n'),
      folder: meta.folder.toLowerCase(),
      tagSet: new Set(meta.tags.map((t) => t.toLowerCase())),
    });
  }

  delete(path: string) {
    this.docs.delete(path);
  }

  clear() {
    this.docs.clear();
  }

  get size() {
    return this.docs.size;
  }

  search(query: string, limit = 50): SearchHit[] {
    const q = parseQuery(query);
    const terms = tokenize(q.text);
    const hits: SearchHit[] = [];
    for (const d of this.docs.values()) {
      if (q.tags.length && !q.tags.every((t) => [...d.tagSet].some((x) => x === t || x.startsWith(t + '/')))) continue;
      if (q.paths.length && !q.paths.every((p) => d.path.toLowerCase().includes(p))) continue;
      if (terms.length === 0) {
        if (q.tags.length || q.paths.length) hits.push({ path: d.path, score: 1, snippet: '', line: 0 });
        continue;
      }
      let score = 0;
      let ok = true;
      for (const t of terms) {
        const s = termScore(d, t);
        if (s === 0) { ok = false; break; }
        score += s;
      }
      if (!ok) continue;
      const { snippet, line } = findSnippet(d.lines, terms);
      hits.push({ path: d.path, score, snippet, line });
    }
    hits.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
    return hits.slice(0, limit);
  }
}

function matchCount(words: string[], t: string): number {
  let n = 0;
  for (const w of words) {
    if (w === t) n += 2;
    else if (t.length >= 2 && w.startsWith(t)) n += 1;
  }
  return n;
}

function termScore(d: Doc, t: string): number {
  let s = 0;
  const inTitle = matchCount(d.title, t);
  if (inTitle) s += 12 + inTitle * 3;
  const inTags = matchCount(d.tags, t);
  if (inTags) s += 6 + inTags;
  const inHeads = matchCount(d.heads, t);
  if (inHeads) s += 4 + inHeads;
  const exact = d.body.get(t) ?? 0;
  if (exact) s += 1 + Math.min(4, Math.log2(1 + exact));
  else if (t.length >= 2) {
    for (const [w, c] of d.body) {
      if (w.startsWith(t)) {
        s += 0.5 + Math.min(2, Math.log2(1 + c) * 0.5);
        break;
      }
    }
  }
  return s;
}

function findSnippet(lines: string[], terms: string[]): { snippet: string; line: number } {
  for (let i = 0; i < lines.length; i++) {
    const f = fold(lines[i]);
    if (terms.some((t) => f.includes(t))) {
      const raw = lines[i].trim();
      if (!raw || /^---\s*$/.test(raw)) continue;
      const idx = f.indexOf(terms.find((t) => f.includes(t))!);
      const start = Math.max(0, idx - 40);
      const cut = raw.slice(start, start + 160);
      return { snippet: (start > 0 ? '…' : '') + cut + (start + 160 < raw.length ? '…' : ''), line: i };
    }
  }
  return { snippet: '', line: 0 };
}
