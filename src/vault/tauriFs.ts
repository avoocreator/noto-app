import { HIDDEN_DIRS, normPath, type FileEntry, type VaultFS } from './fs.ts';

/** Vault di folder asli pada desktop (Tauri 2). Modul Tauri dimuat dinamis agar build web tetap ringan. */

export const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function pickTauriFolder(): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const r = await open({ directory: true, multiple: false, title: 'Pilih folder vault' });
  return typeof r === 'string' ? r : null;
}

export class TauriFS implements VaultFS {
  readonly kind = 'tauri' as const;
  readonly label: string;
  private root: string;
  constructor(root: string) {
    this.root = root.replace(/[\\/]+$/, '');
    this.label = this.root.split(/[\\/]/).pop() || this.root;
  }
  private abs(p: string) { return this.root + '/' + normPath(p); }
  private get api() { return import('@tauri-apps/plugin-fs'); }

  async list(): Promise<FileEntry[]> {
    const fs = await this.api;
    const out: FileEntry[] = [];
    const walk = async (rel: string) => {
      for (const e of await fs.readDir(rel ? this.abs(rel) : this.root)) {
        if (HIDDEN_DIRS.has(e.name) || e.name.startsWith('.')) continue;
        const p = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory) await walk(p);
        else {
          const st = await fs.stat(this.abs(p));
          out.push({ path: p, mtime: st.mtime ? new Date(st.mtime).getTime() : 0, size: st.size });
        }
      }
    };
    await walk('');
    return out;
  }
  async listDirs(): Promise<string[]> {
    const fs = await this.api;
    const out: string[] = [];
    const walk = async (rel: string) => {
      for (const e of await fs.readDir(rel ? this.abs(rel) : this.root)) {
        if (!e.isDirectory || HIDDEN_DIRS.has(e.name) || e.name.startsWith('.')) continue;
        const p = rel ? `${rel}/${e.name}` : e.name;
        out.push(p);
        await walk(p);
      }
    };
    await walk('');
    return out.sort();
  }
  async readText(path: string) { return (await this.api).readTextFile(this.abs(path)); }
  async readBinary(path: string) { return (await this.api).readFile(this.abs(path)); }
  private async ensureDir(path: string) {
    const i = normPath(path).lastIndexOf('/');
    if (i > 0) await (await this.api).mkdir(this.abs(normPath(path).slice(0, i)), { recursive: true });
  }
  async writeText(path: string, content: string) {
    await this.ensureDir(path);
    await (await this.api).writeTextFile(this.abs(path), content);
  }
  async writeBinary(path: string, data: Uint8Array) {
    await this.ensureDir(path);
    await (await this.api).writeFile(this.abs(path), data);
  }
  async remove(path: string) { await (await this.api).remove(this.abs(path)); }
  async removeDir(path: string) { await (await this.api).remove(this.abs(path), { recursive: true }); }
  async exists(path: string) { return (await this.api).exists(this.abs(path)); }
  async mkdir(path: string) { await (await this.api).mkdir(this.abs(path), { recursive: true }); }
  async rename(from: string, to: string) {
    await this.ensureDir(to);
    await (await this.api).rename(this.abs(from), this.abs(to));
  }
}
