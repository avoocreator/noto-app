import { randomId } from '../lib/hash.ts';
import { IdbFS } from './idbFs.ts';
import { Vault } from './vault.ts';
import { seedVault } from './seed.ts';
import { ensurePermission, forgetHandle, loadHandle, pickDirectory, saveHandle, webFsSupported, WebFS } from './webFs.ts';
import { isTauri, pickTauriFolder, TauriFS } from './tauriFs.ts';
import { CapFS, isNative } from './capFs.ts';
import type { VaultFS } from './fs.ts';

export type VaultKind = 'idb' | 'web' | 'tauri' | 'capacitor';
export interface VaultRecord {
  id: string;
  kind: VaultKind;
  label: string;
  /** hanya Tauri */
  path?: string;
}

const KEY = 'noto-vaults';
const ACTIVE = 'noto-active-vault';

export function listVaults(): VaultRecord[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as VaultRecord[]; } catch { return []; }
}
function saveList(l: VaultRecord[]) {
  try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* storage penuh/diblokir */ }
}
export function activeVaultId(): string | null {
  try { return localStorage.getItem(ACTIVE); } catch { return null; }
}
export function setActiveVaultId(id: string | null) {
  try { id ? localStorage.setItem(ACTIVE, id) : localStorage.removeItem(ACTIVE); } catch { /* abaikan */ }
}

/** Kemampuan platform → menentukan opsi di layar sambutan. */
export function capabilities() {
  return {
    folder: isTauri() || webFsSupported(),
    folderKind: (isTauri() ? 'tauri' : webFsSupported() ? 'web' : null) as 'tauri' | 'web' | null,
    native: isNative(),
    tauri: isTauri(),
  };
}

async function toFS(rec: VaultRecord, interactive = false): Promise<VaultFS | null> {
  switch (rec.kind) {
    case 'idb': return new IdbFS(rec.id, rec.label);
    case 'capacitor': return new CapFS(rec.id, rec.label);
    case 'tauri': return rec.path ? new TauriFS(rec.path) : null;
    case 'web': {
      const h = await loadHandle(rec.id);
      if (!h) return null;
      if (!(await ensurePermission(h, interactive))) return null;
      return new WebFS(h);
    }
  }
}

export async function openRecord(rec: VaultRecord, interactive = false): Promise<Vault | null> {
  const fs = await toFS(rec, interactive);
  if (!fs) return null;
  const v = new Vault(fs);
  await v.load();
  setActiveVaultId(rec.id);
  return v;
}

/** Folder asli lewat dialog (desktop/Chrome). */
export async function openFolderVault(): Promise<{ rec: VaultRecord; vault: Vault } | null> {
  let rec: VaultRecord;
  if (isTauri()) {
    const path = await pickTauriFolder();
    if (!path) return null;
    rec = { id: 'v-' + randomId(4), kind: 'tauri', label: path.split(/[\\/]/).pop() || path, path };
  } else if (webFsSupported()) {
    let h: FileSystemDirectoryHandle;
    try { h = await pickDirectory(); } catch { return null; } // dibatalkan
    rec = { id: 'v-' + randomId(4), kind: 'web', label: h.name };
    await saveHandle(rec.id, h);
  } else return null;
  const vault = await openRecord(rec, true);
  if (!vault) return null;
  saveList([...listVaults().filter((r) => !(r.kind === rec.kind && r.path && r.path === rec.path)), rec]);
  if (vault.notes.length === 0) await seedVault(vault);
  return { rec, vault };
}

/** Vault tersimpan di app (browser: IndexedDB, Android: folder privat app). */
export async function createLocalVault(label = 'Vault saya'): Promise<{ rec: VaultRecord; vault: Vault }> {
  const rec: VaultRecord = { id: 'v-' + randomId(4), kind: isNative() ? 'capacitor' : 'idb', label };
  const vault = (await openRecord(rec, true))!;
  saveList([...listVaults(), rec]);
  await seedVault(vault);
  return { rec, vault };
}

export async function forgetVault(rec: VaultRecord) {
  saveList(listVaults().filter((r) => r.id !== rec.id));
  if (rec.kind === 'web') await forgetHandle(rec.id);
  if (activeVaultId() === rec.id) setActiveVaultId(null);
}

/** Buka vault terakhir; null bila belum ada / izin perlu diminta ulang lewat klik pengguna. */
export async function restoreActive(): Promise<{ rec: VaultRecord; vault: Vault | null } | null> {
  const id = activeVaultId();
  const rec = listVaults().find((r) => r.id === id);
  if (!rec) return null;
  try {
    return { rec, vault: await openRecord(rec, false) };
  } catch {
    return { rec, vault: null };
  }
}
