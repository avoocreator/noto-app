import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Icon, type IconName } from './Icon.tsx';

export interface Swatch { value: string | null; label: string; color?: string }

export interface MenuItem {
  label: string;
  icon?: IconName;
  run?: () => void;
  danger?: boolean;
  /** garis pemisah sebelum item ini */
  sep?: boolean;
  disabled?: boolean;
  /** teks kecil di kanan (pintasan) */
  hint?: string;
  /** submenu */
  children?: MenuItem[];
  /** baris titik warna; onPick menerima value (null = tanpa warna) */
  swatches?: Swatch[];
  onPick?: (value: string | null) => void;
}

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)),
    });
  }, [x, y]);

  useEffect(() => {
    const close = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', close, true);
    document.addEventListener('keydown', esc);
    window.addEventListener('blur', onClose);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', close, true);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('blur', onClose);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      className="ctx"
      role="menu"
      style={{ left: pos.x, top: pos.y }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.12 }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <MenuList items={items} onClose={onClose} />
    </motion.div>
  );
}

function MenuList({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      {items.map((it, i) => (
        <div key={i} className="ctx-row" onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setOpen(it.children ? i : null)}>
          {it.sep && <hr />}
          {it.swatches ? (
            <div className="ctx-swatches" role="group" aria-label={it.label}>
              <span className="ctx-sw-label">{it.icon && <Icon name={it.icon} size={15} />}{it.label}</span>
              <span className="ctx-dots">
                {it.swatches.map((sw) => (
                  <button
                    key={sw.label}
                    className={'ctx-dot' + (sw.color ? '' : ' none')}
                    style={sw.color ? { background: sw.color } : undefined}
                    title={sw.label}
                    aria-label={sw.label}
                    onClick={() => { onClose(); it.onPick?.(sw.value); }}
                  >{!sw.color && <Icon name="x" size={11} strokeWidth={2.4} />}</button>
                ))}
              </span>
            </div>
          ) : (
            <button
              role="menuitem"
              aria-haspopup={it.children ? 'menu' : undefined}
              aria-expanded={it.children ? open === i : undefined}
              disabled={it.disabled}
              className={'ctx-item' + (it.danger ? ' danger' : '') + (open === i ? ' on' : '')}
              onClick={() => { if (it.children) { setOpen(open === i ? null : i); return; } onClose(); it.run?.(); }}
            >
              {it.icon ? <Icon name={it.icon} size={16} /> : <span className="ctx-ico-gap" />}
              <span className="ctx-label">{it.label}</span>
              {it.hint && <kbd className="ctx-hint">{it.hint}</kbd>}
              {it.children && <Icon name="chevRsm" size={14} />}
            </button>
          )}
          {it.children && open === i && <SubMenu items={it.children} onClose={onClose} />}
        </div>
      ))}
    </>
  );
}

function SubMenu({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [flip, setFlip] = useState<{ x: boolean; y: number }>({ x: false, y: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setFlip({ x: r.right > window.innerWidth - 8, y: Math.min(0, window.innerHeight - 8 - r.bottom) });
  }, []);
  return (
    <div ref={ref} className="ctx ctx-sub" role="menu" style={{ [flip.x ? 'right' : 'left']: 'calc(100% + 4px)', top: flip.y - 6 }}>
      <MenuList items={items} onClose={onClose} />
    </div>
  );
}

/** Hook kecil: kelola state menu konteks + long-press untuk sentuh. */
export function useContextMenu() {
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const bind = (items: () => MenuItem[]) => ({
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, items: items() }); },
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setMenu({ x: t.clientX, y: t.clientY, items: items() }), 520);
    },
    onTouchEnd: () => window.clearTimeout(timer.current),
    onTouchMove: () => window.clearTimeout(timer.current),
  });
  const element = menu ? <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} /> : null;
  return { bind, element, open: (x: number, y: number, items: MenuItem[]) => setMenu({ x, y, items }) };
}
