import { asStringList, parseFrontmatter, type FmValue } from './frontmatter.ts';
import { extractTasks, type TaskItem } from './tasks.ts';

export interface LinkRef {
  target: string;
  heading?: string;
  alias?: string;
  embed: boolean;
  line: number; // 0-based, relatif ke seluruh file
  context: string;
}

export interface Heading {
  level: number;
  text: string;
  line: number;
}

export interface NoteMeta {
  path: string;
  title: string;
  folder: string;
  mtime: number;
  size: number;
  fm: Record<string, FmValue>;
  tags: string[];
  aliases: string[];
  links: LinkRef[];
  headings: Heading[];
  tasks: TaskItem[];
  words: number;
  excerpt: string;
}

export function basename(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? path : path.slice(i + 1);
}

export function dirname(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}

export function stripExt(name: string): string {
  return name.replace(/\.(md|markdown|canvas)$/i, '');
}

export function extOf(path: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(path);
  return m ? m[1].toLowerCase() : '';
}

export const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp'];
export const isImagePath = (p: string) => IMAGE_EXT.includes(extOf(p));
export const isNotePath = (p: string) => /\.(md|markdown)$/i.test(p);
export const isCanvasPath = (p: string) => /\.canvas$/i.test(p);

const WIKI = /(!?)\[\[([^\[\]|#\n]+?)(?:#([^\[\]|\n]+?))?(?:\|([^\[\]\n]+?))?\]\]/g;
const TAG = /(?:^|[\s(])#([\p{L}\p{N}_/-]*[\p{L}_/-][\p{L}\p{N}_/-]*)/gu;

function blank(line: string): string {
  // kosongkan inline code agar tidak dianggap link/tag
  return line.replace(/`[^`]*`/g, (m) => ' '.repeat(m.length));
}

export function plainExcerpt(body: string, max = 180): string {
  let out = '';
  let fence = false;
  for (const raw of body.split('\n')) {
    const l = raw.trim();
    if (/^(```|~~~)/.test(l)) { fence = !fence; continue; }
    if (fence || l === '' || /^#{1,6}\s/.test(l) || /^(-{3,}|\*{3,})$/.test(l)) continue;
    out += (out ? ' ' : '') + l
      .replace(/!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b ?? a)
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^[>\-*+]\s+(\[[ xX]\]\s+)?/, '')
      .replace(/[*_~`]/g, '');
    if (out.length >= max) break;
  }
  return out.length > max ? out.slice(0, max - 1).trimEnd() + '…' : out;
}

export function analyzeNote(path: string, content: string, mtime = 0): NoteMeta {
  const fmRes = parseFrontmatter(content);
  const lines = content.split('\n');
  const links: LinkRef[] = [];
  const headings: Heading[] = [];
  const tagSet = new Set<string>();
  let fence = false;

  for (let i = fmRes.fmLines; i < lines.length; i++) {
    const raw = lines[i];
    if (/^\s*(```|~~~)/.test(raw)) { fence = !fence; continue; }
    if (fence) continue;
    const h = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(raw);
    if (h) headings.push({ level: h[1].length, text: h[2].replace(/[*_`]/g, ''), line: i });
    const line = blank(raw);
    WIKI.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = WIKI.exec(line))) {
      links.push({
        embed: m[1] === '!',
        target: m[2].trim(),
        heading: m[3]?.trim(),
        alias: m[4]?.trim(),
        line: i,
        context: raw.trim().slice(0, 160),
      });
    }
    if (!h) {
      TAG.lastIndex = 0;
      let tm: RegExpExecArray | null;
      const noLinks = line.replace(/\[\[[^\]]*\]\]/g, (x) => ' '.repeat(x.length)).replace(/\]\([^)]*\)/g, (x) => ' '.repeat(x.length));
      while ((tm = TAG.exec(noLinks))) tagSet.add(tm[1]);
    }
  }
  for (const t of asStringList(fmRes.data.tags ?? fmRes.data.tag)) tagSet.add(t.replace(/^#/, ''));

  const body = fmRes.body;
  const words = (body.match(/[\p{L}\p{N}']+/gu) ?? []).length;
  const name = stripExt(basename(path));
  const fmTitle = typeof fmRes.data.title === 'string' ? fmRes.data.title : undefined;

  return {
    path,
    title: fmTitle || name,
    folder: dirname(path),
    mtime,
    size: content.length,
    fm: fmRes.data,
    tags: [...tagSet],
    aliases: asStringList(fmRes.data.aliases ?? fmRes.data.alias),
    links,
    headings,
    tasks: extractTasks(content, fmRes.fmLines),
    words,
    excerpt: plainExcerpt(body),
  };
}
