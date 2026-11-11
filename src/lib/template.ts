import { DAYS_ID, MONTHS_ID, hm, pad, ymd } from './dates.ts';

/** Format tanggal sederhana: YYYY YY MMMM MM DD dddd HH mm. */
export function formatDate(d: Date, fmt: string): string {
  return fmt
    .replace(/YYYY/g, String(d.getFullYear()))
    .replace(/YY/g, String(d.getFullYear()).slice(-2))
    .replace(/MMMM/g, MONTHS_ID[d.getMonth()])
    .replace(/MM/g, pad(d.getMonth() + 1))
    .replace(/DD/g, pad(d.getDate()))
    .replace(/dddd/g, DAYS_ID[d.getDay()])
    .replace(/HH/g, pad(d.getHours()))
    .replace(/mm/g, pad(d.getMinutes()));
}

/** Variabel: {{title}} {{date}} {{time}} {{date:DD MMMM YYYY}} {{cursor}} (cursor dihapus & posisinya dikembalikan). */
export function applyTemplate(tpl: string, vars: { title: string; now?: Date }): { text: string; cursor: number | null } {
  const now = vars.now ?? new Date();
  let text = tpl
    .replace(/\{\{\s*title\s*\}\}/g, vars.title)
    .replace(/\{\{\s*date\s*\}\}/g, ymd(now))
    .replace(/\{\{\s*time\s*\}\}/g, hm(now))
    .replace(/\{\{\s*date:([^}]+?)\s*\}\}/g, (_, f: string) => formatDate(now, f));
  const i = text.indexOf('{{cursor}}');
  let cursor: number | null = null;
  if (i !== -1) {
    cursor = i;
    text = text.replace('{{cursor}}', '');
  }
  return { text, cursor };
}

export const DEFAULT_DAILY = `---
tanggal: {{date}}
tags: [harian]
---
# {{date:dddd, DD MMMM YYYY}}

## Fokus hari ini
- [ ] {{cursor}}

## Catatan

## Syukur kecil
`;

export const BUILTIN_TEMPLATES: { name: string; body: string }[] = [
  { name: 'Harian', body: DEFAULT_DAILY },
  {
    name: 'Rapat',
    body: `---
tanggal: {{date}}
tags: [rapat]
peserta: []
---
# {{title}}

## Agenda
- {{cursor}}

## Catatan

## Tindak lanjut
- [ ]
`,
  },
  {
    name: 'Proyek',
    body: `---
status: rencana
tags: [proyek]
mulai: {{date}}
---
# {{title}}

## Tujuan
{{cursor}}

## Langkah
- [ ]

## Catatan
`,
  },
  {
    name: 'Jurnal',
    body: `---
tanggal: {{date}}
tags: [jurnal]
mood:
---
# {{date:dddd, DD MMMM YYYY}}

{{cursor}}
`,
  },
];
