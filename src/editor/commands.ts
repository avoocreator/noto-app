import { EditorSelection, type StateCommand } from '@codemirror/state';
import { keymap, type EditorView } from '@codemirror/view';
import { toggleTaskLine } from '../lib/tasks.ts';

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
  { key: 'Mod-b', run: wrapWith('**') },
  { key: 'Mod-i', run: wrapWith('*') },
  { key: 'Mod-e', run: wrapWith('`') },
  { key: 'Mod-Shift-x', run: wrapWith('~~') },
  { key: 'Mod-Shift-h', run: wrapWith('==') },
  { key: 'Mod-k', run: insertLink },
  { key: 'Mod-Enter', run: toggleTask },
  { key: 'Enter', run: continueList },
]);

export function focusEnd(view: EditorView) {
  view.focus();
  view.dispatch({ selection: { anchor: view.state.doc.length }, scrollIntoView: true });
}
