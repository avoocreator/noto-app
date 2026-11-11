import { hashBytes, hashText } from '../lib/hash.ts';
import { conflictPath, planSync, type HashMap } from '../lib/syncPlan.ts';
import { isCanvasPath, isNotePath } from '../lib/analyze.ts';
import type { Vault } from '../vault/vault.ts';

export interface RemoteFile {
  path: string;
  hash: string;
  kind: 'text' | 'blob';
}

/** Penyimpanan cloud (diimplementasikan Supabase; tes memakai versi memori). Hanya file yang tidak dihapus. */
export interface RemoteStore {
  list(): Promise<RemoteFile[]>;
  getText(path: string): Promise<string>;
  getBlob(path: string): Promise<Uint8Array>;
  putText(path: string, content: string, hash: string): Promise<void>;
  putBlob(path: string, data: Uint8Array, hash: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export interface SyncReport {
  pushed: number;
  pulled: number;
  deleted: number;
  conflicts: string[];
  errors: { path: string; message: string }[];
  at: number;
}

const BASE_PATH = '.noto/sync-base.json';
const isText = (p: string) => isNotePath(p) || isCanvasPath(p);

const blobHashCache = new Map<string, string>();

async function localHashes(vault: Vault): Promise<{ map: HashMap; kinds: Map<string, 'text' | 'blob'> }> {
  const map: HashMap = {};
  const kinds = new Map<string, 'text' | 'blob'>();
  for (const f of vault.files) {
    if (isText(f.path)) {
      map[f.path] = await hashText(vault.content(f.path) ?? '');
      kinds.set(f.path, 'text');
    } else {
      const key = `${f.path}|${f.mtime}|${f.size}`;
      let h = blobHashCache.get(key);
      if (!h) {
        h = await hashBytes(await vault.fs.readBinary(f.path));
        blobHashCache.set(key, h);
      }
      map[f.path] = h;
      kinds.set(f.path, 'blob');
    }
  }
  return { map, kinds };
}

async function readBase(vault: Vault): Promise<HashMap> {
  try {
    if (!(await vault.fs.exists(BASE_PATH))) return {};
    return JSON.parse(await vault.fs.readText(BASE_PATH)) as HashMap;
  } catch {
    return {};
  }
}

export async function runSync(vault: Vault, remote: RemoteStore): Promise<SyncReport> {
  const report: SyncReport = { pushed: 0, pulled: 0, deleted: 0, conflicts: [], errors: [], at: Date.now() };
  await vault.refresh();
  const { map: local, kinds } = await localHashes(vault);
  const remoteList = await remote.list();
  const remoteMap: HashMap = {};
  const remoteKind = new Map<string, 'text' | 'blob'>();
  for (const r of remoteList) {
    remoteMap[r.path] = r.hash;
    remoteKind.set(r.path, r.kind);
  }
  const base = await readBase(vault);
  const actions = planSync(local, remoteMap, base);

  const pull = async (path: string) => {
    const kind = remoteKind.get(path) ?? (isText(path) ? 'text' : 'blob');
    if (kind === 'text') await vault.write(path, await remote.getText(path));
    else {
      await vault.fs.writeBinary(path, await remote.getBlob(path));
    }
    base[path] = remoteMap[path];
    report.pulled++;
  };

  for (const a of actions) {
    try {
      switch (a.type) {
        case 'push': {
          if (kinds.get(a.path) === 'text') await remote.putText(a.path, vault.content(a.path) ?? '', local[a.path]);
          else await remote.putBlob(a.path, await vault.fs.readBinary(a.path), local[a.path]);
          base[a.path] = local[a.path];
          report.pushed++;
          break;
        }
        case 'pull':
          await pull(a.path);
          break;
        case 'deleteLocal':
          if (vault.has(a.path)) await vault.remove(a.path);
          delete base[a.path];
          report.deleted++;
          break;
        case 'deleteRemote':
          await remote.remove(a.path);
          delete base[a.path];
          report.deleted++;
          break;
        case 'adopt':
          if (a.hash === undefined) delete base[a.path];
          else base[a.path] = a.hash;
          break;
        case 'conflict': {
          const copy = conflictPath(a.path, vault.config.deviceId);
          if (kinds.get(a.path) === 'text') await vault.write(copy, vault.content(a.path) ?? '');
          else await vault.fs.writeBinary(copy, await vault.fs.readBinary(a.path));
          await pull(a.path);
          report.conflicts.push(a.path);
          break;
        }
      }
    } catch (e) {
      report.errors.push({ path: a.path, message: e instanceof Error ? e.message : String(e) });
    }
  }
  await vault.fs.writeText(BASE_PATH, JSON.stringify(base));
  await vault.refresh();
  return report;
}

/** Memori: implementasi RemoteStore untuk tes dan mode demo. */
export class MemoryRemote implements RemoteStore {
  files = new Map<string, { kind: 'text' | 'blob'; text?: string; blob?: Uint8Array; hash: string }>();
  async list() {
    return [...this.files.entries()].map(([path, f]) => ({ path, hash: f.hash, kind: f.kind }));
  }
  async getText(path: string) { return this.files.get(path)!.text!; }
  async getBlob(path: string) { return this.files.get(path)!.blob!.slice(); }
  async putText(path: string, text: string, hash: string) { this.files.set(path, { kind: 'text', text, hash }); }
  async putBlob(path: string, blob: Uint8Array, hash: string) { this.files.set(path, { kind: 'blob', blob: blob.slice(), hash }); }
  async remove(path: string) { this.files.delete(path); }
}
