import type { CSSProperties, ReactNode } from 'react';
import { footnoteDefId, footnoteIndex, isFootnoteDef, isTableLine, parseTable } from '../lib/format.ts';

/** Render Markdown ringan untuk kartu canvas: judul, daftar (poin/nomor/tugas), tabel, catatan kaki, warna & stabilo, garis bawah, wikilink. */
export function MiniMd({ text, onLink }: { text: string; onLink?: (target: string) => void }) {
  const out: ReactNode[] = [];
  const fns = footnoteIndex(text);
  const lines = text.split('\n');
  let fence = false;
  for (let i = 0; i < lines.length; i++) {
    let raw = lines[i];
    if (/^\s*```/.test(raw)) { fence = !fence; continue; }
    if (fence) { out.push(<pre key={i} className="mm-code">{raw}</pre>); continue; }
    if (raw.trim() === '') { out.push(<div key={i} className="mm-gap" />); continue; }

    // tabel: baris header + pemisah + isi
    if (isTableLine(raw)) {
      let e = i;
      while (e + 1 < lines.length && isTableLine(lines[e + 1])) e++;
      const t = parseTable(lines.slice(i, e + 1));
      if (t) {
        out.push(
          <table key={i} className="mm-table">
            <thead><tr>{t.cells[0].map((c, k) => <th key={k} style={{ textAlign: t.aligns[k] }}>{inline(c, fns, onLink)}</th>)}</tr></thead>
            <tbody>{t.cells.slice(1).map((r, ri) => <tr key={ri}>{r.map((c, k) => <td key={k} style={{ textAlign: t.aligns[k] }}>{inline(c, fns, onLink)}</td>)}</tr>)}</tbody>
          </table>,
        );
        i = e;
        continue;
      }
    }

    let style: CSSProperties | undefined;
    const al = /\s*<!--\s*align:(center|right|justify)\s*-->\s*$/.exec(raw);
    if (al) { style = { textAlign: al[1] as CSSProperties['textAlign'] }; raw = raw.slice(0, al.index); }

    let m: RegExpExecArray | null;
    if (isFootnoteDef(raw)) {
      const id = footnoteDefId(raw)!;
      out.push(<div key={i} className="mm-fn" style={style}><sup className="fn-ref">{fns.get(id) ?? id}</sup> {inline(raw.replace(/^\[\^[^\]\s]+\]:\s?/, ''), fns, onLink)}</div>);
    } else if ((m = /^(#{1,3})\s+(.*)$/.exec(raw))) {
      out.push(<div key={i} className={'mm-h mm-h' + m[1].length} style={style}>{inline(m[2], fns, onLink)}</div>);
    } else if ((m = /^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(raw))) {
      out.push(<div key={i} className={'mm-task' + (m[2] !== ' ' ? ' done' : '')} style={{ paddingLeft: m[1].replace(/\t/g, '    ').length * 5, ...style }}><span className="mm-box">{m[2] !== ' ' ? '✓' : ''}</span>{inline(m[3], fns, onLink)}</div>);
    } else if ((m = /^(\s*)[-*+]\s+(.*)$/.exec(raw))) {
      out.push(<div key={i} className="mm-li" style={{ paddingLeft: 12 + m[1].replace(/\t/g, '    ').length * 5, ...style }}>• {inline(m[2], fns, onLink)}</div>);
    } else if ((m = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(raw))) {
      out.push(<div key={i} className="mm-li mm-ol" style={{ paddingLeft: 4 + m[1].replace(/\t/g, '    ').length * 5, ...style }}><span className="mm-num">{m[2]}.</span>{inline(m[3], fns, onLink)}</div>);
    } else if ((m = /^\s*>\s?(.*)$/.exec(raw))) {
      out.push(<div key={i} className="mm-quote" style={style}>{inline(m[1], fns, onLink)}</div>);
    } else out.push(<div key={i} className="mm-p" style={style}>{inline(raw, fns, onLink)}</div>);
  }
  return <div className="mm">{out}</div>;
}

const TOKEN = new RegExp(
  [
    '\\[\\[([^\\]|#]+)(?:#[^\\]|]*)?(?:\\|([^\\]]+))?\\]\\]', // 1,2 wikilink
    '<span style="color:\\s*(#[0-9a-fA-F]{3,8})\\s*">(.*?)</span>', // 3,4
    '<mark style="background:\\s*(#[0-9a-fA-F]{3,8})\\s*">(.*?)</mark>', // 5,6
    '<u>(.*?)</u>', // 7
    '<sup>(.*?)</sup>', // 8
    '<sub>(.*?)</sub>', // 9
    '\\*\\*(.+?)\\*\\*', // 10
    '(?<![*\\w])\\*(?!\\s)(.+?)\\*(?![*\\w])', // 11
    '`([^`]+)`', // 12
    '~~(.+?)~~', // 13
    '==(.+?)==', // 14
    '\\[\\^([^\\]\\s]+)\\](?!:)', // 15
    '#([\\p{L}\\p{N}_/-]+)', // 16
  ].join('|'),
  'gu',
);

function inline(s: string, fns: Map<string, number>, onLink?: (t: string) => void): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of s.matchAll(TOKEN)) {
    const i = m.index!;
    if (i > last) parts.push(s.slice(last, i));
    const rec = (t: string) => inline(t, fns, onLink);
    if (m[1] !== undefined) {
      const target = m[1].trim();
      parts.push(<a key={k++} className="mm-link" href="#" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLink?.(target); }}>{m[2] ?? target}</a>);
    } else if (m[3] !== undefined) parts.push(<span key={k++} style={{ color: m[3] }}>{rec(m[4])}</span>);
    else if (m[5] !== undefined) parts.push(<mark key={k++} className="hl" style={{ background: m[5] }}>{rec(m[6])}</mark>);
    else if (m[7] !== undefined) parts.push(<u key={k++}>{rec(m[7])}</u>);
    else if (m[8] !== undefined) parts.push(<sup key={k++}>{rec(m[8])}</sup>);
    else if (m[9] !== undefined) parts.push(<sub key={k++}>{rec(m[9])}</sub>);
    else if (m[10] !== undefined) parts.push(<strong key={k++}>{rec(m[10])}</strong>);
    else if (m[11] !== undefined) parts.push(<em key={k++}>{rec(m[11])}</em>);
    else if (m[12] !== undefined) parts.push(<code key={k++}>{m[12]}</code>);
    else if (m[13] !== undefined) parts.push(<s key={k++}>{rec(m[13])}</s>);
    else if (m[14] !== undefined) parts.push(<mark key={k++}>{rec(m[14])}</mark>);
    else if (m[15] !== undefined) parts.push(<sup key={k++} className="fn-ref">{fns.get(m[15]) ?? m[15]}</sup>);
    else parts.push(<span key={k++} className="mm-tag">#{m[16]}</span>);
    last = i + m[0].length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}
