import { Facet, type Extension, type Range } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { isImagePath } from '../lib/analyze.ts';

export interface PreviewEnv {
  resolve(target: string): string | null;
  /** URL gambar (async) dari nama lampiran di vault */
  imageUrl(name: string): Promise<string | null>;
  isImage(name: string): boolean;
  openLink(target: string, heading?: string): void;
}

export const previewEnv = Facet.define<PreviewEnv, PreviewEnv>({ combine: (v) => v[0] });

class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean, readonly from: number) { super(); }
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
  constructor(readonly name: string, readonly alt: string, readonly env: PreviewEnv, readonly width?: number) { super(); }
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
  constructor(readonly label: string, readonly ok: boolean) { super(); }
  eq(o: EmbedChip) { return o.label === this.label && o.ok === this.ok; }
  toDOM() {
    const s = document.createElement('span');
    s.className = 'cm-embed-chip' + (this.ok ? '' : ' is-missing');
    s.textContent = '⧉ ' + this.label;
    return s;
  }
}

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
          const el = (e.target as HTMLElement).closest('.cm-wikilink, .cm-link, .cm-tag') as HTMLElement | null;
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
  return plugin;
}
