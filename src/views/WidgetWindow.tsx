import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useApp, useVault } from '../store.ts';
import { restoreActive } from '../vault/manager.ts';
import { summaryFor } from '../native/bridge.ts';
import { quickAddTask, toggleTaskItem } from '../actions.ts';
import { useThemeEffect } from '../theme/useTheme.ts';
import { Icon } from '../ui/Icon.tsx';

/** Jendela widget tempel (desktop) / pratinjau widget. Dibuka dengan ?widget=1 */
export function WidgetWindow() {
  useThemeEffect();
  const setVault = useApp((s) => s.setVault);
  const vault = useVault();
  const [state, setState] = useState<'loading' | 'none' | 'ready'>('loading');
  const [text, setText] = useState('');

  useEffect(() => {
    void restoreActive().then((r) => {
      if (r?.vault) { setVault(r.vault, r.rec); setState('ready'); } else setState('none');
    }).catch(() => setState('none'));
  }, [setVault]);

  // jendela ini proses terpisah → ambil perubahan dari disk secara berkala
  useEffect(() => {
    if (!vault) return;
    const iv = window.setInterval(() => void vault.refresh(), 5000);
    const f = () => void vault.refresh();
    window.addEventListener('focus', f);
    return () => { window.clearInterval(iv); window.removeEventListener('focus', f); };
  }, [vault]);

  if (state === 'loading') return <div className="widget-win"><p className="muted pad">Memuat…</p></div>;
  if (!vault) return <div className="widget-win"><p className="pad">Buka Noto dulu dan pilih vault, lalu buka widget lagi.</p></div>;
  const s = summaryFor(vault);

  return (
    <motion.div className="widget-win tint-1" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} data-tauri-drag-region>
      <header data-tauri-drag-region>
        <div data-tauri-drag-region><b>{s.title}</b><small>{s.subtitle}</small></div>
        <img src="./favicon.svg" width={22} height={22} alt="" data-tauri-drag-region />
      </header>
      <ul>
        {s.lines.map((l, i) => (
          <li key={i} className={l.task?.done ? 'done' : ''}>
            {l.task ? (
              <button className="check" aria-label="Selesai" disabled={l.task.line < 0} onClick={() => void toggleTaskItem(l.task!)} />
            ) : <span className="w-dot" />}
            <span className="w-text">{l.text}</span>
            {l.sub && <small>{l.sub}</small>}
          </li>
        ))}
        {s.lines.length === 0 && <li className="muted">Tidak ada apa-apa. Santai dulu ☕</li>}
        {s.more > 0 && <li className="muted small">+{s.more} lagi</li>}
      </ul>
      <form className="w-add" onSubmit={async (e) => { e.preventDefault(); if (await quickAddTask(text)) setText(''); }}>
        <Icon name="plus" size={15} />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Tugas cepat…" aria-label="Tugas cepat" />
      </form>
    </motion.div>
  );
}
