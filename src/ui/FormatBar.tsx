import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { HIGHLIGHT_COLORS, TEXT_COLORS } from '../lib/format.ts';
import { FONT_SIZES, LINE_GAPS, PARA_GAPS, useLook } from '../editor/look.ts';
import { Icon, type IconName } from './Icon.tsx';

type Pop = 'style' | 'hl' | 'color' | 'table' | 'look' | null;

interface Props {
  /** jalankan perintah format; mengembalikan false bila gagal */
  run: (op: string) => void;
  inTable: boolean;
  /** tampilkan kontrol tampilan menulis (ukuran huruf & spasi) — hanya relevan untuk catatan */
  look?: boolean;
  className?: string;
}

const keep = (e: React.MouseEvent) => e.preventDefault(); // jangan curi fokus dari editor

function Btn({ icon, label, onClick, on }: { icon: IconName; label: string; onClick: () => void; on?: boolean }) {
  return <button type="button" className={'fb-btn' + (on ? ' on' : '')} title={label} aria-label={label} onMouseDown={keep} onClick={onClick}><Icon name={icon} size={17} /></button>;
}
const Sep = () => <span className="fb-sep" aria-hidden="true" />;

/** Toolbar format ala Word untuk catatan dan kartu canvas. */
export function FormatBar({ run, inTable, look, className }: Props) {
  const [pop, setPop] = useState<Pop>(null);
  const [grid, setGrid] = useState<[number, number]>([0, 0]);
  const root = useRef<HTMLDivElement>(null);
  const lk = useLook();

  useEffect(() => {
    if (!pop) return;
    const down = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setPop(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPop(null); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', esc); };
  }, [pop]);

  const go = (op: string) => { run(op); setPop(null); };
  const toggle = (p: Pop) => setPop(pop === p ? null : p);
  const Drop = ({ id, icon, label }: { id: Exclude<Pop, null>; icon: IconName; label: string }) => (
    <button type="button" className={'fb-btn wide' + (pop === id ? ' on' : '')} title={label} aria-label={label} aria-haspopup="true" aria-expanded={pop === id} onMouseDown={keep} onClick={() => toggle(id)}>
      <Icon name={icon} size={17} /><Icon name="chevD" size={11} strokeWidth={2.4} />
    </button>
  );

  return (
    <div className={'fbar ' + (className ?? '')} role="toolbar" aria-label="Format teks" ref={root}>
      <div className="fb-row">
        <span className="fb-pop-anchor">
          <Drop id="style" icon="heading" label="Gaya paragraf" />
          <AnimatePresence>{pop === 'style' && (
            <Pane key="style">
              {[['Teks biasa', 'h:0'], ['Judul 1', 'h:1'], ['Judul 2', 'h:2'], ['Judul 3', 'h:3'], ['Judul 4', 'h:4']].map(([l, op], i) => (
                <button type="button" key={op} className={'fb-item fb-h' + i} onMouseDown={keep} onClick={() => go(op)}>{l}</button>
              ))}
              <button type="button" className="fb-item" onMouseDown={keep} onClick={() => go('quote')}><Icon name="quote" size={15} /> Kutipan</button>
              <button type="button" className="fb-item" onMouseDown={keep} onClick={() => go('codeblock')}><Icon name="code" size={15} /> Blok kode</button>
            </Pane>
          )}</AnimatePresence>
        </span>
        <Sep />
        <Btn icon="bold" label="Tebal (Ctrl+B)" onClick={() => go('bold')} />
        <Btn icon="italic" label="Miring (Ctrl+I)" onClick={() => go('italic')} />
        <Btn icon="underline" label="Garis bawah (Ctrl+U)" onClick={() => go('underline')} />
        <Btn icon="strike" label="Coret (Ctrl+Shift+X)" onClick={() => go('strike')} />
        <Btn icon="sup" label="Superskrip" onClick={() => go('sup')} />
        <Btn icon="sub" label="Subskrip" onClick={() => go('sub')} />
        <span className="fb-pop-anchor">
          <Drop id="hl" icon="highlighter" label="Stabilo" />
          <AnimatePresence>{pop === 'hl' && (
            <Pane key="hl">
              <div className="fb-title">Stabilo</div>
              <div className="fb-dots">
                {HIGHLIGHT_COLORS.map((c) => <button type="button" key={c.hex} className="fb-dot" style={{ background: c.hex }} title={c.label} aria-label={c.label} onMouseDown={keep} onClick={() => go(`hl:${c.hex}`)} />)}
                <button type="button" className="fb-dot none" title="Hapus stabilo" aria-label="Hapus stabilo" onMouseDown={keep} onClick={() => go('hl:none')}><Icon name="x" size={11} strokeWidth={2.4} /></button>
              </div>
            </Pane>
          )}</AnimatePresence>
        </span>
        <span className="fb-pop-anchor">
          <Drop id="color" icon="textColor" label="Warna teks" />
          <AnimatePresence>{pop === 'color' && (
            <Pane key="color">
              <div className="fb-title">Warna teks</div>
              <div className="fb-dots">
                {TEXT_COLORS.map((c) => <button type="button" key={c.hex} className="fb-dot" style={{ background: c.hex }} title={c.label} aria-label={c.label} onMouseDown={keep} onClick={() => go(`color:${c.hex}`)} />)}
                <button type="button" className="fb-dot none" title="Warna bawaan" aria-label="Warna bawaan" onMouseDown={keep} onClick={() => go('color:none')}><Icon name="x" size={11} strokeWidth={2.4} /></button>
              </div>
            </Pane>
          )}</AnimatePresence>
        </span>
        <Btn icon="eraser" label="Hapus format" onClick={() => go('clear')} />
        <Sep />
        <Btn icon="list" label="Daftar poin (Ctrl+Shift+8)" onClick={() => go('bullet')} />
        <Btn icon="listOl" label="Daftar bernomor (Ctrl+Shift+7)" onClick={() => go('number')} />
        <Btn icon="tasks" label="Daftar tugas" onClick={() => go('task')} />
        <Btn icon="outdent" label="Geser keluar" onClick={() => go('outdent')} />
        <Btn icon="indent" label="Geser masuk" onClick={() => go('indent')} />
        <Sep />
        <Btn icon="alignL" label="Rata kiri" onClick={() => go('align:left')} />
        <Btn icon="alignC" label="Rata tengah" onClick={() => go('align:center')} />
        <Btn icon="alignR" label="Rata kanan" onClick={() => go('align:right')} />
        <Btn icon="alignJ" label="Rata kiri-kanan" onClick={() => go('align:justify')} />
        <Sep />
        <span className="fb-pop-anchor">
          <Drop id="table" icon="table" label="Sisipkan tabel" />
          <AnimatePresence>{pop === 'table' && (
            <Pane key="table">
              <div className="fb-title">{grid[0] > 0 ? `${grid[0]} baris × ${grid[1]} kolom` : 'Sisipkan tabel'}</div>
              <div className="fb-grid" onMouseLeave={() => setGrid([0, 0])}>
                {Array.from({ length: 6 * 8 }, (_, i) => {
                  const r = Math.floor(i / 8) + 1, c = (i % 8) + 1;
                  return <button type="button" key={i} aria-label={`${r} × ${c}`} className={'fb-cell' + (r <= grid[0] && c <= grid[1] ? ' on' : '')} onMouseDown={keep} onMouseEnter={() => setGrid([r, c])} onClick={() => go(`table:${r + 1}x${c}`)} />;
                })}
              </div>
            </Pane>
          )}</AnimatePresence>
        </span>
        <Btn icon="footnote" label="Catatan kaki (Ctrl+Alt+F)" onClick={() => go('footnote')} />
        <Btn icon="link" label="Tautan (Ctrl+K)" onClick={() => go('link')} />
        <Btn icon="hr" label="Garis pemisah" onClick={() => go('hr')} />
        {look && (
          <>
            <Sep />
            <span className="fb-pop-anchor">
              <Drop id="look" icon="spacing" label="Ukuran huruf & spasi" />
              <AnimatePresence>{pop === 'look' && (
                <Pane key="look" wide>
                  <div className="fb-title"><Icon name="textSize" size={14} /> Ukuran huruf</div>
                  <div className="fb-chips">{FONT_SIZES.map((f) => <button type="button" key={f.id} className={'chip-btn' + (lk.fontSize === f.id ? ' on' : '')} onMouseDown={keep} onClick={() => lk.set({ fontSize: f.id })}>{f.label}</button>)}</div>
                  <div className="fb-title"><Icon name="spacing" size={14} /> Jarak antar baris</div>
                  <div className="fb-chips">{LINE_GAPS.map((f) => <button type="button" key={f.id} className={'chip-btn' + (lk.lineGap === f.id ? ' on' : '')} onMouseDown={keep} onClick={() => lk.set({ lineGap: f.id })}>{f.label}</button>)}</div>
                  <div className="fb-title"><Icon name="alignJ" size={14} /> Jarak antar paragraf</div>
                  <div className="fb-chips">{PARA_GAPS.map((f) => <button type="button" key={f.id} className={'chip-btn' + (lk.paraGap === f.id ? ' on' : '')} onMouseDown={keep} onClick={() => lk.set({ paraGap: f.id })}>{f.label}</button>)}</div>
                  <p className="muted small">Berlaku untuk semua catatan di perangkat ini.</p>
                </Pane>
              )}</AnimatePresence>
            </span>
          </>
        )}
      </div>
      <AnimatePresence initial={false}>
        {inTable && (
          <motion.div className="fb-row fb-table" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.16 }}>
            <span className="fb-label"><Icon name="table" size={14} /> Tabel</span>
            <Btn icon="plus" label="Tambah baris di bawah" onClick={() => go('tbl:rowBelow')} />
            <button type="button" className="fb-text" onMouseDown={keep} onClick={() => go('tbl:colRight')}>+ Kolom</button>
            <button type="button" className="fb-text" onMouseDown={keep} onClick={() => go('tbl:delRow')}>− Baris</button>
            <button type="button" className="fb-text" onMouseDown={keep} onClick={() => go('tbl:delCol')}>− Kolom</button>
            <Sep />
            <Btn icon="alignL" label="Kolom rata kiri" onClick={() => go('tbl:alignLeft')} />
            <Btn icon="alignC" label="Kolom rata tengah" onClick={() => go('tbl:alignCenter')} />
            <Btn icon="alignR" label="Kolom rata kanan" onClick={() => go('tbl:alignRight')} />
            <Sep />
            <button type="button" className="fb-text danger" onMouseDown={keep} onClick={() => go('tbl:delTable')}>Hapus tabel</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Pane({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <motion.div className={'fb-pane' + (wide ? ' wide' : '')} initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.12 }}>
      {children}
    </motion.div>
  );
}
