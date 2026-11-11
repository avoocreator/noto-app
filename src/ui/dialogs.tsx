import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { AnimatePresence, motion } from 'motion/react';
import { useApp } from '../store.ts';
import { Icon } from './Icon.tsx';

interface AskOpts {
  title: string;
  label?: string;
  initial?: string;
  placeholder?: string;
  confirm?: string;
  /** true → tampilkan hanya pesan konfirmasi (tanpa input) */
  message?: string;
  danger?: boolean;
}
interface Pending extends AskOpts { resolve: (v: string | null) => void }

const useDialog = create<{ cur: Pending | null; set: (p: Pending | null) => void }>((set) => ({ cur: null, set: (cur) => set({ cur }) }));

export function ask(opts: AskOpts): Promise<string | null> {
  return new Promise((resolve) => {
    useDialog.getState().cur?.resolve(null);
    useDialog.getState().set({ ...opts, resolve });
  });
}
export async function confirmBox(title: string, message: string, confirm = 'Ya', danger = false): Promise<boolean> {
  return (await ask({ title, message, confirm, danger })) !== null;
}

export function DialogHost() {
  const cur = useDialog((s) => s.cur);
  const set = useDialog((s) => s.set);
  const [val, setVal] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cur) {
      setVal(cur.initial ?? '');
      window.setTimeout(() => { input.current?.focus(); input.current?.select(); }, 30);
    }
  }, [cur]);

  const close = (v: string | null) => { cur?.resolve(v); set(null); };

  return (
    <AnimatePresence>
      {cur && (
        <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => close(null)}>
          <motion.form
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label={cur.title}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onMouseDown={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); close(cur.message ? '' : val.trim()); }}
            onKeyDown={(e) => { if (e.key === 'Escape') close(null); }}
          >
            <h3>{cur.title}</h3>
            {cur.message ? (
              <p className="muted">{cur.message}</p>
            ) : (
              <label className="field">
                {cur.label && <span>{cur.label}</span>}
                <input ref={input} value={val} onChange={(e) => setVal(e.target.value)} placeholder={cur.placeholder} />
              </label>
            )}
            <div className="row end gap">
              <button type="button" className="btn ghost" onClick={() => close(null)}>Batal</button>
              <button type="submit" className={'btn ' + (cur.danger ? 'danger' : 'ink')} disabled={!cur.message && val.trim() === ''}>
                {cur.confirm ?? 'Simpan'}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            className={'toast ' + t.kind}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          >
            <span>{t.text}</span>
            {t.action && <button className="link-btn" onClick={() => { t.action!.run(); dismiss(t.id); }}>{t.action.label}</button>}
            <button className="icon-btn tiny" aria-label="Tutup" onClick={() => dismiss(t.id)}><Icon name="x" size={14} /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
