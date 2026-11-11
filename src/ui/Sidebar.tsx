import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Icon, type IconName } from './Icon.tsx';
import { FileTree } from './FileTree.tsx';
import { useApp, useVault, type View } from '../store.ts';
import { forgetVault, listVaults, openFolderVault, openRecord, createLocalVault, capabilities } from '../vault/manager.ts';
import { basename, stripExt } from '../lib/analyze.ts';
import { newCanvas, newFolder, newNote, openToday } from '../actions.ts';
import { useSyncStore } from '../sync/state.ts';
import { relativeTime } from '../lib/dates.ts';

const MAIN: { id: View; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Beranda', icon: 'home' },
  { id: 'notes', label: 'Catatan', icon: 'notes' },
  { id: 'canvas', label: 'Canvas', icon: 'canvas' },
  { id: 'tasks', label: 'Tugas', icon: 'tasks' },
  { id: 'graph', label: 'Graf', icon: 'graph' },
];

export function Sidebar() {
  const vault = useVault();
  const { view, setView, record, openPath, openPalette, setVault, toast } = useApp();
  const collapsed = useApp((s) => s.sidebarCollapsed);
  const toggleSidebar = useApp((s) => s.toggleSidebar);
  const drawer = useApp((s) => s.drawer);
  const setDrawer = useApp((s) => s.setDrawer);
  const [vaultMenu, setVaultMenu] = useState(false);
  const sync = useSyncStore();
  const caps = capabilities();

  const switchTo = async (id: string) => {
    const rec = listVaults().find((r) => r.id === id);
    if (!rec) return;
    setVaultMenu(false);
    try {
      const v = await openRecord(rec, true);
      if (v) setVault(v, rec);
      else toast('Izin ke folder ditolak', 'error');
    } catch { toast('Vault tidak bisa dibuka', 'error'); }
  };

  const navBtn = (id: View, label: string, icon: IconName, onClick?: () => void) => (
    <button key={label} className={'nav-item' + (view === id && !onClick ? ' active' : '')} onClick={onClick ?? (() => setView(id))} title={collapsed ? label : undefined}>
      {view === id && !onClick && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
      <Icon name={icon} size={18} />
      <span className="nav-label">{label}</span>
    </button>
  );

  const syncLabel =
    sync.status === 'syncing' ? 'Menyinkronkan…'
    : sync.status === 'error' ? 'Sinkron gagal'
    : sync.status === 'ready' && vault?.config.syncId ? (sync.last ? `Sinkron ${relativeTime(sync.last.at)}` : 'Sinkron aktif')
    : null;

  return (
    <>
      {drawer && <div className="drawer-scrim" onClick={() => setDrawer(false)} />}
      <aside className={'sidebar' + (collapsed ? ' collapsed' : '') + (drawer ? ' drawer-open' : '')} aria-label="Navigasi utama">
        <div className="side-top">
          <div className="brand">
            <img src="./favicon.svg" alt="" width={30} height={30} />
            <span className="brand-name">noto</span>
          </div>
          <button className="collapse-btn" onClick={toggleSidebar} aria-label={collapsed ? 'Lebarkan sidebar' : 'Ciutkan sidebar'}>
            <Icon name={collapsed ? 'chevR' : 'chevL'} size={14} strokeWidth={2.4} />
          </button>
        </div>

        <div className="vault-switch">
          <button className="vault-card" onClick={() => setVaultMenu((o) => !o)} aria-expanded={vaultMenu}>
            <span className="vault-ico"><Icon name="folder" size={16} /></span>
            <span className="vault-text">
              <b>{vault?.fs.label ?? 'Vault'}</b>
              <small>{record?.kind === 'tauri' || record?.kind === 'web' ? 'Folder di perangkat' : record?.kind === 'capacitor' ? 'Penyimpanan app' : 'Di browser'}</small>
            </span>
            <Icon name="chevD" size={14} />
          </button>
          <AnimatePresence>
            {vaultMenu && (
              <motion.div className="menu-pop" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}>
                {listVaults().map((r) => (
                  <div className="menu-row" key={r.id}>
                    <button className={'ctx-item grow' + (r.id === record?.id ? ' on' : '')} onClick={() => void switchTo(r.id)}>
                      <Icon name={r.id === record?.id ? 'check' : 'folder'} size={15} /> {r.label}
                    </button>
                    {r.id !== record?.id && (
                      <button className="icon-btn tiny" aria-label={`Lupakan ${r.label}`} title="Lupakan (file tidak dihapus)" onClick={() => { void forgetVault(r); setVaultMenu(false); }}>
                        <Icon name="x" size={13} />
                      </button>
                    )}
                  </div>
                ))}
                <hr />
                {caps.folder && (
                  <button className="ctx-item" onClick={async () => { setVaultMenu(false); const r = await openFolderVault(); if (r) setVault(r.vault, r.rec); }}>
                    <Icon name="folderOpen" size={15} /> Buka folder…
                  </button>
                )}
                <button className="ctx-item" onClick={async () => { setVaultMenu(false); const r = await createLocalVault(`Vault ${listVaults().length + 1}`); setVault(r.vault, r.rec); }}>
                  <Icon name="plus" size={15} /> Vault baru
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="nav">
          <div className="nav-group">Umum</div>
          {MAIN.map((m) => navBtn(m.id, m.label, m.icon))}
          <div className="nav-group">Alat</div>
          {navBtn('home', 'Catatan harian', 'calendar', () => void openToday())}
          {navBtn('home', 'Cari…', 'search', () => openPalette('files'))}
          {navBtn('settings', 'Pengaturan', 'settings')}
        </nav>

        {vault && vault.config.pinned.length > 0 && !collapsed && (
          <div className="side-section">
            <div className="nav-group">Disematkan</div>
            {vault.config.pinned.filter((p) => vault.has(p)).map((p) => (
              <button key={p} className="nav-item sub" onClick={() => openPath(p)}>
                <Icon name="pin" size={15} /><span className="nav-label">{stripExt(basename(p))}</span>
              </button>
            ))}
          </div>
        )}

        {!collapsed && (
          <div className="side-files">
            <div className="side-files-head">
              <span className="nav-group">Berkas</span>
              <div className="row gap-s">
                <button className="icon-btn tiny" title="Catatan baru (Ctrl+N)" aria-label="Catatan baru" onClick={() => void newNote()}><Icon name="plus" size={15} /></button>
                <button className="icon-btn tiny" title="Canvas baru" aria-label="Canvas baru" onClick={() => void newCanvas()}><Icon name="canvas" size={15} /></button>
                <button className="icon-btn tiny" title="Folder baru" aria-label="Folder baru" onClick={() => void newFolder()}><Icon name="folder" size={15} /></button>
              </div>
            </div>
            <div className="side-scroll"><FileTree /></div>
          </div>
        )}

        <div className="side-foot">
          {syncLabel && !collapsed && (
            <button className={'sync-chip ' + sync.status} onClick={() => setView('settings')} title={sync.error ?? undefined}>
              <Icon name={sync.status === 'syncing' ? 'refresh' : 'cloud'} size={14} className={sync.status === 'syncing' ? 'spin' : ''} />
              {syncLabel}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
