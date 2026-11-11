import { addDays, addMonths, nextWeekday, parseYmd, startOfDay, ymd, pad } from './dates.ts';

export type Priority = 'high' | 'medium' | 'low';
export type Recur = 'day' | 'week' | 'month' | 'year';

export interface ParsedTask {
  text: string;
  due?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  priority?: Priority;
  recur?: Recur;
  tags: string[];
}

const WEEKDAYS: Record<string, number> = {
  minggu: 0, ahad: 0, sunday: 0, sun: 0,
  senin: 1, monday: 1, mon: 1,
  selasa: 2, tuesday: 2, tue: 2,
  rabu: 3, wednesday: 3, wed: 3,
  kamis: 4, thursday: 4, thu: 4,
  jumat: 5, "jum'at": 5, friday: 5, fri: 5,
  sabtu: 6, saturday: 6, sat: 6,
};

const MONTHS: Record<string, number> = {
  jan: 0, januari: 0, january: 0,
  feb: 1, februari: 1, february: 1,
  mar: 2, maret: 2, march: 2,
  apr: 3, april: 3,
  mei: 4, may: 4,
  jun: 5, juni: 5, june: 5,
  jul: 6, juli: 6, july: 6,
  agu: 7, agt: 7, agustus: 7, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  okt: 9, oktober: 9, oct: 9, october: 9,
  nov: 10, november: 10,
  des: 11, desember: 11, dec: 11, december: 11,
};

function take(src: string, re: RegExp): { rest: string; m: RegExpExecArray | null } {
  const m = re.exec(src);
  if (!m) return { rest: src, m: null };
  return { rest: (src.slice(0, m.index) + ' ' + src.slice(m.index + m[0].length)), m };
}

/**
 * Paham bahasa alami (Indonesia/Inggris): "beli susu besok jam 10 !penting #belanja tiap minggu"
 */
export function smartParse(input: string, now = new Date()): ParsedTask {
  let s = ' ' + input.trim() + ' ';
  const today = startOfDay(now);
  const out: ParsedTask = { text: '', tags: [] };

  // prioritas
  let r = take(s, /\s!(penting|tinggi|high|p1|urgent)\b/i);
  if (r.m) { out.priority = 'high'; s = r.rest; }
  else {
    r = take(s, /\s!(sedang|medium|p2)\b/i);
    if (r.m) { out.priority = 'medium'; s = r.rest; }
    else {
      r = take(s, /\s!(rendah|low|p3)\b/i);
      if (r.m) { out.priority = 'low'; s = r.rest; }
    }
  }

  // pengulangan
  r = take(s, /\s(?:tiap|setiap|every)\s+(hari|day|minggu|week|bulan|month|tahun|year)\b/i);
  if (r.m) {
    const w = r.m[1].toLowerCase();
    out.recur = w === 'hari' || w === 'day' ? 'day' : w === 'minggu' || w === 'week' ? 'week' : w === 'bulan' || w === 'month' ? 'month' : 'year';
    s = r.rest;
  } else {
    r = take(s, /\s(harian|mingguan|bulanan|tahunan|daily|weekly|monthly|yearly)\b/i);
    if (r.m) {
      const w = r.m[1].toLowerCase();
      out.recur = w === 'harian' || w === 'daily' ? 'day' : w === 'mingguan' || w === 'weekly' ? 'week' : w === 'bulanan' || w === 'monthly' ? 'month' : 'year';
      s = r.rest;
    }
  }

  // tag
  const tagRe = /\s#([\p{L}\p{N}_/-]+)/gu;
  let tm: RegExpExecArray | null;
  while ((tm = tagRe.exec(s))) out.tags.push(tm[1]);
  s = s.replace(tagRe, ' ');

  // jam
  r = take(s, /\s(?:jam|pukul|pkl|at)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(pagi|siang|sore|malam|am|pm)?\b/i);
  if (!r.m) r = take(s, /\s(\d{1,2}):(\d{2})\s*(pagi|siang|sore|malam|am|pm)?(?=\s)/i);
  if (r.m) {
    let h = Number(r.m[1]);
    const mi = r.m[2] ? Number(r.m[2]) : 0;
    const suf = (r.m[3] || '').toLowerCase();
    if ((suf === 'sore' || suf === 'malam' || suf === 'pm') && h < 12) h += 12;
    if ((suf === 'pagi' || suf === 'am') && h === 12) h = 0;
    if (h <= 23 && mi <= 59) {
      out.time = `${pad(h)}:${pad(mi)}`;
      s = r.rest;
    }
  }

  // tanggal
  let due: Date | undefined;
  r = take(s, /\s(\d{4}-\d{2}-\d{2})(?=\s)/);
  if (r.m) { due = parseYmd(r.m[1]) ?? undefined; if (due) s = r.rest; }

  if (!due) {
    r = take(s, /\s(?:hari ini|hr ini|today|tonight|nanti malam)\b/i);
    if (r.m) { due = today; s = r.rest; }
  }
  if (!due) {
    r = take(s, /\s(?:besok|bsk|tomorrow|tmrw)\b/i);
    if (r.m) { due = addDays(today, 1); s = r.rest; }
  }
  if (!due) {
    r = take(s, /\s(?:lusa)\b/i);
    if (r.m) { due = addDays(today, 2); s = r.rest; }
  }
  if (!due) {
    r = take(s, /\s(?:minggu depan|pekan depan|next week)\b/i);
    if (r.m) { due = addDays(today, 7); s = r.rest; }
  }
  if (!due) {
    r = take(s, /\s(?:bulan depan|next month)\b/i);
    if (r.m) { due = addMonths(today, 1); s = r.rest; }
  }
  if (!due) {
    r = take(s, /\s(?:tgl|tanggal)\.?\s*(\d{1,2})\b/i);
    if (r.m) {
      const day = Number(r.m[1]);
      let d = new Date(today.getFullYear(), today.getMonth(), day);
      if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, day);
      if (day >= 1 && day <= 31) { due = d; s = r.rest; }
    }
  }
  if (!due) {
    r = take(s, /\s(\d{1,2})\s+([A-Za-z]{3,9})\b/);
    if (r.m && MONTHS[r.m[2].toLowerCase()] !== undefined) {
      const day = Number(r.m[1]);
      const mon = MONTHS[r.m[2].toLowerCase()];
      let d = new Date(today.getFullYear(), mon, day);
      if (d < today) d = new Date(today.getFullYear() + 1, mon, day);
      if (day >= 1 && day <= 31) { due = d; s = r.rest; }
    }
  }
  if (!due) {
    r = take(s, /\s(?:hari\s+|on\s+|next\s+)?(senin|selasa|rabu|kamis|jum'?at|sabtu|minggu|ahad|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    if (r.m) {
      due = nextWeekday(today, WEEKDAYS[r.m[1].toLowerCase()]);
      s = r.rest;
    }
  }

  if (due) out.due = ymd(due);
  else if (out.time && !out.recur) out.due = ymd(today);
  else if (out.time) out.due = ymd(today);

  out.text = s.replace(/\s+/g, ' ').trim();
  return out;
}
