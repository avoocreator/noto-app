import { useState } from 'react';
import { motion } from 'motion/react';
import { Icon } from '../ui/Icon.tsx';
import { useApp } from '../store.ts';
import { capabilities, createLocalVault, forgetVault, listVaults, openFolderVault, openRecord, type VaultRecord } from '../vault/manager.ts';
import { errMsg } from '../actions.ts';

export function Welcome({ pending }: { pending?: VaultRecord | null }) {
  const setVault = useApp((s) => s.setVault);
  const toast = useApp((s) => s.toast);
  const [busy, setBusy] = useState<string | null>(null);
  const caps = capabilities();
  const saved = listVaults();

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(null); }
  };

  const card = (key: string, icon: 'folderOpen' | 'sparkle' | 'cloud', title: string, text: string, onClick: () => Promise<void>, tint: number) => (
    <motion.button
      key={key}
      className={'welcome-card tint-' + tint}
      whileHover={{ y: -4, rotate: tint % 2 ? -0.6 : 0.6 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 24 }}
      disabled={busy !== null}
      onClick={() => void run(key, onClick)}
    >
      <span className="wc-icon"><Icon name={icon} size={22} /></span>
      <b>{title}</b>
      <small>{text}</small>
      {busy === key && <span className="wc-busy">Membuka…</span>}
    </motion.button>
  );

  return (
    <div className="welcome">
      <motion.div className="welcome-inner" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}>
        <img src="./favicon.svg" alt="" width={64} height={64} className="welcome-logo" />
        <h1>Selamat datang di <span className="grad">noto</span></h1>
        <p className="muted lead">Catatan dan canvas dalam satu vault — berkas Markdown biasa yang tetap milikmu.</p>

        {pending && (
          <motion.div className="resume" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div>
              <b>Lanjutkan “{pending.label}”?</b>
              <small>Browser meminta izin ulang untuk membuka folder ini.</small>
            </div>
            <button
              className="btn ink"
              onClick={() => void run('resume', async () => {
                const v = await openRecord(pending, true);
                if (v) setVault(v, pending);
                else toast('Izin ditolak', 'error');
              })}
            >
              Beri izin & buka
            </button>
          </motion.div>
        )}

        <div className="welcome-cards">
          {caps.folder && card('folder', 'folderOpen', 'Buka folder', caps.tauri ? 'Pilih folder di komputermu. Vault Obsidian pun bisa.' : 'Pilih folder di perangkat. Vault Obsidian pun bisa.', async () => {
            const r = await openFolderVault();
            if (r) setVault(r.vault, r.rec);
          }, 1)}
          {card('local', 'sparkle', caps.native ? 'Vault di aplikasi' : 'Vault di browser', caps.native ? 'Tersimpan di penyimpanan aplikasi. Aktifkan sinkron untuk membawanya ke PC.' : 'Mulai cepat tanpa memilih folder. Bisa diekspor kapan saja.', async () => {
            const r = await createLocalVault('Vault saya');
            setVault(r.vault, r.rec);
          }, caps.folder ? 2 : 1)}
        </div>

        {!caps.folder && !caps.native && (
          <p className="muted small note-line">
            Browser ini tidak bisa membuka folder asli. Pakai Chrome/Edge atau aplikasi desktop untuk itu — atau mulai dengan vault di browser.
          </p>
        )}

        {saved.length > 0 && (
          <div className="saved">
            <h4>Vault tersimpan</h4>
            {saved.map((r) => (
              <div className="saved-row" key={r.id}>
                <button className="saved-open" onClick={() => void run(r.id, async () => {
                  const v = await openRecord(r, true);
                  if (v) setVault(v, r);
                  else toast('Tidak bisa membuka vault ini', 'error');
                })}>
                  <Icon name="folder" size={16} /> {r.label}
                </button>
                <button className="icon-btn tiny" aria-label="Lupakan" onClick={() => { void forgetVault(r); location.reload(); }}><Icon name="x" size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
