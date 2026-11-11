import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Icon } from '../ui/Icon.tsx';
import { useApp, useVault } from '../store.ts';
import { basename, stripExt } from '../lib/analyze.ts';
import { bounds, parseCanvas } from '../lib/jsoncanvas.ts';
import { relativeTime } from '../lib/dates.ts';
import { deleteEntry, newCanvas, renameEntry } from '../actions.ts';

function Thumb({ src }: { src: string }) {
  const data = useMemo(() => parseCanvas(src), [src]);
  const b = bounds(data.nodes);
  if (!b) return <div className="thumb empty"><Icon name="canvas" size={28} /></div>;
  const pad = 30;
  return (
    <svg className="thumb" viewBox={`${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {data.edges.map((e) => {
        const a = data.nodes.find((n) => n.id === e.fromNode), c = data.nodes.find((n) => n.id === e.toNode);
        return a && c ? <line key={e.id} x1={a.x + a.width / 2} y1={a.y + a.height / 2} x2={c.x + c.width / 2} y2={c.y + c.height / 2} className="th-edge" /> : null;
      })}
      {data.nodes.map((n) => (
        <rect
          key={n.id} x={n.x} y={n.y} width={n.width} height={n.height} rx={Math.min(24, n.height / 4)}
          className={'th-node ' + n.type}
          style={n.color && /^[1-6]$/.test(n.color) ? { fill: `var(--c-${n.color})` } : undefined}
        />
      ))}
    </svg>
  );
}

export function CanvasGallery() {
  const vault = useVault();
  const openPath = useApp((s) => s.openPath);
  if (!vault) return null;
  const list = vault.files.filter((f) => f.path.endsWith('.canvas')).sort((a, b) => b.mtime - a.mtime);
  return (
    <div className="gallery">
      <header className="page-head">
        <div>
          <h1>Canvas</h1>
          <p className="muted">Papan tak terbatas untuk memetakan ide. Disimpan sebagai <code>.canvas</code> (JSON Canvas) — terbuka juga di Obsidian.</p>
        </div>
        <button className="btn ink" onClick={() => void newCanvas()}><Icon name="plus" size={16} /> Canvas baru</button>
      </header>
      {list.length === 0 ? (
        <div className="empty-doc">
          <img src="./art/empty-canvas.svg" alt="" width={200} />
          <h2>Belum ada canvas</h2>
          <button className="btn ink" onClick={() => void newCanvas()}><Icon name="plus" size={16} /> Buat canvas pertama</button>
        </div>
      ) : (
        <div className="gallery-grid">
          {list.map((f, i) => (
            <motion.article key={f.path} className={'gcard tint-' + ((i % 4) + 1)} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} whileHover={{ y: -4 }}>
              <button className="gcard-open" onClick={() => openPath(f.path)} aria-label={`Buka ${stripExt(basename(f.path))}`}>
                <Thumb src={vault.content(f.path) ?? ''} />
              </button>
              <div className="gcard-foot">
                <div><b>{stripExt(basename(f.path))}</b><small>{relativeTime(f.mtime)}</small></div>
                <div className="row gap-s">
                  <button className="icon-btn tiny" aria-label="Ganti nama" onClick={() => void renameEntry(f.path)}><Icon name="edit" size={14} /></button>
                  <button className="icon-btn tiny" aria-label="Hapus" onClick={() => void deleteEntry(f.path)}><Icon name="trash" size={14} /></button>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
}
