import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Icon, type IconName } from './Icon.tsx';
import { useApp, useVault } from '../store.ts';
import { basename, stripExt } from '../lib/analyze.ts';
import { relativeTime } from '../lib/dates.ts';
import { BUILTIN_TEMPLATES } from '../lib/template.ts';
import { downloadBlob, newCanvas, newFolder, newNote, openToday } from '../actions.ts';
import { useTheme } from '../theme/useTheme.ts';
import { PRESETS } from '../theme/palettes.ts';
import { runSyncAction } from './syncAction.ts';

interface Item {
  id: string;
  title: string;
  sub?: string;
  icon: IconName;
  hint?: string;
  run: () => void;
}

export function Palette() {
  const mode = useApp((s) => s.palette);
  const seed = useApp((s) => s.paletteSeed);
  const openPalette = useApp((s) => s.openPalette);
  return (
    <AnimatePresence>
      {mode && (
        <motion.div className="scrim top" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => openPalette(null)}>
          <PaletteBody key={mode + seed} initialMode={mode} seed={seed} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PaletteBody({ initialMode, seed }: { initialMode: 'files' | 'commands'; seed: string }) {
  const vault = useVault();
  const { openPath, openPalette, setView, toggleRight, toggleEditorMode, toast } = useApp();
  const theme = useTheme();
  const [q, setQ] = useState(initialMode === 'commands' ? '>' + seed : seed);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => { input.current?.focus(); }, []);

  const close = () => openPalette(null);
  const go = (fn: () => void) => () => { close(); fn(); };

  const commands: Item[] = useMemo(() => {
    const c: Item[] = [
      { id: 'new', title: 'Catatan baru', icon: 'plus', hint: 'Ctrl+N', run: go(() => void newNote()) },
      { id: 'newc', title: 'Canvas baru', icon: 'canvas', run: go(() => void newCanvas()) },
      { id: 'newf', title: 'Folder baru', icon: 'folder', run: go(() => void newFolder()) },
      { id: 'daily', title: 'Buka catatan harian hari ini', icon: 'calendar', hint: 'Ctrl+D', run: go(() => void openToday()) },
      { id: 'home', title: 'Ke Beranda', icon: 'home', run: go(() => setView('home')) },
      { id: 'tasks', title: 'Ke Tugas', icon: 'tasks', run: go(() => setView('tasks')) },
      { id: 'graph', title: 'Ke Graf', icon: 'graph', run: go(() => setView('graph')) },
      { id: 'canvas', title: 'Ke Canvas', icon: 'canvas', run: go(() => setView('canvas')) },
      { id: 'settings', title: 'Buka Pengaturan', icon: 'settings', hint: 'Ctrl+,', run: go(() => setView('settings')) },
      { id: 'right', title: 'Tampilkan/sembunyikan panel kanan', icon: 'panel', run: go(toggleRight) },
      { id: 'mode', title: 'Ganti mode editor (live preview ↔ source)', icon: 'code', run: go(toggleEditorMode) },
      { id: 'dark', title: 'Mode gelap', icon: 'moon', run: go(() => theme.patch({ mode: 'dark' })) },
      { id: 'light', title: 'Mode terang', icon: 'sun', run: go(() => theme.patch({ mode: 'light' })) },
      { id: 'sys', title: 'Mode ikut sistem', icon: 'monitor', run: go(() => theme.patch({ mode: 'system' })) },
      { id: 'sync', title: 'Sinkronkan sekarang', icon: 'refresh', run: go(() => void runSyncAction()) },
      {
        id: 'zip', title: 'Ekspor vault sebagai ZIP', icon: 'download',
        run: go(async () => { if (vault) { downloadBlob(`${vault.fs.label}.zip`, await vault.exportZip(), 'application/zip'); toast('Vault diekspor', 'ok'); } }),
      },
    ];
    for (const p of PRESETS) c.push({ id: 'p-' + p.id, title: `Palet: ${p.name}`, icon: 'sparkle', run: go(() => theme.patch({ presetId: p.id })) });
    for (const t of vault?.templates() ?? BUILTIN_TEMPLATES.map((b) => b.name)) {
      c.push({ id: 't-' + t, title: `Catatan baru dari templat: ${t}`, icon: 'notes', run: go(() => void newNote('', t)) });
    }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vault?.version]);

  const items: Item[] = useMemo(() => {
    if (!vault) return [];
    if (q.startsWith('>')) {
      const s = q.slice(1).trim().toLowerCase();
      return commands.filter((c) => !s || c.title.toLowerCase().includes(s)).slice(0, 30);
    }
    const s = q.trim();
    if (!s) {
      return [...vault.notes].sort((a, b) => b.mtime - a.mtime).slice(0, 14).map((n) => ({
        id: n.path, title: n.title, sub: `${n.folder || 'Vault'} · ${relativeTime(n.mtime)}`, icon: 'notes' as IconName, run: go(() => openPath(n.path)),
      }));
    }
    const hits = vault.search(s, 30);
    const out: Item[] = hits.map((h) => ({
      id: h.path,
      title: vault.meta(h.path)?.title ?? stripExt(basename(h.path)),
      sub: h.snippet || h.path,
      icon: 'notes' as IconName,
      run: go(() => openPath(h.path, h.snippet ? { line: h.line } : undefined)),
    }));
    // canvas dicari berdasarkan nama
    for (const f of vault.files) {
      if (f.path.endsWith('.canvas') && f.path.toLowerCase().includes(s.toLowerCase())) {
        out.push({ id: f.path, title: stripExt(basename(f.path)), sub: f.path, icon: 'canvas', run: go(() => openPath(f.path)) });
      }
    }
    if (!/^(tag|path):/.test(s)) {
      out.push({ id: 'create', title: `Buat catatan "${s}"`, icon: 'plus', sub: 'Enter untuk membuat', run: go(() => void vault.createNote({ title: s }).then((p) => openPath(p))) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, vault?.version, commands]);

  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { (list.current?.children[sel] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' }); }, [sel]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); items[sel]?.run(); }
  };

  return (
    <motion.div
      className="palette"
      role="dialog"
      aria-modal="true"
      aria-label="Pencarian dan perintah"
      initial={{ opacity: 0, y: -14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={onKey}
    >
      <div className="palette-input">
        <Icon name={q.startsWith('>') ? 'command' : 'search'} size={18} />
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari catatan, atau ketik > untuk perintah" aria-label="Cari" spellCheck={false} />
        <kbd>Esc</kbd>
      </div>
      <ul className="palette-list" ref={list} role="listbox">
        {items.map((it, i) => (
          <li key={it.id + i} role="option" aria-selected={i === sel} className={i === sel ? 'on' : ''} onMouseMove={() => setSel(i)} onClick={it.run}>
            <span className="pi"><Icon name={it.icon} size={16} /></span>
            <span className="pt"><b>{it.title}</b>{it.sub && <small>{it.sub}</small>}</span>
            {it.hint && <kbd>{it.hint}</kbd>}
          </li>
        ))}
        {items.length === 0 && (
          <li className="palette-empty">
            <img src="./art/empty-search.svg" alt="" width={120} />
            <p>Tidak ada hasil.</p>
          </li>
        )}
      </ul>
      <div className="palette-foot"><span><kbd>↑↓</kbd> pilih</span><span><kbd>Enter</kbd> buka</span><span><kbd>&gt;</kbd> perintah</span><span><kbd>tag:</kbd> <kbd>path:</kbd> filter</span></div>
    </motion.div>
  );
}
