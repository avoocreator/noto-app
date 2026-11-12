/* Nada pengingat: 6 bawaan disintesis dengan WebAudio (tanpa berkas), plus nada .mp3 impor milik pengguna (disimpan di IndexedDB). */

export interface SoundDef { id: string; label: string; hint: string }

export const BUILTIN_SOUNDS: SoundDef[] = [
  { id: 'bell', label: 'Lonceng', hint: 'Hangat, dua dentang' },
  { id: 'chime', label: 'Kristal', hint: 'Tiga nada naik' },
  { id: 'digital', label: 'Digital', hint: 'Bip jam tangan' },
  { id: 'alarm', label: 'Alarm klasik', hint: 'Tegas, bergantian' },
  { id: 'ring', label: 'Dering', hint: 'Seperti telepon lama' },
  { id: 'soft', label: 'Lembut', hint: 'Marimba pelan' },
];

type Synth = (ctx: AudioContext, out: AudioNode, t: number) => number; // mengembalikan durasi satu putaran (detik)

function tone(ctx: AudioContext, out: AudioNode, type: OscillatorType, freq: number, t: number, dur: number, peak = 0.5, attack = 0.005) {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
}

const SYNTH: Record<string, Synth> = {
  bell(ctx, out, t) {
    for (const [i, f] of [[0, 659], [0.55, 523]] as const) {
      [[1, 0.5], [2.76, 0.22], [5.4, 0.1]].forEach(([m, a]) => tone(ctx, out, 'sine', f * m, t + i, 1.6, a));
    }
    return 2.3;
  },
  chime(ctx, out, t) {
    [880, 1109, 1319].forEach((f, i) => { tone(ctx, out, 'triangle', f, t + i * 0.16, 0.9, 0.4); tone(ctx, out, 'sine', f * 2, t + i * 0.16, 0.5, 0.12); });
    return 1.5;
  },
  digital(ctx, out, t) {
    for (let k = 0; k < 2; k++) for (let i = 0; i < 3; i++) tone(ctx, out, 'square', 1480, t + k * 0.6 + i * 0.12, 0.07, 0.18, 0.002);
    return 1.3;
  },
  alarm(ctx, out, t) {
    for (let i = 0; i < 6; i++) tone(ctx, out, 'sawtooth', i % 2 ? 660 : 880, t + i * 0.18, 0.17, 0.22, 0.004);
    return 1.5;
  },
  ring(ctx, out, t) {
    for (let k = 0; k < 2; k++) {
      const s = t + k * 0.65;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.35, s + 0.02); g.gain.setValueAtTime(0.35, s + 0.4); g.gain.linearRampToValueAtTime(0, s + 0.43);
      const lfo = ctx.createOscillator(); const depth = ctx.createGain(); lfo.frequency.value = 22; depth.gain.value = 0.25;
      const am = ctx.createGain(); am.gain.value = 0.75; lfo.connect(depth); depth.connect(am.gain);
      for (const f of [440, 480]) { const o = ctx.createOscillator(); o.frequency.value = f; o.connect(am); o.start(s); o.stop(s + 0.45); }
      am.connect(g); g.connect(out); lfo.start(s); lfo.stop(s + 0.45);
    }
    return 2.2;
  },
  soft(ctx, out, t) {
    [[392, 0], [523, 0.22], [659, 0.44]].forEach(([f, d]) => { tone(ctx, out, 'sine', f, t + d, 0.7, 0.45, 0.003); tone(ctx, out, 'sine', f * 4, t + d, 0.12, 0.1, 0.002); });
    return 1.5;
  },
};

/* ── konteks audio ─────────────────────────────────────────────────────────────────────── */
let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  ctx = new C();
  return ctx;
}

/** Browser memblokir suara sebelum ada interaksi; pasang sekali agar alarm bisa berbunyi kemudian. */
export function installAudioUnlock() {
  const unlock = () => { void getCtx()?.resume(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
}

/* ── nada impor (.mp3 dll.) di IndexedDB ───────────────────────────────────────────────── */
export interface CustomSound { id: string; name: string; size: number }
interface Rec extends CustomSound { blob: Blob }
const DB = 'noto-sounds';
const MAX_BYTES = 8 * 1024 * 1024;

function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('sounds', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => { const r = f(d.transaction('sounds', mode).objectStore('sounds')); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}

export async function listCustomSounds(): Promise<CustomSound[]> {
  try { return (await tx<Rec[]>('readonly', (s) => s.getAll())).map(({ id, name, size }) => ({ id, name, size })); } catch { return []; }
}
export async function addCustomSound(file: File): Promise<CustomSound> {
  const okType = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name);
  if (!okType) throw new Error('Berkas bukan audio. Pilih .mp3, .wav, .ogg, atau .m4a.');
  if (file.size > MAX_BYTES) throw new Error('Berkas terlalu besar (maks 8 MB).');
  const rec: Rec = { id: Math.random().toString(36).slice(2, 10), name: file.name.replace(/\.[^.]+$/, ''), size: file.size, blob: file };
  await tx('readwrite', (s) => s.put(rec));
  return { id: rec.id, name: rec.name, size: rec.size };
}
export async function removeCustomSound(id: string): Promise<void> { await tx('readwrite', (s) => s.delete(id)); }
async function customBlob(id: string): Promise<Blob | null> {
  try { return (await tx<Rec | undefined>('readonly', (s) => s.get(id)))?.blob ?? null; } catch { return null; }
}

/* ── pemutar ───────────────────────────────────────────────────────────────────────────── */
export interface PlayOpts { sound: string; volume: number; loop?: boolean; maxSeconds?: number }

/** Putar nada. Mengembalikan fungsi stop(). Bila loop, berulang sampai stop() atau maxSeconds. */
export async function playSound(o: PlayOpts): Promise<() => void> {
  const volume = Math.min(1, Math.max(0, o.volume));
  let stopped = false;
  const cleanups: (() => void)[] = [];
  let limit: number | undefined;
  const stop = () => { if (stopped) return; stopped = true; if (limit) window.clearTimeout(limit); cleanups.forEach((f) => f()); };
  if (o.loop && o.maxSeconds) limit = window.setTimeout(stop, o.maxSeconds * 1000);

  if (o.sound.startsWith('custom:')) {
    const blob = await customBlob(o.sound.slice(7));
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      a.loop = !!o.loop; a.volume = volume;
      cleanups.push(() => { a.pause(); URL.revokeObjectURL(url); });
      a.addEventListener('ended', () => { if (!o.loop) stop(); });
      try { await a.play(); return stop; } catch { stop(); return () => undefined; }
    }
    return playSound({ ...o, sound: 'bell' }); // berkas impor hilang → nada bawaan
  }

  const c = getCtx();
  if (!c) return () => undefined;
  try { await c.resume(); } catch { /* butuh interaksi */ }
  const synth = SYNTH[o.sound] ?? SYNTH.bell;
  const master = c.createGain(); master.gain.value = volume; master.connect(c.destination);
  cleanups.push(() => { try { master.gain.cancelScheduledValues(0); master.gain.value = 0; master.disconnect(); } catch { /* sudah putus */ } });
  const cycle = () => {
    if (stopped) return;
    const len = synth(c, master, c.currentTime + 0.03);
    if (o.loop) { const tm = window.setTimeout(cycle, (len + 0.5) * 1000); cleanups.push(() => window.clearTimeout(tm)); }
    else { const tm = window.setTimeout(stop, (len + 0.2) * 1000); cleanups.push(() => window.clearTimeout(tm)); }
  };
  cycle();
  return stop;
}

export const soundLabel = (id: string, custom: CustomSound[]) =>
  id.startsWith('custom:') ? (custom.find((c) => c.id === id.slice(7))?.name ?? 'Nada impor') : (BUILTIN_SOUNDS.find((s) => s.id === id)?.label ?? 'Lonceng');
