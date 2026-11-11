/** Abstraksi penyimpanan vault. Satu antarmuka, beberapa adapter (lihat adapters.ts). */

export interface FileEntry {
  /** path relatif vault, pemisah "/", tanpa awalan "/" */
  path: string;
  mtime: number;
  size: number;
}

export interface VaultFS {
  readonly kind: 'memory' | 'idb' | 'web' | 'tauri' | 'capacitor';
  /** nama yang ditampilkan untuk vault ini */
  readonly label: string;
  /** daftar semua file (rekursif), tanpa folder tersembunyi (.noto, .git, .trash, dst.) */
  list(): Promise<FileEntry[]>;
  readText(path: string): Promise<string>;
  readBinary(path: string): Promise<Uint8Array>;
  writeText(path: string, content: string): Promise<void>;
  writeBinary(path: string, data: Uint8Array): Promise<void>;
  remove(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  /** folder kosong ikut ditampilkan di file tree */
  listDirs(): Promise<string[]>;
  removeDir(path: string): Promise<void>;
}

export const HIDDEN_DIRS = new Set(['.noto', '.git', '.obsidian', '.trash', '.DS_Store', 'node_modules']);

export function isHidden(path: string): boolean {
  return path.split('/').some((seg) => HIDDEN_DIRS.has(seg) || (seg.startsWith('.') && seg !== '.'));
}

export function normPath(p: string): string {
  const out: string[] = [];
  for (const seg of p.replace(/\\/g, '/').split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { out.pop(); continue; }
    out.push(seg);
  }
  return out.join('/');
}

/** Nama file aman lintas OS (Windows/Android melarang beberapa karakter). */
export function safeName(name: string): string {
  const s = name.replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').replace(/[. ]+$/, '');
  return s.slice(0, 120) || 'Tanpa judul';
}

export async function uniquePath(fs: Pick<VaultFS, 'exists'>, dir: string, base: string, ext: string): Promise<string> {
  const mk = (n: number) => `${dir ? dir + '/' : ''}${base}${n ? ` ${n}` : ''}${ext}`;
  for (let n = 0; n < 1000; n++) {
    const p = mk(n);
    if (!(await fs.exists(p))) return p;
  }
  return mk(Date.now());
}
