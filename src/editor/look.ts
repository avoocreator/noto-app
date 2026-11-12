import { create } from 'zustand';

/** Tampilan menulis ala Word: ukuran huruf, jarak antar baris, jarak antar paragraf. Tersimpan di perangkat ini. */
export type FontSize = 'sm' | 'md' | 'lg' | 'xl';
export type LineGap = 'tight' | 'normal' | 'loose' | 'double';
export type ParaGap = 'none' | 'small' | 'medium' | 'large';

export const FONT_SIZES: { id: FontSize; label: string; v: string }[] = [
  { id: 'sm', label: 'Kecil', v: '.92rem' }, { id: 'md', label: 'Normal', v: '1.04rem' }, { id: 'lg', label: 'Besar', v: '1.2rem' }, { id: 'xl', label: 'Sangat besar', v: '1.4rem' },
];
export const LINE_GAPS: { id: LineGap; label: string; v: string }[] = [
  { id: 'tight', label: 'Rapat (1.4)', v: '1.4' }, { id: 'normal', label: 'Normal (1.75)', v: '1.75' }, { id: 'loose', label: 'Longgar (2.0)', v: '2' }, { id: 'double', label: 'Ganda (2.4)', v: '2.4' },
];
export const PARA_GAPS: { id: ParaGap; label: string; v: string }[] = [
  { id: 'none', label: 'Tanpa jarak', v: '0' }, { id: 'small', label: 'Kecil', v: '.35em' }, { id: 'medium', label: 'Sedang', v: '.7em' }, { id: 'large', label: 'Besar', v: '1.1em' },
];

interface Look { fontSize: FontSize; lineGap: LineGap; paraGap: ParaGap; ribbon: boolean; set: (p: Partial<Omit<Look, 'set'>>) => void }
const KEY = 'noto-editor-look';
const load = (): Omit<Look, 'set'> => {
  const d = { fontSize: 'md' as FontSize, lineGap: 'normal' as LineGap, paraGap: 'none' as ParaGap, ribbon: true };
  try { return { ...d, ...(JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<typeof d>) }; } catch { return d; }
};

export const useLook = create<Look>((set, get) => ({
  ...load(),
  set: (p) => {
    set(p);
    const { fontSize, lineGap, paraGap, ribbon } = get();
    try { localStorage.setItem(KEY, JSON.stringify({ fontSize, lineGap, paraGap, ribbon })); } catch { /* abaikan */ }
  },
}));

export function lookStyle(l: Pick<Look, 'fontSize' | 'lineGap' | 'paraGap'>): React.CSSProperties {
  return {
    ['--note-fs' as string]: FONT_SIZES.find((x) => x.id === l.fontSize)!.v,
    ['--note-lh' as string]: LINE_GAPS.find((x) => x.id === l.lineGap)!.v,
    ['--note-pg' as string]: PARA_GAPS.find((x) => x.id === l.paraGap)!.v,
  };
}
