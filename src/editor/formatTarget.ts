import { flushSync } from 'react-dom';
import { EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { applyChanges, applyFormat, tableAt } from '../lib/format.ts';

/** Sasaran perintah format: editor catatan (CodeMirror) atau textarea kartu canvas. */
export interface FormatTarget {
  run(op: string): boolean;
  inTable(): boolean;
  /** teks yang sedang diseleksi ('' bila kosong) */
  selected(): string;
  replaceSelection(text: string): void;
}

export function cmTarget(view: EditorView): FormatTarget {
  return {
    run(op) {
      const { from, to } = view.state.selection.main;
      const r = applyFormat(view.state.doc.toString(), from, to, op);
      if (!r) return false;
      view.dispatch({ changes: r.changes, selection: EditorSelection.range(r.from, r.to), scrollIntoView: true, userEvent: 'input.format' });
      view.focus();
      return true;
    },
    inTable: () => !!tableAt(view.state.doc.toString(), view.state.selection.main.head),
    selected: () => { const r = view.state.selection.main; return view.state.sliceDoc(r.from, r.to); },
    replaceSelection(text) {
      const r = view.state.selection.main;
      view.dispatch({ changes: { from: r.from, to: r.to, insert: text }, selection: { anchor: r.from + text.length }, userEvent: 'input.paste', scrollIntoView: true });
      view.focus();
    },
  };
}

export function textareaTarget(ta: HTMLTextAreaElement, set: (v: string) => void): FormatTarget {
  const put = (next: string, from: number, to: number) => {
    flushSync(() => set(next)); // commit dulu supaya value textarea sudah baru sebelum seleksi diatur
    ta.focus();
    ta.setSelectionRange(from, to);
  };
  return {
    run(op) {
      const r = applyFormat(ta.value, ta.selectionStart, ta.selectionEnd, op);
      if (!r) return false;
      put(applyChanges(ta.value, r.changes), r.from, r.to);
      return true;
    },
    inTable: () => !!tableAt(ta.value, ta.selectionStart),
    selected: () => ta.value.slice(ta.selectionStart, ta.selectionEnd),
    replaceSelection(text) {
      const a = ta.selectionStart;
      put(ta.value.slice(0, a) + text + ta.value.slice(ta.selectionEnd), a + text.length, a + text.length);
    },
  };
}
