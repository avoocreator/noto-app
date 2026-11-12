import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { AnimatePresence, motion } from 'motion/react';
import { useVault } from '../store.ts';
import { Icon, type IconName } from './Icon.tsx';

const EMOJI = [
  '📝', '📄', '📚', '📖', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '🗒️', '📋', '📌', '📍', '🔖',
  '💡', '⭐', '🌟', '✨', '🔥', '💎', '🎯', '🏆', '🎨', '🎵', '🎮', '🎬', '📷', '💻', '🖥️', '📱',
  '⚙️', '🔧', '🛠️', '🔒', '🔑', '🧠', '❤️', '💙', '💚', '💛', '🧡', '💜', '🖤', '🌱', '🌿', '🍀',
  '🌸', '🌞', '🌙', '☁️', '⚡', '🌈', '🍎', '🍊', '🍋', '🍓', '☕', '🍕', '🏠', '🏢', '🚀', '✈️',
  '🚗', '📅', '⏰', '✅', '❓', '❗', '📈', '💰', '🛒', '👥', '👤', '🎓', '🔬', '🧪', '🗂️', '📦',
];

interface Req { current?: string; resolve: (v: string | null | undefined) => void }
const useReq = create<{ req: Req | null }>(() => ({ req: null }));

/** Buka pemilih ikon. Hasil: emoji, '' = hapus ikon, undefined = batal. */
export function pickIcon(current?: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    useReq.getState().req?.resolve(undefined);
    useReq.setState({ req: { current, resolve: (v) => resolve(v ?? undefined) } });
  });
}

export function IconPickerHost() {
  const req = useReq((s) => s.req);
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (req) { setText(''); window.setTimeout(() => input.current?.focus(), 40); } }, [req]);
  const close = (v: string | undefined) => { req?.resolve(v); useReq.setState({ req: null }); };
  // satu grafem emoji dari input bebas
  const typed = text.trim() ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text.trim())][0]?.segment ?? '' : '';

  return (
    <AnimatePresence>
      {req && (
        <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => close(undefined)}>
          <motion.div
            className="dialog icon-picker" role="dialog" aria-modal="true" aria-label="Pilih ikon"
            initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Escape') close(undefined); }}
          >
            <h3>Pilih ikon</h3>
            <div className="emoji-grid">
              {EMOJI.map((e) => <button key={e} className={'emoji' + (req.current === e ? ' on' : '')} aria-label={`Ikon ${e}`} onClick={() => close(e)}>{e}</button>)}
            </div>
            <form className="row gap" onSubmit={(e) => { e.preventDefault(); if (typed) close(typed); }}>
              <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="…atau ketik/tempel emoji sendiri" aria-label="Emoji sendiri" />
              <button className="btn ink" type="submit" disabled={!typed}>Pakai {typed}</button>
            </form>
            <div className="row gap end">
              {req.current && <button className="btn ghost" onClick={() => close('')}>Hapus ikon</button>}
              <button className="btn soft" onClick={() => close(undefined)}>Batal</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Ikon sebuah berkas/folder: emoji pilihan pengguna bila ada, jika tidak ikon bawaan. */
export function EntryIcon({ path, fallback, size = 16 }: { path: string; fallback: IconName; size?: number }) {
  const vault = useVault();
  const e = vault?.iconOf(path);
  return e ? <span className="emoji-ico" style={{ fontSize: size }} aria-hidden="true">{e}</span> : <Icon name={fallback} size={size} />;
}
