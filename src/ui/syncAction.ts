import { useApp } from '../store.ts';
import { syncNow, useSyncStore } from '../sync/state.ts';

/** Dipakai palet perintah & Pengaturan: sinkron sekali, lalu beri tahu hasilnya. */
export async function runSyncAction() {
  const { vault, toast } = useApp.getState();
  if (!vault) return;
  const st = useSyncStore.getState();
  if (st.status === 'off' || st.status === 'signedOut') return toast('Sinkron belum diatur. Buka Pengaturan → Sinkron.', 'info');
  if (!vault.config.syncId) return toast('Sinkron belum diaktifkan untuk vault ini.', 'info');
  const r = await syncNow(vault);
  if (!r) return toast(useSyncStore.getState().error ?? 'Sinkron tidak berjalan', 'error');
  if (r.errors.length) return toast(`${r.errors.length} berkas gagal: ${r.errors[0].message}`, 'error');
  if (r.conflicts.length) return toast(`${r.conflicts.length} konflik — salinan lokal disimpan sebagai berkas "(konflik …)".`, 'info');
  toast(r.pushed + r.pulled + r.deleted === 0 ? 'Sudah mutakhir' : `Terkirim ${r.pushed}, diterima ${r.pulled}, dihapus ${r.deleted}`, 'ok');
}
