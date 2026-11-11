import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Icon, type IconName } from '../ui/Icon.tsx';
import { useApp, useVault } from '../store.ts';
import { useTheme } from '../theme/useTheme.ts';
import { auditContrast, buildTokens, HARMONY_OFFSETS, PRESETS, type Density, type Harmony, type ModePref, type RadiusPref, type ThemeSettings } from '../theme/palettes.ts';
import { systemMode } from '../theme/useTheme.ts';
import { downloadBlob, errMsg } from '../actions.ts';
import { confirmBox } from '../ui/dialogs.tsx';
import { ensureNotifyPermission, loadReminderPrefs, notifyNow, openWidgetWindow, saveReminderPrefs, summaryFor } from '../native/bridge.ts';
import { confirmOtp, disableSync, enableSync, refreshAuth, remoteVaults, requestOtp, signOut, useSyncStore } from '../sync/state.ts';
import { runSyncAction } from '../ui/syncAction.ts';
import { relativeTime } from '../lib/dates.ts';
import type { RemoteVault } from '../sync/supabase.ts';
import type { TrashRecord } from '../vault/vault.ts';
import { basename, stripExt } from '../lib/analyze.ts';
import { capabilities } from '../vault/manager.ts';

type Tab = 'look' | 'vault' | 'sync' | 'widget' | 'about';
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'look', label: 'Tampilan', icon: 'sparkle' },
  { id: 'vault', label: 'Vault & data', icon: 'folder' },
  { id: 'sync', label: 'Sinkron', icon: 'cloud' },
  { id: 'widget', label: 'Widget & pengingat', icon: 'sticky' },
  { id: 'about', label: 'Tentang', icon: 'command' },
];

export function Settings() {
  const [tab, setTab] = useState<Tab>('look');
  return (
    <div className="settings">
      <header className="page-head"><div><h1>Pengaturan</h1><p className="muted">Semua tersimpan di perangkat ini. Pengaturan vault ikut tersimpan di folder <code>.noto</code>.</p></div></header>
      <div className="settings-grid">
        <nav className="settings-nav" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {tab === t.id && <motion.span layoutId="set-pill" className="set-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <Icon name={t.icon} size={16} /> <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <motion.div key={tab} className="settings-body" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
          {tab === 'look' && <Look />}
          {tab === 'vault' && <VaultTab />}
          {tab === 'sync' && <SyncTab />}
          {tab === 'widget' && <WidgetTab />}
          {tab === 'about' && <About />}
        </motion.div>
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="set-row"><div><b>{label}</b>{hint && <small>{hint}</small>}</div><div className="set-ctl">{children}</div></div>;
}
function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string; icon?: IconName }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>
          {value === o.id && <motion.span layoutId={'seg-' + label} className="seg-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          {o.icon && <Icon name={o.icon} size={14} />}<span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={'switch' + (on ? ' on' : '')} onClick={() => onChange(!on)}><motion.i layout transition={{ type: 'spring', stiffness: 600, damping: 32 }} /></button>;
}

/* ── Tampilan ────────────────────────────────────────────────────────────────────────── */
function Look() {
  const t = useTheme();
  const mode = t.mode === 'system' ? systemMode() : t.mode;
  const settings: ThemeSettings = t;
  const swatch = (id: string) => {
    const tk = buildTokens({ ...settings, presetId: id }, mode);
    return [tk['--tint-1'], tk['--tint-2'], tk['--tint-3'], tk['--tint-4'], tk['--accent']];
  };
  const audit = useMemo(() => auditContrast(buildTokens(settings, mode)), [t.presetId, t.customHex, t.harmony, t.intensity, mode]);
  const bad = audit.filter((a) => a.ratio < a.min - 0.01);

  return (
    <div className="stack-l">
      <section className="panel">
        <h3>Mode</h3>
        <Seg label="Mode" value={t.mode} onChange={(v: ModePref) => t.patch({ mode: v })} options={[
          { id: 'light', label: 'Terang', icon: 'sun' }, { id: 'dark', label: 'Gelap', icon: 'moon' }, { id: 'system', label: 'Ikut sistem', icon: 'monitor' },
        ]} />
      </section>

      <section className="panel">
        <h3>Palet warna</h3>
        <div className="palette-grid" role="radiogroup" aria-label="Palet">
          {PRESETS.map((p) => (
            <motion.button key={p.id} role="radio" aria-checked={t.presetId === p.id} className={'pal-card' + (t.presetId === p.id ? ' on' : '')} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }} onClick={() => t.patch({ presetId: p.id })}>
              <span className="pal-sw">{swatch(p.id).map((c, i) => <i key={i} style={{ background: c }} />)}</span>
              <b>{p.name}</b>
              {t.presetId === p.id && <span className="pal-check"><Icon name="check" size={13} strokeWidth={2.8} /></span>}
            </motion.button>
          ))}
          <motion.button role="radio" aria-checked={t.presetId === 'custom'} className={'pal-card' + (t.presetId === 'custom' ? ' on' : '')} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }} onClick={() => t.patch({ presetId: 'custom' })}>
            <span className="pal-sw">{swatch('custom').map((c, i) => <i key={i} style={{ background: c }} />)}</span>
            <b>Kustom</b>
            {t.presetId === 'custom' && <span className="pal-check"><Icon name="check" size={13} strokeWidth={2.8} /></span>}
          </motion.button>
        </div>

        {t.presetId === 'custom' && (
          <motion.div className="custom-box" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
            <Row label="Warna aksen" hint="Warna kartu diturunkan otomatis dari sini">
              <input type="color" value={t.customHex} onChange={(e) => t.patch({ customHex: e.target.value })} aria-label="Warna aksen" />
              <input className="hex" value={t.customHex} onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && t.patch({ customHex: e.target.value })} aria-label="Kode hex" maxLength={7} />
            </Row>
            <Row label="Harmoni" hint="Cara memilih warna kartu lainnya">
              <Seg label="Harmoni" value={t.harmony} onChange={(v: Harmony) => t.patch({ harmony: v })} options={(Object.keys(HARMONY_OFFSETS) as Harmony[]).map((h) => ({ id: h, label: { analogous: 'Serumpun', triad: 'Segitiga', complement: 'Berlawanan', split: 'Terbelah' }[h] }))} />
            </Row>
          </motion.div>
        )}

        <Row label="Kepekatan warna" hint={`${Math.round(t.intensity * 100)}% — lebih rendah = lebih pudar`}>
          <input type="range" min={0.4} max={1.4} step={0.05} value={t.intensity} onChange={(e) => t.patch({ intensity: Number(e.target.value) })} aria-label="Kepekatan" />
        </Row>
      </section>

      <section className="panel">
        <h3>Bentuk & rasa</h3>
        <Row label="Sudut"><Seg label="Sudut" value={t.radius} onChange={(v: RadiusPref) => t.patch({ radius: v })} options={[{ id: 'sharp', label: 'Tajam' }, { id: 'soft', label: 'Lembut' }, { id: 'round', label: 'Bulat' }]} /></Row>
        <Row label="Kepadatan"><Seg label="Kepadatan" value={t.density} onChange={(v: Density) => t.patch({ density: v })} options={[{ id: 'comfortable', label: 'Lega' }, { id: 'compact', label: 'Ringkas' }]} /></Row>
        <Row label="Font isi catatan"><Seg label="Font" value={t.fontBody} onChange={(v) => t.patch({ fontBody: v })} options={[{ id: 'sans', label: 'Sans' }, { id: 'serif', label: 'Serif' }, { id: 'mono', label: 'Mono' }]} /></Row>
        <Row label="Bentuk dekoratif" hint="Plus, bintang, dan segitiga di pojok kartu"><Toggle label="Bentuk dekoratif" on={t.decor} onChange={(v) => t.patch({ decor: v })} /></Row>
        <Row label="Kurangi animasi" hint="Otomatis aktif bila sistemmu memintanya"><Toggle label="Kurangi animasi" on={t.reduceMotion} onChange={(v) => t.patch({ reduceMotion: v })} /></Row>
      </section>

      <section className="panel">
        <h3>Keterbacaan <span className={'badge ' + (bad.length ? 'warn' : 'ok')}>{bad.length ? `${bad.length} perlu perhatian` : 'semua lolos'}</span></h3>
        <p className="muted small">Teks di atas kartu berwarna dihitung otomatis agar kontrasnya cukup (WCAG), apa pun palet yang kamu pilih.</p>
        <ul className="audit">
          {audit.map((a) => <li key={a.name} className={a.ratio >= a.min - 0.01 ? 'ok' : 'bad'}><span>{a.name}</span><b>{a.ratio.toFixed(1)}:1</b><i>min {a.min}</i></li>)}
        </ul>
        <button className="btn ghost" onClick={t.reset}><Icon name="refresh" size={15} /> Kembalikan ke bawaan</button>
      </section>
    </div>
  );
}

/* ── Vault & data ────────────────────────────────────────────────────────────────────── */
function VaultTab() {
  const vault = useVault();
  const { toast, record } = useApp();
  const file = useRef<HTMLInputElement>(null);
  const [trash, setTrash] = useState<TrashRecord[]>([]);
  const caps = capabilities();

  const reloadTrash = () => { if (vault) void vault.listTrash().then(setTrash); };
  useEffect(reloadTrash, [vault, vault?.version]);
  if (!vault) return null;
  const cfg = vault.config;
  const field = (key: 'dailyFolder' | 'templateFolder' | 'attachmentFolder', label: string, hint: string) => (
    <Row label={label} hint={hint}>
      <input defaultValue={cfg[key]} onBlur={(e) => { const v = e.target.value.trim().replace(/^\/+|\/+$/g, ''); if (v && v !== cfg[key]) void vault.setConfig({ [key]: v }); }} aria-label={label} />
    </Row>
  );

  return (
    <div className="stack-l">
      <section className="panel">
        <h3>Vault aktif</h3>
        <dl className="kv">
          <dt>Nama</dt><dd>{vault.fs.label}</dd>
          <dt>Lokasi</dt><dd>{record?.kind === 'tauri' ? record.path : record?.kind === 'web' ? 'Folder di perangkat (izin browser)' : record?.kind === 'capacitor' ? 'Penyimpanan privat aplikasi' : 'Penyimpanan browser (IndexedDB)'}</dd>
          <dt>Isi</dt><dd>{vault.notes.length} catatan · {vault.files.filter((f) => f.path.endsWith('.canvas')).length} canvas · {vault.files.length} berkas</dd>
        </dl>
        {record?.kind === 'idb' && <p className="callout warn">Vault ini hidup di browser dan bisa hilang jika data situs dihapus. Ekspor ZIP berkala, atau aktifkan Sinkron.{caps.folder ? ' Atau pakai “Buka folder” di menu vault agar tersimpan sebagai file asli.' : ''}</p>}
        {record?.kind === 'capacitor' && <p className="callout">Vault tersimpan di folder privat aplikasi (tidak terlihat aplikasi lain). Gunakan Sinkron atau Ekspor ZIP untuk memindahkannya ke PC.</p>}
      </section>

      <section className="panel">
        <h3>Folder khusus</h3>
        {field('dailyFolder', 'Catatan harian', 'Tempat catatan YYYY-MM-DD.md dibuat')}
        {field('templateFolder', 'Templat', 'Catatan di sini muncul sebagai templat')}
        {field('attachmentFolder', 'Lampiran', 'Gambar yang ditempel / diseret disimpan di sini')}
      </section>

      <section className="panel">
        <h3>Impor & ekspor</h3>
        <div className="row gap wrap">
          <button className="btn ink" onClick={() => file.current?.click()}><Icon name="upload" size={16} /> Impor berkas (.md, .canvas, gambar)</button>
          <button className="btn soft" onClick={async () => { downloadBlob(`${vault.fs.label}.zip`, await vault.exportZip(), 'application/zip'); toast('Vault diekspor', 'ok'); }}><Icon name="download" size={16} /> Ekspor semua sebagai ZIP</button>
          <input ref={file} type="file" hidden multiple accept=".md,.markdown,.canvas,image/*" onChange={async (e) => {
            const files = [...(e.target.files ?? [])];
            let n = 0;
            for (const f of files) { try { await vault.importFile(f.name, new Uint8Array(await f.arrayBuffer())); n++; } catch (er) { toast(errMsg(er), 'error'); } }
            if (n) toast(`${n} berkas diimpor`, 'ok');
            e.target.value = '';
          }} />
        </div>
        <p className="muted small">Mengimpor vault Obsidian utuh? Pakai <b>Buka folder</b> dan pilih folder vault-nya — wikilink, frontmatter, dan <code>.canvas</code> langsung terbaca.</p>
      </section>

      <section className="panel">
        <h3>Sampah <span className="badge">{trash.length}</span></h3>
        {trash.length === 0 ? <p className="muted small">Kosong. Berkas yang kamu hapus muncul di sini dan bisa dipulihkan.</p> : (
          <>
            <ul className="trash">
              {trash.map((r) => (
                <li key={r.id}>
                  <span><b>{stripExt(basename(r.original))}</b><small>{r.original} · {relativeTime(r.ts)}</small></span>
                  <button className="btn tiny ghost" onClick={async () => { const p = await vault.restore(r); toast(`Dipulihkan: ${p}`, 'ok'); reloadTrash(); }}>Pulihkan</button>
                </li>
              ))}
            </ul>
            <button className="btn danger" onClick={async () => { if (await confirmBox('Kosongkan Sampah?', 'Berkas di Sampah dihapus permanen.', 'Kosongkan', true)) { await vault.emptyTrash(); reloadTrash(); } }}><Icon name="trash" size={15} /> Kosongkan Sampah</button>
          </>
        )}
      </section>
    </div>
  );
}

/* ── Sinkron ─────────────────────────────────────────────────────────────────────────── */
function SyncTab() {
  const vault = useVault();
  const toast = useApp((s) => s.toast);
  const s = useSyncStore();
  const [url, setUrl] = useState(s.creds?.url ?? '');
  const [key, setKey] = useState(s.creds?.anonKey ?? '');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [remotes, setRemotes] = useState<RemoteVault[]>([]);
  const [join, setJoin] = useState('');

  useEffect(() => { void refreshAuth(); }, [s.creds]);
  useEffect(() => { if (s.status === 'ready' || s.status === 'syncing') void remoteVaults().then(setRemotes).catch(() => undefined); }, [s.status === 'ready']);

  const guard = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); } };
  if (!vault) return null;
  const on = !!vault.config.syncId;

  return (
    <div className="stack-l">
      <section className="panel">
        <h3>1. Hubungkan Supabase</h3>
        <p className="muted small">Buat project gratis di supabase.com, jalankan <code>supabase/schema.sql</code> di SQL Editor, lalu salin <b>Project URL</b> dan <b>anon public key</b> (Project Settings → API). Key ini memang publik; data dilindungi RLS per pengguna.</p>
        <label className="field"><span>Project URL</span><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" autoComplete="off" spellCheck={false} /></label>
        <label className="field"><span>Anon key</span><input value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJ…" autoComplete="off" spellCheck={false} /></label>
        <div className="row gap">
          <button className="btn ink" disabled={!/^https:\/\/.+/.test(url) || key.length < 20} onClick={() => s.setCreds({ url: url.trim().replace(/\/+$/, ''), anonKey: key.trim() })}>Simpan</button>
          {s.creds && <button className="btn ghost" onClick={() => { s.setCreds(null); setUrl(''); setKey(''); }}>Putuskan</button>}
        </div>
      </section>

      {s.creds && (
        <section className="panel">
          <h3>2. Masuk</h3>
          {s.userId ? (
            <div className="row between wrap">
              <span>Masuk sebagai <b>{s.email}</b></span>
              <button className="btn ghost" onClick={() => void guard(signOut)}><Icon name="logout" size={15} /> Keluar</button>
            </div>
          ) : (
            <>
              <label className="field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kamu@email.com" autoComplete="email" /></label>
              {!sent ? (
                <button className="btn ink" disabled={busy || !/.+@.+\..+/.test(email)} onClick={() => void guard(async () => { await requestOtp(email); setSent(true); toast('Kode dikirim ke emailmu', 'ok'); })}>Kirim kode masuk</button>
              ) : (
                <>
                  <label className="field"><span>Kode dari email</span><input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" /></label>
                  <div className="row gap">
                    <button className="btn ink" disabled={busy || code.trim().length < 6} onClick={() => void guard(async () => { await confirmOtp(email, code); setCode(''); setSent(false); toast('Berhasil masuk', 'ok'); })}>Masuk</button>
                    <button className="btn ghost" onClick={() => setSent(false)}>Ganti email</button>
                  </div>
                </>
              )}
            </>
          )}
          {s.error && s.status === 'error' && <p className="callout bad">{s.error}</p>}
        </section>
      )}

      {s.userId && (
        <section className="panel">
          <h3>3. Vault ini</h3>
          {on ? (
            <>
              <p>Sinkron <b>aktif</b> untuk “{vault.fs.label}”. {s.last ? `Terakhir ${relativeTime(s.last.at)}: kirim ${s.last.pushed}, terima ${s.last.pulled}, hapus ${s.last.deleted}.` : ''}</p>
              {s.last && s.last.conflicts.length > 0 && <p className="callout warn">{s.last.conflicts.length} konflik. Versi dari perangkat lain dipakai, dan edit lokalmu disimpan sebagai berkas “(konflik …)”. Gabungkan manual lalu hapus salinannya.</p>}
              {s.last && s.last.errors.length > 0 && <p className="callout bad">{s.last.errors.length} gagal: {s.last.errors[0].path} — {s.last.errors[0].message}</p>}
              <div className="row gap">
                <button className="btn ink" disabled={s.status === 'syncing'} onClick={() => void runSyncAction()}><Icon name="refresh" size={15} className={s.status === 'syncing' ? 'spin' : ''} /> Sinkronkan sekarang</button>
                <button className="btn ghost" onClick={() => void disableSync(vault)}>Matikan di vault ini</button>
              </div>
            </>
          ) : (
            <>
              <div className="row gap wrap">
                <button className="btn ink" disabled={busy} onClick={() => void guard(async () => { await enableSync(vault); toast('Sinkron diaktifkan — mengunggah…', 'ok'); void runSyncAction(); })}>Aktifkan sebagai vault baru di cloud</button>
              </div>
              {remotes.length > 0 && (
                <div className="join">
                  <p className="muted small">Atau gabung ke vault yang sudah ada di cloud (mis. dibuat dari laptop). Isinya akan diunduh ke vault ini.</p>
                  <div className="row gap wrap">
                    <select value={join} onChange={(e) => setJoin(e.target.value)} aria-label="Vault cloud"><option value="">Pilih vault…</option>{remotes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
                    <button className="btn soft" disabled={!join || busy} onClick={() => void guard(async () => { await enableSync(vault, remotes.find((r) => r.id === join)); void runSyncAction(); })}>Gabung</button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
      <p className="muted small">Yang disinkronkan: semua catatan, canvas, dan lampiran. Tidak ikut: Sampah, riwayat versi, dan pengaturan perangkat (folder <code>.noto</code>). Data di Supabase tidak dienkripsi end-to-end.</p>
    </div>
  );
}

/* ── Widget & pengingat ──────────────────────────────────────────────────────────────── */
function WidgetTab() {
  const vault = useVault();
  const toast = useApp((s) => s.toast);
  const [rem, setRem] = useState(loadReminderPrefs);
  const caps = capabilities();
  if (!vault) return null;
  const sum = summaryFor(vault);
  const setRemP = (p: Partial<typeof rem>) => { const n = { ...rem, ...p }; setRem(n); saveReminderPrefs(n); };

  return (
    <div className="stack-l">
      <section className="panel">
        <h3>Widget</h3>
        <div className="widget-split">
          <div className="widget-prev tint-1" aria-label="Pratinjau widget 2×2">
            <b>{sum.title}</b><small>{sum.subtitle}</small>
            <ul>{sum.lines.map((l, i) => <li key={i}>{l.task ? '○ ' : '· '}{l.text}</li>)}{sum.lines.length === 0 && <li>Tidak ada apa-apa ☕</li>}</ul>
            <span className="w-btn">＋ Catatan</span>
          </div>
          <div className="widget-opts">
            <Row label="Isi widget" hint="Dipakai widget HP (2×2) dan jendela widget desktop">
              <select value={vault.config.widgetPath ?? ''} onChange={(e) => void vault.setConfig({ widgetPath: e.target.value || null })} aria-label="Isi widget">
                <option value="">Tugas hari ini (bawaan)</option>
                {[...vault.notes].sort((a, b) => a.title.localeCompare(b.title)).map((n) => <option key={n.path} value={n.path}>Catatan: {n.title}</option>)}
              </select>
            </Row>
            <div className="row gap wrap">
              <button className="btn ink" onClick={() => void openWidgetWindow().then((ok) => !ok && toast('Jendela widget diblokir browser', 'error'))}><Icon name="sticky" size={15} /> Buka jendela widget</button>
            </div>
            <p className="muted small">
              {caps.native ? 'Di Android: tekan lama layar utama → Widget → Noto → pilih ukuran 2×2. Ketukan “＋ Catatan” langsung membuka catatan baru.'
                : caps.tauri ? 'Jendela widget bisa diseret, selalu di atas, dan diubah ukurannya sesukamu. Hotkey global: Ctrl/⌘+Alt+N untuk catatan baru dari mana saja.'
                  : 'Di komputer: buka jendela widget lalu biarkan mengambang di sisi layar. Widget layar utama HP tersedia di aplikasi Android.'}
            </p>
          </div>
        </div>
      </section>

      <section className="panel">
        <h3>Pengingat tugas</h3>
        <Row label="Aktifkan pengingat" hint="Untuk tugas yang punya jam (⏰)">
          <Toggle label="Pengingat" on={rem.on} onChange={async (v) => { if (v && !(await ensureNotifyPermission())) { toast('Izin notifikasi ditolak', 'error'); return; } setRemP({ on: v }); toast(v ? 'Pengingat aktif — muat ulang aplikasi untuk menerapkan' : 'Pengingat dimatikan', 'ok'); }} />
        </Row>
        <Row label="Ingatkan sebelum"><select value={rem.lead} onChange={(e) => setRemP({ lead: Number(e.target.value) })} aria-label="Waktu pengingat">{[0, 5, 10, 15, 30, 60].map((m) => <option key={m} value={m}>{m === 0 ? 'Tepat waktu' : `${m} menit`}</option>)}</select></Row>
        <button className="btn ghost" onClick={async () => { if (await ensureNotifyPermission()) void notifyNow('Noto', 'Notifikasi berfungsi 🎉'); else toast('Izin notifikasi belum diberikan', 'error'); }}>Coba notifikasi</button>
        {caps.native ? <p className="muted small">Di Android, pengingat dijadwalkan ke sistem sehingga tetap berbunyi saat aplikasi tertutup.</p> : <p className="muted small">Di browser/desktop, pengingat berbunyi selama Noto terbuka (boleh diminimalkan).</p>}
      </section>
    </div>
  );
}

function About() {
  const keys: [string, string][] = [
    ['Ctrl+O', 'Buka catatan / cari'], ['Ctrl+P', 'Palet perintah'], ['Ctrl+N', 'Catatan baru'], ['Ctrl+D', 'Catatan harian hari ini'],
    ['Ctrl+,', 'Pengaturan'], ['Ctrl+\\', 'Ciutkan sidebar'], ['Ctrl+Enter', 'Centang tugas di baris ini'], ['Ctrl+B / I / E', 'Tebal / miring / kode'],
    ['/', 'Menu blok (di baris kosong)'], ['[[', 'Tautan ke catatan'], ['Ctrl+Z', 'Urungkan (canvas & editor)'], ['Shift+1', 'Pas ke layar (canvas)'],
  ];
  return (
    <div className="stack-l">
      <section className="panel center">
        <img src="./favicon.svg" width={64} height={64} alt="" />
        <h3>Noto 3.0</h3>
        <p className="muted">Vault catatan Markdown + canvas, lokal-first.<br />Berkasmu tetap berkasmu.</p>
      </section>
      <section className="panel">
        <h3>Pintasan papan ketik</h3>
        <dl className="keys">{keys.map(([k, d]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{d}</dd></div>)}</dl>
      </section>
    </div>
  );
}
