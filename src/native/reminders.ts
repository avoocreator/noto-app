import { useEffect, useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { Capacitor } from '@capacitor/core';
import type { Vault } from '../vault/vault.ts';
import { DEFAULT_REMINDER_PREFS, dueReminders, reminderAt, reminderBody, reminderKey, type ReminderPrefs, type ReminderTask } from '../lib/reminders.ts';
import { BUILTIN_SOUNDS, installAudioUnlock, playSound } from '../lib/sounds.ts';
import { useApp } from '../store.ts';
import { toggleTaskItem } from '../actions.ts';

/* ── preferensi (reaktif, tersimpan di localStorage) ─────────────────────────────────────── */
const PREFS_KEY = 'noto-reminders';
const load = (): ReminderPrefs => {
  try { return { ...DEFAULT_REMINDER_PREFS, ...(JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') as Partial<ReminderPrefs>) }; } catch { return DEFAULT_REMINDER_PREFS; }
};
let prefs = load();
const subs = new Set<() => void>();
export const getReminderPrefs = () => prefs;
export function setReminderPrefs(p: Partial<ReminderPrefs>) {
  prefs = { ...prefs, ...p };
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* abaikan */ }
  subs.forEach((f) => f());
}
export const useReminderPrefs = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, getReminderPrefs, getReminderPrefs);

/* ── izin & notifikasi sistem ────────────────────────────────────────────────────────────── */
export type PermState = 'granted' | 'denied' | 'default' | 'unsupported';
export function notifyPermission(): PermState {
  if (Capacitor.isNativePlatform()) return 'default';
  return typeof Notification === 'undefined' ? 'unsupported' : (Notification.permission as PermState);
}

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

const hashId = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return Math.abs(h) % 2_000_000_000; };

/** Notifikasi sistem (web/desktop). Lewat service worker bila ada — satu-satunya cara yang jalan di Chrome Android. */
export async function notifyNow(title: string, body: string, opts: { tag?: string; sticky?: boolean } = {}) {
  if (Capacitor.isNativePlatform()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.schedule({ notifications: [{ id: Math.floor(Math.random() * 2_000_000_000), title, body, channelId: channelFor(prefs.sound), schedule: { at: new Date(Date.now() + 500) } }] });
    return;
  }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const o: NotificationOptions & { requireInteraction?: boolean; renotify?: boolean } = { body, icon: './icons/icon-192.png', badge: './icons/icon-192.png', tag: opts.tag, requireInteraction: opts.sticky, renotify: !!opts.tag };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) { await reg.showNotification(title, o); return; }
  } catch { /* jatuh ke Notification biasa */ }
  new Notification(title, o);
}

/* ── kanal Android: tiap nada = satu kanal (nada kanal tak bisa diubah setelah dibuat) ───── */
const channelFor = (sound: string) => `noto-${BUILTIN_SOUNDS.some((s) => s.id === sound) ? sound : 'bell'}`;
let channelsDone = false;
async function ensureChannels() {
  if (channelsDone || !Capacitor.isNativePlatform()) return;
  channelsDone = true;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    for (const s of BUILTIN_SOUNDS) {
      await LocalNotifications.createChannel({ id: `noto-${s.id}`, name: `Pengingat — ${s.label}`, importance: 5, visibility: 1, vibration: true, sound: `noto_${s.id}.wav` });
    }
  } catch { /* plugin belum siap */ }
}

/* ── alarm yang sedang berbunyi ──────────────────────────────────────────────────────────── */
export interface AlarmItem { key: string; task: ReminderTask; body: string; at: number }
interface AlarmState {
  items: AlarmItem[];
  dismiss: (key: string) => void;
  snooze: (key: string, minutes: number) => void;
  done: (key: string) => Promise<void>;
}
const stops = new Map<string, () => void>();
const FIRED_KEY = 'noto-fired';
const firedMap: Record<string, number> = (() => { try { const m = JSON.parse(localStorage.getItem(FIRED_KEY) || '{}') as Record<string, number>; const cut = Date.now() - 3 * 86_400_000; for (const k of Object.keys(m)) if (m[k] < cut) delete m[k]; return m; } catch { return {}; } })();
const saveFired = () => { try { localStorage.setItem(FIRED_KEY, JSON.stringify(firedMap)); } catch { /* abaikan */ } };
const snoozed = new Map<string, number>();

function stopSound(key: string) { stops.get(key)?.(); stops.delete(key); }

export const useAlarms = create<AlarmState>((set, get) => ({
  items: [],
  dismiss: (key) => { stopSound(key); set({ items: get().items.filter((i) => i.key !== key) }); },
  snooze: (key, minutes) => { snoozed.set(key, Date.now() + minutes * 60_000); get().dismiss(key); useApp.getState().toast(`Ditunda ${minutes} menit`, 'ok'); },
  done: async (key) => {
    const it = get().items.find((i) => i.key === key);
    snoozed.delete(key); get().dismiss(key);
    if (it) await toggleTaskItem(it.task);
  },
}));

export async function ring(task: ReminderTask, p: ReminderPrefs = prefs, preview = false) {
  const key = reminderKey(task);
  const body = reminderBody(task, p);
  const alarm = p.mode === 'alarm';
  if (useAlarms.getState().items.some((i) => i.key === key)) return;
  stopSound(key);
  const stop = await playSound({ sound: p.sound, volume: p.volume, loop: alarm, maxSeconds: p.maxSeconds });
  stops.set(key, stop);
  if (alarm || preview) useAlarms.setState((s) => ({ items: [...s.items, { key, task, body, at: Date.now() }] }));
  else {
    useApp.getState().toast(`⏰ ${task.text} — ${body}`, 'info', { label: 'Selesai', run: () => void toggleTaskItem(task) });
  }
  // jendela tidak terlihat → notifikasi sistem juga (di Android sudah dijadwalkan OS)
  if (!preview && !Capacitor.isNativePlatform() && (document.visibilityState !== 'visible' || !document.hasFocus())) {
    void notifyNow(task.text, body, { tag: key, sticky: alarm });
  }
}

/** Percobaan dari Pengaturan: bunyikan tugas contoh sesuai mode & nada saat ini. */
export const testReminder = () => ring({ path: '__test__', line: 0, text: 'Contoh pengingat Noto', done: false, due: new Date().toISOString().slice(0, 10), time: new Date().toTimeString().slice(0, 5) }, prefs, true);

/* ── pemicu ──────────────────────────────────────────────────────────────────────────────── */
export function useReminders(vault: Vault | null) {
  const p = useReminderPrefs();
  useEffect(() => { installAudioUnlock(); }, []);

  useEffect(() => {
    if (!vault || !p.on) return;
    const check = () => {
      const tasks: ReminderTask[] = vault.index.tasks;
      const now = Date.now();
      const fired = new Set(Object.keys(firedMap));
      for (const t of dueReminders(tasks, now, p, fired, snoozed)) {
        const k = reminderKey(t);
        snoozed.delete(k); firedMap[k] = now; saveFired();
        void ring(t, p);
        if (Capacitor.isNativePlatform()) void import('@capacitor/local-notifications').then((m) => m.LocalNotifications.cancel({ notifications: [{ id: hashId(k) }] })).catch(() => undefined);
      }
    };
    const iv = window.setInterval(check, 15_000);
    const vis = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', vis);
    const off = vault.subscribe(() => window.setTimeout(check, 300));
    check();
    return () => { window.clearInterval(iv); document.removeEventListener('visibilitychange', vis); off(); };
  }, [vault, p]);

  // Android: jadwalkan ke OS agar tetap berbunyi saat aplikasi tertutup
  useEffect(() => {
    if (!vault || !Capacitor.isNativePlatform()) return;
    let timer: number | undefined;
    const schedule = async () => {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
        if (!p.on) return;
        await ensureChannels();
        const now = Date.now();
        const list = (vault.index.tasks as ReminderTask[])
          .map((t) => ({ t, at: reminderAt(t, p) }))
          .filter((x): x is { t: ReminderTask; at: number } => x.at !== null && x.at > now && x.at < now + 14 * 86_400_000 && !firedMap[reminderKey(x.t)])
          .sort((a, b) => a.at - b.at)
          .slice(0, 60);
        if (list.length) {
          await LocalNotifications.schedule({
            notifications: list.map(({ t, at }) => ({ id: hashId(reminderKey(t)), title: t.text, body: reminderBody(t, p), channelId: channelFor(p.sound), schedule: { at: new Date(at), allowWhileIdle: true } })),
          });
        }
      } catch { /* izin belum diberikan */ }
    };
    const off = vault.subscribe(() => { window.clearTimeout(timer); timer = window.setTimeout(schedule, 1500); });
    void schedule();
    return () => { off(); window.clearTimeout(timer); };
  }, [vault, p]);
}
