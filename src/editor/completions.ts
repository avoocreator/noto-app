import { autocompletion, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import type { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { basename, stripExt, type Heading, type NoteMeta } from '../lib/analyze.ts';
import { formatDate } from '../lib/template.ts';

export interface CompletionHost {
  notes(): NoteMeta[];
  headingsOf(target: string): Heading[];
  tags(): string[];
}

interface SlashItem {
  label: string;
  detail: string;
  keywords: string;
  /** teks yang disisipkan; `|` = posisi kursor */
  text: string | (() => string);
}

const callout = (t: string) => `> [!${t}] |\n> `;

const SLASH: SlashItem[] = [
  { label: 'Judul 1', detail: '#', keywords: 'h1 heading judul besar', text: '# |' },
  { label: 'Judul 2', detail: '##', keywords: 'h2 heading judul', text: '## |' },
  { label: 'Judul 3', detail: '###', keywords: 'h3 heading subjudul', text: '### |' },
  { label: 'Tugas', detail: '- [ ]', keywords: 'todo task centang checklist', text: '- [ ] |' },
  { label: 'Tugas + tanggal', detail: '📅', keywords: 'todo deadline tenggat', text: () => `- [ ] | 📅 ${formatDate(new Date(), 'YYYY')}-${formatDate(new Date(), 'MM')}-${formatDate(new Date(), 'DD')}` },
  { label: 'Daftar poin', detail: '-', keywords: 'bullet list daftar', text: '- |' },
  { label: 'Daftar angka', detail: '1.', keywords: 'number ordered list', text: '1. |' },
  { label: 'Kutipan', detail: '>', keywords: 'quote kutip', text: '> |' },
  { label: 'Callout: info', detail: '> [!info]', keywords: 'callout info catatan', text: callout('info') },
  { label: 'Callout: tip', detail: '> [!tip]', keywords: 'callout tip saran', text: callout('tip') },
  { label: 'Callout: peringatan', detail: '> [!warning]', keywords: 'callout warning awas', text: callout('warning') },
  { label: 'Callout: penting', detail: '> [!important]', keywords: 'callout important', text: callout('important') },
  { label: 'Blok kode', detail: '```', keywords: 'code kode', text: '```\n|\n```' },
  { label: 'Tabel', detail: '| a | b |', keywords: 'table tabel', text: '| Kolom 1 | Kolom 2 |\n| --- | --- |\n| | |' },
  { label: 'Garis pemisah', detail: '---', keywords: 'hr divider garis', text: '---\n|' },
  { label: 'Tautan catatan', detail: '[[ ]]', keywords: 'link wikilink tautan', text: '[[|]]' },
  { label: 'Sematkan catatan', detail: '![[ ]]', keywords: 'embed sematkan transklusi gambar', text: '![[|]]' },
  { label: 'Tanggal hari ini', detail: 'YYYY-MM-DD', keywords: 'date tanggal', text: () => formatDate(new Date(), 'YYYY-MM-DD') },
  { label: 'Waktu sekarang', detail: 'HH:mm', keywords: 'time jam waktu', text: () => formatDate(new Date(), 'HH:mm') },
  { label: 'Stabilo', detail: '==teks==', keywords: 'highlight stabilo', text: '==|==' },
];

function insertAt(view: EditorView, from: number, to: number, raw: string) {
  const i = raw.indexOf('|');
  const text = i === -1 ? raw : raw.slice(0, i) + raw.slice(i + 1);
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + (i === -1 ? text.length : i) },
    userEvent: 'input.complete',
  });
}

function slashSource(ctx: CompletionContext): CompletionResult | null {
  const m = ctx.matchBefore(/^\s*\/[^\s/]*$/);
  if (!m) return null;
  const slash = m.from + m.text.indexOf('/');
  const q = ctx.state.sliceDoc(slash + 1, ctx.pos).toLowerCase();
  const items = SLASH.filter((s) => !q || (s.label + ' ' + s.keywords).toLowerCase().includes(q));
  if (!items.length) return null;
  const options: Completion[] = items.map((s, i) => ({
    label: s.label,
    detail: s.detail,
    type: 'keyword',
    boost: -i, // pertahankan urutan daftar
    apply: (view, _c, _from, to) => insertAt(view, slash, to, typeof s.text === 'function' ? s.text() : s.text),
  }));
  // filter:false → kita sudah menyaring sendiri (termasuk kata kunci), sumber dipanggil ulang tiap ketikan
  return { from: slash + 1, options, filter: false };
}

function wikiSource(host: CompletionHost) {
  return (ctx: CompletionContext): CompletionResult | null => {
    const m = ctx.matchBefore(/\[\[[^\]\n]*$/);
    if (!m) return null;
    const typed = m.text.slice(2);
    const hash = typed.indexOf('#');
    const closing = (view: EditorView, to: number) => (view.state.sliceDoc(to, to + 2) === ']]' ? 2 : 0);

    if (hash !== -1) {
      const target = typed.slice(0, hash).split('|')[0];
      const heads = host.headingsOf(target);
      if (!heads.length) return null;
      return {
        from: m.from + 2 + hash + 1,
        options: heads.map((h) => ({
          label: h.text,
          detail: 'H' + h.level,
          type: 'text',
          apply: (view: EditorView, _c: Completion, from: number, to: number) => {
            const extra = closing(view, to);
            view.dispatch({ changes: { from, to: to + extra, insert: h.text + ']]' }, selection: { anchor: from + h.text.length + 2 } });
          },
        })),
        validFor: /^[^\]\n|]*$/,
      };
    }

    const seen = new Set<string>();
    const options: Completion[] = [];
    for (const n of [...host.notes()].sort((a, b) => b.mtime - a.mtime)) {
      const name = stripExt(basename(n.path));
      const dup = seen.has(name.toLowerCase());
      seen.add(name.toLowerCase());
      const value = dup ? stripExt(n.path) : name;
      options.push({
        label: n.title === name ? name : `${name}`,
        detail: n.folder || undefined,
        type: 'text',
        apply: (view, _c, from, to) => {
          const extra = closing(view, to);
          view.dispatch({ changes: { from, to: to + extra, insert: value + ']]' }, selection: { anchor: from + value.length + 2 } });
        },
      });
      for (const a of n.aliases) {
        options.push({
          label: a,
          detail: `alias → ${name}`,
          type: 'text',
          apply: (view, _c, from, to) => {
            const extra = closing(view, to);
            const ins = `${value}|${a}]]`;
            view.dispatch({ changes: { from, to: to + extra, insert: ins }, selection: { anchor: from + ins.length } });
          },
        });
      }
    }
    return { from: m.from + 2, options, validFor: /^[^\]\n#]*$/ };
  };
}

function tagSource(host: CompletionHost) {
  return (ctx: CompletionContext): CompletionResult | null => {
    const m = ctx.matchBefore(/(?:^|[\s(])#[\p{L}\p{N}_/-]*$/u);
    if (!m) return null;
    const hashAt = m.from + m.text.indexOf('#');
    if (ctx.state.doc.lineAt(hashAt).text.slice(0, hashAt - ctx.state.doc.lineAt(hashAt).from).trim() === '' && /^#{1,6}\s/.test(ctx.state.doc.lineAt(hashAt).text)) return null;
    return {
      from: hashAt + 1,
      options: host.tags().map((t) => ({ label: t, type: 'keyword' })),
      validFor: /^[\p{L}\p{N}_/-]*$/u,
    };
  };
}

export function completions(host: CompletionHost): Extension {
  return autocompletion({
    override: [slashSource, wikiSource(host), tagSource(host)],
    icons: false,
    activateOnTyping: true,
    maxRenderedOptions: 40,
  });
}
