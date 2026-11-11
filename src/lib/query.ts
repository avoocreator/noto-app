export interface ParsedQuery {
  text: string;
  tags: string[];
  paths: string[];
  /** filter tipe: note | task | canvas */
  kinds: string[];
}

/** "tag:kerja path:Proyek rapat mingguan" → filter + teks bebas */
export function parseQuery(q: string): ParsedQuery {
  const out: ParsedQuery = { text: '', tags: [], paths: [], kinds: [] };
  const rest: string[] = [];
  for (const tok of q.trim().split(/\s+/)) {
    if (!tok) continue;
    const m = /^(tag|path|folder|is|type):(.+)$/i.exec(tok);
    if (!m) { rest.push(tok); continue; }
    const v = m[2].replace(/^#/, '');
    switch (m[1].toLowerCase()) {
      case 'tag': out.tags.push(v.toLowerCase()); break;
      case 'path':
      case 'folder': out.paths.push(v.toLowerCase()); break;
      default: out.kinds.push(v.toLowerCase());
    }
  }
  out.text = rest.join(' ');
  return out;
}
