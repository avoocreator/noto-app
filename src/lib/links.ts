/** Tulis ulang [[wikilink]] ketika sebuah catatan di-rename / dipindah. */

const WIKI = /(!?)\[\[([^\[\]|#\n]+?)(#[^\[\]|\n]+?)?(\|[^\[\]\n]+?)?\]\]/g;
const norm = (s: string) => s.trim().toLowerCase().replace(/\.(md|markdown)$/i, '');

export interface RenameSpec {
  /** nama lama tanpa folder/ekstensi (mis. "Beta") */
  oldName: string;
  newName: string;
  /** path lama tanpa ekstensi (mis. "Proyek/Beta") */
  oldPath: string;
  newPath: string;
}

/** Mengembalikan isi baru dan jumlah tautan yang diubah. Blok kode dan inline code dilewati. */
export function rewriteLinks(content: string, spec: RenameSpec): { content: string; count: number } {
  const oldName = norm(spec.oldName);
  const oldPath = norm(spec.oldPath);
  let count = 0;
  let fence = false;
  const out = content.split('\n').map((line) => {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; return line; }
    if (fence) return line;
    // lindungi inline code
    const codes: string[] = [];
    const safe = line.replace(/`[^`]*`/g, (m) => {
      codes.push(m);
      return `\u0000${codes.length - 1}\u0000`;
    });
    const replaced = safe.replace(WIKI, (whole, bang: string, target: string, heading = '', alias = '') => {
      const t = norm(target);
      let next: string | null = null;
      if (t === oldName) next = spec.newName;
      else if (t === oldPath || oldPath.endsWith('/' + t) && t.includes('/')) next = spec.newPath;
      if (next === null) return whole;
      count++;
      return `${bang}[[${next}${heading}${alias}]]`;
    });
    return replaced.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
  });
  return { content: out.join('\n'), count };
}
