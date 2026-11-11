import type { ReactNode } from 'react';

/** Render Markdown ringan untuk kartu canvas (judul, daftar, tugas, tebal/miring/kode, wikilink). */
export function MiniMd({ text, onLink }: { text: string; onLink?: (target: string) => void }) {
  const out: ReactNode[] = [];
  let fence = false;
  text.split('\n').forEach((raw, i) => {
    if (/^\s*```/.test(raw)) { fence = !fence; return; }
    if (fence) { out.push(<pre key={i} className="mm-code">{raw}</pre>); return; }
    if (raw.trim() === '') { out.push(<div key={i} className="mm-gap" />); return; }
    let m: RegExpExecArray | null;
    if ((m = /^(#{1,3})\s+(.*)$/.exec(raw))) {
      out.push(<div key={i} className={'mm-h mm-h' + m[1].length}>{inline(m[2], onLink)}</div>);
    } else if ((m = /^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(raw))) {
      out.push(<div key={i} className={'mm-task' + (m[2] !== ' ' ? ' done' : '')}><span className="mm-box">{m[2] !== ' ' ? '✓' : ''}</span>{inline(m[3], onLink)}</div>);
    } else if ((m = /^(\s*)[-*+]\s+(.*)$/.exec(raw))) {
      out.push(<div key={i} className="mm-li" style={{ paddingLeft: 12 + m[1].length * 6 }}>• {inline(m[2], onLink)}</div>);
    } else if ((m = /^\s*>\s?(.*)$/.exec(raw))) {
      out.push(<div key={i} className="mm-quote">{inline(m[1], onLink)}</div>);
    } else out.push(<div key={i} className="mm-p">{inline(raw, onLink)}</div>);
  });
  return <div className="mm">{out}</div>;
}

const TOKEN = /(\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|`([^`]+)`|~~([^~]+)~~|==([^=]+)==|#([\p{L}\p{N}_/-]+))/gu;

function inline(s: string, onLink?: (t: string) => void): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of s.matchAll(TOKEN)) {
    const i = m.index!;
    if (i > last) parts.push(s.slice(last, i));
    if (m[2] !== undefined) {
      const target = m[2].trim();
      parts.push(<a key={k++} className="mm-link" href="#" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLink?.(target); }}>{m[3] ?? target}</a>);
    } else if (m[4] !== undefined) parts.push(<strong key={k++}>{m[4]}</strong>);
    else if (m[5] !== undefined) parts.push(<em key={k++}>{m[5]}</em>);
    else if (m[6] !== undefined) parts.push(<code key={k++}>{m[6]}</code>);
    else if (m[7] !== undefined) parts.push(<s key={k++}>{m[7]}</s>);
    else if (m[8] !== undefined) parts.push(<mark key={k++}>{m[8]}</mark>);
    else parts.push(<span key={k++} className="mm-tag">#{m[9]}</span>);
    last = i + m[0].length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}
