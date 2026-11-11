/**
 * Perencana sinkronisasi per file (three-way: local / remote / base).
 * base = keadaan terakhir yang sudah sama di kedua sisi.
 */
export type HashMap = Record<string, string>;

export type SyncAction =
  | { type: 'push'; path: string }
  | { type: 'pull'; path: string }
  | { type: 'deleteLocal'; path: string }
  | { type: 'deleteRemote'; path: string }
  /** dua sisi berubah berbeda: simpan salinan lokal sebagai file konflik, lalu tarik versi remote */
  | { type: 'conflict'; path: string }
  /** isi sama di dua sisi; cukup perbarui base (hash undefined = hapus dari base) */
  | { type: 'adopt'; path: string; hash?: string };

export function planSync(local: HashMap, remote: HashMap, base: HashMap): SyncAction[] {
  const paths = new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(base)]);
  const actions: SyncAction[] = [];
  for (const path of [...paths].sort()) {
    const L = local[path];
    const R = remote[path];
    const B = base[path];
    if (L === R) {
      if (L !== B) actions.push({ type: 'adopt', path, hash: L });
      continue;
    }
    const localChanged = L !== B;
    const remoteChanged = R !== B;
    if (!localChanged && remoteChanged) {
      actions.push(R === undefined ? { type: 'deleteLocal', path } : { type: 'pull', path });
    } else if (localChanged && !remoteChanged) {
      actions.push(L === undefined ? { type: 'deleteRemote', path } : { type: 'push', path });
    } else if (localChanged && remoteChanged) {
      if (L === undefined) actions.push({ type: 'pull', path }); // dihapus lokal, diedit remote → versi remote menang
      else if (R === undefined) actions.push({ type: 'push', path }); // dihapus remote, diedit lokal → edit lokal menang
      else actions.push({ type: 'conflict', path });
    }
  }
  return actions;
}

export function conflictPath(path: string, device: string, now = new Date()): string {
  const m = /^(.*?)(\.[A-Za-z0-9]+)?$/.exec(path)!;
  const stamp = now.toISOString().slice(0, 16).replace('T', ' ').replace(':', '.');
  return `${m[1]} (konflik ${device} ${stamp})${m[2] ?? ''}`;
}
