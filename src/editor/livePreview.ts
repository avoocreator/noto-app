import { EditorSelection, Facet, StateField, type EditorState, type Extension, type Range } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { isImagePath } from '../lib/analyze.ts';
import { cellPos, footnoteIndex, isTableLine, parseTable } from '../lib/format.ts';
import { inlineToHtml } from '../lib/inlineHtml.ts';

export interface PreviewEnv {
  resolve(target: string): string | null;
  /** URL gambar (async) dari nama lampiran di vault */
  imageUrl(name: string): Promise<string | null>;
  isImage(name: string): boolean;
  openLink(target: string, heading?: string): void;
}

export const previewEnv = Facet.define<PreviewEnv, PreviewEnv>({ combine: (v) => v[0] });

class CheckboxWidget extends WidgetType {
  readonly checked: boolean;
  readonly from: number;
  constructor(checked: boolean, from: number) { super(); this.checked = checked; this.from = from; }
  eq(o: CheckboxWidget) { return o.checked === this.checked && o.from === this.from; }
  toDOM(view: EditorView) {
    const el = document.createElement('span');
    el.className = 'cm-check' + (this.checked ? ' is-checked' : '');
    el.setAttribute('role', 'checkbox');
    el.setAttribute('aria-checked', String(this.checked));
    el.innerHTML = this.checked
      ? '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '';
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const line = view.state.doc.lineAt(view.posAtDOM(el));
      const m = /^(\s*[-*+]\s+\[)([ xX])(\])/.exec(line.text);
      if (!m) return;
      const at = line.from + m[1].length;
      view.dispatch({ changes: { from: at, to: at + 1, insert: m[2] === ' ' ? 'x' : ' ' } });
    });
    return el;
  }
  ignoreEvent() { return true; }
}

class BulletWidget extends WidgetType {
  eq() { return true; }
  toDOM() { const s = document.createElement('span'); s.className = 'cm-bullet-dot'; s.textContent = '•'; return s; }
}

class HrWidget extends WidgetType {
  eq() { return true; }
  toDOM() { const s = document.createElement('span'); s.className = 'cm-hr-line'; return s; }
}

class ImageWidget extends WidgetType {
  readonly name: string;
  readonly alt: string;
  readonly env: PreviewEnv;
  readonly width?: number;
  constructor(name: string, alt: string, env: PreviewEnv, width?: number) { super(); this.name = name; this.alt = alt; this.env = env; this.width = width; }
  eq(o: ImageWidget) { return o.name === this.name && o.width === this.width; }
  toDOM() {
    const wrap = document.createElement('span');
    wrap.className = 'cm-image';
    const img = document.createElement('img');
    img.alt = this.alt || this.name;
    img.loading = 'lazy';
    if (this.width) img.style.width = this.width + 'px';
    const direct = /^(https?:|data:|blob:)/i.test(this.name);
    if (direct) img.src = this.name;
    else void this.env.imageUrl(this.name).then((u) => { if (u) img.src = u; else wrap.classList.add('is-missing'); });
    img.addEventListener('error', () => wrap.classList.add('is-missing'));
    wrap.appendChild(img);
    return wrap;
  }
  ignoreEvent() { return false; }
}

class EmbedChip extends WidgetType {
  readonly label: string;
  readonly ok: boolean;
  constructor(label: string, ok: boolean) { super(); this.label = label; this.ok = ok; }
  eq(o: EmbedChip) { return o.label === this.label && o.ok === this.ok; }
  toDOM() {
    const s = document.createElement('span');
    s.className = 'cm-embed-chip' + (this.ok ? '' : ' is-missing');
    s.textContent = '⧉ ' + this.label;
    return s;
  }
}


/* ── tabel, catatan kaki ───────────────────────────────────────────────────────────────── */
const fnCache = new WeakMap<object, Map<string, number>>();
function fnIndex(state: EditorState): Map<string, number> {
  let m = fnCache.get(state.doc);
  if (!m) { m = footnoteIndex(state.doc.toString()); fnCache.set(state.doc, m); }
  return m;
}

class FootnoteRefWidget extends WidgetType {
  readonly id: string;
  readonly label: string;
  constructor(id: string, label: string) { super(); this.id = id; this.label = label; }
  eq(o: FootnoteRefWidget) { return o.id === this.id && o.label === this.label; }
  toDOM() { const s = document.createElement('sup'); s.className = 'cm-fn-ref'; s.dataset.fn = this.id; s.title = 'Ke catatan kaki'; s.textContent = this.label; return s; }
  ignoreEvent() { return false; }
}
class FootnoteLabelWidget extends WidgetType {
  readonly label: string;
  constructor(label: string) { super(); this.label = label; }
  eq(o: FootnoteLabelWidget) { return o.label === this.label; }
  toDOM() { const s = document.createElement('span'); s.className = 'cm-fn-label'; s.textContent = this.label + '.'; return s; }
}

class TableWidget extends WidgetType {
  readonly src: string;
  readonly fns: string;
  private fnMap: Map<string, number>;
  constructor(src: string, fnMap: Map<string, number>) { super(); this.src = src; this.fnMap = fnMap; this.fns = [...fnMap].join(','); }
  eq(o: TableWidget) { return o.src === this.src && o.fns === this.fns; }
  toDOM() {
    const t = parseTable(this.src.split('\n'));
    const wrap = document.createElement('div');
    wrap.className = 'cm-table-wrap';
    if (!t) { wrap.textContent = this.src; return wrap; }
    const table = document.createElement('table');
    table.className = 'cm-table';
    const mkRow = (cells: string[], tag: 'th' | 'td', r: number) => {
      const tr = document.createElement('tr');
      cells.forEach((c, i) => {
        const td = document.createElement(tag);
        td.style.textAlign = t.aligns[i];
        td.dataset.r = String(r); td.dataset.c = String(i);
        td.innerHTML = inlineToHtml(c, { footnotes: this.fnMap }) || '&nbsp;';
        tr.appendChild(td);
      });
      return tr;
    };
    const head = document.createElement('thead'); head.appendChild(mkRow(t.cells[0], 'th', 0));
    const body = document.createElement('tbody'); t.cells.slice(1).forEach((r, i) => body.appendChild(mkRow(r, 'td', i + 1)));
    table.append(head, body);
    wrap.appendChild(table);
    return wrap;
  }
  ignoreEvent() { return false; }
}

/** Tabel yang kursornya tidak di dalamnya digambar sebagai tabel sungguhan; klik → kembali ke teks sumber. */
function tableDecos(state: EditorState): DecorationSet {
  const out: Range<Decoration>[] = [];
  const doc = state.doc;
  const fns = fnIndex(state);
  let fence = false;
  let inFm = false;
  let n = 1;
  while (n <= doc.lines) {
    const t = doc.line(n).text;
    if (n === 1 && /^---\s*$/.test(t)) { inFm = true; n++; continue; }
    if (inFm) { if (/^---\s*$/.test(t)) inFm = false; n++; continue; }
    if (/^\s*(```|~~~)/.test(t)) { fence = !fence; n++; continue; }
    if (fence || !isTableLine(t)) { n++; continue; }
    let e = n;
    while (e < doc.lines && isTableLine(doc.line(e + 1).text)) e++;
    const from = doc.line(n).from, to = doc.line(e).to;
    const lines: string[] = [];
    for (let i = n; i <= e; i++) lines.push(doc.line(i).text);
    if (parseTable(lines)) {
      const touched = state.selection.ranges.some((r) => r.from <= to && r.to >= from);
      if (!touched) out.push(Decoration.replace({ widget: new TableWidget(lines.join('\n'), fns), block: true }).range(from, to));
    }
    n = e + 1;
  }
  return Decoration.set(out, true);
}

const tableField = StateField.define<DecorationSet>({
  create: tableDecos,
  update(deco, tr) { return tr.docChanged || tr.selection ? tableDecos(tr.state) : deco; },
  provide: (f) => EditorView.decorations.from(f),
});

const hide = Decoration.replace({});
const mk = (cls: string, attrs?: Record<string, string>) => Decoration.mark({ class: cls, attributes: attrs });
const line = (cls: string) => Decoration.line({ class: cls });

interface Taken { from: number; to: number }

function build(view: EditorView, hideMarkers: boolean): DecorationSet {
  const { state } = view;
  const env = state.facet(previewEnv);
  const out: Range<Decoration>[] = [];
  const active = new Set<number>();
  for (const r of state.selection.ranges) {
    const a = state.doc.lineAt(r.from).number;
    const b = state.doc.lineAt(r.to).number;
    for (let n = a; n <= b; n++) active.add(n);
  }
  const focused = view.hasFocus;

  // status fence & frontmatter dihitung sekali per build
  let fence: string | null = null;
  let inFm = false;
  const fenceState: ('none' | 'open' | 'body' | 'close')[] = [];
  const fmState: boolean[] = [];
  for (let n = 1; n <= state.doc.lines; n++) {
    const t = state.doc.line(n).text;
    if (n === 1 && /^---\s*$/.test(t)) { inFm = true; fmState[n] = true; fenceState[n] = 'none'; continue; }
    if (inFm) {
      fmState[n] = true;
      fenceState[n] = 'none';
      if (/^---\s*$/.test(t)) inFm = false;
      continue;
    }
    const f = /^\s*(```|~~~)/.exec(t);
    if (fence === null && f) { fence = f[1]; fenceState[n] = 'open'; }
    else if (fence !== null && f && f[1] === fence) { fence = null; fenceState[n] = 'close'; }
    else fenceState[n] = fence !== null ? 'body' : 'none';
  }

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const ln = state.doc.lineAt(pos);
      pos = ln.to + 1;
      const n = ln.number;
      const text = ln.text;
      const isActive = focused && active.has(n);
      const concealed = hideMarkers && !isActive;

      if (fmState[n]) { out.push(line('cm-fm').range(ln.from)); continue; }
      const fs = fenceState[n];
      if (fs !== 'none') {
        out.push(line('cm-codeline' + (fs === 'open' ? ' cm-codeline-first' : fs === 'close' ? ' cm-codeline-last' : '')).range(ln.from));
        if (fs !== 'body') out.push(mk('cm-fence-mark').range(ln.from, Math.max(ln.from + 1, ln.to)));
        continue;
      }
      if (text.length === 0) continue;

      const taken: Taken[] = [];
      const free = (a: number, b: number) => !taken.some((t) => a < t.to && b > t.from);
      const claim = (a: number, b: number) => taken.push({ from: a, to: b });
      const replace = (a: number, b: number, d: Decoration = hide) => {
        if (b > a && free(a, b)) { out.push(d.range(ln.from + a, ln.from + b)); claim(a, b); }
      };

      // kode inline dulu agar isinya tidak diproses
      for (const m of text.matchAll(/`([^`\n]+)`/g)) {
        const a = m.index!;
        const b = a + m[0].length;
        out.push(mk('cm-code').range(ln.from + a, ln.from + b));
        if (concealed) { replace(a, a + 1); replace(b - 1, b); }
        claim(a, b);
      }

      // baris tabel (saat tampil sebagai teks sumber)
      if (isTableLine(text)) out.push(line('cm-tbl-src').range(ln.from));

      // catatan kaki: definisi "[^id]: isi"
      const fns = fnIndex(state);
      const fd = /^\[\^([^\]\s]+)\]:\s?/.exec(text);
      if (fd) {
        const prevDef = n > 1 && /^\[\^[^\]\s]+\]:/.test(state.doc.line(n - 1).text);
        out.push(line('cm-fn-def' + (prevDef ? '' : ' cm-fn-first')).range(ln.from));
        if (concealed) replace(0, fd[0].length, Decoration.replace({ widget: new FootnoteLabelWidget(String(fns.get(fd[1]) ?? fd[1])) }));
        else { out.push(mk('cm-md-mark').range(ln.from, ln.from + fd[0].length)); claim(0, fd[0].length); }
      }

      // rata teks (komentar di ujung baris)
      const al = /\s*<!--\s*align:(center|right|justify)\s*-->\s*$/.exec(text);
      if (al) {
        out.push(line('cm-align-' + al[1]).range(ln.from));
        if (concealed) replace(al.index, text.length);
        else { out.push(mk('cm-md-mark').range(ln.from + al.index, ln.to)); claim(al.index, text.length); }
      }

      // blok
      let m: RegExpExecArray | null;
      if ((m = /^(#{1,6})(\s+)/.exec(text))) {
        out.push(line(`cm-h cm-h${m[1].length}`).range(ln.from));
        if (concealed) replace(0, m[0].length);
        else out.push(mk('cm-md-mark').range(ln.from, ln.from + m[1].length));
      } else if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(text)) {
        if (concealed) { out.push(Decoration.replace({ widget: new HrWidget() }).range(ln.from, ln.to)); continue; }
        out.push(mk('cm-md-mark').range(ln.from, ln.to));
      } else if ((m = /^(\s*)(>+)\s?/.exec(text))) {
        const callout = /^\s*>+\s*\[!([\w-]+)\]([+-]?)\s*(.*)$/.exec(text);
        if (callout) {
          out.push(line(`cm-quote cm-callout cm-callout-${callout[1].toLowerCase()} cm-callout-head`).range(ln.from));
          const s = text.indexOf('[!');
          out.push(mk('cm-callout-tag').range(ln.from + s, ln.from + s + callout[1].length + 3));
        } else {
          out.push(line('cm-quote').range(ln.from));
        }
        if (concealed) replace(m[1].length, m[0].length);
        else out.push(mk('cm-md-mark').range(ln.from + m[1].length, ln.from + m[0].length));
      } else if ((m = /^(\s*)([-*+])(\s+)\[([ xX])\](\s)/.exec(text))) {
        const done = m[4] !== ' ';
        const indent = m[1].replace(/\t/g, '    ').length;
        out.push(line('cm-task' + (done ? ' cm-task-done' : '')).range(ln.from));
        out.push(Decoration.line({ attributes: { style: `--indent:${indent}` } }).range(ln.from));
        if (concealed) {
          const a = m[1].length;
          const b = m[0].length;
          out.push(Decoration.replace({ widget: new CheckboxWidget(done, ln.from) }).range(ln.from + a, ln.from + b));
          claim(a, b);
        } else out.push(mk('cm-md-mark').range(ln.from + m[1].length, ln.from + m[0].length));
      } else if ((m = /^(\s*)([-*+]|\d+[.)])(\s+)/.exec(text))) {
        const indent = m[1].replace(/\t/g, '    ').length;
        out.push(Decoration.line({ attributes: { class: 'cm-li', style: `--indent:${indent}` } }).range(ln.from));
        const a = m[1].length;
        if (concealed && /^[-*+]$/.test(m[2])) {
          out.push(Decoration.replace({ widget: new BulletWidget() }).range(ln.from + a, ln.from + a + m[2].length));
          claim(a, a + m[2].length);
        } else out.push(mk('cm-md-mark cm-li-mark').range(ln.from + a, ln.from + a + m[2].length));
      }

      // gambar & embed: ![[x]] dan ![alt](src)
      for (const e of text.matchAll(/!\[\[([^\]|#]+?)(?:\|([^\]]*))?\]\]/g)) {
        const a = e.index!;
        const b = a + e[0].length;
        if (!free(a, b)) continue;
        const name = e[1].trim();
        if (isImagePath(name) || env.isImage(name)) {
          const w = e[2] && /^\d+$/.test(e[2]) ? Number(e[2]) : undefined;
          if (concealed) { replace(a, b, Decoration.replace({ widget: new ImageWidget(name, e[2] ?? '', env, w) })); continue; }
          out.push(mk('cm-embed-src').range(ln.from + a, ln.from + b));
          claim(a, b);
        } else {
          const ok = env.resolve(name) !== null;
          if (concealed) { replace(a, b, Decoration.replace({ widget: new EmbedChip(name, ok) })); continue; }
          out.push(mk('cm-embed-src').range(ln.from + a, ln.from + b));
          claim(a, b);
        }
      }
      for (const e of text.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
        const a = e.index!;
        const b = a + e[0].length;
        if (!free(a, b)) continue;
        if (concealed) replace(a, b, Decoration.replace({ widget: new ImageWidget(decodeURI(e[2]), e[1], env) }));
        else { out.push(mk('cm-embed-src').range(ln.from + a, ln.from + b)); claim(a, b); }
      }

      // wikilink
      for (const w of text.matchAll(/\[\[([^\[\]|#\n]+?)(?:#([^\[\]|\n]+?))?(?:\|([^\[\]\n]+?))?\]\]/g)) {
        const a = w.index!;
        const b = a + w[0].length;
        if (!free(a, b)) continue;
        const target = w[1].trim();
        const missing = env.resolve(target) === null;
        const attrs = { 'data-target': target, ...(w[2] ? { 'data-heading': w[2] } : {}) };
        const alias = w[3];
        if (concealed) {
          // tampilkan hanya alias, atau nama (+ #judul)
          const shownFrom = alias ? a + w[0].lastIndexOf('|') + 1 : a + 2;
          out.push(mk('cm-wikilink' + (missing ? ' is-missing' : ''), attrs).range(ln.from + shownFrom, ln.from + b - 2));
          replace(a, shownFrom);
          replace(b - 2, b);
        } else {
          out.push(mk('cm-wikilink cm-wikilink-raw' + (missing ? ' is-missing' : ''), attrs).range(ln.from + a, ln.from + b));
        }
        claim(a, b);
      }

      // tautan [teks](url)
      for (const l of text.matchAll(/(?<!!)\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
        const a = l.index!;
        const b = a + l[0].length;
        if (!free(a, b)) continue;
        const textEnd = a + 1 + l[1].length;
        out.push(mk('cm-link', { 'data-url': l[2] }).range(ln.from + a + 1, ln.from + textEnd));
        if (concealed) { replace(a, a + 1); replace(textEnd, b); }
        claim(a, b);
      }

      // referensi catatan kaki [^id]
      for (const r of text.matchAll(/\[\^([^\]\s]+)\](?!:)/g)) {
        const a = r.index!;
        const b = a + r[0].length;
        if (!free(a, b)) continue;
        if (concealed) replace(a, b, Decoration.replace({ widget: new FootnoteRefWidget(r[1], String(fns.get(r[1]) ?? r[1])) }));
        else { out.push(mk('cm-fn-ref-src', { 'data-fn': r[1] }).range(ln.from + a, ln.from + b)); claim(a, b); }
      }

      // HTML terbatas buatan Noto: warna teks, stabilo berwarna, garis bawah, superskrip, subskrip
      const tags: [RegExp, (m: RegExpExecArray) => Decoration][] = [
        [/<span style="color:\s*(#[0-9a-fA-F]{3,8})\s*">(.*?)<\/span>/g, (t) => mk('cm-color', { style: `color:${t[1]}` })],
        [/<mark style="background:\s*(#[0-9a-fA-F]{3,8})\s*">(.*?)<\/mark>/g, (t) => mk('cm-mark cm-hl', { style: `background:${t[1]}` })],
        [/<u>(.*?)<\/u>/g, () => mk('cm-underline')],
        [/<sup>(.*?)<\/sup>/g, () => mk('cm-sup')],
        [/<sub>(.*?)<\/sub>/g, () => mk('cm-sub')],
      ];
      for (const [re, deco] of tags) {
        for (const t of text.matchAll(re)) {
          const a = t.index!;
          const b = a + t[0].length;
          const open = t[0].indexOf('>') + 1;
          const close = t[0].length - t[0].lastIndexOf('<');
          if (!free(a, a + open) || !free(b - close, b)) continue;
          out.push(deco(t).range(ln.from + a + open, ln.from + b - close));
          if (concealed) { replace(a, a + open); replace(b - close, b); }
          else { out.push(mk('cm-md-mark').range(ln.from + a, ln.from + a + open)); out.push(mk('cm-md-mark').range(ln.from + b - close, ln.from + b)); }
        }
      }

      // gaya inline
      const inline: [RegExp, string, number][] = [
        [/\*\*([^*\n]+?)\*\*/g, 'cm-bold', 2],
        [/__([^_\n]+?)__/g, 'cm-bold', 2],
        [/~~([^~\n]+?)~~/g, 'cm-strike', 2],
        [/==([^=\n]+?)==/g, 'cm-mark', 2],
        [/(?<![*\w])\*([^*\s][^*\n]*?)\*(?![*\w])/g, 'cm-italic', 1],
        [/(?<![_\w])_([^_\s][^_\n]*?)_(?![_\w])/g, 'cm-italic', 1],
      ];
      for (const [re, cls, k] of inline) {
        for (const t of text.matchAll(re)) {
          const a = t.index!;
          const b = a + t[0].length;
          if (!free(a, a + k) || !free(b - k, b)) continue;
          out.push(mk(cls).range(ln.from + a, ln.from + b));
          if (concealed) { replace(a, a + k); replace(b - k, b); }
          else { out.push(mk('cm-md-mark').range(ln.from + a, ln.from + a + k)); out.push(mk('cm-md-mark').range(ln.from + b - k, ln.from + b)); }
        }
      }

      // tag
      for (const t of text.matchAll(/(?<=^|[\s(])#([\p{L}\p{N}_/-]*[\p{L}_/-][\p{L}\p{N}_/-]*)/gu)) {
        const a = t.index!;
        const b = a + t[0].length;
        if (!free(a, b) || /^#{1,6}\s/.test(text)) continue;
        out.push(mk('cm-tag', { 'data-tag': t[1] }).range(ln.from + a, ln.from + b));
      }
      // properti inline (?) — tidak dipakai
    }
  }
  return Decoration.set(out, true);
}

export function livePreview(hideMarkers: boolean): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) { this.decorations = build(view, hideMarkers); }
      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged || u.selectionSet || u.focusChanged) this.decorations = build(u.view, hideMarkers);
      }
    },
    {
      decorations: (v) => v.decorations,
      provide: (p) => EditorView.atomicRanges.of((view) => view.plugin(p)?.decorations ?? Decoration.none),
      eventHandlers: {
        mousedown(e, view) {
          const tgt = e.target as HTMLElement;
          // klik sel tabel → tampilkan teks sumber dengan kursor di sel itu
          const cell = tgt.closest('.cm-table td, .cm-table th') as HTMLElement | null;
          if (cell && !tgt.closest('.cm-wikilink, a')) {
            const wrapEl = cell.closest('.cm-table-wrap') as HTMLElement;
            const start = view.posAtDOM(wrapEl);
            const p = cellPos(view.state.doc.toString(), start, Number(cell.dataset.r), Number(cell.dataset.c));
            if (p !== null) { e.preventDefault(); view.dispatch({ selection: EditorSelection.cursor(p), scrollIntoView: true }); view.focus(); return true; }
          }
          // klik angka catatan kaki → lompat ke definisinya (dan sebaliknya)
          const fnEl = tgt.closest('.cm-fn-ref, .cm-fn-ref-src') as HTMLElement | null;
          if (fnEl && (fnEl.classList.contains('cm-fn-ref') || e.ctrlKey || e.metaKey)) {
            const id = fnEl.dataset.fn!;
            const doc = view.state.doc;
            for (let i = 1; i <= doc.lines; i++) {
              if (doc.line(i).text.startsWith(`[^${id}]:`)) {
                e.preventDefault();
                const l = doc.line(i);
                view.dispatch({ selection: EditorSelection.cursor(l.to), effects: EditorView.scrollIntoView(l.from, { y: 'center' }) });
                view.focus();
                return true;
              }
            }
          }
          const el = tgt.closest('.cm-wikilink, .cm-link, .cm-tag') as HTMLElement | null;
          if (!el) return false;
          const pos = view.posAtDOM(el);
          const sameLine = view.state.doc.lineAt(pos).number === view.state.doc.lineAt(view.state.selection.main.head).number;
          const hardClick = e.ctrlKey || e.metaKey || e.altKey;
          if (sameLine && !hardClick && view.hasFocus) return false;
          const env = view.state.facet(previewEnv);
          if (el.classList.contains('cm-wikilink')) {
            e.preventDefault();
            env.openLink(el.dataset.target ?? '', el.dataset.heading);
            return true;
          }
          if (el.classList.contains('cm-link')) {
            const url = el.dataset.url ?? '';
            if (/^https?:/i.test(url)) { e.preventDefault(); window.open(url, '_blank', 'noopener'); return true; }
            return false;
          }
          if (el.classList.contains('cm-tag')) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('noto:search', { detail: `tag:${el.dataset.tag}` }));
            return true;
          }
          return false;
        },
      },
    },
  );
  return hideMarkers ? [plugin, tableField] : plugin;
}
