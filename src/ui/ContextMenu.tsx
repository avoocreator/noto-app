import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Icon, type IconName } from './Icon.tsx';

export interface MenuItem {
  label: string;
  icon?: IconName;
  run: () => void;
  danger?: boolean;
  /** garis pemisah sebelum item ini */
  sep?: boolean;
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
    >
      {items.map((it, i) => (
        <div key={i}>
          {it.sep && <hr />}
          <button role="menuitem" className={'ctx-item' + (it.danger ? ' danger' : '')} onClick={() => { onClose(); it.run(); }}>
            {it.icon && <Icon name={it.icon} size={16} />}
            {it.label}
          </button>
        </div>
      ))}
    </motion.div>
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
