/* Markdown inline (+ HTML terbatas buatan Noto) → HTML aman, untuk sel tabel dan pratinjau di dalam widget CodeMirror. */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TOKEN = new RegExp(
  [
    '<span style="color:\\s*(#[0-9a-fA-F]{3,8})\\s*">(.*?)</span>', // 1,2
    '<mark style="background:\\s*(#[0-9a-fA-F]{3,8})\\s*">(.*?)</mark>', // 3,4
    '<u>(.*?)</u>', // 5
    '<sup>(.*?)</sup>', // 6
    '<sub>(.*?)</sub>', // 7
    '\\*\\*(.+?)\\*\\*', // 8
    '(?<![*\\w])\\*(?!\\s)(.+?)\\*(?![*\\w])', // 9
    '~~(.+?)~~', // 10
    '==(.+?)==', // 11
    '`([^`]+)`', // 12
    '\\[\\[([^\\]|#]+)(?:#[^\\]|]*)?(?:\\|([^\\]]+))?\\]\\]', // 13,14
    '\\[([^\\]]+)\\]\\((https?:[^)\\s]+)\\)', // 15,16
    '\\[\\^([^\\]\\s]+)\\]', // 17
    '<br\\s*/?>', // (tanpa grup)
  ].join('|'),
  'g',
);

export interface InlineOpts { footnotes?: Map<string, number> }

export function inlineToHtml(src: string, opts: InlineOpts = {}): string {
  let out = '';
  let last = 0;
  for (const m of src.matchAll(TOKEN)) {
    const i = m.index!;
    out += esc(src.slice(last, i));
    last = i + m[0].length;
    if (m[1]) out += `<span style="color:${m[1]}">${inlineToHtml(m[2], opts)}</span>`;
    else if (m[3]) out += `<mark class="hl" style="background:${m[3]}">${inlineToHtml(m[4], opts)}</mark>`;
    else if (m[5] !== undefined) out += `<u>${inlineToHtml(m[5], opts)}</u>`;
    else if (m[6] !== undefined) out += `<sup>${inlineToHtml(m[6], opts)}</sup>`;
    else if (m[7] !== undefined) out += `<sub>${inlineToHtml(m[7], opts)}</sub>`;
    else if (m[8] !== undefined) out += `<strong>${inlineToHtml(m[8], opts)}</strong>`;
    else if (m[9] !== undefined) out += `<em>${inlineToHtml(m[9], opts)}</em>`;
    else if (m[10] !== undefined) out += `<s>${inlineToHtml(m[10], opts)}</s>`;
    else if (m[11] !== undefined) out += `<mark>${inlineToHtml(m[11], opts)}</mark>`;
    else if (m[12] !== undefined) out += `<code>${esc(m[12])}</code>`;
    else if (m[13] !== undefined) out += `<span class="cm-wikilink" data-target="${esc(m[13].trim())}">${esc((m[14] ?? m[13]).trim())}</span>`;
    else if (m[15] !== undefined) out += `<a href="${esc(m[16])}" target="_blank" rel="noopener noreferrer">${esc(m[15])}</a>`;
    else if (m[17] !== undefined) out += `<sup class="fn-ref">${opts.footnotes?.get(m[17]) ?? esc(m[17])}</sup>`;
    else out += '<br>';
  }
  return out + esc(src.slice(last));
}
