import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import type { Vault } from './vault/vault.ts';
import type { VaultRecord } from './vault/manager.ts';

export type View = 'home' | 'notes' | 'canvas' | 'tasks' | 'graph' | 'settings';
export type RightTab = 'day' | 'outline' | 'links' | 'history';
export type PaletteMode = 'files' | 'commands' | null;

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'ok' | 'error';
  action?: { label: string; run: () => void };
}

interface AppState {
  vault: Vault | null;
  record: VaultRecord | null;
  setVault: (v: Vault | null, rec: VaultRecord | null) => void;

  view: View;
  setView: (v: View) => void;

  tabs: string[];
  active: string | null;
  pendingLine: { path: string; line: number } | null;
  clearPendingLine: () => void;
  openPath: (path: string, opts?: { line?: number }) => void;
  closeTab: (path: string) => void;
  renameTab: (from: string, to: string) => void;

  editorMode: 'live' | 'source';
  toggleEditorMode: () => void;

  rightOpen: boolean;
  rightTab: RightTab;
  setRightTab: (t: RightTab) => void;
  toggleRight: () => void;
  drawer: boolean; // sidebar sebagai laci (HP)
  setDrawer: (b: boolean) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  palette: PaletteMode;
  paletteSeed: string;
  openPalette: (m: PaletteMode, seed?: string) => void;

  toasts: Toast[];
  toast: (text: string, kind?: Toast['kind'], action?: Toast['action']) => void;
  dismissToast: (id: number) => void;
}

let toastId = 1;
const persisted = <T,>(k: string, d: T): T => {
  try { const v = localStorage.getItem(k); return v === null ? d : (JSON.parse(v) as T); } catch { return d; }
};
const persist = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* abaikan */ } };

export const useApp = create<AppState>((set, get) => ({
  vault: null,
  record: null,
  setVault: (vault, record) => set({ vault, record, tabs: [], active: null, view: 'home', pendingLine: null }),

  view: 'home',
  setView: (view) => set({ view, drawer: false }),

  tabs: [],
  active: null,
  pendingLine: null,
  clearPendingLine: () => set({ pendingLine: null }),
  openPath: (path, opts) => {
    const { tabs } = get();
    set({
      tabs: tabs.includes(path) ? tabs : [...tabs, path],
      active: path,
      view: 'notes',
      drawer: false,
      pendingLine: opts?.line !== undefined ? { path, line: opts.line } : null,
    });
  },
  closeTab: (path) => {
    const { tabs, active } = get();
    const i = tabs.indexOf(path);
    if (i === -1) return;
    const next = tabs.filter((t) => t !== path);
    set({ tabs: next, active: active === path ? next[Math.min(i, next.length - 1)] ?? null : active });
  },
  renameTab: (from, to) => {
    const { tabs, active } = get();
    set({ tabs: tabs.map((t) => (t === from ? to : t)), active: active === from ? to : active });
  },

  editorMode: persisted<'live' | 'source'>('noto-editor-mode', 'live'),
  toggleEditorMode: () => {
    const m = get().editorMode === 'live' ? 'source' : 'live';
    persist('noto-editor-mode', m);
    set({ editorMode: m });
  },

  rightOpen: persisted('noto-right-open', typeof window === 'undefined' || window.innerWidth > 900),
  rightTab: 'day',
  setRightTab: (rightTab) => set({ rightTab, rightOpen: true }),
  toggleRight: () => { const v = !get().rightOpen; persist('noto-right-open', v); set({ rightOpen: v }); },
  drawer: false,
  setDrawer: (drawer) => set({ drawer }),
  sidebarCollapsed: persisted('noto-sidebar-collapsed', false),
  toggleSidebar: () => { const v = !get().sidebarCollapsed; persist('noto-sidebar-collapsed', v); set({ sidebarCollapsed: v }); },

  palette: null,
  paletteSeed: '',
  openPalette: (palette, paletteSeed = '') => set({ palette, paletteSeed }),

  toasts: [],
  toast: (text, kind = 'info', action) => {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts, { id, text, kind, action }] }));
    window.setTimeout(() => get().dismissToast(id), action ? 6000 : 3200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

const noop = () => () => {};
const zero = () => 0;

/** Re-render setiap kali isi vault berubah. Mengembalikan vault (atau null). */
export function useVault(): Vault | null {
  const vault = useApp((s) => s.vault);
  useSyncExternalStore(vault ? vault.subscribe : noop, vault ? vault.getVersion : zero);
  return vault;
}
