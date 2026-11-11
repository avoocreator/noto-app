import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { HIDDEN_DIRS, normPath, type FileEntry, type VaultFS } from './fs.ts';

/**
 * Vault di penyimpanan aplikasi Android (Capacitor).
 * Catatan: ini folder privat app (Directory.Data). Untuk membawanya ke PC gunakan Sinkron Supabase
 * atau Ekspor ZIP. Membuka folder bebas lewat SAF memerlukan plugin native tambahan (lihat docs/ANDROID.md).
 */

export const isNative = () => Capacitor.isNativePlatform();

const toB64 = (u: Uint8Array) => {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b: string) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));

export class CapFS implements VaultFS {
  readonly kind = 'capacitor' as const;
  readonly label: string;
  private base: string;
  private dir = Directory.Data;
  constructor(public readonly vaultId: string, label?: string) {
    this.base = `vaults/${vaultId}`;
    this.label = label ?? vaultId;
  }
  private p(path: string) { return path ? `${this.base}/${normPath(path)}` : this.base; }

  async list(): Promise<FileEntry[]> {
    await this.mkdir('');
    const out: FileEntry[] = [];
    const walk = async (rel: string) => {
      const r = await Filesystem.readdir({ path: this.p(rel), directory: this.dir });
      for (const f of r.files) {
        if (HIDDEN_DIRS.has(f.name) || f.name.startsWith('.')) continue;
        const sub = rel ? `${rel}/${f.name}` : f.name;
        if (f.type === 'directory') await walk(sub);
        else out.push({ path: sub, mtime: f.mtime ?? 0, size: f.size ?? 0 });
      }
    };
    await walk('');
    return out;
  }
  async listDirs(): Promise<string[]> {
    const out: string[] = [];
    const walk = async (rel: string) => {
      const r = await Filesystem.readdir({ path: this.p(rel), directory: this.dir });
      for (const f of r.files) {
        if (f.type !== 'directory' || HIDDEN_DIRS.has(f.name) || f.name.startsWith('.')) continue;
        const sub = rel ? `${rel}/${f.name}` : f.name;
        out.push(sub);
        await walk(sub);
      }
    };
    await walk('');
    return out.sort();
  }
  async readText(path: string) {
    const r = await Filesystem.readFile({ path: this.p(path), directory: this.dir, encoding: 'utf8' as never });
    return r.data as string;
  }
  async readBinary(path: string) {
    const r = await Filesystem.readFile({ path: this.p(path), directory: this.dir });
    return fromB64(r.data as string);
  }
  async writeText(path: string, content: string) {
    await Filesystem.writeFile({ path: this.p(path), directory: this.dir, data: content, encoding: 'utf8' as never, recursive: true });
  }
  async writeBinary(path: string, data: Uint8Array) {
    await Filesystem.writeFile({ path: this.p(path), directory: this.dir, data: toB64(data), recursive: true });
  }
  async remove(path: string) { await Filesystem.deleteFile({ path: this.p(path), directory: this.dir }); }
  async removeDir(path: string) { await Filesystem.rmdir({ path: this.p(path), directory: this.dir, recursive: true }); }
  async exists(path: string) {
    try { await Filesystem.stat({ path: this.p(path), directory: this.dir }); return true; } catch { return false; }
  }
  async mkdir(path: string) {
    try { await Filesystem.mkdir({ path: this.p(path), directory: this.dir, recursive: true }); } catch { /* sudah ada */ }
  }
  async rename(from: string, to: string) {
    const dest = normPath(to);
    const i = dest.lastIndexOf('/');
    if (i > 0) await this.mkdir(dest.slice(0, i));
    await Filesystem.rename({ from: this.p(from), to: this.p(to), directory: this.dir, toDirectory: this.dir });
  }
}
