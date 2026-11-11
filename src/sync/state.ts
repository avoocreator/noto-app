import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Vault } from '../vault/vault.ts';
import { runSync, type SyncReport } from './engine.ts';
import { createRemoteVault, currentUser, getClient, listRemoteVaults, loadCreds, saveCreds, sendOtp, SupabaseRemote, verifyOtp, type RemoteVault, type SupabaseCreds } from './supabase.ts';
import { randomId } from '../lib/hash.ts';

export type SyncStatus = 'off' | 'signedOut' | 'ready' | 'syncing' | 'error';

interface SyncState {
  creds: SupabaseCreds | null;
  email: string | null;
  userId: string | null;
  status: SyncStatus;
  last: SyncReport | null;
  error: string | null;
  setCreds: (c: SupabaseCreds | null) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  creds: loadCreds(),
  email: null,
  userId: null,
  status: 'off',
  last: null,
  error: null,
  setCreds: (creds) => { saveCreds(creds); set({ creds, status: creds ? 'signedOut' : 'off', email: null, userId: null }); },
}));

const client = (): SupabaseClient | null => {
  const c = useSyncStore.getState().creds;
  return c ? getClient(c) : null;
};

export async function refreshAuth() {
  const c = client();
  if (!c) { useSyncStore.setState({ status: 'off', email: null, userId: null }); return; }
  try {
    const u = await currentUser(c);
    useSyncStore.setState({ status: u ? 'ready' : 'signedOut', email: u?.email ?? null, userId: u?.id ?? null, error: null });
  } catch (e) {
    useSyncStore.setState({ status: 'error', error: e instanceof Error ? e.message : String(e) });
  }
}

export async function requestOtp(email: string) {
  const c = client();
  if (!c) throw new Error('Isi URL dan anon key Supabase dulu.');
  await sendOtp(c, email.trim());
}
export async function confirmOtp(email: string, code: string) {
  const c = client();
  if (!c) throw new Error('Supabase belum diatur.');
  await verifyOtp(c, email.trim(), code);
  await refreshAuth();
}
export async function signOut() {
  await client()?.auth.signOut();
  await refreshAuth();
}

export async function remoteVaults(): Promise<RemoteVault[]> {
  const c = client();
  return c ? listRemoteVaults(c) : [];
}

/** Aktifkan sinkron untuk vault ini: buat vault cloud baru atau gabung ke yang sudah ada. */
export async function enableSync(vault: Vault, join?: RemoteVault) {
  const c = client();
  if (!c) throw new Error('Supabase belum diatur.');
  const id = join?.id ?? crypto.randomUUID?.() ?? `${randomId(4)}-${randomId(2)}-${randomId(2)}-${randomId(2)}-${randomId(6)}`;
  if (!join) await createRemoteVault(c, id, vault.fs.label);
  await vault.setConfig({ syncId: id });
}
export async function disableSync(vault: Vault) {
  await vault.setConfig({ syncId: null });
}

let running = false;
export async function syncNow(vault: Vault): Promise<SyncReport | null> {
  const st = useSyncStore.getState();
  const c = client();
  if (running || !c || !st.userId || !vault.config.syncId) return null;
  running = true;
  useSyncStore.setState({ status: 'syncing', error: null });
  try {
    const report = await runSync(vault, new SupabaseRemote(c, st.userId, vault.config.syncId));
    useSyncStore.setState({ status: 'ready', last: report, error: report.errors[0]?.message ?? null });
    return report;
  } catch (e) {
    useSyncStore.setState({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    return null;
  } finally {
    running = false;
  }
}

/** Pasang di App: sinkron otomatis (setelah edit, saat kembali online / fokus, dan berkala). */
export function useAutoSync(vault: Vault | null) {
  const status = useSyncStore((s) => s.status);
  const timer = useRef<number | undefined>(undefined);
  const skipVersion = useRef(-1);

  useEffect(() => { void refreshAuth(); }, []);

  useEffect(() => {
    if (!vault || status === 'off' || status === 'signedOut') return;
    const run = async () => {
      if (!vault.config.syncId) return;
      await syncNow(vault);
      skipVersion.current = vault.version;
    };
    const schedule = () => {
      if (vault.version === skipVersion.current) return;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(run, 4000);
    };
    const off = vault.subscribe(schedule);
    const onOnline = () => void run();
    const onVisible = () => { if (document.visibilityState === 'visible') void run(); };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    const iv = window.setInterval(run, 90_000);
    void run();
    return () => {
      off();
      window.clearTimeout(timer.current);
      window.clearInterval(iv);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [vault, status === 'ready' || status === 'syncing' || status === 'error']);
}
