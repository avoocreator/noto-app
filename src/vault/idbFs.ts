import { isHidden, normPath, type FileEntry, type VaultFS } from './fs.ts';

interface Rec { path: string; data: Uint8Array; mtime: number }

function open(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('files', { keyPath: 'path' });
      db.createObjectStore('dirs', { keyPath: 'path' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const wrap = <T>(r: IDBRequest<T>) =>
  new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

/** Vault di dalam browser (IndexedDB). Dipakai ketika File System Access API tidak tersedia. */
export class IdbFS implements VaultFS {
  readonly kind = 'idb' as const;
  readonly label: string;
  private db: Promise<IDBDatabase>;
  private enc = new TextEncoder();
  private dec = new TextDecoder();

  constructor(public readonly id: string, label?: string) {
    this.label = label ?? id;
    this.db = open('noto-vault-' + id);
  }

  private async store(name: 'files' | 'dirs', mode: IDBTransactionMode = 'readonly') {
    return (await this.db).transaction(name, mode).objectStore(name);
  }
  private async getRec(path: string) {
    return (await wrap((await this.store('files')).get(normPath(path)))) as Rec | undefined;
  }
  private async addDirs(path: string) {
    const parts = path.split('/');
    const st = await this.store('dirs', 'readwrite');
    for (let i = 1; i < parts.length; i++) st.put({ path: parts.slice(0, i).join('/') });
  }

  async list(): Promise<FileEntry[]> {
    const all = (await wrap((await this.store('files')).getAll())) as Rec[];
    return all.filter((r) => !isHidden(r.path)).map((r) => ({ path: r.path, mtime: r.mtime, size: r.data.length }));
  }
  async listDirs(): Promise<string[]> {
    const all = (await wrap((await this.store('dirs')).getAllKeys())) as string[];
    return all.filter((d) => !isHidden(d)).sort();
  }
  async readText(path: string) { return this.dec.decode(await this.readBinary(path)); }
  async readBinary(path: string) {
    const r = await this.getRec(path);
    if (!r) throw new Error(`File tidak ditemukan: ${path}`);
    return r.data;
  }
  async writeText(path: string, content: string) { return this.writeBinary(path, this.enc.encode(content)); }
  async writeBinary(path: string, data: Uint8Array) {
    const p = normPath(path);
    await this.addDirs(p);
    await wrap((await this.store('files', 'readwrite')).put({ path: p, data, mtime: Date.now() } satisfies Rec));
  }
  async remove(path: string) { await wrap((await this.store('files', 'readwrite')).delete(normPath(path))); }
  async exists(path: string) {
    const p = normPath(path);
    if (await this.getRec(p)) return true;
    return !!(await wrap((await this.store('dirs')).get(p)));
  }
  async mkdir(path: string) { await this.addDirs(normPath(path) + '/x'); }
  async rename(from: string, to: string) {
    const a = normPath(from);
    const b = normPath(to);
    const one = await this.getRec(a);
    if (one) {
      await this.addDirs(b);
      await wrap((await this.store('files', 'readwrite')).put({ ...one, path: b, mtime: Date.now() }));
      await this.remove(a);
      return;
    }
    const all = (await wrap((await this.store('files')).getAll())) as Rec[];
    for (const r of all.filter((x) => x.path.startsWith(a + '/'))) {
      const np = b + r.path.slice(a.length);
      await this.addDirs(np);
      await wrap((await this.store('files', 'readwrite')).put({ ...r, path: np }));
      await this.remove(r.path);
    }
    const dirs = (await wrap((await this.store('dirs')).getAllKeys())) as string[];
    for (const d of dirs.filter((x) => x === a || x.startsWith(a + '/'))) {
      await wrap((await this.store('dirs', 'readwrite')).delete(d));
      await wrap((await this.store('dirs', 'readwrite')).put({ path: b + d.slice(a.length) }));
    }
  }
  async removeDir(path: string) {
    const a = normPath(path);
    const all = (await wrap((await this.store('files')).getAllKeys())) as string[];
    for (const k of all.filter((x) => x.startsWith(a + '/'))) await this.remove(k);
    const dirs = (await wrap((await this.store('dirs')).getAllKeys())) as string[];
    for (const d of dirs.filter((x) => x === a || x.startsWith(a + '/'))) await wrap((await this.store('dirs', 'readwrite')).delete(d));
  }
}
