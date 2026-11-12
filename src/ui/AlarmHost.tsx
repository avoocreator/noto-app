import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useReminderPrefs, useAlarms, setReminderPrefs } from '../native/reminders.ts';
import { Icon } from './Icon.tsx';

/** Lapisan alarm: muncul saat pengingat berbunyi dan menahan bunyi sampai pengguna menanggapi. */
export function AlarmHost() {
  const items = useAlarms((s) => s.items);
  const { dismiss, snooze, done } = useAlarms.getState();
  const prefs = useReminderPrefs();
  const [mins, setMins] = useState(prefs.snooze);
  useEffect(() => setMins(prefs.snooze), [prefs.snooze]);
  const cur = items[0];
  useEffect(() => {
    if (!cur) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(cur.key); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [cur, dismiss]);
  const preview = cur?.task.path === '__test__';

  return (
    <AnimatePresence>
      {cur && (
        <motion.div className="scrim alarm-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="alarm" role="alertdialog" aria-label="Pengingat tugas" aria-live="assertive" initial={{ opacity: 0, y: 24, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.97 }} transition={{ type: 'spring', stiffness: 380, damping: 28 }}>
            <motion.div className="alarm-bell" animate={{ rotate: [0, -16, 14, -10, 8, 0] }} transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 0.5 }}>
              <Icon name="bell" size={34} strokeWidth={2} />
            </motion.div>
            <small className="alarm-time">{cur.body}{items.length > 1 && ` · +${items.length - 1} lagi`}</small>
            <h2>{cur.task.text}</h2>
            <div className="alarm-actions">
              {!preview && <button className="btn ink" onClick={() => void done(cur.key)}><Icon name="check" size={16} /> Selesai</button>}
              <span className="alarm-snooze">
                <select value={mins} onChange={(e) => { const m = Number(e.target.value); setMins(m); setReminderPrefs({ snooze: m }); }} aria-label="Lama tunda">
                  {[5, 10, 15, 30, 60].map((m) => <option key={m} value={m}>{m} mnt</option>)}
                </select>
                <button className="btn soft" onClick={() => snooze(cur.key, mins)}><Icon name="clock" size={16} /> Tunda</button>
              </span>
              <button className="btn ghost" onClick={() => dismiss(cur.key)}>Matikan</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
