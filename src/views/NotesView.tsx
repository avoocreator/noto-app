import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from '../ui/Icon.tsx';
import { useApp, useVault } from '../store.ts';
import { NoteEditor } from '../editor/NoteEditor.tsx';
import { CanvasEditor } from './CanvasEditor.tsx';
import { basename, isCanvasPath, isNotePath, stripExt } from '../lib/analyze.ts';
import { asStringList, removeProperty, setProperty, type FmValue } from '../lib/frontmatter.ts';
import { relativeTime } from '../lib/dates.ts';
import { changeIcon, copyText, deleteEntry, duplicateEntry, errMsg, newCanvas, newNote, openToday, renameEntry } from '../actions.ts';
import { EntryIcon } from '../ui/IconPicker.tsx';
import { useContextMenu } from '../ui/ContextMenu.tsx';
import { FormatBar } from '../ui/FormatBar.tsx';
import { cmTarget } from '../editor/formatTarget.ts';
import { useLook } from '../editor/look.ts';
import type { EditorView } from '@codemirror/view';
import { ask } from '../ui/dialogs.tsx';

export function NotesView() {
  const vault = useVault();
  const { tabs, active, openPath, closeTab, editorMode, toggleEditorMode, toggleRight, rightOpen } = useApp();
  const ctx = useContextMenu();
  const ribbonOn = useLook((st) => st.ribbon);
  if (!vault) return null;

  const tabsBar = (
    <div className="tabs" role="tablist">
      <AnimatePresence initial={false}>
        {tabs.map((p) => (
          <motion.div
            key={p}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 36 }}
            className={'tab' + (p === active ? ' on' : '')}
            role="tab"
            aria-selected={p === active}
            onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); closeTab(p); } }}
            onContextMenu={(e) => {
              e.preventDefault();
              ctx.open(e.clientX, e.clientY, [
                { label: 'Tutup', icon: 'x', run: () => closeTab(p) },
                { label: 'Tutup tab lain', icon: 'x', run: () => tabs.filter((t) => t !== p).forEach(closeTab) },
                { label: 'Tutup semua', icon: 'x', run: () => [...tabs].forEach(closeTab) },
                { label: 'Ganti nama', icon: 'edit', sep: true, disabled: !vault.has(p), run: () => void renameEntry(p) },
                { label: 'Ganti ikon…', icon: 'smile', disabled: !vault.has(p), run: () => void changeIcon(p) },
                { label: 'Gandakan', icon: 'copy', disabled: !vault.has(p), run: () => void duplicateEntry(p) },
                { label: 'Sematkan', icon: 'pin', disabled: !vault.has(p) || !isNotePath(p), run: () => void vault.togglePin(p) },
                { label: 'Salin path', icon: 'copy', sep: true, run: () => void copyText(p, 'Path') },
              ]);
            }}
          >
            <button className="tab-main" onClick={() => openPath(p)}>
              <EntryIcon path={p} fallback={isCanvasPath(p) ? 'canvas' : 'notes'} size={14} />
              <span>{vault.has(p) ? stripExt(basename(p)) : <s>{stripExt(basename(p))}</s>}</span>
            </button>
            <button className="icon-btn tiny" aria-label="Tutup tab" onClick={() => closeTab(p)}><Icon name="x" size={12} /></button>
          </motion.div>
        ))}
      </AnimatePresence>
      <button className="icon-btn tab-add" aria-label="Catatan baru" title="Catatan baru (Ctrl+N)" onClick={() => void newNote()}><Icon name="plus" size={16} /></button>
      <div className="grow" />
      {active && (isNotePath(active) || isCanvasPath(active)) && (
        <button className={'icon-btn' + (ribbonOn ? ' on' : '')} aria-label="Toolbar format" title="Toolbar format" onClick={() => useLook.getState().set({ ribbon: !ribbonOn })}><Icon name="bold" size={17} /></button>
      )}
      {active && isNotePath(active) && (
        <button className="icon-btn" aria-label="Ganti mode editor" title={editorMode === 'live' ? 'Live preview — klik untuk source' : 'Source — klik untuk live preview'} onClick={toggleEditorMode}>
          <Icon name={editorMode === 'live' ? 'eye' : 'code'} size={17} />
        </button>
      )}
      <button className={'icon-btn' + (rightOpen ? ' on' : '')} aria-label="Panel kanan" title="Panel kanan" onClick={toggleRight}><Icon name="panel" size={17} /></button>
    </div>
  );

  return (
    <div className="notes-view">
      {tabsBar}
      <div className="doc">
        {!active || !vault.has(active) ? <EmptyDoc /> : isCanvasPath(active) ? (
          <CanvasEditor key={active} path={active} />
        ) : (
          <NotePage key={active} path={active} mode={editorMode} />
        )}
      </div>
      {ctx.element}
    </div>
  );
}

function EmptyDoc() {
  const vault = useVault()!;
  const openPath = useApp((s) => s.openPath);
  const recent = [...vault.notes].sort((a, b) => b.mtime - a.mtime).slice(0, 5);
  return (
    <div className="empty-doc">
      <img src="./art/empty-notes.svg" alt="" width={200} />
      <h2>Pilih atau buat catatan</h2>
      <p className="muted">Tekan <kbd>Ctrl</kbd> <kbd>O</kbd> untuk membuka cepat, atau mulai dari nol.</p>
      <div className="row gap center">
        <button className="btn ink" onClick={() => void newNote()}><Icon name="plus" size={16} /> Catatan baru</button>
        <button className="btn soft" onClick={() => void newCanvas()}><Icon name="canvas" size={16} /> Canvas baru</button>
        <button className="btn ghost" onClick={() => void openToday()}><Icon name="calendar" size={16} /> Hari ini</button>
      </div>
      {recent.length > 0 && (
        <ul className="recent">
          {recent.map((n) => (
            <li key={n.path}><button onClick={() => openPath(n.path)}><b>{n.title}</b><small>{relativeTime(n.mtime)}</small></button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NotePage({ path, mode }: { path: string; mode: 'live' | 'source' }) {
  const vault = useVault()!;
  const renameTab = useApp((s) => s.renameTab);
  const toast = useApp((s) => s.toast);
  const meta = vault.meta(path);
  const base = stripExt(basename(path));
  const [title, setTitle] = useState(base);
  const editing = useRef(false);

  useEffect(() => { if (!editing.current) setTitle(base); }, [base]);

  const commitTitle = async () => {
    editing.current = false;
    const t = title.trim();
    if (!t || t === base) { setTitle(base); return; }
    try {
      const r = await vault.rename(path, t);
      renameTab(path, r.path);
      if (r.updated) toast(`${r.updated} tautan diperbarui`, 'ok');
    } catch (e) { toast(errMsg(e), 'error'); setTitle(base); }
  };

  const pinned = vault.config.pinned.includes(path);
  const ribbon = useLook((st) => st.ribbon);
  const [view, setView] = useState<EditorView | null>(null);
  const [inTable, setInTable] = useState(false);
  return (
    <div className="note-page">
      <header className="note-head">
        <button className="note-icon-btn" aria-label="Ganti ikon catatan" title="Ganti ikon" onClick={() => void changeIcon(path)}>{vault.iconOf(path) ?? <Icon name="smile" size={22} />}</button>
        <input
          className="note-title"
          value={title}
          aria-label="Judul catatan"
          onFocus={() => { editing.current = true; }}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void commitTitle()}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setTitle(base); (e.target as HTMLInputElement).blur(); } }}
          spellCheck={false}
        />
        <div className="note-actions">
          <button className={'icon-btn' + (pinned ? ' on' : '')} aria-label={pinned ? 'Lepas sematan' : 'Sematkan'} title={pinned ? 'Lepas sematan' : 'Sematkan'} onClick={() => void vault.togglePin(path)}><Icon name="pin" size={16} /></button>
          <button className={'icon-btn' + (vault.config.widgetPath === path ? ' on' : '')} aria-label="Tampilkan di widget" title="Tampilkan di widget" onClick={() => void vault.setConfig({ widgetPath: vault.config.widgetPath === path ? null : path })}><Icon name="sticky" size={16} /></button>
          <button className="icon-btn" aria-label="Ganti nama" title="Ganti nama" onClick={() => void renameEntry(path)}><Icon name="edit" size={16} /></button>
          <button className="icon-btn" aria-label="Hapus" title="Hapus" onClick={() => void deleteEntry(path)}><Icon name="trash" size={16} /></button>
        </div>
      </header>
      {meta && Object.keys(meta.fm).length >= 0 && <PropertiesBar path={path} />}
      {ribbon && <FormatBar run={(op) => { if (view) cmTarget(view).run(op); }} inTable={inTable} look />}
      <NoteEditor path={path} mode={mode} onView={setView} onSelection={setInTable} />
      <footer className="statusbar">
        <span>{meta?.words ?? 0} kata</span>
        <span>{meta?.tasks.filter((t) => !t.done).length ?? 0} tugas terbuka</span>
        <span>{vault.index.backlinks.get(path)?.length ?? 0} backlink</span>
        <span className="grow" />
        <span>{path}</span>
      </footer>
    </div>
  );
}

/* ── Properti (frontmatter) ──────────────────────────────────────────────────────────── */
function parseValue(raw: string, prev: FmValue | undefined, key: string): FmValue {
  const v = raw.trim();
  if (Array.isArray(prev) || key === 'tags' || key === 'aliases') return v.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v !== '' && /^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}
const show = (v: FmValue) => (Array.isArray(v) ? v.join(', ') : v === null ? '' : String(v));

function PropertiesBar({ path }: { path: string }) {
  const vault = useVault()!;
  const meta = vault.meta(path);
  const [open, setOpen] = useState(true);
  const entries = Object.entries(meta?.fm ?? {});

  const save = (key: string, raw: string) => {
    const cur = vault.content(path) ?? '';
    const prev = meta?.fm[key];
    if (show(prev ?? null) === raw.trim()) return;
    void vault.write(path, setProperty(cur, key, parseValue(raw, prev, key)));
  };
  const add = async () => {
    const key = await ask({ title: 'Properti baru', label: 'Nama (mis. status, tanggal, tags)', confirm: 'Tambah' });
    if (!key) return;
    const k = key.trim().replace(/[:\s]+/g, '-');
    void vault.write(path, setProperty(vault.content(path) ?? '', k, k === 'tags' || k === 'aliases' ? [] : ''));
  };

  if (entries.length === 0) {
    return <div className="props empty"><button className="link-btn" onClick={() => void add()}><Icon name="plus" size={13} /> Tambah properti</button></div>;
  }
  return (
    <div className="props">
      <button className="props-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <motion.span animate={{ rotate: open ? 90 : 0 }}><Icon name="chevR" size={13} /></motion.span> Properti <i>{entries.length}</i>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div className="props-grid">
              {entries.map(([k, v]) => (
                <div className="prop" key={k + show(v)}>
                  <label htmlFor={'p-' + k}>{k}</label>
                  {k === 'tags' || Array.isArray(v) ? (
                    <div className="prop-tags">
                      {asStringList(v).map((t) => <i key={t} className="chip">{k === 'tags' ? '#' : ''}{t}</i>)}
                      <input id={'p-' + k} defaultValue={show(v)} placeholder="a, b, c" onBlur={(e) => save(k, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                    </div>
                  ) : (
                    <input id={'p-' + k} defaultValue={show(v)} onBlur={(e) => save(k, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                  )}
                  <button className="icon-btn tiny prop-x" aria-label={`Hapus ${k}`} onClick={() => void vault.write(path, removeProperty(vault.content(path) ?? '', k))}><Icon name="x" size={12} /></button>
                </div>
              ))}
              <button className="link-btn" onClick={() => void add()}><Icon name="plus" size={13} /> Tambah properti</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
