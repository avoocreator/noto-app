import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useApp, useVault, type View } from './store.ts';
import { useThemeEffect, useReducedMotion } from './theme/useTheme.ts';
import { restoreActive, type VaultRecord } from './vault/manager.ts';
import { Sidebar } from './ui/Sidebar.tsx';
import { RightPanel } from './ui/RightPanel.tsx';
import { Palette } from './ui/Palette.tsx';
import { DialogHost, Toasts } from './ui/dialogs.tsx';
import { AlarmHost } from './ui/AlarmHost.tsx';
import { Icon, type IconName } from './ui/Icon.tsx';
import { Welcome } from './views/Welcome.tsx';
import { Home } from './views/Home.tsx';
import { NotesView } from './views/NotesView.tsx';
import { TasksView } from './views/TasksView.tsx';
import { CanvasGallery } from './views/CanvasGallery.tsx';
import { GraphView } from './views/GraphView.tsx';
import { Settings } from './views/Settings.tsx';
import { WidgetWindow } from './views/WidgetWindow.tsx';
import { useAutoSync } from './sync/state.ts';
import { handleLaunchParams, useDeepLinks, useTauriShell, useWidgetSync } from './native/bridge.ts';
import { useReminders } from './native/reminders.ts';
import { newNote, openToday } from './actions.ts';
import { useIsMobile } from './hooks.ts';

const IS_WIDGET = new URLSearchParams(location.search).has('widget');

export function App() {
  return IS_WIDGET ? <WidgetWindow /> : <MainApp />;
}

const VIEW_TITLE: Record<View, string> = { home: 'Beranda', notes: 'Catatan', canvas: 'Canvas', tasks: 'Tugas', graph: 'Graf', settings: 'Pengaturan' };
const WITH_RIGHT: View[] = ['home', 'notes', 'tasks'];

function MainApp() {
  useThemeEffect();
  const vault = useVault();
  const { setVault, view, rightOpen, sidebarCollapsed } = useApp();
  const [boot, setBoot] = useState<'loading' | 'welcome' | 'ready'>('loading');
  const [pending, setPending] = useState<VaultRecord | null>(null);
  const reduce = useReducedMotion();
  const mobile = useIsMobile();

  useEffect(() => {
    let alive = true;
    void restoreActive().then((r) => {
      if (!alive) return;
      if (r?.vault) { setVault(r.vault, r.rec); setBoot('ready'); }
      else { setPending(r?.rec ?? null); setBoot('welcome'); }
    }).catch(() => alive && setBoot('welcome'));
    return () => { alive = false; };
  }, [setVault]);

  useEffect(() => { if (vault) setBoot('ready'); else if (boot === 'ready') setBoot('welcome'); }, [vault]);

  useAutoSync(vault);
  useWidgetSync(vault);
  useDeepLinks(vault);
  useReminders(vault);
  useTauriShell(vault);

  useEffect(() => { if (vault) void handleLaunchParams(vault); }, [vault]);

  // ambil perubahan dari luar (Obsidian, sync folder) saat jendela kembali aktif
  useEffect(() => {
    if (!vault) return;
    const f = () => { if (document.visibilityState === 'visible') void vault.refresh(); };
    window.addEventListener('focus', f);
    document.addEventListener('visibilitychange', f);
    const iv = window.setInterval(f, 20_000);
    return () => { window.removeEventListener('focus', f); document.removeEventListener('visibilitychange', f); window.clearInterval(iv); };
  }, [vault]);

  useEffect(() => {
    const onSearch = (e: Event) => useApp.getState().openPalette('files', String((e as CustomEvent).detail ?? ''));
    window.addEventListener('noto:search', onSearch);
    const onKey = (e: KeyboardEvent) => {
      const s = useApp.getState();
      if (!s.vault) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 'o' || (k === 'k' && !e.shiftKey && !(e.target as HTMLElement).closest('.cm-editor'))) { e.preventDefault(); s.openPalette('files'); }
      else if (k === 'p') { e.preventDefault(); s.openPalette('commands'); }
      else if (k === 'n' && !e.shiftKey) { e.preventDefault(); void newNote(); }
      else if (k === 'd' && !(e.target as HTMLElement).closest('.canvas-wrap')) { e.preventDefault(); void openToday(); }
      else if (e.key === ',') { e.preventDefault(); s.setView('settings'); }
      else if (e.key === '\\') { e.preventDefault(); s.toggleSidebar(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('noto:search', onSearch); window.removeEventListener('keydown', onKey); };
  }, []);

  if (boot === 'loading') return <Splash />;
  if (boot === 'welcome' || !vault) return (<><Welcome pending={pending} /><Toasts /><DialogHost /></>);

  const showRight = WITH_RIGHT.includes(view) && rightOpen;
  return (
    <div className={'app' + (sidebarCollapsed ? ' side-collapsed' : '') + (showRight ? ' with-right' : '') + (mobile ? ' mobile' : '')}>
      <Sidebar />
      <main className="main" id="main">
        {mobile && <MobileBar />}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            className="view"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {view === 'home' && <Home />}
            {view === 'notes' && <NotesView />}
            {view === 'canvas' && <CanvasGallery />}
            {view === 'tasks' && <TasksView />}
            {view === 'graph' && <GraphView />}
            {view === 'settings' && <Settings />}
          </motion.div>
        </AnimatePresence>
      </main>
      {WITH_RIGHT.includes(view) && (
        <AnimatePresence initial={false}>
          {rightOpen && (
            <motion.div
              key="right"
              className="right-slot"
              initial={mobile ? { y: '100%' } : { opacity: 0, x: 24 }}
              animate={mobile ? { y: 0 } : { opacity: 1, x: 0 }}
              exit={mobile ? { y: '100%' } : { opacity: 0, x: 24 }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            >
              <RightPanel />
            </motion.div>
          )}
        </AnimatePresence>
      )}
      {mobile && <BottomNav />}
      <Palette />
      <DialogHost />
      <AlarmHost />
      <Toasts />
    </div>
  );
}

function Splash() {
  return (
    <div className="splash">
      <motion.img src="./favicon.svg" width={72} height={72} alt="" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} />
    </div>
  );
}

function MobileBar() {
  const { view, setDrawer, toggleRight, openPalette, rightOpen } = useApp();
  return (
    <header className="mobile-bar">
      <button className="icon-btn" aria-label="Menu" onClick={() => setDrawer(true)}><Icon name="menu" size={20} /></button>
      <b>{VIEW_TITLE[view]}</b>
      <div className="row gap-s">
        <button className="icon-btn" aria-label="Cari" onClick={() => openPalette('files')}><Icon name="search" size={19} /></button>
        {WITH_RIGHT.includes(view) && <button className={'icon-btn' + (rightOpen ? ' on' : '')} aria-label="Panel" onClick={toggleRight}><Icon name="panel" size={19} /></button>}
      </div>
    </header>
  );
}

function BottomNav() {
  const { view, setView } = useApp();
  const item = (id: View, icon: IconName, label: string) => (
    <button key={id} className={view === id ? 'on' : ''} onClick={() => setView(id)} aria-label={label} aria-current={view === id ? 'page' : undefined}>
      {view === id && <motion.span layoutId="bn-pill" className="bn-pill" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
      <Icon name={icon} size={21} /><small>{label}</small>
    </button>
  );
  return (
    <nav className="bottom-nav" aria-label="Navigasi">
      {item('home', 'home', 'Beranda')}
      {item('notes', 'notes', 'Catatan')}
      <button className="fab" aria-label="Catatan baru" onClick={() => void newNote()}><Icon name="plus" size={24} strokeWidth={2.4} /></button>
      {item('tasks', 'tasks', 'Tugas')}
      {item('canvas', 'canvas', 'Canvas')}
    </nav>
  );
}
