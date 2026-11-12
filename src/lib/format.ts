/* Operasi format teks ala Word, murni (tanpa DOM) supaya sama untuk editor catatan (CodeMirror) dan kartu canvas (textarea).
   Semua operasi mengembalikan daftar perubahan pada koordinat ASLI + seleksi baru pada koordinat HASIL. */

export interface Change { from: number; to: number; insert: string }
export interface Result { changes: Change[]; from: number; to: number }

export function applyChanges(text: string, changes: Change[]): string {
  let out = text;
  for (const c of [...changes].sort((a, b) => b.from - a.from || b.to - a.to)) out = out.slice(0, c.from) + c.insert + out.slice(c.to);
  return out;
}

/** Petakan posisi lama ke posisi baru. assoc>0 = sesudah sisipan di titik itu, <0 = sebelumnya. */
export function mapPos(changes: Change[], pos: number, assoc: 1 | -1 = 1): number {
  let delta = 0;
  for (const c of [...changes].sort((a, b) => a.from - b.from || a.to - b.to)) {
    if (pos < c.from || (pos === c.from && c.from === c.to && assoc < 0)) break;
    if (pos > c.to || (pos === c.to && assoc > 0)) { delta += c.insert.length - (c.to - c.from); continue; }
    return c.from + delta + (assoc > 0 ? c.insert.length : 0);
  }
  return pos + delta;
}

const result = (changes: Change[], from: number, to: number): Result => ({ changes, from: mapPos(changes, from, 1), to: mapPos(changes, to, -1) });

/* ── warna ─────────────────────────────────────────────────────────────────────────────── */
export interface Swatch { hex: string; label: string }
export const TEXT_COLORS: Swatch[] = [
  { hex: '#e03131', label: 'Merah' }, { hex: '#e8590c', label: 'Oranye' }, { hex: '#2f9e44', label: 'Hijau' }, { hex: '#1c7ed6', label: 'Biru' },
  { hex: '#7048e8', label: 'Ungu' }, { hex: '#d6336c', label: 'Pink' }, { hex: '#868e96', label: 'Abu-abu' }, { hex: '#212529', label: 'Hitam' },
];
export const HIGHLIGHT_COLORS: Swatch[] = [
  { hex: '#ffe066', label: 'Kuning' }, { hex: '#b2f2bb', label: 'Hijau' }, { hex: '#a5d8ff', label: 'Biru' }, { hex: '#fcc2d7', label: 'Pink' },
  { hex: '#ffd8a8', label: 'Oranye' }, { hex: '#d0bfff', label: 'Ungu' }, { hex: '#dee2e6', label: 'Abu-abu' },
];
export const DEFAULT_HIGHLIGHT = '#ffe066';
const HEX = /^#[0-9a-fA-F]{3,8}$/;

/* ── pembungkus inline ─────────────────────────────────────────────────────────────────── */
const WORD = /[\p{L}\p{N}_]/u;

function expandWord(text: string, from: number, to: number): [number, number] {
  if (from !== to) return [from, to];
  let a = from, b = to;
  while (a > 0 && WORD.test(text[a - 1])) a--;
  while (b < text.length && WORD.test(text[b])) b++;
  return [a, b];
}

const runBefore = (t: string, pos: number, ch: string) => { let n = 0; while (pos - n > 0 && t[pos - n - 1] === ch) n++; return n; };
const runAfter = (t: string, pos: number, ch: string) => { let n = 0; while (pos + n < t.length && t[pos + n] === ch) n++; return n; };

/** Pembungkus sederhana (open/close tetap): **, *, ~~, ==, `, <u>…</u>, <sup>…</sup>. */
export function toggleWrap(text: string, from: number, to: number, open: string, close = open): Result {
  [from, to] = expandWord(text, from, to);
  const star = open === '*' || open === '**';
  // 1) sudah terbungkus di luar seleksi?
  let outside = text.slice(from - open.length, from) === open && text.slice(to, to + close.length) === close;
  if (star) {
    const r = Math.min(runBefore(text, from, '*'), runAfter(text, to, '*'));
    outside = open === '*' ? r % 2 === 1 : r >= 2;
  }
  if (outside) {
    return result([{ from: from - open.length, to: from, insert: '' }, { from: to, to: to + close.length, insert: '' }], from, to);
  }
  // 2) seleksi sudah memuat pembungkusnya?
  const sel = text.slice(from, to);
  if (!star && sel.length >= open.length + close.length && sel.startsWith(open) && sel.endsWith(close)) {
    return result([{ from, to: from + open.length, insert: '' }, { from: to - close.length, to, insert: '' }], from + open.length, to - close.length);
  }
  if (from === to) {
    const ch = [{ from, to, insert: open + close }];
    const p = from + open.length;
    return { changes: ch, from: p, to: p };
  }
  return result([{ from, to: from, insert: open }, { from: to, to, insert: close }], from, to);
}

interface Wrapper { open: RegExp; close: string }

/** Cari pembungkus (di luar atau di dalam seleksi) yang cocok dengan salah satu pola. */
function findWrapper(text: string, from: number, to: number, pats: Wrapper[]): { oFrom: number; oTo: number; cFrom: number; cTo: number } | null {
  const before = text.slice(0, from), sel = text.slice(from, to), after = text.slice(to);
  for (const p of pats) {
    const mo = new RegExp('(?:' + p.open.source + ')$').exec(before);
    if (mo && after.startsWith(p.close)) return { oFrom: from - mo[0].length, oTo: from, cFrom: to, cTo: to + p.close.length };
    const mi = new RegExp('^(?:' + p.open.source + ')').exec(sel);
    if (mi && sel.endsWith(p.close) && sel.length >= mi[0].length + p.close.length) return { oFrom: from, oTo: from + mi[0].length, cFrom: to - p.close.length, cTo: to };
  }
  return null;
}

function setWrapper(text: string, from: number, to: number, pats: Wrapper[], open: string | null, close: string): Result {
  [from, to] = expandWord(text, from, to);
  const f = findWrapper(text, from, to, pats);
  if (f) {
    const ins = open ?? '';
    const insC = open === null ? '' : close;
    const ch: Change[] = [{ from: f.oFrom, to: f.oTo, insert: ins }, { from: f.cFrom, to: f.cTo, insert: insC }];
    return result(ch, f.oTo, f.cFrom);
  }
  if (open === null) return { changes: [], from, to };
  if (from === to) return { changes: [{ from, to, insert: open + close }], from: from + open.length, to: from + open.length };
  return result([{ from, to: from, insert: open }, { from: to, to, insert: close }], from, to);
}

const COLOR_PATS: Wrapper[] = [{ open: /<span style="color:\s*#[0-9a-fA-F]{3,8}\s*">/, close: '</span>' }];
const HL_PATS: Wrapper[] = [{ open: /<mark style="background:\s*#[0-9a-fA-F]{3,8}\s*">/, close: '</mark>' }, { open: /==/, close: '==' }];

/** Warna teks. null = kembali ke warna bawaan. */
export function setTextColor(text: string, from: number, to: number, hex: string | null): Result {
  if (hex !== null && !HEX.test(hex)) return { changes: [], from, to };
  return setWrapper(text, from, to, COLOR_PATS, hex === null ? null : `<span style="color:${hex}">`, '</span>');
}

/** Stabilo. Kuning bawaan memakai ==teks== (kompatibel Obsidian); warna lain <mark style="background:…">. null = hapus. */
export function setHighlight(text: string, from: number, to: number, hex: string | null): Result {
  if (hex !== null && !HEX.test(hex)) return { changes: [], from, to };
  if (hex === null) return setWrapper(text, from, to, HL_PATS, null, '');
  if (hex.toLowerCase() === DEFAULT_HIGHLIGHT) return setWrapper(text, from, to, HL_PATS, '==', '==');
  return setWrapper(text, from, to, HL_PATS, `<mark style="background:${hex}">`, '</mark>');
}

/** Hapus semua format inline pada seleksi (atau kata di kursor). */
export function clearFormat(text: string, from: number, to: number): Result {
  [from, to] = expandWord(text, from, to);
  let s = text.slice(from, to);
  const before = s;
  s = s.replace(/<\/?(?:u|sup|sub|mark|span)\b[^>]*>/gi, '');
  for (let i = 0; i < 3; i++) {
    s = s.replace(/\*\*\*(.+?)\*\*\*/g, '$1').replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/~~(.+?)~~/g, '$1').replace(/==(.+?)==/g, '$1')
      .replace(/(?<![*\w])\*(?!\s)(.+?)\*(?![*\w])/g, '$1').replace(/(?<![_\w])_(?!\s)(.+?)_(?![_\w])/g, '$1');
  }
  if (s === before) return { changes: [], from, to };
  return { changes: [{ from, to, insert: s }], from, to: from + s.length };
}

/* ── baris / paragraf ──────────────────────────────────────────────────────────────────── */
interface Line { start: number; text: string }

function linesIn(text: string, from: number, to: number): Line[] {
  const a = text.lastIndexOf('\n', from - 1) + 1;
  let b = text.indexOf('\n', to > from ? to - 1 : to);
  if (b === -1) b = text.length;
  const out: Line[] = [];
  let pos = a;
  for (const t of text.slice(a, b).split('\n')) { out.push({ start: pos, text: t }); pos += t.length + 1; }
  return out;
}

/** Perubahan minimal (hapus awalan/akhiran sama) dari satu baris lama ke baru. */
function lineChange(l: Line, next: string): Change | null {
  if (next === l.text) return null;
  let p = 0;
  while (p < l.text.length && p < next.length && l.text[p] === next[p]) p++;
  let s = 0;
  while (s < l.text.length - p && s < next.length - p && l.text[l.text.length - 1 - s] === next[next.length - 1 - s]) s++;
  return { from: l.start + p, to: l.start + l.text.length - s, insert: next.slice(p, next.length - s) };
}

const ALIGN_TAIL = /\s*<!--\s*align:(center|right|justify)\s*-->\s*$/;
export type Align = 'left' | 'center' | 'right' | 'justify';
export const alignOf = (line: string): Align => (ALIGN_TAIL.exec(line)?.[1] as Align | undefined) ?? 'left';

type Kind = 'none' | 'heading' | 'bullet' | 'number' | 'task' | 'quote';
interface Prefix { indent: string; kind: Kind; level: number; len: number }

export function parsePrefix(line: string): Prefix {
  let m: RegExpExecArray | null;
  if ((m = /^(\s*)(#{1,6})\s+/.exec(line))) return { indent: m[1], kind: 'heading', level: m[2].length, len: m[0].length };
  if ((m = /^(\s*)[-*+]\s+\[[ xX]\]\s+/.exec(line))) return { indent: m[1], kind: 'task', level: 0, len: m[0].length };
  if ((m = /^(\s*)[-*+]\s+/.exec(line))) return { indent: m[1], kind: 'bullet', level: 0, len: m[0].length };
  if ((m = /^(\s*)\d+[.)]\s+/.exec(line))) return { indent: m[1], kind: 'number', level: 0, len: m[0].length };
  if ((m = /^(\s*)>+\s?/.exec(line))) return { indent: m[1], kind: 'quote', level: 0, len: m[0].length };
  return { indent: /^\s*/.exec(line)![0], kind: 'none', level: 0, len: /^\s*/.exec(line)![0].length };
}

function build(text: string, from: number, to: number, f: (l: Line, i: number, all: Line[]) => string): Result {
  const ls = linesIn(text, from, to);
  const ch: Change[] = [];
  ls.forEach((l, i) => { const c = lineChange(l, f(l, i, ls)); if (c) ch.push(c); });
  return result(ch, from, to);
}

/** Judul 1–6; level 0 = paragraf biasa. Menekan level yang sama lagi mengembalikan ke paragraf. */
export function setHeading(text: string, from: number, to: number, level: number): Result {
  const ls = linesIn(text, from, to).filter((l) => l.text.trim());
  const same = ls.length > 0 && ls.every((l) => { const p = parsePrefix(l.text); return p.kind === 'heading' && p.level === level; });
  return build(text, from, to, (l) => {
    if (!l.text.trim()) return l.text;
    const p = parsePrefix(l.text);
    const body = l.text.slice(p.kind === 'none' ? p.len : p.len);
    const lvl = same ? 0 : level;
    return (lvl > 0 ? '#'.repeat(lvl) + ' ' : p.indent) + body;
  });
}

export type ListKind = 'bullet' | 'number' | 'task' | 'quote';

/** Poin / nomor / daftar tugas / kutipan. Bila semua baris sudah berjenis itu → dilepas. Nomor diurut 1,2,3… */
export function toggleList(text: string, from: number, to: number, kind: ListKind): Result {
  const ls = linesIn(text, from, to).filter((l) => l.text.trim());
  const all = ls.length > 0 && ls.every((l) => parsePrefix(l.text).kind === kind);
  let n = 0;
  return build(text, from, to, (l) => {
    if (!l.text.trim()) return l.text;
    const p = parsePrefix(l.text);
    const body = l.text.slice(p.len);
    if (all) return p.indent + body;
    n++;
    const mark = kind === 'bullet' ? '- ' : kind === 'task' ? '- [ ] ' : kind === 'quote' ? '> ' : `${n}. `;
    return p.indent + mark + body;
  });
}

/** Urutkan ulang nomor pada daftar bernomor yang memuat seleksi (per tingkat indent). */
export function renumber(text: string, from: number, to: number): Result {
  const all = linesIn(text, 0, text.length);
  const idx = (pos: number) => Math.max(0, all.findIndex((l) => pos <= l.start + l.text.length));
  const isNum = (l: Line) => /^\s*\d+[.)]\s+/.test(l.text);
  let a = idx(from), b = idx(to);
  if (!isNum(all[a])) return { changes: [], from, to };
  while (a > 0 && (isNum(all[a - 1]) || /^\s{2,}\S/.test(all[a - 1].text))) a--;
  while (b < all.length - 1 && (isNum(all[b + 1]) || /^\s{2,}\S/.test(all[b + 1].text))) b++;
  const counters = new Map<number, number>();
  const ch: Change[] = [];
  for (let i = a; i <= b; i++) {
    const l = all[i];
    const m = /^(\s*)(\d+)([.)])(\s+)/.exec(l.text);
    if (!m) continue;
    const depth = m[1].replace(/\t/g, '    ').length;
    for (const k of [...counters.keys()]) if (k > depth) counters.delete(k);
    const nx = (counters.get(depth) ?? 0) + 1;
    counters.set(depth, nx);
    if (String(nx) !== m[2]) ch.push({ from: l.start + m[1].length, to: l.start + m[1].length + m[2].length, insert: String(nx) });
  }
  return result(ch, from, to);
}

const INDENT = '    ';
export function indentLines(text: string, from: number, to: number, dir: 1 | -1): Result {
  return build(text, from, to, (l) => {
    if (!l.text.trim() && dir === 1) return l.text;
    if (dir === 1) return INDENT + l.text;
    return l.text.replace(/^(?:\t| {1,4})/, '');
  });
}

/** Rata teks per baris: disimpan sebagai komentar di ujung baris (<!--align:center-->) agar Markdown tetap utuh. */
export function setAlign(text: string, from: number, to: number, align: Align): Result {
  return build(text, from, to, (l) => {
    if (!l.text.trim()) return l.text;
    const base = l.text.replace(ALIGN_TAIL, '');
    return align === 'left' ? base : `${base} <!--align:${align}-->`;
  });
}

/* ── sisipan ───────────────────────────────────────────────────────────────────────────── */
/** Sisipkan blok (tabel, garis, kode) di bawah baris kursor, dipisah baris kosong. */
function insertBlock(text: string, pos: number, block: string): { change: Change; start: number } {
  const ls = linesIn(text, pos, pos)[0];
  const cur = ls.text.trim() === '';
  const at = cur ? ls.start : ls.start + ls.text.length;
  const lead = cur ? '' : '\n\n';
  const ins = lead + block + (cur && at < text.length ? '\n' : '');
  return { change: { from: at, to: at, insert: ins }, start: at + lead.length };
}

export function insertHr(text: string, pos: number): Result {
  const { change, start } = insertBlock(text, pos, '---\n');
  return { changes: [change], from: start + 4, to: start + 4 };
}

export function insertCodeBlock(text: string, pos: number): Result {
  const { change, start } = insertBlock(text, pos, '```\n\n```\n');
  return { changes: [change], from: start + 4, to: start + 4 };
}

export function insertLinkAt(text: string, from: number, to: number): Result {
  const sel = text.slice(from, to);
  return { changes: [{ from, to, insert: `[${sel}](url)` }], from: from + sel.length + 3, to: from + sel.length + 6 };
}

/* ── tabel ─────────────────────────────────────────────────────────────────────────────── */
export type ColAlign = 'left' | 'center' | 'right';
export interface Table { cells: string[][]; aligns: ColAlign[] }

export const isTableLine = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isDelim = (l: string) => /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(l) && l.includes('-');

export function splitRow(line: string): string[] {
  const t = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '\\' && t[i + 1] === '|') { cur += '\\|'; i++; }
    else if (t[i] === '|') { out.push(cur.trim()); cur = ''; }
    else cur += t[i];
  }
  out.push(cur.trim());
  return out;
}

export function parseTable(lines: string[]): Table | null {
  if (lines.length < 2 || !isTableLine(lines[0]) || !isDelim(lines[1])) return null;
  const aligns = splitRow(lines[1]).map((c): ColAlign => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : 'left'));
  const cells = [splitRow(lines[0]), ...lines.slice(2).map(splitRow)];
  const n = Math.max(aligns.length, ...cells.map((r) => r.length));
  for (const r of cells) while (r.length < n) r.push('');
  while (aligns.length < n) aligns.push('left');
  return { cells, aligns };
}

export function formatTable(t: Table): string[] {
  const n = t.aligns.length;
  const w = Array.from({ length: n }, (_, c) => Math.max(3, ...t.cells.map((r) => (r[c] ?? '').length)));
  const pad = (s: string, c: number) => {
    const a = t.aligns[c], sp = w[c] - s.length;
    return a === 'right' ? ' '.repeat(sp) + s : a === 'center' ? ' '.repeat(Math.floor(sp / 2)) + s + ' '.repeat(Math.ceil(sp / 2)) : s + ' '.repeat(sp);
  };
  const row = (r: string[]) => '| ' + r.map((s, c) => pad(s, c)).join(' | ') + ' |';
  const delim = '| ' + t.aligns.map((a, c) => (a === 'center' ? ':' + '-'.repeat(w[c] - 2) + ':' : a === 'right' ? '-'.repeat(w[c] - 1) + ':' : '-'.repeat(w[c]))).join(' | ') + ' |';
  return [row(t.cells[0]), delim, ...t.cells.slice(1).map(row)];
}

export interface TableAt { start: number; end: number; first: number; lines: string[]; table: Table; row: number; col: number }

/** Tabel yang memuat posisi `pos` (baris tabel berurutan, dimulai baris header + pemisah). */
export function tableAt(text: string, pos: number): TableAt | null {
  const all = linesIn(text, 0, text.length);
  let i = all.findIndex((l) => pos >= l.start && pos <= l.start + l.text.length);
  if (i < 0 || !isTableLine(all[i].text)) return null;
  let a = i; while (a > 0 && isTableLine(all[a - 1].text)) a--;
  let b = i; while (b < all.length - 1 && isTableLine(all[b + 1].text)) b++;
  const lines = all.slice(a, b + 1).map((l) => l.text);
  const table = parseTable(lines);
  if (!table) return null;
  const rel = i - a;
  const row = rel === 0 ? 0 : rel === 1 ? 0 : rel - 1;
  const before = all[i].text.slice(0, pos - all[i].start);
  const col = Math.min(table.aligns.length - 1, Math.max(0, (before.match(/(?<!\\)\|/g)?.length ?? 1) - 1));
  return { start: all[a].start, end: all[b].start + all[b].text.length, first: a, lines, table, row, col };
}

export function insertTable(text: string, pos: number, rows: number, cols: number): Result {
  const head = Array.from({ length: cols }, (_, i) => `Kolom ${i + 1}`);
  const body = Array.from({ length: Math.max(1, rows - 1) }, () => Array.from({ length: cols }, () => ''));
  const lines = formatTable({ cells: [head, ...body], aligns: Array(cols).fill('left') });
  const { change, start } = insertBlock(text, pos, lines.join('\n') + '\n');
  return { changes: [change], from: start + 2, to: start + 2 + head[0].length };
}

export type TableOp = 'rowBelow' | 'rowAbove' | 'colRight' | 'colLeft' | 'delRow' | 'delCol' | 'alignLeft' | 'alignCenter' | 'alignRight' | 'delTable' | 'format';

export function tableOp(text: string, pos: number, op: TableOp): Result | null {
  const at = tableAt(text, pos);
  if (!at) return null;
  const t: Table = { cells: at.table.cells.map((r) => [...r]), aligns: [...at.table.aligns] };
  const n = t.aligns.length;
  const empty = () => Array(n).fill('') as string[];
  let { row, col } = at;
  switch (op) {
    case 'rowBelow': t.cells.splice(row + 1, 0, empty()); row = Math.min(row + 1, t.cells.length - 1); break;
    case 'rowAbove': t.cells.splice(Math.max(1, row), 0, empty()); row = Math.max(1, row); break;
    case 'colRight': t.aligns.splice(col + 1, 0, 'left'); t.cells.forEach((r, i) => r.splice(col + 1, 0, i === 0 ? `Kolom ${r.length + 1}` : '')); col++; break;
    case 'colLeft': t.aligns.splice(col, 0, 'left'); t.cells.forEach((r, i) => r.splice(col, 0, i === 0 ? `Kolom ${r.length + 1}` : '')); break;
    case 'delRow': if (row === 0 || t.cells.length <= 2) return null; t.cells.splice(row, 1); row = Math.min(row, t.cells.length - 1); break;
    case 'delCol': if (n <= 1) return null; t.aligns.splice(col, 1); t.cells.forEach((r) => r.splice(col, 1)); col = Math.min(col, t.aligns.length - 1); break;
    case 'alignLeft': t.aligns[col] = 'left'; break;
    case 'alignCenter': t.aligns[col] = 'center'; break;
    case 'alignRight': t.aligns[col] = 'right'; break;
    case 'delTable': return { changes: [{ from: at.start, to: Math.min(text.length, at.end + 1), insert: '' }], from: at.start, to: at.start };
    case 'format': break;
  }
  const out = formatTable(t);
  const lines = out.join('\n');
  // kursor ke sel (row,col)
  const lineIdx = row === 0 ? 0 : row + 1;
  let off = 0;
  for (let i = 0; i < lineIdx; i++) off += out[i].length + 1;
  const lt = out[lineIdx];
  let bars = 0, p = 0;
  for (; p < lt.length; p++) { if (lt[p] === '|' && lt[p - 1] !== '\\') { if (bars === col) break; bars++; } }
  const cs = Math.min(lt.length, p + 2);
  return { changes: [{ from: at.start, to: at.end, insert: lines }], from: at.start + off + cs, to: at.start + off + cs };
}

/** Tab / Shift+Tab di dalam tabel: sel berikutnya (Tab di sel terakhir menambah baris). */
export function tableTab(text: string, pos: number, dir: 1 | -1): Result | null {
  const at = tableAt(text, pos);
  if (!at) return null;
  const n = at.table.aligns.length;
  let { row, col } = at;
  const rows = at.table.cells.length;
  col += dir;
  if (col >= n) { col = 0; row++; }
  if (col < 0) { col = n - 1; row--; }
  if (row < 0) return { changes: [], from: pos, to: pos };
  if (row >= rows) {
    const r = tableOp(text, pos, 'rowBelow');
    if (!r) return null;
    // setelah baris baru: pindah ke kolom pertama baris itu
    const next = applyChanges(text, r.changes);
    const t2 = tableAt(next, r.from);
    if (!t2) return r;
    const o = cellStart(next, t2, t2.row, 0);
    return { changes: r.changes, from: o, to: o };
  }
  const formatted = tableOp(text, pos, 'format');
  if (!formatted) return null;
  const next = applyChanges(text, formatted.changes);
  const t2 = tableAt(next, formatted.from);
  if (!t2) return formatted;
  const o = cellStart(next, t2, row, col);
  return { changes: formatted.changes, from: o, to: o };
}

function cellStart(text: string, t: TableAt, row: number, col: number): number {
  const all = linesIn(text, 0, text.length);
  const li = t.first + (row === 0 ? 0 : row + 1);
  const l = all[li];
  let bars = 0, p = 0;
  for (; p < l.text.length; p++) { if (l.text[p] === '|' && l.text[p - 1] !== '\\') { if (bars === col) break; bars++; } }
  return l.start + Math.min(l.text.length, p + 2);
}

/* ── catatan kaki ──────────────────────────────────────────────────────────────────────── */
const FN_DEF = /^\[\^([^\]\s]+)\]:\s?/;
const FN_REF = /\[\^([^\]\s]+)\](?!:)/g;

/** Nomor tampilan catatan kaki: urutan kemunculan referensi pertama. */
export function footnoteIndex(text: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const line of text.split('\n')) {
    if (FN_DEF.test(line)) continue;
    for (const m of line.matchAll(FN_REF)) if (!map.has(m[1])) map.set(m[1], map.size + 1);
  }
  return map;
}

export const isFootnoteDef = (line: string) => FN_DEF.test(line);
export const footnoteDefId = (line: string) => FN_DEF.exec(line)?.[1] ?? null;

/** Sisipkan [^n] di posisi `to` dan buat definisinya di akhir dokumen; kursor langsung di isi catatan. */
export function insertFootnote(text: string, from: number, to: number): Result {
  const used = new Set<string>();
  for (const m of text.matchAll(/\[\^([^\]\s]+)\]/g)) used.add(m[1]);
  let n = 1;
  while (used.has(String(n))) n++;
  const id = String(n);
  // definisi baru: tepat setelah definisi terakhir bila definisi ada di akhir dokumen, selain itu di akhir (dipisah baris kosong)
  let end = text.length;
  while (end > 0 && /\s/.test(text[end - 1])) end--;
  const tail = text.slice(0, end).split('\n').pop() ?? '';
  const lastIsDef = isFootnoteDef(tail) || /^\s{2,}\S/.test(tail);
  const sep = end === 0 ? '' : lastIsDef ? '\n' : '\n\n';
  const defIns = `${sep}[^${id}]: `;
  const ref = `[^${id}]`;
  const merged: Change[] = to >= end
    ? [{ from: end, to: text.length, insert: ref + defIns }]
    : [{ from: to, to, insert: ref }, { from: end, to: text.length, insert: defIns }];
  const sel = mapPos(merged, text.length, 1);
  return { changes: merged, from: sel, to: sel };
}

/** Posisi awal isi sel (row,col) pada tabel yang memuat `pos` (row 0 = header). */
export function cellPos(text: string, pos: number, row: number, col: number): number | null {
  const at = tableAt(text, pos);
  if (!at) return null;
  return cellStart(text, at, Math.min(row, at.table.cells.length - 1), Math.min(col, at.table.aligns.length - 1));
}

/* ── pintu tunggal: dipakai toolbar, menu klik kanan, dan pintasan ─────────────────────── */
export const TABLE_OPS: TableOp[] = ['rowBelow', 'rowAbove', 'colRight', 'colLeft', 'delRow', 'delCol', 'alignLeft', 'alignCenter', 'alignRight', 'delTable', 'format'];

/** op: bold|italic|underline|strike|code|sup|sub|clear|link|hr|codeblock|footnote|quote|bullet|number|task|indent|outdent|renumber
 *      | h:0-6 | color:#hex|none | hl:#hex|none | align:left|center|right|justify | table:RxC | tbl:<TableOp> */
export function applyFormat(text: string, from: number, to: number, op: string): Result | null {
  const [k, arg = ''] = op.split(':') as [string, string?];
  switch (k) {
    case 'bold': return toggleWrap(text, from, to, '**');
    case 'italic': return toggleWrap(text, from, to, '*');
    case 'underline': return toggleWrap(text, from, to, '<u>', '</u>');
    case 'strike': return toggleWrap(text, from, to, '~~');
    case 'code': return toggleWrap(text, from, to, '`');
    case 'sup': return toggleWrap(text, from, to, '<sup>', '</sup>');
    case 'sub': return toggleWrap(text, from, to, '<sub>', '</sub>');
    case 'clear': return clearFormat(text, from, to);
    case 'link': return insertLinkAt(text, from, to);
    case 'hr': return insertHr(text, to);
    case 'codeblock': return insertCodeBlock(text, to);
    case 'footnote': return insertFootnote(text, from, to);
    case 'quote': case 'bullet': case 'number': case 'task': return toggleList(text, from, to, k);
    case 'indent': return indentLines(text, from, to, 1);
    case 'outdent': return indentLines(text, from, to, -1);
    case 'renumber': return renumber(text, from, to);
    case 'h': return setHeading(text, from, to, Number(arg) || 0);
    case 'color': return setTextColor(text, from, to, arg === 'none' ? null : arg);
    case 'hl': return setHighlight(text, from, to, arg === 'none' ? null : arg);
    case 'align': return ['left', 'center', 'right', 'justify'].includes(arg) ? setAlign(text, from, to, arg as Align) : null;
    case 'table': { const m = /^(\d+)x(\d+)$/.exec(arg); return m ? insertTable(text, to, Math.min(30, Number(m[1])), Math.min(12, Number(m[2]))) : null; }
    case 'tbl': return (TABLE_OPS as string[]).includes(arg) ? tableOp(text, from, arg as TableOp) : null;
    default: return null;
  }
}
