import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { addDays, nextWeekday, parseYmd, ymd } from '../lib/dates.ts';
import type { Priority, Recur } from '../lib/smartParse.ts';
import { Calendar } from './Calendar.tsx';
import { Icon } from './Icon.tsx';

export interface TaskWhen { due?: string; time?: string; priority?: Priority; recur?: Recur }

const TIMES = ['07:00', '09:00', '12:00', '15:00', '18:00', '21:00'];
const PRIS: { id: Priority | undefined; label: string }[] = [{ id: undefined, label: 'Biasa' }, { id: 'low', label: 'Rendah' }, { id: 'medium', label: 'Sedang' }, { id: 'high', label: 'Penting' }];
const RECURS: { id: Recur | undefined; label: string }[] = [{ id: undefined, label: 'Sekali' }, { id: 'day', label: 'Harian' }, { id: 'week', label: 'Mingguan' }, { id: 'month', label: 'Bulanan' }, { id: 'year', label: 'Tahunan' }];

const dateChip = (due: string | undefined, now = new Date()) => {
  if (!due) return 'Tanggal';
  const d = parseYmd(due); if (!d) return due;
  const diff = Math.round((d.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000);
  if (diff === 0) return 'Hari ini'; if (diff === 1) return 'Besok'; if (diff === -1) return 'Kemarin';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
};

/** Tombol ringkas + popover pemilih tanggal, jam, prioritas, dan pengulangan. Dipakai saat tambah & ubah tugas. */
export function TaskPicker({ value, onChange, label, compact }: { value: TaskWhen; onChange: (v: TaskWhen) => void; label?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);

  const set = (p: Partial<TaskWhen>) => onChange({ ...value, ...p });
  const now = new Date();
  const sel = value.due ? parseYmd(value.due) ?? now : now;
  const has = !!(value.due || value.time || value.priority || value.recur);
  const quick: [string, string][] = [['Hari ini', ymd(now)], ['Besok', ymd(addDays(now, 1))], ['Lusa', ymd(addDays(now, 2))], ['Senin depan', ymd(nextWeekday(now, 1))], ['Minggu depan', ymd(addDays(now, 7))]];

  return (
    <span className="picker" ref={root}>
      <button type="button" className={'picker-btn' + (has ? ' set' : '')} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)} title="Atur tanggal, jam, dan pengingat">
        <Icon name="calendar" size={15} />
        {!compact && <span>{label ?? (has ? [value.due && dateChip(value.due), value.time].filter(Boolean).join(' · ') || 'Diatur' : 'Tanggal & jam')}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="picker-pop" role="dialog" aria-label="Atur tanggal dan jam" initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.98 }} transition={{ type: 'spring', stiffness: 460, damping: 34 }}>
            <div className="picker-chips">
              {quick.map(([l, d]) => <button type="button" key={l} className={'chip-btn' + (value.due === d ? ' on' : '')} onClick={() => set({ due: d })}>{l}</button>)}
              <button type="button" className={'chip-btn' + (!value.due ? ' on' : '')} onClick={() => set({ due: undefined, time: undefined })}>Tanpa tanggal</button>
            </div>
            <Calendar selected={sel} onSelect={(d) => set({ due: ymd(d) })} />
            <div className="picker-sec">
              <label className="picker-l"><Icon name="clock" size={14} /> Jam pengingat</label>
              <div className="picker-time">
                <input type="time" value={value.time ?? ''} onChange={(e) => set({ time: e.target.value || undefined, due: value.due ?? ymd(now) })} aria-label="Jam" />
                {value.time && <button type="button" className="icon-btn" aria-label="Hapus jam" onClick={() => set({ time: undefined })}><Icon name="x" size={14} /></button>}
              </div>
              <div className="picker-chips">
                {TIMES.map((t) => <button type="button" key={t} className={'chip-btn' + (value.time === t ? ' on' : '')} onClick={() => set({ time: t, due: value.due ?? ymd(now) })}>{t}</button>)}
              </div>
            </div>
            <div className="picker-sec">
              <label className="picker-l"><Icon name="flag" size={14} /> Prioritas</label>
              <div className="picker-chips">{PRIS.map((p) => <button type="button" key={p.label} className={'chip-btn' + (value.priority === p.id ? ' on' : '')} onClick={() => set({ priority: p.id })}>{p.label}</button>)}</div>
            </div>
            <div className="picker-sec">
              <label className="picker-l"><Icon name="repeat" size={14} /> Ulangi</label>
              <div className="picker-chips">{RECURS.map((p) => <button type="button" key={p.label} className={'chip-btn' + (value.recur === p.id ? ' on' : '')} onClick={() => set({ recur: p.id, due: p.id ? value.due ?? ymd(now) : value.due })}>{p.label}</button>)}</div>
            </div>
            <div className="picker-foot">
              <button type="button" className="btn ghost" onClick={() => { onChange({}); setOpen(false); }}>Kosongkan</button>
              <button type="button" className="btn ink" onClick={() => setOpen(false)}>Selesai</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
