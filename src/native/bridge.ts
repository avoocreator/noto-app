import { useEffect, useRef } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import type { Vault } from '../vault/vault.ts';
import { widgetSummary, type WidgetSummary } from '../lib/widget.ts';
import { isTauri } from '../vault/tauriFs.ts';
import { useApp } from '../store.ts';
import { newNote, quickAddTask } from '../actions.ts';

/* ── Widget Android (plugin native "NotoWidget", lihat native/android-widget) ───────────── */
interface NotoWidgetPlugin {
  update(o: { json: string }): Promise<void>;
}
const NotoWidget = registerPlugin<NotoWidgetPlugin>('NotoWidget');

export function summaryFor(vault: Vault, now = new Date()): WidgetSummary {
  return widgetSummary(now, vault.config.widgetPath, new Map(vault.notes.map((n) => [n.path, n])), vault.index.tasks, (p) => vault.content(p));
}

/** Kirim ringkasan ke widget layar utama setiap vault berubah (di-debounce). Tidak berefek di web/desktop. */
export function useWidgetSync(vault: Vault | null) {
  const last = useRef('');
  useEffect(() => {
    if (!vault || !Capacitor.isNativePlatform()) return;
    let t: number | undefined;
    const push = () => {
      const s = summaryFor(vault);
      const json = JSON.stringify({ ...s, updated: 0 }); // abaikan stempel waktu saat membandingkan
      if (json === last.current) return;
      last.current = json;
      void NotoWidget.update({ json: JSON.stringify(s) }).catch(() => undefined);
    };
    const off = vault.subscribe(() => { window.clearTimeout(t); t = window.setTimeout(push, 800); });
    push();
    return () => { off(); window.clearTimeout(t); };
  }, [vault]);
}

/** Tautan dalam: noto://new (widget "＋ Catatan"), noto://task?text=…, noto://open?path=… */
export function useDeepLinks(vault: Vault | null) {
  const openPath = useApp((s) => s.openPath);
  useEffect(() => {
    if (!vault || !Capacitor.isNativePlatform()) return;
    const handle = (url: string) => {
      try {
        const u = new URL(url);
        const action = u.host || u.pathname.replace(/^\/+/, '');
        if (action === 'new') void newNote();
        else if (action === 'task') void quickAddTask(u.searchParams.get('text') ?? '');
        else if (action === 'open') { const p = u.searchParams.get('path'); if (p && vault.has(p)) openPath(p); }
        else if (action === 'daily') void vault.openDaily(new Date()).then((p) => openPath(p));
      } catch { /* URL tidak valid */ }
    };
    let remove: (() => void) | undefined;
    void CapApp.addListener('appUrlOpen', (e) => handle(e.url)).then((h) => { remove = () => void h.remove(); });
    void CapApp.getLaunchUrl().then((r) => { if (r?.url) handle(r.url); });
    return () => remove?.();
  }, [vault, openPath]);
}

/** Dari Web Share Target / PWA shortcut: ?new=note, ?new=task, ?share=1&title=&text=&url= */
export async function handleLaunchParams(vault: Vault) {
  const q = new URLSearchParams(location.search);
  if (!q.size) return;
  const { openPath } = useApp.getState();
  if (q.get('share')) {
    const body = [q.get('text'), q.get('url')].filter(Boolean).join('\n\n');
    const title = q.get('title') || (q.get('text') ?? '').slice(0, 40) || 'Dibagikan';
    const p = await vault.createNote({ title, content: `# ${title}\n\n${body}\n` });
    openPath(p);
  } else if (q.get('new') === 'note') await newNote();
  else if (q.get('new') === 'task') useApp.getState().setView('tasks');
  history.replaceState(null, '', location.pathname);
}

/* ── Desktop (Tauri): hotkey global + jendela widget tempel ───────────────────────────── */
export function useTauriShell(vault: Vault | null) {
  useEffect(() => {
    if (!isTauri() || !vault) return;
    let unregister: (() => void) | undefined;
    void (async () => {
      try {
        const { register, unregister: un } = await import('@tauri-apps/plugin-global-shortcut');
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await register('CommandOrControl+Alt+N', async (e) => {
          if (e.state !== 'Pressed') return;
          const w = getCurrentWindow();
          await w.show(); await w.unminimize(); await w.setFocus();
          void newNote();
        });
        unregister = () => void un('CommandOrControl+Alt+N');
      } catch { /* shortcut sudah dipakai aplikasi lain */ }
    })();
    return () => unregister?.();
  }, [vault]);
}

export async function openWidgetWindow(): Promise<boolean> {
  if (isTauri()) {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const existing = await WebviewWindow.getByLabel('widget');
    if (existing) { await existing.show(); await existing.setFocus(); return true; }
    new WebviewWindow('widget', {
      url: 'index.html?widget=1', title: 'Noto Widget', width: 340, height: 360, minWidth: 260, minHeight: 260,
      decorations: false, alwaysOnTop: true, resizable: true, transparent: true, skipTaskbar: true,
    });
    return true;
  }
  const w = window.open(`${location.pathname}?widget=1`, 'noto-widget', 'popup=yes,width=340,height=380');
  return !!w;
}
