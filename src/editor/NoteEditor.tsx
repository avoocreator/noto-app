import { useEffect, useRef } from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import { drawSelection, EditorView, keymap, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { livePreview, previewEnv, type PreviewEnv } from './livePreview.ts';
import { completions, type CompletionHost } from './completions.ts';
import { noteKeymap } from './commands.ts';
import { basename, isImagePath } from '../lib/analyze.ts';
import { formatDate } from '../lib/template.ts';
import { useApp } from '../store.ts';

interface Props {
  path: string;
  mode: 'live' | 'source';
  focusOnMount?: boolean;
}

const SAVE_DELAY = 400;

export function NoteEditor({ path, mode, focusOnMount }: Props) {
  const vault = useApp((s) => s.vault)!;
  const openPath = useApp((s) => s.openPath);
  const parent = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const modeComp = useRef(new Compartment());
  const lastSent = useRef('');
  const timer = useRef<number | undefined>(undefined);
  const pendingLine = useApp((s) => s.pendingLine);
  const clearPendingLine = useApp((s) => s.clearPendingLine);

  useEffect(() => {
    if (!parent.current) return;
    const initial = vault.content(path) ?? '';
    lastSent.current = initial;

    const flush = () => {
      if (timer.current !== undefined) { window.clearTimeout(timer.current); timer.current = undefined; }
      const v = viewRef.current;
      if (!v) return;
      const text = v.state.doc.toString();
      if (text !== lastSent.current) {
        lastSent.current = text;
        void vault.write(path, text);
      }
    };

    const env: PreviewEnv = {
      resolve: (t) => vault.resolve(t, path),
      isImage: (n) => isImagePath(n),
      imageUrl: async (n) => {
        const p = vault.resolveAttachment(n);
        return p ? vault.blobUrl(p).catch(() => null) : null;
      },
      openLink: (target, heading) => {
        const p = vault.resolve(target, path);
        if (p) {
          const line = heading ? vault.meta(p)?.headings.find((h) => h.text.toLowerCase() === heading.toLowerCase())?.line : undefined;
          openPath(p, { line });
        } else {
          void vault.createNote({ title: target }).then((np) => openPath(np));
        }
      },
    };

    const host: CompletionHost = {
      notes: () => vault.notes,
      headingsOf: (t) => {
        const p = vault.resolve(t, path);
        return p ? vault.meta(p)?.headings ?? [] : [];
      },
      tags: () => [...vault.index.tags.keys()].sort(),
    };

    const saveImages = async (files: File[], view: EditorView) => {
      for (const f of files) {
        const bytes = new Uint8Array(await f.arrayBuffer());
        const ext = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg');
        const name = f.name && !/^image\.\w+$/i.test(f.name) ? f.name : `Gambar ${formatDate(new Date(), 'YYYYMMDD-HHmmss')}.${ext}`;
        const saved = await vault.saveAttachment(name, bytes);
        const at = view.state.selection.main.head;
        const ins = `![[${basename(saved)}]]\n`;
        view.dispatch({ changes: { from: at, insert: ins }, selection: { anchor: at + ins.length } });
      }
    };

    const state = EditorState.create({
      doc: initial,
      extensions: [
        history(),
        drawSelection(),
        EditorView.lineWrapping,
        markdown({ base: markdownLanguage }),
        placeholder('Mulai menulis… ketik / untuk blok, [[ untuk tautan'),
        previewEnv.of(env),
        modeComp.current.of(livePreview(mode === 'live')),
        completions(host),
        noteKeymap,
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.contentAttributes.of({ spellcheck: 'true', autocapitalize: 'sentences' }),
        EditorView.updateListener.of((u) => {
          if (!u.docChanged) return;
          if (timer.current !== undefined) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(flush, SAVE_DELAY);
        }),
        EditorView.domEventHandlers({
          paste(e, view) {
            const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
            if (!files.length) return false;
            e.preventDefault();
            void saveImages(files, view);
            return true;
          },
          drop(e, view) {
            const files = [...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'));
            if (!files.length) return false;
            e.preventDefault();
            void saveImages(files, view);
            return true;
          },
        }),
      ],
    });

    const view = new EditorView({ state, parent: parent.current });
    viewRef.current = view;
    if (focusOnMount) view.focus();

    // perubahan dari luar (sync, Obsidian, restore versi)
    const off = vault.subscribe(() => {
      const cur = vault.content(path);
      if (cur === undefined || timer.current !== undefined) return;
      if (cur !== lastSent.current && cur !== view.state.doc.toString()) {
        lastSent.current = cur;
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: cur }, userEvent: 'external' });
      }
    });

    const onBlur = () => flush();
    view.contentDOM.addEventListener('blur', onBlur);
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);

    return () => {
      flush();
      off();
      view.contentDOM.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, vault]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: modeComp.current.reconfigure(livePreview(mode === 'live')) });
  }, [mode]);

  useEffect(() => {
    const v = viewRef.current;
    if (!v || !pendingLine || pendingLine.path !== path) return;
    const ln = v.state.doc.line(Math.min(v.state.doc.lines, Math.max(1, pendingLine.line + 1)));
    v.dispatch({ selection: { anchor: ln.from }, effects: EditorView.scrollIntoView(ln.from, { y: 'center' }) });
    v.focus();
    clearPendingLine();
  }, [pendingLine, path, clearPendingLine]);

  return <div className={`editor-host mode-${mode}`} ref={parent} />;
}
