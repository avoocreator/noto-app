import { isHidden, normPath, type FileEntry, type VaultFS } from './fs.ts';

/** Adapter di memori: dipakai untuk tes dan mode demo. */
export class MemoryFS implements VaultFS {
  readonly kind = 'memory' as const;
  readonly label: string;
  private files = new Map<string, { data: Uint8Array; mtime: number }>();
  private dirs = new Set<string>();
  private clock: () => number;

  constructor(label = 'Demo', clock: () => number = () => Date.now()) {
    this.label = label;
    this.clock = clock;
  }

  private enc = new TextEncoder();
  private dec = new TextDecoder();

  private touchDirs(path: string) {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) this.dirs.add(parts.slice(0, i).join('/'));
  }

  async list(): Promise<FileEntry[]> {
    return [...this.files.entries()]
      .filter(([p]) => !isHidden(p))
      .map(([path, f]) => ({ path, mtime: f.mtime, size: f.data.length }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }
  async listDirs(): Promise<string[]> {
    return [...this.dirs].filter((d) => !isHidden(d)).sort();
  }
  private get(path: string) {
    const f = this.files.get(normPath(path));
    if (!f) throw new Error(`File tidak ditemukan: ${path}`);
    return f;
  }
  async readText(path: string) { return this.dec.decode(this.get(path).data); }
  async readBinary(path: string) { return this.get(path).data.slice(); }
  async writeText(path: string, content: string) { return this.writeBinary(path, this.enc.encode(content)); }
  async writeBinary(path: string, data: Uint8Array) {
    const p = normPath(path);
    this.touchDirs(p);
    this.files.set(p, { data: data.slice(), mtime: this.clock() });
  }
  async remove(path: string) { this.files.delete(normPath(path)); }
  async rename(from: string, to: string) {
    const a = normPath(from);
    const b = normPath(to);
    if (this.files.has(a)) {
      const f = this.files.get(a)!;
      this.files.delete(a);
      this.touchDirs(b);
      this.files.set(b, { ...f, mtime: this.clock() });
      return;
    }
    // folder
    const prefix = a + '/';
    let moved = false;
    for (const [p, f] of [...this.files]) {
      if (p.startsWith(prefix)) {
        this.files.delete(p);
        this.files.set(b + '/' + p.slice(prefix.length), f);
        moved = true;
      }
    }
    for (const d of [...this.dirs]) {
      if (d === a || d.startsWith(prefix)) {
        this.dirs.delete(d);
        this.dirs.add(b + d.slice(a.length));
        moved = true;
      }
    }
    if (!moved) throw new Error(`Tidak ditemukan: ${from}`);
    this.touchDirs(b + '/x');
  }
  async exists(path: string) {
    const p = normPath(path);
    return this.files.has(p) || this.dirs.has(p);
  }
  async mkdir(path: string) {
    const p = normPath(path);
    this.touchDirs(p + '/x');
  }
  async removeDir(path: string) {
    const prefix = normPath(path) + '/';
    for (const p of [...this.files.keys()]) if (p.startsWith(prefix)) this.files.delete(p);
    for (const d of [...this.dirs]) if (d === normPath(path) || d.startsWith(prefix)) this.dirs.delete(d);
  }
}
