import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { addMonths, DAYS_SHORT_ID, isoWeek, isSameDay, monthMatrix, MONTHS_ID, ymd } from '../lib/dates.ts';
import { Icon } from './Icon.tsx';

interface Props {
  selected: Date;
  onSelect: (d: Date) => void;
  /** tanggal (YYYY-MM-DD) yang punya catatan harian / tugas → diberi titik */
  marks?: Map<string, 'note' | 'task' | 'both'>;
}

export function Calendar({ selected, onSelect, marks }: Props) {
  const [cursor, setCursor] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const [dir, setDir] = useState(1);
  const weeks = useMemo(() => monthMatrix(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const today = new Date();
  const go = (n: number) => { setDir(n); setCursor(addMonths(cursor, n)); };

  return (
    <div className="cal">
      <div className="cal-head">
        <button className="icon-btn" aria-label="Bulan sebelumnya" onClick={() => go(-1)}><Icon name="chevL" /></button>
        <button
          className="pill soft"
          onClick={() => { setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); onSelect(today); }}
          title="Kembali ke hari ini"
        >
          {MONTHS_ID[cursor.getMonth()]} {cursor.getFullYear()}
        </button>
        <button className="icon-btn" aria-label="Bulan berikutnya" onClick={() => go(1)}><Icon name="chevR" /></button>
      </div>
      <div className="cal-grid cal-dow">
        {[1, 2, 3, 4, 5, 6, 0].map((i) => <span key={i}>{DAYS_SHORT_ID[i].slice(0, 2)}</span>)}
        <span className="wk">Mg</span>
      </div>
      <div className="cal-body">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={`${cursor.getFullYear()}-${cursor.getMonth()}`}
            className="cal-weeks"
            custom={dir}
            initial={{ opacity: 0, x: dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -24 }}
            transition={{ duration: 0.18 }}
          >
            {weeks.map((w) => (
              <div className="cal-grid" key={ymd(w[0])}>
                {w.map((d) => {
                  const out = d.getMonth() !== cursor.getMonth();
                  const sel = isSameDay(d, selected);
                  const mark = marks?.get(ymd(d));
                  return (
                    <button
                      key={ymd(d)}
                      className={'cal-day' + (out ? ' out' : '') + (sel ? ' sel' : '') + (isSameDay(d, today) ? ' today' : '')}
                      onClick={() => onSelect(d)}
                      aria-label={ymd(d)}
                      aria-pressed={sel}
                    >
                      {d.getDate()}
                      {mark && <i className={'dot ' + mark} />}
                    </button>
                  );
                })}
                <span className="wk">{isoWeek(w[0])}</span>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
