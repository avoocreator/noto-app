import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../ui/Icon.tsx';
import { useApp, useVault } from '../store.ts';
import { seedNodes, stepForce, type GEdge, type GNode } from '../lib/graphLayout.ts';
import { basename, stripExt } from '../lib/analyze.ts';
import { useReducedMotion } from '../theme/useTheme.ts';
import type { Vault } from '../vault/vault.ts';

interface Opts { q: string; tag: string; local: boolean; orphans: boolean; ghosts: boolean }
interface Model {
  ids: string[];
  label: string[];
  kind: ('note' | 'ghost')[];
  group: number[];
  deg: number[];
  edges: GEdge[];
}

function buildModel(vault: Vault, o: Opts, active: string | null): Model {
  const idx = vault.index;
  let paths = [...idx.notes.keys()];
  const q = o.q.trim().toLowerCase();
  if (q) paths = paths.filter((p) => p.toLowerCase().includes(q) || (idx.notes.get(p)?.title ?? '').toLowerCase().includes(q));
  if (o.tag) paths = paths.filter((p) => idx.notes.get(p)?.tags.some((t) => t === o.tag || t.startsWith(o.tag + '/')));
  let keep = new Set(paths);

  if (o.local && active && idx.notes.has(active)) {
    const near = new Set([active]);
    for (let d = 0; d < 2; d++) for (const e of idx.edges) { if (near.has(e.from)) near.add(e.to); if (near.has(e.to)) near.add(e.from); }
    keep = new Set([...keep].filter((p) => near.has(p)));
    keep.add(active);
  }
  const deg = new Map<string, number>();
  const edges: { from: string; to: string }[] = [];
  for (const e of idx.edges) if (keep.has(e.from) && keep.has(e.to)) {
    edges.push(e);
    deg.set(e.from, (deg.get(e.from) ?? 0) + 1);
    deg.set(e.to, (deg.get(e.to) ?? 0) + 1);
  }
  const ghostIds: string[] = [];
  if (o.ghosts) {
    for (const p of keep) for (const l of idx.notes.get(p)!.links) {
      if (!vault.resolve(l.target, p) && !/\.[a-z0-9]{2,4}$/i.test(l.target)) {
        const gid = 'ghost:' + stripExt(l.target).toLowerCase();
        if (!ghostIds.includes(gid)) ghostIds.push(gid);
        edges.push({ from: p, to: gid });
        deg.set(p, (deg.get(p) ?? 0) + 1);
        deg.set(gid, (deg.get(gid) ?? 0) + 1);
      }
    }
  }
  let ids = [...keep];
  if (!o.orphans) ids = ids.filter((p) => (deg.get(p) ?? 0) > 0);
  ids = [...ids, ...ghostIds];
  const pos = new Map(ids.map((id, i) => [id, i]));
  const gedges: GEdge[] = [];
  for (const e of edges) { const a = pos.get(e.from), b = pos.get(e.to); if (a !== undefined && b !== undefined) gedges.push({ a, b }); }
  const folders = [...new Set(ids.map((id) => (id.startsWith('ghost:') ? '' : idx.notes.get(id)?.folder ?? '')))];
  return {
    ids,
    label: ids.map((id) => (id.startsWith('ghost:') ? id.slice(6) : idx.notes.get(id)?.title ?? stripExt(basename(id)))),
    kind: ids.map((id) => (id.startsWith('ghost:') ? 'ghost' : 'note')),
    group: ids.map((id) => (id.startsWith('ghost:') ? -1 : folders.indexOf(idx.notes.get(id)?.folder ?? '') )),
    deg: ids.map((id) => deg.get(id) ?? 0),
    edges: gedges,
  };
}

export function GraphView() {
  const vault = useVault();
  const openPath = useApp((s) => s.openPath);
  const active = useApp((s) => s.active);
  const reduce = useReducedMotion();
  const [o, setO] = useState<Opts>({ q: '', tag: '', local: false, orphans: true, ghosts: false });
  const cv = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const sim = useRef(new Map<string, GNode>());
  const hover = useRef(-1);
  const view = useRef({ x: 0, y: 0, k: 0.9 });
  const alpha = useRef(1);
  const [count, setCount] = useState(0);

  const model = useMemo(() => (vault ? buildModel(vault, o, active) : null), [vault?.version, o, active]);
  const tags = useMemo(() => [...(vault?.index.tags.keys() ?? [])].sort(), [vault?.version]);

  useEffect(() => {
    if (!model || !vault) return;
    setCount(model.ids.length);
    // pertahankan posisi lama; node baru diberi posisi awal
    const seeded = seedNodes(model.ids);
    const nodes: GNode[] = seeded.map((s) => { const old = sim.current.get(s.id); return old ? { ...old, r: s.r } : s; });
    sim.current = new Map(nodes.map((n) => [n.id, n]));
    alpha.current = 1;
    const canvas = cv.current!, el = box.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let w = 0, h = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = el.clientWidth; h = el.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (view.current.x === 0 && view.current.y === 0) view.current = { x: w / 2, y: h / 2, k: 0.9 };
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const css = getComputedStyle(document.documentElement);
    const col = (n: string) => css.getPropertyValue(n).trim();

    const neighbors = (i: number) => {
      const s = new Set<number>([i]);
      for (const e of model.edges) { if (e.a === i) s.add(e.b); if (e.b === i) s.add(e.a); }
      return s;
    };

    const draw = () => {
      const k = view.current.k;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(view.current.x, view.current.y);
      ctx.scale(k, k);
      const hv = hover.current;
      const nb = hv >= 0 ? neighbors(hv) : null;
      const edgeCol = col('--border-strong'), textCol = col('--text'), dim = 0.18;
      ctx.lineWidth = 1.2 / k;
      for (const e of model.edges) {
        const A = nodes[e.a], B = nodes[e.b];
        const on = nb && nb.has(e.a) && nb.has(e.b) && (e.a === hv || e.b === hv);
        ctx.globalAlpha = nb ? (on ? 1 : dim) : 0.7;
        ctx.strokeStyle = on ? col('--accent-strong') : edgeCol;
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      }
      model.ids.forEach((id, i) => {
        const n = nodes[i];
        const r = 4 + Math.min(10, Math.sqrt(model.deg[i]) * 2.4);
        n.r = r;
        ctx.globalAlpha = nb ? (nb.has(i) ? 1 : dim) : 1;
        const isActive = id === active;
        const g = model.group[i];
        ctx.fillStyle = model.kind[i] === 'ghost' ? 'transparent' : col(`--tint-${(((g % 4) + 4) % 4) + 1}-deep`) || col('--accent');
        ctx.strokeStyle = isActive ? col('--ink') : model.kind[i] === 'ghost' ? edgeCol : col('--bg');
        ctx.lineWidth = (isActive ? 3 : 2) / k;
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        if (model.kind[i] === 'ghost') ctx.setLineDash([3 / k, 3 / k]); else ctx.setLineDash([]);
        ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
        if (k > 0.75 || i === hv || (nb && nb.has(i)) || isActive) {
          ctx.fillStyle = textCol;
          ctx.font = `${i === hv ? 600 : 500} ${12 / k}px ${col('--font-body') || 'sans-serif'}`;
          ctx.textAlign = 'center';
          ctx.fillText(model.label[i].slice(0, 28), n.x, n.y + r + 13 / k);
        }
      });
      ctx.restore();
    };

    const tick = () => {
      if (alpha.current > 0.015) {
        const steps = reduce ? 6 : 1;
        for (let s = 0; s < steps; s++) stepForce(nodes, model.edges, alpha.current);
        alpha.current *= reduce ? 0.9 : 0.985;
      }
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    /* interaksi */
    const toWorld = (cx: number, cy: number) => {
      const r = canvas.getBoundingClientRect();
      return { x: (cx - r.left - view.current.x) / view.current.k, y: (cy - r.top - view.current.y) / view.current.k };
    };
    const hit = (cx: number, cy: number) => {
      const p = toWorld(cx, cy);
      let best = -1, bd = Infinity;
      nodes.forEach((n, i) => { const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < Math.max(n.r + 4, 10 / view.current.k) && d < bd) { bd = d; best = i; } });
      return best;
    };
    let dragNode = -1, panning = false, moved = false, last = { x: 0, y: 0 };
    const down = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      last = { x: e.clientX, y: e.clientY }; moved = false;
      dragNode = hit(e.clientX, e.clientY);
      if (dragNode >= 0) nodes[dragNode].fixed = true; else panning = true;
    };
    const move = (e: PointerEvent) => {
      if (dragNode >= 0) {
        const p = toWorld(e.clientX, e.clientY);
        nodes[dragNode].x = p.x; nodes[dragNode].y = p.y; nodes[dragNode].vx = 0; nodes[dragNode].vy = 0;
        alpha.current = Math.max(alpha.current, 0.3);
        if (Math.hypot(e.clientX - last.x, e.clientY - last.y) > 4) moved = true;
      } else if (panning) {
        view.current.x += e.clientX - last.x; view.current.y += e.clientY - last.y;
        last = { x: e.clientX, y: e.clientY };
        moved = true;
      } else {
        const hv = hit(e.clientX, e.clientY);
        if (hv !== hover.current) { hover.current = hv; canvas.style.cursor = hv >= 0 ? 'pointer' : 'grab'; }
      }
    };
    const up = () => {
      if (dragNode >= 0) {
        nodes[dragNode].fixed = false;
        if (!moved && model.kind[dragNode] === 'note') openPath(model.ids[dragNode]);
        else if (!moved && model.kind[dragNode] === 'ghost') void vault.createNote({ title: model.label[dragNode] }).then((p) => openPath(p));
      }
      dragNode = -1; panning = false;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = view.current;
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      const k = Math.min(3, Math.max(0.15, v.k * f));
      const r = canvas.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      view.current = { k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k };
    };
    const leave = () => { hover.current = -1; };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('wheel', wheel);
    };
  }, [model, vault, active, reduce, openPath]);

  if (!vault || !model) return null;
  return (
    <div className="graph-view">
      <div className="graph-panel">
        <h2>Graf</h2>
        <p className="muted small">{count} node · {model.edges.length} tautan</p>
        <input placeholder="Saring nama / folder…" value={o.q} onChange={(e) => setO({ ...o, q: e.target.value })} aria-label="Saring graf" />
        <select value={o.tag} onChange={(e) => setO({ ...o, tag: e.target.value })} aria-label="Saring tag">
          <option value="">Semua tag</option>
          {tags.map((t) => <option key={t} value={t}>#{t}</option>)}
        </select>
        <label className="check-row"><input type="checkbox" checked={o.local} onChange={(e) => setO({ ...o, local: e.target.checked })} /> Graf lokal (catatan aktif ±2)</label>
        <label className="check-row"><input type="checkbox" checked={o.orphans} onChange={(e) => setO({ ...o, orphans: e.target.checked })} /> Tampilkan catatan tanpa tautan</label>
        <label className="check-row"><input type="checkbox" checked={o.ghosts} onChange={(e) => setO({ ...o, ghosts: e.target.checked })} /> Tampilkan tautan ke catatan yang belum ada</label>
        <button className="btn soft" onClick={() => { for (const n of sim.current.values()) { n.vx += (Math.random() - 0.5) * 10; n.vy += (Math.random() - 0.5) * 10; } view.current = { x: (box.current?.clientWidth ?? 800) / 2, y: (box.current?.clientHeight ?? 600) / 2, k: 0.9 }; alpha.current = 1; }}>
          <Icon name="refresh" size={15} /> Susun ulang
        </button>
      </div>
      <div className="graph-canvas" ref={box}>
        <canvas ref={cv} aria-label="Graf tautan antar catatan" role="img" />
        {count === 0 && <div className="cv-empty"><img src="./art/empty-search.svg" alt="" width={140} /><p className="muted">Belum ada catatan yang cocok.</p></div>}
      </div>
    </div>
  );
}

