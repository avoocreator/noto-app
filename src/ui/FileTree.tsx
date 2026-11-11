import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Icon, type IconName } from './Icon.tsx';
import { useApp, useVault } from '../store.ts';
import { useContextMenu, type MenuItem } from './ContextMenu.tsx';
import { basename, isCanvasPath, isImagePath, isNotePath, stripExt } from '../lib/analyze.ts';
import { deleteEntry, moveEntry, newCanvas, newFolder, newNote, renameEntry, renameFolderAction } from '../actions.ts';

interface TNode { name: string; path: string; dir: boolean; children: TNode[] }

function build(files: string[], dirs: string[]): TNode {
  const root: TNode = { name: '', path: '', dir: true, children: [] };
  const index = new Map<string, TNode>([['', root]]);
  const ensureDir = (p: string): TNode => {
    const hit = index.get(p);
    if (hit) return hit;
    const parent = ensureDir(p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
    const n: TNode = { name: basename(p), path: p, dir: true, children: [] };
    parent.children.push(n);
    index.set(p, n);
    return n;
  };
  for (const d of dirs) ensureDir(d);
  for (const f of files) {
    const parent = ensureDir(f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '');
    parent.children.push({ name: basename(f), path: f, dir: false, children: [] });
  }
  const sort = (n: TNode) => {
    n.children.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' }) : a.dir ? -1 : 1));
    n.children.forEach(sort);
  };
  sort(root);
  return root;
}

const EXPANDED = 'noto-expanded';
const loadExpanded = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(EXPANDED) || '[]') as string[]); } catch { return new Set(); }
};

function iconFor(path: string): IconName {
  if (isCanvasPath(path)) return 'canvas';
  if (isImagePath(path)) return 'image';
  return isNotePath(path) ? 'notes' : 'file';
}

export function FileTree() {
  const vault = useVault();
  const active = useApp((s) => s.active);
  const openPath = useApp((s) => s.openPath);
  const [expanded, setExpanded] = useState<Set<string>>(loadExpanded);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const ctx = useContextMenu();

  const tree = useMemo(
    () => build(vault?.files.map((f) => f.path) ?? [], vault?.dirs ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vault?.version],
  );
  if (!vault) return null;

  const toggle = (p: string) => {
    const n = new Set(expanded);
    n.has(p) ? n.delete(p) : n.add(p);
    setExpanded(n);
    try { localStorage.setItem(EXPANDED, JSON.stringify([...n])); } catch { /* abaikan */ }
  };

  const itemsFor = (n: TNode): MenuItem[] =>
    n.dir
      ? [
          { label: 'Catatan baru di sini', icon: 'plus', run: () => void newNote(n.path) },
          { label: 'Canvas baru di sini', icon: 'canvas', run: () => void newCanvas(n.path) },
          { label: 'Folder baru', icon: 'folder', run: () => void newFolder(n.path) },
          { label: 'Ganti nama', icon: 'edit', sep: true, run: () => void renameFolderAction(n.path) },
          { label: 'Hapus folder', icon: 'trash', danger: true, run: () => void deleteEntry(n.path, true) },
        ]
      : [
          { label: 'Buka', icon: 'file', run: () => openPath(n.path) },
          ...(isNotePath(n.path) ? [{ label: vault.config.pinned.includes(n.path) ? 'Lepas sematan' : 'Sematkan', icon: 'pin' as IconName, run: () => void vault.togglePin(n.path) }] : []),
          ...(isNotePath(n.path) ? [{ label: 'Tampilkan di widget', icon: 'sticky' as IconName, run: () => void vault.setConfig({ widgetPath: n.path }) }] : []),
          { label: 'Ganti nama', icon: 'edit', sep: true, run: () => void renameEntry(n.path) },
          { label: 'Hapus', icon: 'trash', danger: true, run: () => void deleteEntry(n.path) },
        ];

  const row = (n: TNode, depth: number) => {
    const open = expanded.has(n.path);
    return (
      <li key={n.path}>
        <div
          className={'tree-row' + (!n.dir && active === n.path ? ' active' : '') + (dragOver === n.path ? ' drop' : '')}
          style={{ paddingLeft: 8 + depth * 14 }}
          draggable
          onDragStart={(e) => { e.dataTransfer.setData('text/noto-path', n.path); e.dataTransfer.effectAllowed = 'move'; }}
          onDragOver={(e) => { if (n.dir) { e.preventDefault(); setDragOver(n.path); } }}
          onDragLeave={() => setDragOver((d) => (d === n.path ? null : d))}
          onDrop={(e) => {
            const from = e.dataTransfer.getData('text/noto-path');
            setDragOver(null);
            if (n.dir && from && from !== n.path && !n.path.startsWith(from + '/')) { e.preventDefault(); void moveEntry(from, n.path); }
          }}
          onClick={() => (n.dir ? toggle(n.path) : openPath(n.path))}
          {...ctx.bind(() => itemsFor(n))}
          role="treeitem"
          aria-expanded={n.dir ? open : undefined}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); n.dir ? toggle(n.path) : openPath(n.path); } }}
        >
          {n.dir ? (
            <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }} className="tree-chev"><Icon name="chevR" size={14} /></motion.span>
          ) : <span className="tree-chev" />}
          <Icon name={n.dir ? (open ? 'folderOpen' : 'folder') : iconFor(n.path)} size={16} />
          <span className="tree-name">{n.dir ? n.name : isNotePath(n.path) || isCanvasPath(n.path) ? stripExt(n.name) : n.name}</span>
          {!n.dir && isCanvasPath(n.path) && <span className="tree-tag">canvas</span>}
          <button
            className="icon-btn tiny tree-more"
            aria-label="Menu"
            onClick={(e) => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); ctx.open(r.left, r.bottom, itemsFor(n)); }}
          >
            <Icon name="more" size={14} />
          </button>
        </div>
        <AnimatePresence initial={false}>
          {n.dir && open && (
            <motion.ul
              role="group"
              className="tree"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ overflow: 'hidden' }}
            >
              {n.children.map((c) => row(c, depth + 1))}
            </motion.ul>
          )}
        </AnimatePresence>
      </li>
    );
  };

  return (
    <>
      <ul
        className="tree root"
        role="tree"
        onDragOver={(e) => { if (e.dataTransfer.types.includes('text/noto-path')) e.preventDefault(); }}
        onDrop={(e) => { const from = e.dataTransfer.getData('text/noto-path'); if (from) void moveEntry(from, ''); }}
      >
        {tree.children.map((c) => row(c, 0))}
        {tree.children.length === 0 && <li className="muted small pad">Vault masih kosong.</li>}
      </ul>
      {ctx.element}
    </>
  );
}
