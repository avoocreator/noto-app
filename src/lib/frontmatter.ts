export type FmScalar = string | number | boolean | null;
export type FmValue = FmScalar | FmScalar[];

export interface FrontmatterResult {
  data: Record<string, FmValue>;
  /** isi catatan tanpa blok frontmatter */
  body: string;
  hasFm: boolean;
  /** jumlah baris yang dipakai blok frontmatter (termasuk ---) */
  fmLines: number;
}

const FM_OPEN = /^---[ \t]*\r?\n/;

function findBlock(content: string): { start: number; end: number; inner: string } | null {
  const open = FM_OPEN.exec(content);
  if (!open) return null;
  const from = open[0].length;
  const re = /^---[ \t]*(?:\r?\n|$)/gm;
  re.lastIndex = from;
  const m = re.exec(content);
  if (!m) return null;
  return { start: 0, end: m.index + m[0].length, inner: content.slice(from, m.index) };
}

function parseScalar(raw: string): FmScalar {
  const s = raw.trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if ((s.startsWith('"') && s.endsWith('"') && s.length >= 2) || (s.startsWith("'") && s.endsWith("'") && s.length >= 2)) {
    if (s[0] === '"') {
      try {
        return JSON.parse(s) as string;
      } catch {
        return s.slice(1, -1);
      }
    }
    return s.slice(1, -1).replace(/''/g, "'");
  }
  return s;
}

function splitInline(list: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q: string | null = null;
  for (const ch of list) {
    if (q) {
      cur += ch;
      if (ch === q) q = null;
    } else if (ch === '"' || ch === "'") {
      q = ch;
      cur += ch;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim() !== '') out.push(cur);
  return out;
}

export function parseFrontmatter(content: string): FrontmatterResult {
  const block = findBlock(content);
  if (!block) return { data: {}, body: content, hasFm: false, fmLines: 0 };
  const data: Record<string, FmValue> = {};
  const lines = block.inner.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = /^([A-Za-z0-9_\-À-￿][^:]*?):(?:\s+(.*))?$/.exec(line);
    if (!m) continue;
    const key = m[1].trim();
    const rest = (m[2] ?? '').trim();
    if (rest === '') {
      const items: FmScalar[] = [];
      let j = i + 1;
      while (j < lines.length && /^\s*-\s+/.test(lines[j])) {
        items.push(parseScalar(lines[j].replace(/^\s*-\s+/, '')));
        j++;
      }
      if (items.length) {
        data[key] = items;
        i = j - 1;
      } else data[key] = null;
    } else if (rest.startsWith('[') && rest.endsWith(']')) {
      data[key] = splitInline(rest.slice(1, -1)).map(parseScalar);
    } else {
      data[key] = parseScalar(rest);
    }
  }
  const fmText = content.slice(0, block.end);
  return {
    data,
    body: content.slice(block.end),
    hasFm: true,
    fmLines: fmText.split('\n').length - 1,
  };
}

function formatScalar(v: FmScalar): string {
  if (v === null) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v === '' || /^[\s\-?:,\[\]{}#&*!|>'"%@`]|[:#]\s|\s$|^(true|false|null|~)$|^-?\d+(\.\d+)?$/.test(v)) return JSON.stringify(v);
  return v;
}

export function formatValue(v: FmValue): string {
  if (Array.isArray(v)) return `[${v.map(formatScalar).join(', ')}]`;
  return formatScalar(v);
}

function lineIsKey(line: string, key: string): boolean {
  return new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`).test(line);
}

/** Ubah/tambah satu properti tanpa merusak bagian YAML lain. */
export function setProperty(content: string, key: string, value: FmValue): string {
  const block = findBlock(content);
  const newLine = `${key}: ${formatValue(value)}`.trimEnd();
  if (!block) return `---\n${newLine}\n---\n${content}`;
  const nl = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = block.inner.split(/\r?\n/);
  const idx = lines.findIndex((l) => lineIsKey(l, key));
  if (idx === -1) {
    // sisipkan sebelum baris kosong di akhir blok
    let at = lines.length;
    while (at > 0 && lines[at - 1].trim() === '') at--;
    lines.splice(at, 0, newLine);
  } else {
    let end = idx + 1;
    while (end < lines.length && /^\s*-\s+/.test(lines[end])) end++;
    lines.splice(idx, end - idx, newLine);
  }
  const head = `---${nl}`;
  const tail = content.slice(block.end);
  return `${head}${lines.join(nl).replace(/(\r?\n)+$/, '')}${nl}---${nl}${tail}`;
}

export function removeProperty(content: string, key: string): string {
  const block = findBlock(content);
  if (!block) return content;
  const nl = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = block.inner.split(/\r?\n/);
  const idx = lines.findIndex((l) => lineIsKey(l, key));
  if (idx === -1) return content;
  let end = idx + 1;
  while (end < lines.length && /^\s*-\s+/.test(lines[end])) end++;
  lines.splice(idx, end - idx);
  const kept = lines.join(nl).replace(/(\r?\n)+$/, '');
  const tail = content.slice(block.end);
  if (kept.trim() === '') return tail.replace(/^\r?\n/, '');
  return `---${nl}${kept}${nl}---${nl}${tail}`;
}

export function asStringList(v: FmValue | undefined): string[] {
  if (v === undefined || v === null) return [];
  if (Array.isArray(v)) return v.filter((x) => x !== null && x !== '').map(String);
  return String(v).split(/[,\s]+/).filter(Boolean);
}
