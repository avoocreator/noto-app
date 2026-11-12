import { EditorSelection, type StateCommand } from '@codemirror/state';
import { keymap, type EditorView } from '@codemirror/view';
import { toggleTaskLine } from '../lib/tasks.ts';
import { applyFormat, tableTab } from '../lib/format.ts';

/** Perintah format berbasis lib/format (satu pintu dengan toolbar & klik kanan). */
export const fmt = (op: string): StateCommand => ({ state, dispatch }) => {
  const { from, to } = state.selection.main;
  const r = applyFormat(state.doc.toString(), from, to, op);
  if (!r) return false;
  dispatch(state.update({ changes: r.changes, selection: EditorSelection.range(r.from, r.to), scrollIntoView: true, userEvent: 'input.format' }));
  return true;
};

/** Tab / Shift+Tab di dalam tabel pindah antar sel; di luar tabel diteruskan ke perintah lain. */
const tableTabCmd = (dir: 1 | -1): StateCommand => ({ state, dispatch }) => {
  const r = tableTab(state.doc.toString(), state.selection.main.head, dir);
  if (!r) return false;
  dispatch(state.update({ changes: r.changes, selection: EditorSelection.range(r.from, r.to), scrollIntoView: true, userEvent: 'input.format' }));
  return true;
};

/** Bungkus/lepas penanda di sekitar seleksi (atau kata di bawah kursor). */
export function wrapWith(mark: string): StateCommand {
  return ({ state, dispatch }) => {
    const tr = state.changeByRange((range) => {
      let { from, to } = range;
      if (range.empty) {
        const w = state.wordAt(range.head);
        if (w) { from = w.from; to = w.to; }
      }
      const before = state.sliceDoc(Math.max(0, from - mark.length), from);
      const after = state.sliceDoc(to, to + mark.length);
      if (before === mark && after === mark) {
        return {
          changes: [{ from: from - mark.length, to: from }, { from: to, to: to + mark.length }],
          range: EditorSelection.range(from - mark.length, to - mark.length),
        };
      }
      return {
        changes: [{ from, insert: mark }, { from: to, insert: mark }],
        range: range.empty && from === to
          ? EditorSelection.cursor(from + mark.length)
          : EditorSelection.range(from + mark.length, to + mark.length),
      };
    });
    dispatch(state.update(tr, { scrollIntoView: true, userEvent: 'input' }));
    return true;
  };
}

export const insertLink: StateCommand = ({ state, dispatch }) => {
  const r = state.selection.main;
  const text = state.sliceDoc(r.from, r.to);
  const ins = `[${text}](url)`;
  dispatch(state.update({
    changes: { from: r.from, to: r.to, insert: ins },
    selection: EditorSelection.range(r.from + text.length + 3, r.from + text.length + 6),
    userEvent: 'input',
  }));
  return true;
};

/** Ctrl+Enter: centang/batalkan tugas di baris ini (tugas berulang menambah baris berikutnya). Bukan tugas → ubah jadi tugas. */
export const toggleTask: StateCommand = ({ state, dispatch }) => {
  const line = state.doc.lineAt(state.selection.main.head);
  const r = toggleTaskLine(line.text);
  if (r) {
    dispatch(state.update({
      changes: { from: line.from, to: line.to, insert: r.line + (r.extra ? '\n' + r.extra : '') },
      userEvent: 'input',
    }));
    return true;
  }
  const m = /^(\s*)([-*+]\s+)?/.exec(line.text)!;
  dispatch(state.update({
    changes: { from: line.from + m[1].length, to: line.from + m[0].length, insert: '- [ ] ' },
    userEvent: 'input',
  }));
  return true;
};

/** Enter di dalam daftar: lanjutkan poin/tugas berikutnya; baris poin kosong → akhiri daftar. */
export const continueList: StateCommand = ({ state, dispatch }) => {
  const r = state.selection.main;
  if (!r.empty) return false;
  const line = state.doc.lineAt(r.head);
  const m = /^(\s*)([-*+]|\d+[.)])(\s+)(\[[ xX]\]\s+)?(.*)$/.exec(line.text);
  if (!m || r.head < line.from + (m[0].length - m[5].length)) return false;
  if (m[5].trim() === '') {
    dispatch(state.update({ changes: { from: line.from, to: line.to, insert: '' }, selection: { anchor: line.from }, userEvent: 'delete' }));
    return true;
  }
  let marker = m[2];
  const num = /^(\d+)([.)])$/.exec(marker);
  if (num) marker = `${Number(num[1]) + 1}${num[2]}`;
  const ins = `\n${m[1]}${marker}${m[3]}${m[4] ? '[ ] ' : ''}`;
  dispatch(state.update({
    changes: { from: r.head, insert: ins },
    selection: { anchor: r.head + ins.length },
    scrollIntoView: true,
    userEvent: 'input',
  }));
  return true;
};

export const noteKeymap = keymap.of([
  { key: 'Mod-b', run: fmt('bold') },
  { key: 'Mod-i', run: fmt('italic') },
  { key: 'Mod-u', run: fmt('underline') },
  { key: 'Mod-e', run: fmt('code') },
  { key: 'Mod-Shift-x', run: fmt('strike') },
  { key: 'Mod-Shift-h', run: fmt('hl:#ffe066') },
  { key: 'Mod-Shift-7', run: fmt('number') },
  { key: 'Mod-Shift-8', run: fmt('bullet') },
  { key: 'Mod-Alt-0', run: fmt('h:0') },
  { key: 'Mod-Alt-1', run: fmt('h:1') },
  { key: 'Mod-Alt-2', run: fmt('h:2') },
  { key: 'Mod-Alt-3', run: fmt('h:3') },
  { key: 'Mod-Alt-f', run: fmt('footnote') },
  { key: 'Mod-k', run: insertLink },
  { key: 'Mod-Enter', run: toggleTask },
  { key: 'Tab', run: tableTabCmd(1) },
  { key: 'Shift-Tab', run: tableTabCmd(-1) },
  { key: 'Enter', run: continueList },
]);

export function focusEnd(view: EditorView) {
  view.focus();
  view.dispatch({ selection: { anchor: view.state.doc.length }, scrollIntoView: true });
}
