import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildTokens, auditContrast, PRESETS, DEFAULT_THEME, type ThemeSettings } from '../src/theme/palettes.ts';
import { hexToRgb, rgbToOklch, oklchHex } from '../src/theme/color.ts';
import { makeZip, crc32 } from '../src/lib/zip.ts';

test('warna: roundtrip hex ↔ oklch', () => {
  for (const hex of ['#f3d458', '#f5b7d8', '#111111', '#a9b879']) {
    const { L, C, h } = rgbToOklch(hexToRgb(hex)!);
    const back = hexToRgb(oklchHex(L, C, h))!;
    const orig = hexToRgb(hex)!;
    orig.forEach((v, i) => assert.ok(Math.abs(v - back[i]) <= 1, `${hex} kanal ${i}`));
  }
});

test('tema: kontras memenuhi batas untuk semua preset, mode, intensitas', () => {
  const settings: ThemeSettings[] = [
    ...PRESETS.map((p) => ({ ...DEFAULT_THEME, presetId: p.id })),
    { ...DEFAULT_THEME, presetId: 'custom', customHex: '#1fa37a', harmony: 'triad' },
    { ...DEFAULT_THEME, presetId: 'custom', customHex: '#ffcc00', harmony: 'complement', intensity: 1.4 },
    { ...DEFAULT_THEME, presetId: 'custom', customHex: '#3355ff', harmony: 'split', intensity: 0.4 },
  ];
  for (const s of settings) {
    for (const mode of ['light', 'dark'] as const) {
      const tokens = buildTokens(s, mode);
      for (const row of auditContrast(tokens)) {
        assert.ok(row.ratio >= row.min - 0.01, `${s.presetId}/${mode} ${row.name}: ${row.ratio.toFixed(2)} < ${row.min}`);
      }
      assert.match(tokens['--tint-1'], /^#[0-9a-f]{6}$/);
    }
  }
});

test('zip: valid menurut unzip/python', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const zip = makeZip([
    { path: 'Halo.md', data: new TextEncoder().encode('# Halo\n') },
    { path: 'Proyek/Ünïcode.md', data: new TextEncoder().encode('isi 🍊') },
    { path: 'kosong.md', data: new Uint8Array(0) },
  ]);
  const dir = mkdtempSync(join(tmpdir(), 'zip-'));
  const f = join(dir, 't.zip');
  writeFileSync(f, zip);
  const out = execFileSync('python3', ['-c', `
import zipfile,sys
z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None
print(sorted(z.namelist())); print(z.read('Halo.md').decode())
`, f]).toString();
  assert.match(out, /Halo\.md/);
  assert.match(out, /Ünïcode\.md/);
  assert.match(out, /# Halo/);
});
