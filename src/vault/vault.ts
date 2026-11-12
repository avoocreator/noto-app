import { analyzeNote, basename, dirname, isCanvasPath, isImagePath, isNotePath, stripExt, type NoteMeta } from '../lib/analyze.ts';
import { buildIndex, resolveLink, type VaultIndex } from '../lib/vaultIndex.ts';
import { SearchIndex, type SearchHit } from '../lib/search.ts';
import { rewriteLinks } from '../lib/links.ts';
import { applyTemplate, BUILTIN_TEMPLATES, DEFAULT_DAILY } from '../lib/template.ts';
import { formatLongDate, ymd } from '../lib/dates.ts';
import { makeZip, type ZipEntry } from '../lib/zip.ts';
import { randomId } from '../lib/hash.ts';
import { emptyCanvas, serializeCanvas } from '../lib/jsoncanvas.ts';
import { normPath, safeName, uniquePath, type FileEntry, type VaultFS } from './fs.ts';

export type DisplayMode = 'simple' | 'full';

export interface VaultConfig {
  dailyFolder: string;
  templateFolder: string;
  attachmentFolder: string;
  pinned: string[];
  /** catatan yang ditampilkan di widget (HP & jendela tempel desktop) */
  widgetPath: string | null;
  deviceId: string;
  /** id vault di cloud (null = sinkron belum diaktifkan) */
  syncId: string | null;
  /** ikon (emoji) per berkas/folder */
  icons: Record<string, string>;
  /** mode tampilan: 'simple' (fokus menulis & tenang) atau 'full' (lengkap dengan graf & panel teknis) */
  displayMode: DisplayMode;
}

const DEFAULT_CONFIG = (): VaultConfig => ({
  dailyFolder: 'Harian',
  templateFolder: 'Templat',
  attachmentFolder: 'Lampiran',
  pinned: [],
  widgetPath: null,
  deviceId: 'dev-' + randomId(3),
  syncId: null,
  icons: {},
  displayMode: 'simple',
});

export interface HistoryEntry {
  ts: number;
  content: string;
}
export interface TrashRecord {
  id: string;
  original: string;
  trashPath: string;
  ts: number;
}

const CONFIG_PATH = '.noto/config.json';
const TRASH_INDEX = '.noto/trash.json';
const HISTORY_GAP_MS = 5 * 60 * 1000;
const HISTORY_MAX = 30;

function fnv(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
const historyPath = (p: string) => `.noto/history/${safeName(basename(p)).slice(0, 40)}-${fnv(p)}.json`;

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  svg: 'image/svg+xml', avif: 'image/avif', bmp: 'image/bmp', pdf: 'application/pdf',
};

export class Vault {
  readonly fs: VaultFS;
  private contents = new Map<string, string>();
  private metas = new Map<string, NoteMeta>();
  private entries = new Map<string, FileEntry>();
  private searchIdx = new SearchIndex();
  private listeners = new Set<() => void>();
  private writeChain = new Map<string, Promise<unknown>>();
  private lastSnap = new Map<string, number>();
  private blobUrls = new Map<string, string>();
  private cfg: VaultConfig = DEFAULT_CONFIG();

  index: VaultIndex = buildIndex([]);
  dirs: string[] = [];
  version = 0;
  ready = false;

  constructor(fs: VaultFS) {
    this.fs = fs;
  }

  // ── langganan (kompatibel useSyncExternalStore) ───────────────────────────────────────
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };
  getVersion = () => this.version;
  private emit() {
    this.version++;
    for (const l of [...this.listeners]) l();
  }
  private rebuild() {
    this.index = buildIndex([...this.metas.values()]);
  }

  // ── muat ─────────────────────────────────────────────────────────────────────────────
  async load(): Promise<void> {
    await this.loadConfig();
    const list = await this.fs.list();
    this.dirs = await this.fs.listDirs();
    this.contents.clear();
    this.metas.clear();
    this.entries.clear();
    this.searchIdx.clear();
    for (const f of list) this.entries.set(f.path, f);
    const textFiles = list.filter((f) => isNotePath(f.path) || isCanvasPath(f.path));
    const BATCH = 24;
    for (let i = 0; i < textFiles.length; i += BATCH) {
      await Promise.all(
        textFiles.slice(i, i + BATCH).map(async (f) => {
          try {
            this.ingest(f.path, await this.fs.readText(f.path), f.mtime);
          } catch { /* file rusak/terkunci dilewati */ }
        }),
      );
    }
    this.rebuild();
    this.ready = true;
    this.emit();
  }

  private ingest(path: string, content: string, mtime: number) {
    this.contents.set(path, content);
    if (isNotePath(path)) {
      const meta = analyzeNote(path, content, mtime);
      this.metas.set(path, meta);
      this.searchIdx.set(meta, content);
    }
  }

  /** Cek perubahan dari luar (mis. Obsidian / sync folder). Mengembalikan path yang berubah. */
  async refresh(): Promise<string[]> {
    const list = await this.fs.list();
    this.dirs = await this.fs.listDirs();
    const changed: string[] = [];
    const seen = new Set<string>();
    for (const f of list) {
      seen.add(f.path);
      const old = this.entries.get(f.path);
      const textual = isNotePath(f.path) || isCanvasPath(f.path);
      if (!old || old.mtime !== f.mtime || old.size !== f.size) {
        this.entries.set(f.path, f);
        if (textual) {
          try {
            const c = await this.fs.readText(f.path);
            if (this.contents.get(f.path) !== c) {
              this.ingest(f.path, c, f.mtime);
              changed.push(f.path);
            }
          } catch { /* abaikan */ }
        } else if (!old) changed.push(f.path);
      }
    }
    for (const p of [...this.entries.keys()]) {
      if (!seen.has(p)) {
        this.entries.delete(p);
        this.contents.delete(p);
        this.metas.delete(p);
        this.searchIdx.delete(p);
        changed.push(p);
      }
    }
    if (changed.length) {
      this.rebuild();
      this.emit();
    } else if (list.length !== this.entries.size) this.emit();
    return changed;
  }

  // ── baca ─────────────────────────────────────────────────────────────────────────────
  get notes(): NoteMeta[] { return [...this.metas.values()]; }
  get files(): FileEntry[] { return [...this.entries.values()]; }
  meta(path: string): NoteMeta | undefined { return this.metas.get(path); }
  content(path: string): string | undefined { return this.contents.get(path); }
  has(path: string): boolean { return this.entries.has(path); }
  resolve(target: string, from: string | null = null): string | null {
    return resolveLink(target, from, this.index);
  }
  search(q: string, limit = 50): SearchHit[] { return this.searchIdx.search(q, limit); }

  async blobUrl(path: string): Promise<string> {
    const hit = this.blobUrls.get(path);
    if (hit) return hit;
    const data = await this.fs.readBinary(path);
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    const url = URL.createObjectURL(new Blob([data as BlobPart], { type: MIME[ext] ?? 'application/octet-stream' }));
    this.blobUrls.set(path, url);
    return url;
  }

  /** Cari file lampiran dari nama di ![[gambar.png]] */
  resolveAttachment(name: string): string | null {
    const clean = normPath(name);
    if (this.entries.has(clean)) return clean;
    const low = clean.toLowerCase();
    let best: string | null = null;
    for (const p of this.entries.keys()) {
      const lp = p.toLowerCase();
      if (lp === low) return p;
      if (lp.endsWith('/' + low) && (!best || p.length < best.length)) best = p;
    }
    return best;
  }

  // ── tulis ────────────────────────────────────────────────────────────────────────────
  private serial<T>(path: string, job: () => Promise<T>): Promise<T> {
    const prev = this.writeChain.get(path) ?? Promise.resolve();
    const next = prev.catch(() => undefined).then(job);
    this.writeChain.set(path, next);
    void next.finally(() => { if (this.writeChain.get(path) === next) this.writeChain.delete(path); }).catch(() => undefined);
    return next;
  }

  async write(path: string, content: string): Promise<void> {
    path = normPath(path);
    const prev = this.contents.get(path);
    if (prev === content) return;
    if (prev !== undefined && isNotePath(path)) void this.snapshot(path, prev);
    const now = Date.now();
    this.ingest(path, content, now);
    this.entries.set(path, { path, mtime: now, size: content.length });
    this.dirs = this.dirs.includes(dirname(path)) || !dirname(path) ? this.dirs : [...this.dirs, dirname(path)];
    this.rebuild();
    this.emit();
    await this.serial(path, () => this.fs.writeText(path, content));
  }

  async createNote(opts: { dir?: string; title?: string; content?: string; template?: string; now?: Date } = {}): Promise<string> {
    const dir = normPath(opts.dir ?? '');
    const title = safeName(opts.title?.trim() || 'Tanpa judul');
    const path = await uniquePath(this.fs, dir, title, '.md');
    let body = opts.content;
    if (body === undefined) {
      const tpl = opts.template ? await this.templateBody(opts.template) : null;
      body = tpl ? applyTemplate(tpl, { title, now: opts.now }).text : `# ${title}\n\n`;
    }
    await this.write(path, body);
    return path;
  }

  async createCanvas(dir = '', title = 'Canvas baru'): Promise<string> {
    const path = await uniquePath(this.fs, normPath(dir), safeName(title), '.canvas');
    await this.write(path, serializeCanvas(emptyCanvas()));
    return path;
  }

  async createFolder(path: string): Promise<void> {
    const p = normPath(path);
    await this.fs.mkdir(p);
    this.dirs = [...new Set([...this.dirs, p])];
    this.emit();
  }

  async saveAttachment(name: string, data: Uint8Array): Promise<string> {
    const dot = name.lastIndexOf('.');
    const base = safeName(dot > 0 ? name.slice(0, dot) : name);
    const ext = dot > 0 ? name.slice(dot).toLowerCase() : '';
    const path = await uniquePath(this.fs, this.cfg.attachmentFolder, base, ext);
    await this.fs.writeBinary(path, data);
    this.entries.set(path, { path, mtime: Date.now(), size: data.length });
    this.emit();
    return path;
  }

  /** Impor file dari luar vault (drag-drop / pilih berkas). .md/.canvas dibaca sebagai teks. */
  async importFile(name: string, data: Uint8Array, dir = ''): Promise<string> {
    if (isNotePath(name) || isCanvasPath(name)) {
      const dot = name.lastIndexOf('.');
      const path = await uniquePath(this.fs, normPath(dir), safeName(name.slice(0, dot)), name.slice(dot).toLowerCase());
      await this.write(path, new TextDecoder().decode(data));
      return path;
    }
    return this.saveAttachment(name, data);
  }

  // ── rename / pindah / hapus ──────────────────────────────────────────────────────────
  /** Pindahkan file. Tautan [[…]] di catatan lain ikut diperbarui. Mengembalikan jumlah tautan diubah. */
  async move(from: string, to: string): Promise<{ path: string; updated: number }> {
    from = normPath(from);
    to = normPath(to);
    if (from === to) return { path: to, updated: 0 };
    if (await this.fs.exists(to)) throw new Error(`Sudah ada: ${to}`);
    const wasNote = isNotePath(from);
    const referrers = wasNote
      ? this.index.backlinks.get(from)?.map((b) => b.from).filter((v, i, a) => a.indexOf(v) === i) ?? []
      : [];
    const oldName = stripExt(basename(from));
    const newName = stripExt(basename(to));

    await this.serial(from, () => this.fs.rename(from, to));
    const c = this.contents.get(from);
    this.entries.delete(from);
    this.contents.delete(from);
    this.metas.delete(from);
    this.searchIdx.delete(from);
    const old = this.history.get(from);
    if (old) { this.history.delete(from); }
    const now = Date.now();
    this.entries.set(to, { path: to, mtime: now, size: c?.length ?? 0 });
    if (c !== undefined) this.ingest(to, c, now);
    this.cfg.pinned = this.cfg.pinned.map((p) => (p === from ? to : p));
    this.remapIcons(from, to);
    if (this.cfg.widgetPath === from) this.cfg.widgetPath = to;
    this.rebuild();

    let updated = 0;
    if (wasNote) {
      for (const ref of referrers) {
        const src = this.contents.get(ref === from ? to : ref);
        if (src === undefined) continue;
        const r = rewriteLinks(src, {
          oldName, newName,
          oldPath: stripExt(from), newPath: stripExt(to),
        });
        if (r.count) {
          updated += r.count;
          await this.write(ref === from ? to : ref, r.content);
        }
      }
    }
    await this.saveConfig();
    this.emit();
    return { path: to, updated };
  }

  async rename(path: string, newTitle: string): Promise<{ path: string; updated: number }> {
    const ext = /\.[A-Za-z0-9]+$/.exec(path)?.[0] ?? '';
    const dir = dirname(path);
    return this.move(path, `${dir ? dir + '/' : ''}${safeName(newTitle)}${ext}`);
  }

  async renameFolder(from: string, to: string): Promise<void> {
    await this.fs.rename(normPath(from), normPath(to));
    this.remapIcons(normPath(from), normPath(to));
    this.cfg.pinned = this.cfg.pinned.map((p) => (p.startsWith(normPath(from) + '/') ? normPath(to) + p.slice(normPath(from).length) : p));
    await this.saveConfig();
    await this.refresh();
    this.emit();
  }

  async remove(path: string): Promise<void> {
    path = normPath(path);
    const id = randomId(4);
    const trashPath = `.trash/${id}/${path}`;
    await this.serial(path, () => this.fs.rename(path, trashPath));
    const list = await this.readJson<TrashRecord[]>(TRASH_INDEX, []);
    list.push({ id, original: path, trashPath, ts: Date.now() });
    await this.fs.writeText(TRASH_INDEX, JSON.stringify(list));
    this.entries.delete(path);
    this.contents.delete(path);
    this.metas.delete(path);
    this.searchIdx.delete(path);
    this.cfg.pinned = this.cfg.pinned.filter((p) => p !== path);
    delete this.cfg.icons[path];
    if (this.cfg.widgetPath === path) this.cfg.widgetPath = null;
    this.rebuild();
    await this.saveConfig();
    this.emit();
  }

  async removeFolder(path: string): Promise<void> {
    const prefix = normPath(path) + '/';
    for (const f of this.files.filter((x) => x.path.startsWith(prefix))) await this.remove(f.path);
    await this.fs.removeDir(normPath(path));
    for (const k of Object.keys(this.cfg.icons)) if (k === normPath(path) || k.startsWith(prefix)) delete this.cfg.icons[k];
    await this.saveConfig();
    this.dirs = this.dirs.filter((d) => d !== normPath(path) && !d.startsWith(prefix));
    this.emit();
  }

  async listTrash(): Promise<TrashRecord[]> {
    return (await this.readJson<TrashRecord[]>(TRASH_INDEX, [])).sort((a, b) => b.ts - a.ts);
  }

  async restore(rec: TrashRecord): Promise<string> {
    const dot = rec.original.lastIndexOf('.');
    const base = dot > 0 ? rec.original.slice(0, dot) : rec.original;
    const ext = dot > 0 ? rec.original.slice(dot) : '';
    const target = await uniquePath(this.fs, '', base, ext);
    await this.fs.rename(rec.trashPath, target);
    const list = (await this.readJson<TrashRecord[]>(TRASH_INDEX, [])).filter((r) => r.id !== rec.id);
    await this.fs.writeText(TRASH_INDEX, JSON.stringify(list));
    await this.refresh();
    return target;
  }

  async emptyTrash(): Promise<void> {
    for (const r of await this.listTrash()) {
      try { await this.fs.remove(r.trashPath); } catch { /* sudah hilang */ }
    }
    await this.fs.writeText(TRASH_INDEX, '[]');
  }

  // ── riwayat versi ────────────────────────────────────────────────────────────────────
  private history = new Map<string, HistoryEntry[]>();

  private async snapshot(path: string, content: string) {
    const last = this.lastSnap.get(path) ?? 0;
    const now = Date.now();
    if (now - last < HISTORY_GAP_MS) return;
    this.lastSnap.set(path, now);
    try {
      const list = await this.getHistory(path);
      if (list[0]?.content === content) return;
      list.unshift({ ts: now, content });
      list.length = Math.min(list.length, HISTORY_MAX);
      this.history.set(path, list);
      await this.fs.writeText(historyPath(path), JSON.stringify(list));
    } catch { /* riwayat bersifat best-effort */ }
  }

  async getHistory(path: string): Promise<HistoryEntry[]> {
    const mem = this.history.get(path);
    if (mem) return [...mem];
    const list = await this.readJson<HistoryEntry[]>(historyPath(path), []);
    this.history.set(path, list);
    return [...list];
  }

  async restoreVersion(path: string, ts: number): Promise<void> {
    const h = (await this.getHistory(path)).find((e) => e.ts === ts);
    if (!h) throw new Error('Versi tidak ditemukan');
    this.lastSnap.delete(path); // paksa simpan versi saat ini dulu
    await this.write(path, h.content);
  }

  // ── konfigurasi, pin, template, harian ────────────────────────────────────────────────
  private async readJson<T>(path: string, fallback: T): Promise<T> {
    try {
      if (!(await this.fs.exists(path))) return fallback;
      return JSON.parse(await this.fs.readText(path)) as T;
    } catch {
      return fallback;
    }
  }

  private async loadConfig() {
    this.cfg = { ...DEFAULT_CONFIG(), ...(await this.readJson<Partial<VaultConfig>>(CONFIG_PATH, {})) };
    if (!(await this.fs.exists(CONFIG_PATH))) await this.saveConfig();
  }
  private async saveConfig() {
    await this.fs.writeText(CONFIG_PATH, JSON.stringify(this.cfg, null, 2));
  }
  get config(): VaultConfig { return this.cfg; }
  async setConfig(patch: Partial<VaultConfig>) {
    this.cfg = { ...this.cfg, ...patch };
    await this.saveConfig();
    this.emit();
  }
  async setDisplayMode(mode: DisplayMode) {
    await this.setConfig({ displayMode: mode });
  }
  /** Pindahkan ikon saat berkas/folder dipindah atau diganti namanya. */
  private remapIcons(from: string, to: string) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(this.cfg.icons)) {
      if (k === from) out[to] = v;
      else if (k.startsWith(from + '/')) out[to + k.slice(from.length)] = v;
      else out[k] = v;
    }
    this.cfg.icons = out;
  }
  iconOf(path: string): string | undefined { return this.cfg.icons[normPath(path)]; }
  /** Ganti ikon (emoji) berkas/folder; null = hapus. */
  async setIcon(path: string, icon: string | null) {
    const icons = { ...this.cfg.icons };
    if (icon) icons[normPath(path)] = icon; else delete icons[normPath(path)];
    await this.setConfig({ icons });
  }
  /** Gandakan berkas (catatan, canvas, atau lampiran) menjadi "nama salinan". */
  async duplicate(path: string): Promise<string> {
    path = normPath(path);
    const ext = /\.[A-Za-z0-9]+$/.exec(path)?.[0] ?? '';
    const to = await uniquePath(this.fs, dirname(path), `${stripExt(basename(path))} salinan`, ext);
    if (isNotePath(path) || isCanvasPath(path)) await this.write(to, this.contents.get(path) ?? (await this.fs.readText(path)));
    else { await this.fs.writeBinary(to, await this.fs.readBinary(path)); await this.refresh(); }
    const ic = this.cfg.icons[path];
    if (ic) await this.setIcon(to, ic);
    return to;
  }
  async togglePin(path: string) {
    const has = this.cfg.pinned.includes(path);
    await this.setConfig({ pinned: has ? this.cfg.pinned.filter((p) => p !== path) : [...this.cfg.pinned, path] });
  }

  private async templateBody(name: string): Promise<string | null> {
    const file = `${this.cfg.templateFolder}/${name}.md`;
    const c = this.contents.get(file);
    if (c !== undefined) return c;
    return BUILTIN_TEMPLATES.find((t) => t.name.toLowerCase() === name.toLowerCase())?.body ?? null;
  }

  templates(): string[] {
    const own = this.notes.filter((n) => n.folder === this.cfg.templateFolder).map((n) => stripExt(basename(n.path)));
    const builtin = BUILTIN_TEMPLATES.map((t) => t.name).filter((n) => !own.includes(n));
    return [...own, ...builtin];
  }

  dailyPath(d: Date): string {
    return `${this.cfg.dailyFolder}/${ymd(d)}.md`;
  }

  async openDaily(d = new Date()): Promise<string> {
    const path = this.dailyPath(d);
    if (this.has(path)) return path;
    const tpl = (await this.templateBody('Harian')) ?? DEFAULT_DAILY;
    const { text } = applyTemplate(tpl, { title: formatLongDate(d), now: d });
    await this.write(path, text);
    return path;
  }

  // ── ekspor ───────────────────────────────────────────────────────────────────────────
  async exportZip(): Promise<Uint8Array> {
    const entries: ZipEntry[] = [];
    for (const f of this.files) {
      const data = isNotePath(f.path) || isCanvasPath(f.path)
        ? new TextEncoder().encode(this.contents.get(f.path) ?? '')
        : await this.fs.readBinary(f.path);
      entries.push({ path: f.path, data, mtime: f.mtime });
    }
    return makeZip(entries);
  }

  isImage(path: string) { return isImagePath(path); }
}
