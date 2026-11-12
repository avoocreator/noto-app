import { execFileSync } from 'node:child_process';

/** Jalankan Python lintas-OS (python3 di Linux/macOS, python/py di Windows). Mengembalikan null bila tak ada. */
export function runPython(args: string[]): string | null {
  const cands = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python'];
  for (const c of cands) {
    try { return execFileSync(c, args, { stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch { /* coba berikutnya */ }
  }
  return null;
}
