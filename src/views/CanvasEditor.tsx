import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../ui/Icon.tsx';
import { useApp, useVault } from '../store.ts';
import {
  anchor, bestSides, bounds, edgePath, newFileNode, newGroupNode, newId, newLinkNode, newTextNode, parseCanvas, serializeCanvas,
  type CanvasData, type CanvasEdge, type CanvasNode, type Side,
} from '../lib/jsoncanvas.ts';
import { parseFrontmatter } from '../lib/frontmatter.ts';
import { basename, isCanvasPath, isImagePath, isNotePath, stripExt } from '../lib/analyze.ts';
import { MiniMd } from './MiniMd.tsx';
import { ask } from '../ui/dialogs.tsx';

interface View { x: number; y: number; k: number }
const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];
const COLORS = ['1', '2', '3', '4', '5', '6'];
const MIN_W = 80, MIN_H = 48;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const viewKey = (p: string) => 'noto-canvas-view:' + p;

type Drag =
  | { type: 'pan'; sx: number; sy: number; vx: number; vy: number }
  | { type: 'move'; sx: number; sy: number; ids: string[]; orig: Map<string, { x: number; y: number }>; moved: boolean }
  | { type: 'resize'; id: string; sx: number; sy: number; w: number; h: number }
  | { type: 'connect'; from: string; side: Side }
  | { type: 'marquee'; sx: number; sy: number };

function nodeColor(c?: string) {
  if (!c) return {};
  if (/^[1-6]$/.test(c)) return { '--nc': `var(--c-${c})`, '--nc-fg': `var(--c-${c}-fg)` } as React.CSSProperties;
  return { '--nc': c, '--nc-fg': 'var(--text)' } as React.CSSProperties;
}

export function CanvasEditor({ path }: { path: string }) {
  const vault = useVault()!;
  const openPath = useApp((s) => s.openPath);
  const toast = useApp((s) => s.toast);
  const wrap = useRef<HTMLDivElement>(null);

  const initial = useMemo(() => parseCanvas(vault.content(path) ?? ''), [path, vault]);
  const [data, setData] = useState<CanvasData>(initial);
  const dataRef = useRef(initial);
  const undo = useRef<CanvasData[]>([]);
  const redo = useRef<CanvasData[]>([]);
  const lastSaved = useRef(serializeCanvas(initial));
  const saveTimer = useRef<number | undefined>(undefined);

  const [view, setViewState] = useState<View>(() => {
    try { const v = JSON.parse(localStorage.getItem(viewKey(path)) || 'null') as View | null; if (v && isFinite(v.k)) return v; } catch { /* abaikan */ }
    return { x: 400, y: 260, k: 1 };
  });
  const viewRef = useRef(view);
  const setView = (v: View) => { viewRef.current = v; setViewState(v); };

  const [sel, setSel] = useState<Set<string>>(new Set());
  const [selEdge, setSelEdge] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ a: { x: number; y: number }; b: { x: number; y: number } } | null>(null);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [picker, setPicker] = useState(false);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const drag = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; k: number } | null>(null);

  /* ── simpan / undo ─────────────────────────────────────────────────────────────── */
  const flush = useCallback(() => {
    if (saveTimer.current !== undefined) { window.clearTimeout(saveTimer.current); saveTimer.current = undefined; }
    const s = serializeCanvas(dataRef.current);
    if (s !== lastSaved.current) { lastSaved.current = s; void vault.write(path, s); }
  }, [vault, path]);
  const scheduleSave = useCallback(() => {
    if (saveTimer.current !== undefined) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flush, 350);
  }, [flush]);

  const apply = useCallback((d: CanvasData, pushUndo: boolean) => {
    if (pushUndo) { undo.current.push(dataRef.current); if (undo.current.length > 100) undo.current.shift(); redo.current = []; }
    dataRef.current = d;
    setData(d);
    scheduleSave();
  }, [scheduleSave]);

  const doUndo = () => { const p = undo.current.pop(); if (!p) return; redo.current.push(dataRef.current); dataRef.current = p; setData(p); scheduleSave(); };
  const doRedo = () => { const n = redo.current.pop(); if (!n) return; undo.current.push(dataRef.current); dataRef.current = n; setData(n); scheduleSave(); };

  useEffect(() => {
    const off = vault.subscribe(() => {
      const cur = vault.content(path);
      if (cur === undefined || saveTimer.current !== undefined) return;
      if (cur !== lastSaved.current) { lastSaved.current = cur; const d = parseCanvas(cur); dataRef.current = d; setData(d); }
    });
    return () => { off(); flush(); try { localStorage.setItem(viewKey(path), JSON.stringify(viewRef.current)); } catch { /* abaikan */ } };
  }, [vault, path, flush]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  /* ── koordinat & zoom ──────────────────────────────────────────────────────────── */
  const toWorld = (cx: number, cy: number) => {
    const r = wrap.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (cx - r.left - v.x) / v.k, y: (cy - r.top - v.y) / v.k };
  };
  const zoomAt = (cx: number, cy: number, factor: number) => {
    const r = wrap.current!.getBoundingClientRect();
    const v = viewRef.current;
    const k = clamp(v.k * factor, 0.1, 3);
    const px = cx - r.left, py = cy - r.top;
    setView({ k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k });
  };
  const fit = useCallback((nodes = dataRef.current.nodes) => {
    const b = bounds(nodes);
    const el = wrap.current;
    if (!b || !el) { setView({ x: el ? el.clientWidth / 2 : 400, y: el ? el.clientHeight / 2 : 260, k: 1 }); return; }
    const k = clamp(Math.min(el.clientWidth / (b.w + 160), el.clientHeight / (b.h + 160)), 0.1, 1.5);
    setView({ k, x: (el.clientWidth - b.w * k) / 2 - b.x * k, y: (el.clientHeight - b.h * k) / 2 - b.y * k });
  }, []);
  useEffect(() => {
    if (!localStorage.getItem(viewKey(path))) fit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w > 0]);

  // wheel: geser (trackpad) / zoom (Ctrl, pinch)
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('textarea, .node-scroll')) { if (!e.ctrlKey && !e.metaKey) return; }
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
      else { const v = viewRef.current; setView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }); }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  /* ── operasi data ──────────────────────────────────────────────────────────────── */
  const patchNode = (id: string, patch: Partial<CanvasNode>, pushUndo = true) =>
    apply({ ...dataRef.current, nodes: dataRef.current.nodes.map((n) => (n.id === id ? ({ ...n, ...patch } as CanvasNode) : n)) }, pushUndo);

  const addNode = (n: CanvasNode, edit = false) => {
    apply({ ...dataRef.current, nodes: [...dataRef.current.nodes, n] }, true);
    setSel(new Set([n.id]));
    setSelEdge(null);
    if (edit) setEditing(n.id);
  };
  const center = () => toWorld(wrap.current!.getBoundingClientRect().left + size.w / 2, wrap.current!.getBoundingClientRect().top + size.h / 2);

  const removeSelected = () => {
    const d = dataRef.current;
    if (selEdge) { apply({ ...d, edges: d.edges.filter((e) => e.id !== selEdge) }, true); setSelEdge(null); return; }
    if (sel.size === 0) return;
    apply({
      nodes: d.nodes.filter((n) => !sel.has(n.id)),
      edges: d.edges.filter((e) => !sel.has(e.fromNode) && !sel.has(e.toNode)),
    }, true);
    setSel(new Set());
  };
  const duplicate = () => {
    const d = dataRef.current;
    const map = new Map<string, string>();
    const copies = d.nodes.filter((n) => sel.has(n.id)).map((n) => { const id = newId(); map.set(n.id, id); return { ...n, id, x: n.x + 32, y: n.y + 32 } as CanvasNode; });
    const edges = d.edges.filter((e) => map.has(e.fromNode) && map.has(e.toNode)).map((e) => ({ ...e, id: newId(), fromNode: map.get(e.fromNode)!, toNode: map.get(e.toNode)! }));
    apply({ nodes: [...d.nodes, ...copies], edges: [...d.edges, ...edges] }, true);
    setSel(new Set(copies.map((c) => c.id)));
  };
  const setColor = (c?: string) => {
    const d = dataRef.current;
    if (selEdge) apply({ ...d, edges: d.edges.map((e) => (e.id === selEdge ? { ...e, color: c } : e)) }, true);
    else apply({ ...d, nodes: d.nodes.map((n) => (sel.has(n.id) ? ({ ...n, color: c } as CanvasNode) : n)) }, true);
  };

  const openLink = (target: string) => {
    const p = vault.resolve(target, path);
    if (p) openPath(p); else toast(`Catatan "${target}" belum ada`, 'info');
  };

  /* ── pointer ───────────────────────────────────────────────────────────────────── */
  const onPointerDown = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('textarea, input, .cv-toolbar, .cv-mini, .cv-picker, a')) return;
    wrap.current!.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), k: viewRef.current.k };
      drag.current = null;
      return;
    }
    const w = toWorld(e.clientX, e.clientY);
    const portEl = t.closest('[data-port]') as HTMLElement | null;
    const resizeEl = t.closest('[data-resize]') as HTMLElement | null;
    const nodeEl = t.closest('[data-node-id]') as HTMLElement | null;
    const edgeEl = t.closest('[data-edge-id]') as HTMLElement | null;
    const d = dataRef.current;

    if (portEl && nodeEl) {
      drag.current = { type: 'connect', from: nodeEl.dataset.nodeId!, side: portEl.dataset.port as Side };
      const n = d.nodes.find((x) => x.id === nodeEl.dataset.nodeId)!;
      setGhost({ a: anchor(n, portEl.dataset.port as Side), b: w });
      return;
    }
    if (resizeEl && nodeEl) {
      const n = d.nodes.find((x) => x.id === nodeEl.dataset.nodeId)!;
      undo.current.push(d); redo.current = [];
      drag.current = { type: 'resize', id: n.id, sx: w.x, sy: w.y, w: n.width, h: n.height };
      return;
    }
    if (nodeEl) {
      const id = nodeEl.dataset.nodeId!;
      let ids = sel.has(id) ? [...sel] : [id];
      if (e.shiftKey) {
        const next = new Set(sel);
        next.has(id) ? next.delete(id) : next.add(id);
        setSel(next);
        ids = [...next];
      } else if (!sel.has(id)) setSel(new Set([id]));
      setSelEdge(null);
      // geser grup → anggotanya ikut
      const group = d.nodes.filter((n) => n.type === 'group' && ids.includes(n.id));
      for (const g of group) {
        for (const n of d.nodes) {
          if (n.id !== g.id && n.x >= g.x && n.y >= g.y && n.x + n.width <= g.x + g.width && n.y + n.height <= g.y + g.height && !ids.includes(n.id)) ids.push(n.id);
        }
      }
      const orig = new Map(d.nodes.filter((n) => ids.includes(n.id)).map((n) => [n.id, { x: n.x, y: n.y }]));
      drag.current = { type: 'move', sx: w.x, sy: w.y, ids, orig, moved: false };
      return;
    }
    if (edgeEl) { setSelEdge(edgeEl.dataset.edgeId!); setSel(new Set()); return; }
    // latar
    if (e.shiftKey) {
      drag.current = { type: 'marquee', sx: w.x, sy: w.y };
      setMarquee({ x1: w.x, y1: w.y, x2: w.x, y2: w.y });
      return;
    }
    setSel(new Set()); setSelEdge(null); setEditing(null); setPicker(false);
    const v = viewRef.current;
    drag.current = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const target = clamp(pinch.current.k * (d / pinch.current.d), 0.1, 3);
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, target / viewRef.current.k);
      return;
    }
    const dr = drag.current;
    if (!dr) return;
    const w = toWorld(e.clientX, e.clientY);
    const d = dataRef.current;
    if (dr.type === 'pan') setView({ ...viewRef.current, x: dr.vx + (e.clientX - dr.sx), y: dr.vy + (e.clientY - dr.sy) });
    else if (dr.type === 'move') {
      let dx = w.x - dr.sx, dy = w.y - dr.sy;
      if (!dr.moved && Math.hypot(dx, dy) * viewRef.current.k < 3) return;
      if (!dr.moved) { undo.current.push(d); redo.current = []; dr.moved = true; }
      // snap ke tepi/tengah node lain (hanya saat satu node bergerak)
      const gv: number[] = [], gh: number[] = [];
      if (dr.ids.length === 1 && !e.altKey) {
        const me = d.nodes.find((n) => n.id === dr.ids[0])!;
        const o = dr.orig.get(me.id)!;
        const tol = 6 / viewRef.current.k;
        const xs = [o.x + dx, o.x + dx + me.width / 2, o.x + dx + me.width];
        const ys = [o.y + dy, o.y + dy + me.height / 2, o.y + dy + me.height];
        let bx: number | null = null, by: number | null = null;
        for (const n of d.nodes) {
          if (n.id === me.id) continue;
          for (const tx of [n.x, n.x + n.width / 2, n.x + n.width]) for (const cx of xs) if (Math.abs(tx - cx) < tol && (bx === null || Math.abs(tx - cx) < Math.abs(bx))) bx = tx - cx;
          for (const ty of [n.y, n.y + n.height / 2, n.y + n.height]) for (const cy of ys) if (Math.abs(ty - cy) < tol && (by === null || Math.abs(ty - cy) < Math.abs(by))) by = ty - cy;
        }
        if (bx !== null) { dx += bx; xs.forEach((x) => gv.push(x + bx!)); }
        if (by !== null) { dy += by; ys.forEach((y) => gh.push(y + by!)); }
      }
      setGuides({ v: gv, h: gh });
      apply({ ...d, nodes: d.nodes.map((n) => { const o = dr.orig.get(n.id); return o ? ({ ...n, x: Math.round(o.x + dx), y: Math.round(o.y + dy) } as CanvasNode) : n; }) }, false);
    } else if (dr.type === 'resize') {
      apply({ ...d, nodes: d.nodes.map((n) => (n.id === dr.id ? ({ ...n, width: Math.max(MIN_W, Math.round(dr.w + w.x - dr.sx)), height: Math.max(MIN_H, Math.round(dr.h + w.y - dr.sy)) } as CanvasNode) : n)) }, false);
    } else if (dr.type === 'connect') {
      const n = d.nodes.find((x) => x.id === dr.from)!;
      setGhost({ a: anchor(n, dr.side), b: w });
    } else if (dr.type === 'marquee') {
      setMarquee({ x1: dr.sx, y1: dr.sy, x2: w.x, y2: w.y });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const dr = drag.current;
    drag.current = null;
    setGuides({ v: [], h: [] });
    if (!dr) return;
    const d = dataRef.current;
    if (dr.type === 'connect') {
      setGhost(null);
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-node-id]') as HTMLElement | null;
      const toId = el?.dataset.nodeId;
      if (toId && toId !== dr.from) {
        const a = d.nodes.find((n) => n.id === dr.from)!, b = d.nodes.find((n) => n.id === toId)!;
        const [, toSide] = bestSides(a, b);
        apply({ ...d, edges: [...d.edges, { id: newId(), fromNode: a.id, fromSide: dr.side, toNode: b.id, toSide, toEnd: 'arrow' } satisfies CanvasEdge] }, true);
      } else if (!toId) {
        const w = toWorld(e.clientX, e.clientY);
        const n = newTextNode(w.x - 20, w.y - 20, '');
        const a = d.nodes.find((x) => x.id === dr.from)!;
        const [, toSide] = bestSides(a, n);
        apply({ nodes: [...d.nodes, n], edges: [...d.edges, { id: newId(), fromNode: a.id, fromSide: dr.side, toNode: n.id, toSide, toEnd: 'arrow' }] }, true);
        setSel(new Set([n.id]));
        setEditing(n.id);
      }
    } else if (dr.type === 'marquee') {
      const m = marquee;
      setMarquee(null);
      if (m) {
        const x1 = Math.min(m.x1, m.x2), x2 = Math.max(m.x1, m.x2), y1 = Math.min(m.y1, m.y2), y2 = Math.max(m.y1, m.y2);
        setSel(new Set(d.nodes.filter((n) => n.x < x2 && n.x + n.width > x1 && n.y < y2 && n.y + n.height > y1).map((n) => n.id)));
      }
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('textarea, input, .cv-toolbar, .cv-mini, .cv-picker')) return;
    const nodeEl = t.closest('[data-node-id]') as HTMLElement | null;
    const edgeEl = t.closest('[data-edge-id]') as HTMLElement | null;
    if (edgeEl) {
      const ed = dataRef.current.edges.find((x) => x.id === edgeEl.dataset.edgeId)!;
      void ask({ title: 'Label garis', initial: ed.label ?? '', confirm: 'Simpan' }).then((v) => {
        if (v === null) return;
        apply({ ...dataRef.current, edges: dataRef.current.edges.map((x) => (x.id === ed.id ? { ...x, label: v || undefined } : x)) }, true);
      });
      return;
    }
    if (nodeEl) {
      const n = dataRef.current.nodes.find((x) => x.id === nodeEl.dataset.nodeId)!;
      if (n.type === 'text' || n.type === 'group') setEditing(n.id);
      else if (n.type === 'file') openPath(n.file);
      else if (n.type === 'link') window.open(n.url, '_blank', 'noopener');
      return;
    }
    const w = toWorld(e.clientX, e.clientY);
    addNode(newTextNode(Math.round(w.x - 130), Math.round(w.y - 40)), true);
  };

  /* ── papan ketik ───────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('textarea, input')) return;
      if (!el.contains(document.activeElement) && document.activeElement !== document.body) return;
      const mod = e.ctrlKey || e.metaKey;
      if ((e.key === 'Delete' || e.key === 'Backspace') && (sel.size || selEdge)) { e.preventDefault(); removeSelected(); }
      else if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); }
      else if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); setSel(new Set(dataRef.current.nodes.map((n) => n.id))); }
      else if (mod && e.key.toLowerCase() === 'd' && sel.size) { e.preventDefault(); duplicate(); }
      else if (e.key === 'Escape') { setSel(new Set()); setSelEdge(null); setPicker(false); }
      else if (e.key === '+' || e.key === '=') zoomAt(el.getBoundingClientRect().left + size.w / 2, el.getBoundingClientRect().top + size.h / 2, 1.2);
      else if (e.key === '-') zoomAt(el.getBoundingClientRect().left + size.w / 2, el.getBoundingClientRect().top + size.h / 2, 1 / 1.2);
      else if (e.key === '!' || (e.shiftKey && e.key === '1')) fit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, selEdge, size]);

  /* ── drop ──────────────────────────────────────────────────────────────────────── */
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const w = toWorld(e.clientX, e.clientY);
    const p = e.dataTransfer.getData('text/noto-path');
    if (p) {
      if (isNotePath(p) || isImagePath(p) || isCanvasPath(p)) addNode(newFileNode(Math.round(w.x), Math.round(w.y), p));
      return;
    }
    let i = 0;
    for (const f of [...e.dataTransfer.files]) {
      if (!f.type.startsWith('image/')) continue;
      const saved = await vault.saveAttachment(f.name, new Uint8Array(await f.arrayBuffer()));
      const n = newFileNode(Math.round(w.x + i * 30), Math.round(w.y + i * 30), saved);
      n.width = 320; n.height = 240;
      addNode(n);
      i++;
    }
  };

  /* ── render ────────────────────────────────────────────────────────────────────── */
  const nodes = useMemo(() => [...data.nodes].sort((a, b) => Number(b.type === 'group') - Number(a.type === 'group')), [data.nodes]);
  const byId = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data.nodes]);
  const selNodes = data.nodes.filter((n) => sel.has(n.id));
  const selBox = selNodes.length === 1 ? selNodes[0] : null;

  const edgeEls = data.edges.map((ed) => {
    const a = byId.get(ed.fromNode), b = byId.get(ed.toNode);
    if (!a || !b) return null;
    const [fs, ts] = ed.fromSide && ed.toSide ? [ed.fromSide, ed.toSide] : bestSides(a, b);
    const pa = anchor(a, ed.fromSide ?? fs), pb = anchor(b, ed.toSide ?? ts);
    const { d, mid } = edgePath(pa, ed.fromSide ?? fs, pb, ed.toSide ?? ts);
    const col = ed.color ? (/^[1-6]$/.test(ed.color) ? `var(--c-${ed.color}-deep, var(--c-${ed.color}))` : ed.color) : 'var(--border-strong)';
    const on = selEdge === ed.id;
    const arrow = (p: { x: number; y: number }, side: Side) => {
      const o = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }[side];
      const px = -o[1], py = o[0];
      return `M ${p.x} ${p.y} L ${p.x + o[0] * 13 + px * 6.5} ${p.y + o[1] * 13 + py * 6.5} L ${p.x + o[0] * 13 - px * 6.5} ${p.y + o[1] * 13 - py * 6.5} Z`;
    };
    return (
      <g key={ed.id} className={'cv-edge' + (on ? ' on' : '')} style={{ color: col }}>
        <path d={d} className="cv-edge-hit" data-edge-id={ed.id} />
        <path d={d} className="cv-edge-line" />
        {(ed.toEnd ?? 'arrow') === 'arrow' && <path d={arrow(pb, ed.toSide ?? ts)} fill="currentColor" />}
        {ed.fromEnd === 'arrow' && <path d={arrow(pa, ed.fromSide ?? fs)} fill="currentColor" />}
        {ed.label && (
          <g transform={`translate(${mid.x} ${mid.y})`}>
            <rect x={-ed.label.length * 3.6 - 8} y={-11} width={ed.label.length * 7.2 + 16} height={22} rx={11} className="cv-edge-label-bg" />
            <text textAnchor="middle" dy="4" className="cv-edge-label">{ed.label}</text>
          </g>
        )}
      </g>
    );
  });

  return (
    <div
      className="canvas-wrap"
      ref={wrap}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => void onDrop(e)}
      style={{ backgroundSize: `${24 * view.k}px ${24 * view.k}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
    >
      <div className="cv-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
        <svg className="cv-edges" width="1" height="1" style={{ overflow: 'visible' }}>
          {edgeEls}
          {ghost && <path d={edgePath(ghost.a, 'right', ghost.b, 'left').d} className="cv-ghost" />}
          {guides.v.map((x, i) => <line key={'v' + i} x1={x} x2={x} y1={-100000} y2={100000} className="cv-guide" />)}
          {guides.h.map((y, i) => <line key={'h' + i} y1={y} y2={y} x1={-100000} x2={100000} className="cv-guide" />)}
          {marquee && <rect className="cv-marquee" x={Math.min(marquee.x1, marquee.x2)} y={Math.min(marquee.y1, marquee.y2)} width={Math.abs(marquee.x2 - marquee.x1)} height={Math.abs(marquee.y2 - marquee.y1)} />}
        </svg>
        {nodes.map((n) => (
          <NodeView
            key={n.id}
            n={n}
            selected={sel.has(n.id)}
            single={selBox?.id === n.id}
            editing={editing === n.id}
            onEdit={(v) => patchNode(n.id, n.type === 'group' ? ({ label: v } as Partial<CanvasNode>) : ({ text: v } as Partial<CanvasNode>))}
            onStopEdit={() => setEditing(null)}
            onLink={openLink}
          />
        ))}
      </div>

      {data.nodes.length === 0 && (
        <div className="cv-empty">
          <img src="./art/empty-canvas.svg" alt="" width={180} />
          <p><b>Canvas kosong</b></p>
          <p className="muted small">Klik dua kali untuk membuat kartu. Seret catatan dari daftar berkas ke sini.</p>
        </div>
      )}

      <div className="cv-toolbar" role="toolbar" aria-label="Alat canvas">
        <button title="Kartu teks" onClick={() => { const c = center(); addNode(newTextNode(Math.round(c.x - 130), Math.round(c.y - 70)), true); }}><Icon name="text" size={17} /></button>
        <button title="Sisipkan catatan" className={picker ? 'on' : ''} onClick={() => setPicker(!picker)}><Icon name="notes" size={17} /></button>
        <button title="Tautan web" onClick={async () => { const u = await ask({ title: 'Tautan web', label: 'URL', placeholder: 'https://…', confirm: 'Tambah' }); if (u) { const c = center(); addNode(newLinkNode(Math.round(c.x - 150), Math.round(c.y - 60), /^https?:/i.test(u) ? u : 'https://' + u)); } }}><Icon name="link" size={17} /></button>
        <button title="Grup" onClick={() => { const c = center(); addNode(newGroupNode(Math.round(c.x - 260), Math.round(c.y - 180))); }}><Icon name="group" size={17} /></button>
        <i className="sep" />
        <button title="Urungkan (Ctrl+Z)" onClick={doUndo}><Icon name="undo" size={17} /></button>
        <button title="Ulangi (Ctrl+Shift+Z)" onClick={doRedo}><Icon name="redo" size={17} /></button>
        <i className="sep" />
        <button title="Perkecil (-)" onClick={() => zoomAt(wrap.current!.getBoundingClientRect().left + size.w / 2, wrap.current!.getBoundingClientRect().top + size.h / 2, 1 / 1.25)}><Icon name="minus" size={17} /></button>
        <span className="zoom-val">{Math.round(view.k * 100)}%</span>
        <button title="Perbesar (+)" onClick={() => zoomAt(wrap.current!.getBoundingClientRect().left + size.w / 2, wrap.current!.getBoundingClientRect().top + size.h / 2, 1.25)}><Icon name="plus" size={17} /></button>
        <button title="Pas ke layar (Shift+1)" onClick={() => fit()}><Icon name="fit" size={17} /></button>
      </div>

      {(sel.size > 0 || selEdge) && (
        <div className="cv-toolbar sel" role="toolbar" aria-label="Pilihan">
          {COLORS.map((c) => <button key={c} className="swatch" style={{ background: `var(--c-${c})` }} aria-label={`Warna ${c}`} onClick={() => setColor(c)} />)}
          <button className="swatch none" aria-label="Tanpa warna" onClick={() => setColor(undefined)}><Icon name="x" size={12} /></button>
          {sel.size > 0 && <><i className="sep" /><button title="Gandakan (Ctrl+D)" onClick={duplicate}><Icon name="copy" size={16} /></button></>}
          <button title="Hapus (Del)" className="danger" onClick={removeSelected}><Icon name="trash" size={16} /></button>
        </div>
      )}

      {picker && (
        <NotePicker
          onPick={(p) => { const c = center(); addNode(newFileNode(Math.round(c.x - 150), Math.round(c.y - 110), p)); setPicker(false); }}
          onClose={() => setPicker(false)}
        />
      )}

      <Minimap nodes={data.nodes} view={view} size={size} onJump={(x, y) => setView({ ...view, x: size.w / 2 - x * view.k, y: size.h / 2 - y * view.k })} />
    </div>
  );
}

/* ── satu node ─────────────────────────────────────────────────────────────────────── */
function NodeView({ n, selected, single, editing, onEdit, onStopEdit, onLink }: {
  n: CanvasNode; selected: boolean; single: boolean; editing: boolean;
  onEdit: (v: string) => void; onStopEdit: () => void; onLink: (t: string) => void;
}) {
  const vault = useVault()!;
  const style: React.CSSProperties = { left: n.x, top: n.y, width: n.width, height: n.height, ...nodeColor(n.color) };
  const cls = `cv-node ${n.type}${n.color ? ' colored' : ''}${selected ? ' sel' : ''}`;

  let body: React.ReactNode = null;
  if (n.type === 'text') {
    body = editing ? (
      <textarea
        className="cv-edit"
        autoFocus
        defaultValue={n.text}
        onBlur={(e) => { onEdit(e.target.value); onStopEdit(); }}
        onKeyDown={(e) => { if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur(); }}
        placeholder="Tulis sesuatu…"
      />
    ) : (
      <div className="node-scroll">{n.text.trim() ? <MiniMd text={n.text} onLink={onLink} /> : <span className="muted">Kartu kosong — klik dua kali</span>}</div>
    );
  } else if (n.type === 'file') {
    body = <FileBody path={n.file} onLink={onLink} vault={vault} />;
  } else if (n.type === 'link') {
    body = (
      <div className="cv-link">
        <Icon name="external" size={16} />
        <b>{(() => { try { return new URL(n.url).hostname.replace(/^www\./, ''); } catch { return n.url; } })()}</b>
        <small>{n.url}</small>
      </div>
    );
  } else {
    body = editing ? (
      <input className="cv-group-edit" autoFocus defaultValue={n.label ?? ''} onBlur={(e) => { onEdit(e.target.value); onStopEdit(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur(); }} />
    ) : <span className="cv-group-label">{n.label || 'Grup'}</span>;
  }

  return (
    <div className={cls} style={style} data-node-id={n.id}>
      {body}
      {(selected || single) && SIDES.map((s) => <i key={s} className={'cv-port ' + s} data-port={s} />)}
      {single && <i className="cv-resize" data-resize="1" />}
    </div>
  );
}

function FileBody({ path, onLink, vault }: { path: string; onLink: (t: string) => void; vault: ReturnType<typeof useVault> & object }) {
  const [url, setUrl] = useState<string | null>(null);
  const missing = !vault.has(path);
  useEffect(() => {
    let alive = true;
    if (isImagePath(path) && vault.has(path)) void vault.blobUrl(path).then((u) => { if (alive) setUrl(u); }).catch(() => undefined);
    return () => { alive = false; };
  }, [path, vault]);

  if (missing) return <div className="cv-file missing"><Icon name="file" size={16} /> {basename(path)} <small>tidak ditemukan</small></div>;
  if (isImagePath(path)) return url ? <img className="cv-img" src={url} alt={basename(path)} draggable={false} /> : <div className="cv-file">Memuat…</div>;
  if (isCanvasPath(path)) return <div className="cv-file"><Icon name="canvas" size={18} /> <b>{stripExt(basename(path))}</b><small>canvas</small></div>;
  const body = parseFrontmatter(vault.content(path) ?? '').body.slice(0, 900);
  return (
    <>
      <div className="cv-file-head"><Icon name="notes" size={14} /> {stripExt(basename(path))}</div>
      <div className="node-scroll"><MiniMd text={body} onLink={onLink} /></div>
    </>
  );
}

function NotePicker({ onPick, onClose }: { onPick: (p: string) => void; onClose: () => void }) {
  const vault = useVault()!;
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = [...vault.notes, ...vault.files.filter((f) => isImagePath(f.path)).map((f) => ({ path: f.path, title: basename(f.path), mtime: f.mtime }))];
    return all.filter((n) => !s || n.title.toLowerCase().includes(s) || n.path.toLowerCase().includes(s)).sort((a, b) => b.mtime - a.mtime).slice(0, 30);
  }, [q, vault.version]);
  return (
    <div className="cv-picker" role="dialog" aria-label="Sisipkan catatan">
      <input autoFocus placeholder="Cari catatan atau gambar…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter' && list[0]) onPick(list[0].path); }} />
      <ul>
        {list.map((n) => <li key={n.path}><button onClick={() => onPick(n.path)}><Icon name={isImagePath(n.path) ? 'image' : 'notes'} size={14} /> {n.title}<small>{n.path}</small></button></li>)}
        {list.length === 0 && <li className="muted small pad">Tidak ada hasil.</li>}
      </ul>
    </div>
  );
}

function Minimap({ nodes, view, size, onJump }: { nodes: CanvasNode[]; view: View; size: { w: number; h: number }; onJump: (x: number, y: number) => void }) {
  const W = 168, H = 112;
  const vp = { x: -view.x / view.k, y: -view.y / view.k, w: size.w / view.k, h: size.h / view.k };
  const b = bounds(nodes);
  const x1 = Math.min(vp.x, b?.x ?? vp.x), y1 = Math.min(vp.y, b?.y ?? vp.y);
  const x2 = Math.max(vp.x + vp.w, b ? b.x + b.w : vp.x + vp.w), y2 = Math.max(vp.y + vp.h, b ? b.y + b.h : vp.y + vp.h);
  const pad = 40, ww = x2 - x1 + pad * 2, hh = y2 - y1 + pad * 2;
  const s = Math.min(W / ww, H / hh);
  const ox = (W - ww * s) / 2 - (x1 - pad) * s, oy = (H - hh * s) / 2 - (y1 - pad) * s;
  return (
    <svg
      className="cv-mini"
      width={W}
      height={H}
      onPointerDown={(e) => {
        const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        onJump((e.clientX - r.left - ox) / s, (e.clientY - r.top - oy) / s);
      }}
      aria-label="Peta mini"
    >
      {nodes.map((n) => <rect key={n.id} x={n.x * s + ox} y={n.y * s + oy} width={Math.max(2, n.width * s)} height={Math.max(2, n.height * s)} rx={2} className={'mini-node ' + n.type} style={n.color && /^[1-6]$/.test(n.color) ? { fill: `var(--c-${n.color}-deep, var(--c-${n.color}))` } : undefined} />)}
      <rect x={vp.x * s + ox} y={vp.y * s + oy} width={vp.w * s} height={vp.h * s} className="mini-view" rx={3} />
    </svg>
  );
}
