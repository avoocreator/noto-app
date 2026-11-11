import { useEffect, useRef } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import type { Vault } from '../vault/vault.ts';
import { widgetSummary, type WidgetSummary } from '../lib/widget.ts';
import { isTauri } from '../vault/tauriFs.ts';
import { useApp } from '../store.ts';
import { newNote, quickAddTask } from '../actions.ts';
import { ymd } from '../lib/dates.ts';

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

/* ── Pengingat tugas ─────────────────────────────────────────────────────────────────── */
const REM_KEY = 'noto-reminders';
export interface ReminderPrefs { on: boolean; lead: number }
export const loadReminderPrefs = (): ReminderPrefs => {
  try { return { on: false, lead: 10, ...(JSON.parse(localStorage.getItem(REM_KEY) || '{}') as Partial<ReminderPrefs>) }; } catch { return { on: false, lead: 10 }; }
};
export const saveReminderPrefs = (p: ReminderPrefs) => { try { localStorage.setItem(REM_KEY, JSON.stringify(p)); } catch { /* abaikan */ } };

export async function ensureNotifyPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const r = await LocalNotifications.requestPermissions();
      return r.display === 'granted';
    } catch { return false; }
  }
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  return (await Notification.requestPermission()) === 'granted';
}

export async function notifyNow(title: string, body: string) {
  if (Capacitor.isNativePlatform()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.schedule({ notifications: [{ id: Math.floor(Math.random() * 2_000_000_000), title, body, schedule: { at: new Date(Date.now() + 500) } }] });
  } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, { body, icon: './icons/icon-192.png' });
}

const hashId = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return Math.abs(h) % 2_000_000_000; };

export function useReminders(vault: Vault | null) {
  const fired = useRef(new Set<string>());
  useEffect(() => {
    if (!vault) return;
    const prefs = loadReminderPrefs();
    if (!prefs.on) return;
    const native = Capacitor.isNativePlatform();

    if (native) {
      // jadwalkan di OS agar tetap berbunyi saat app tertutup
      const schedule = async () => {
        try {
          const { LocalNotifications } = await import('@capacitor/local-notifications');
          const pending = await LocalNotifications.getPending();
          if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
          const now = Date.now();
          const list = vault.index.tasks
            .filter((t) => !t.done && t.due && t.time)
            .map((t) => ({ t, at: new Date(`${t.due}T${t.time}:00`).getTime() - prefs.lead * 60_000 }))
            .filter((x) => x.at > now && x.at < now + 14 * 86_400_000)
            .sort((a, b) => a.at - b.at)
            .slice(0, 60);
          if (list.length) {
            await LocalNotifications.schedule({
              notifications: list.map(({ t, at }) => ({ id: hashId(t.path + t.line + t.text + t.due), title: t.text, body: `${t.time}${prefs.lead ? ` · ${prefs.lead} menit lagi` : ''}`, schedule: { at: new Date(at) } })),
            });
          }
        } catch { /* izin belum diberikan */ }
      };
      let timer: number | undefined;
      const off = vault.subscribe(() => { window.clearTimeout(timer); timer = window.setTimeout(schedule, 1500); });
      void schedule();
      return () => { off(); window.clearTimeout(timer); };
    }

    const check = () => {
      const now = Date.now();
      const today = ymd(new Date());
      for (const t of vault.index.tasks) {
        if (t.done || t.due !== today || !t.time) continue;
        const at = new Date(`${t.due}T${t.time}:00`).getTime() - prefs.lead * 60_000;
        const key = `${t.path}:${t.line}:${t.due}:${t.time}`;
        if (now >= at && now < at + 5 * 60_000 && !fired.current.has(key)) {
          fired.current.add(key);
          void notifyNow(t.text, `${t.time}${prefs.lead ? ` · ${prefs.lead} menit lagi` : ''}`);
        }
      }
    };
    const iv = window.setInterval(check, 30_000);
    check();
    return () => window.clearInterval(iv);
  }, [vault]);
}
