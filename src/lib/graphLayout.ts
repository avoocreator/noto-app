export interface GNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  fixed?: boolean;
}
export interface GEdge {
  a: number;
  b: number;
}

/** Posisi awal melingkar yang deterministik (hasil sama setiap dibuka). */
export function seedNodes(ids: string[], radius = 260): GNode[] {
  return ids.map((id, i) => {
    let h = 2166136261;
    for (let k = 0; k < id.length; k++) h = Math.imul(h ^ id.charCodeAt(k), 16777619);
    const a = (i / Math.max(1, ids.length)) * Math.PI * 2 + ((h >>> 0) % 100) / 400;
    const rr = radius * (0.35 + (((h >>> 8) % 100) / 100) * 0.65);
    return { id, x: Math.cos(a) * rr, y: Math.sin(a) * rr, vx: 0, vy: 0, r: 5 };
  });
}

/** Satu langkah simulasi gaya (tolak antar-node, pegas di edge, tarik ke pusat). Mengembalikan energi. */
export function stepForce(nodes: GNode[], edges: GEdge[], alpha = 1): number {
  const n = nodes.length;
  const REPULSE = 2600;
  const SPRING = 0.02;
  const REST = 90;
  const CENTER = 0.0035;
  for (let i = 0; i < n; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < n; j++) {
      const b = nodes[j];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 0.01) { dx = (i - j) * 0.1; dy = 0.1; d2 = dx * dx + dy * dy; }
      if (d2 > 160000) continue;
      const f = (REPULSE / d2) * alpha;
      const d = Math.sqrt(d2);
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }
  }
  for (const e of edges) {
    const a = nodes[e.a];
    const b = nodes[e.b];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const f = (d - REST) * SPRING * alpha;
    const fx = (dx / d) * f;
    const fy = (dy / d) * f;
    a.vx += fx; a.vy += fy;
    b.vx -= fx; b.vy -= fy;
  }
  let energy = 0;
  for (const a of nodes) {
    a.vx -= a.x * CENTER * alpha;
    a.vy -= a.y * CENTER * alpha;
    a.vx *= 0.82;
    a.vy *= 0.82;
    if (!a.fixed) {
      a.x += a.vx;
      a.y += a.vy;
    }
    energy += a.vx * a.vx + a.vy * a.vy;
  }
  return energy;
}
