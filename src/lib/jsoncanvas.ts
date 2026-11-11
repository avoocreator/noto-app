/** Format JSON Canvas 1.0 (https://jsoncanvas.org) — kompatibel dengan Obsidian. */
import { randomId } from './hash.ts';

export type Side = 'top' | 'right' | 'bottom' | 'left';

interface NodeBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string; // "1".."6" atau hex
}
export interface TextNode extends NodeBase { type: 'text'; text: string }
export interface FileNode extends NodeBase { type: 'file'; file: string; subpath?: string }
export interface LinkNode extends NodeBase { type: 'link'; url: string }
export interface GroupNode extends NodeBase { type: 'group'; label?: string; background?: string; backgroundStyle?: string }
export type CanvasNode = TextNode | FileNode | LinkNode | GroupNode;

export interface CanvasEdge {
  id: string;
  fromNode: string;
  fromSide?: Side;
  fromEnd?: 'none' | 'arrow';
  toNode: string;
  toSide?: Side;
  toEnd?: 'none' | 'arrow';
  color?: string;
  label?: string;
}

export interface CanvasData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export const emptyCanvas = (): CanvasData => ({ nodes: [], edges: [] });

export function parseCanvas(src: string): CanvasData {
  try {
    const j = JSON.parse(src || '{}') as Partial<CanvasData>;
    const nodes = Array.isArray(j.nodes) ? j.nodes.filter((n) => n && typeof n.id === 'string' && typeof n.x === 'number') : [];
    const ids = new Set(nodes.map((n) => n.id));
    const edges = Array.isArray(j.edges) ? j.edges.filter((e) => e && ids.has(e.fromNode) && ids.has(e.toNode)) : [];
    return {
      nodes: nodes.map((n) => ({ ...n, width: n.width || 240, height: n.height || 120 })) as CanvasNode[],
      edges: edges as CanvasEdge[],
    };
  } catch {
    return emptyCanvas();
  }
}

export function serializeCanvas(c: CanvasData): string {
  // Obsidian memakai indent tab; kita ikuti agar diff rapi.
  return JSON.stringify(c, null, '\t') + '\n';
}

export const newId = () => randomId(8);

export function newTextNode(x: number, y: number, text = ''): TextNode {
  return { id: newId(), type: 'text', x, y, width: 260, height: 140, text };
}
export function newFileNode(x: number, y: number, file: string): FileNode {
  return { id: newId(), type: 'file', x, y, width: 300, height: 220, file };
}
export function newLinkNode(x: number, y: number, url: string): LinkNode {
  return { id: newId(), type: 'link', x, y, width: 300, height: 120, url };
}
export function newGroupNode(x: number, y: number, label = 'Grup'): GroupNode {
  return { id: newId(), type: 'group', x, y, width: 520, height: 360, label };
}

export function anchor(n: CanvasNode, side: Side): { x: number; y: number } {
  switch (side) {
    case 'top': return { x: n.x + n.width / 2, y: n.y };
    case 'bottom': return { x: n.x + n.width / 2, y: n.y + n.height };
    case 'left': return { x: n.x, y: n.y + n.height / 2 };
    default: return { x: n.x + n.width, y: n.y + n.height / 2 };
  }
}

/** Pilih sisi terdekat antara dua node. */
export function bestSides(a: CanvasNode, b: CanvasNode): [Side, Side] {
  const dx = b.x + b.width / 2 - (a.x + a.width / 2);
  const dy = b.y + b.height / 2 - (a.y + a.height / 2);
  if (Math.abs(dx) * a.height > Math.abs(dy) * a.width) return dx >= 0 ? ['right', 'left'] : ['left', 'right'];
  return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom'];
}

const OUT: Record<Side, [number, number]> = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };

export function edgePath(a: { x: number; y: number }, sa: Side, b: { x: number; y: number }, sb: Side): { d: string; mid: { x: number; y: number } } {
  const dist = Math.max(40, Math.hypot(b.x - a.x, b.y - a.y) * 0.35);
  const c1 = { x: a.x + OUT[sa][0] * dist, y: a.y + OUT[sa][1] * dist };
  const c2 = { x: b.x + OUT[sb][0] * dist, y: b.y + OUT[sb][1] * dist };
  const mid = {
    x: 0.125 * a.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * b.x,
    y: 0.125 * a.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * b.y,
  };
  return { d: `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`, mid };
}

/** Warna preset JSON Canvas → variabel CSS tema. */
export function canvasColorVar(c?: string): string | undefined {
  if (!c) return undefined;
  if (/^[1-6]$/.test(c)) return `var(--c-${c})`;
  return c;
}

export function bounds(nodes: CanvasNode[]): { x: number; y: number; w: number; h: number } | null {
  if (nodes.length === 0) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const n of nodes) {
    x1 = Math.min(x1, n.x);
    y1 = Math.min(y1, n.y);
    x2 = Math.max(x2, n.x + n.width);
    y2 = Math.max(y2, n.y + n.height);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
