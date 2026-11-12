import { HIDDEN_DIRS, normPath, type FileEntry, type VaultFS } from './fs.ts';

/**
 * Vault di folder asli lewat File System Access API (Chrome, Edge, Brave, Opera — desktop & Android Chrome).
 * Browser lain (Firefox, Safari) memakai IdbFS.
 */

type Dir = FileSystemDirectoryHandle;
type FileH = FileSystemFileHandle;

export const webFsSupported = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

// ── simpan handle folder agar vault terbuka lagi setelah restart ─────────────────────────────
function handleDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open('noto-handles', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('h');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function saveHandle(key: string, h: Dir) {
  const db = await handleDb();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction('h', 'readwrite');
    tx.objectStore('h').put(h, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
export async function loadHandle(key: string): Promise<Dir | undefined> {
  const db = await handleDb();
  return new Promise((res, rej) => {
    const q = db.transaction('h').objectStore('h').get(key);
    q.onsuccess = () => res(q.result as Dir | undefined);
    q.onerror = () => rej(q.error);
  });
}
export async function forgetHandle(key: string) {
  const db = await handleDb();
  db.transaction('h', 'readwrite').objectStore('h').delete(key);
}

export async function pickDirectory(): Promise<Dir> {
  const w = window as unknown as { showDirectoryPicker: (o?: object) => Promise<Dir> };
  return w.showDirectoryPicker({ mode: 'readwrite', id: 'noto-vault' });
}

type PermHandle = Dir & {
  queryPermission(o: { mode: string }): Promise<PermissionState>;
  requestPermission(o: { mode: string }): Promise<PermissionState>;
};
export async function ensurePermission(h: Dir, request = false): Promise<boolean> {
  const p = h as PermHandle;
  if ((await p.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
  if (!request) return false;
  return (await p.requestPermission({ mode: 'readwrite' })) === 'granted';
}

export class WebFS implements VaultFS {
  readonly kind = 'web' as const;
  readonly label: string;
  private root: Dir;
  constructor(root: Dir) {
    this.root = root;
    this.label = root.name;
  }

  private async dirOf(path: string, create = false): Promise<{ dir: Dir; name: string }> {
    const parts = normPath(path).split('/');
    const name = parts.pop()!;
    let dir = this.root;
    for (const seg of parts) dir = await dir.getDirectoryHandle(seg, { create });
    return { dir, name };
  }
  private async fileHandle(path: string, create = false): Promise<FileH> {
    const { dir, name } = await this.dirOf(path, create);
    return dir.getFileHandle(name, { create });
  }

  async list(): Promise<FileEntry[]> {
    const out: FileEntry[] = [];
    const walk = async (dir: Dir, prefix: string) => {
      for await (const [name, h] of (dir as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
        if (HIDDEN_DIRS.has(name) || name.startsWith('.')) continue;
        if (h.kind === 'directory') await walk(h as Dir, prefix + name + '/');
        else {
          const f = await (h as FileH).getFile();
          out.push({ path: prefix + name, mtime: f.lastModified, size: f.size });
        }
      }
    };
    await walk(this.root, '');
    return out;
  }
  async listDirs(): Promise<string[]> {
    const out: string[] = [];
    const walk = async (dir: Dir, prefix: string) => {
      for await (const [name, h] of (dir as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
        if (h.kind !== 'directory' || HIDDEN_DIRS.has(name) || name.startsWith('.')) continue;
        out.push(prefix + name);
        await walk(h as Dir, prefix + name + '/');
      }
    };
    await walk(this.root, '');
    return out.sort();
  }
  async readText(path: string) { return (await (await this.fileHandle(path)).getFile()).text(); }
  async readBinary(path: string) { return new Uint8Array(await (await (await this.fileHandle(path)).getFile()).arrayBuffer()); }
  async writeText(path: string, content: string) {
    const w = await (await this.fileHandle(path, true)).createWritable();
    await w.write(content);
    await w.close();
  }
  async writeBinary(path: string, data: Uint8Array) {
    const w = await (await this.fileHandle(path, true)).createWritable();
    await w.write(data as BufferSource);
    await w.close();
  }
  async remove(path: string) {
    const { dir, name } = await this.dirOf(path);
    await dir.removeEntry(name);
  }
  async removeDir(path: string) {
    const { dir, name } = await this.dirOf(path);
    await dir.removeEntry(name, { recursive: true });
  }
  async exists(path: string) {
    try {
      const { dir, name } = await this.dirOf(path);
      if (!name) return true;
      try { await dir.getFileHandle(name); return true; } catch { /* mungkin folder */ }
      await dir.getDirectoryHandle(name);
      return true;
    } catch { return false; }
  }
  async mkdir(path: string) {
    let dir = this.root;
    for (const seg of normPath(path).split('/').filter(Boolean)) dir = await dir.getDirectoryHandle(seg, { create: true });
  }
  async rename(from: string, to: string) {
    const a = normPath(from);
    const b = normPath(to);
    const { dir: srcDir, name } = await this.dirOf(a);
    // file?
    try {
      const fh = await srcDir.getFileHandle(name);
      const mv = (fh as unknown as { move?: (p: string) => Promise<void> }).move;
      const data = await fh.getFile();
      void mv; // `move()` belum konsisten antarbrowser → salin lalu hapus
      const w = await (await this.fileHandle(b, true)).createWritable();
      await w.write(data);
      await w.close();
      await srcDir.removeEntry(name);
      return;
    } catch (e) {
      if (!(e instanceof DOMException) || e.name !== 'TypeMismatchError' && e.name !== 'NotFoundError') throw e;
    }
    // folder: salin rekursif lalu hapus
    const srcHandle = await srcDir.getDirectoryHandle(name);
    const copy = async (from: Dir, toPath: string) => {
      await this.mkdir(toPath);
      for await (const [n, h] of (from as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
        if (h.kind === 'directory') await copy(h as Dir, toPath + '/' + n);
        else {
          const w = await (await this.fileHandle(toPath + '/' + n, true)).createWritable();
          await w.write(await (h as FileH).getFile());
          await w.close();
        }
      }
    };
    await copy(srcHandle, b);
    await srcDir.removeEntry(name, { recursive: true });
  }
}
