import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import { useApp } from '../store.ts';
import { Icon } from '../ui/Icon.tsx';
import { BUILTIN_SOUNDS, addCustomSound, listCustomSounds, playSound, removeCustomSound, type CustomSound } from '../lib/sounds.ts';
import { ensureNotifyPermission, notifyPermission, setReminderPrefs, testReminder, useReminderPrefs } from '../native/reminders.ts';
import { errMsg } from '../actions.ts';

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="set-row"><div><b>{label}</b>{hint && <small>{hint}</small>}</div><div className="set-ctl">{children}</div></div>;
}
function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={'switch' + (on ? ' on' : '')} onClick={() => onChange(!on)}><motion.i layout transition={{ type: 'spring', stiffness: 600, damping: 32 }} /></button>;
}

export function ReminderSettings() {
  const p = useReminderPrefs();
  const toast = useApp((s) => s.toast);
  const [custom, setCustom] = useState<CustomSound[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const native = Capacitor.isNativePlatform();
  const perm = notifyPermission();

  const refresh = () => void listCustomSounds().then(setCustom);
  useEffect(refresh, []);
  useEffect(() => () => stopRef.current?.(), []);

  const preview = async (id: string) => {
    stopRef.current?.();
    if (playing === id) { setPlaying(null); return; }
    setPlaying(id);
    const stop = await playSound({ sound: id, volume: p.volume, maxSeconds: 8 });
    stopRef.current = stop;
    window.setTimeout(() => setPlaying((c) => (c === id ? null : c)), 4000);
  };
  const choose = (id: string) => { setReminderPrefs({ sound: id }); void preview(id); };

  const importFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    try {
      let last: CustomSound | null = null;
      for (const f of Array.from(list)) last = await addCustomSound(f);
      refresh();
      if (last) { setReminderPrefs({ sound: 'custom:' + last.id }); toast(`Nada “${last.name}” ditambahkan dan dipilih`, 'ok'); }
    } catch (e) { toast(errMsg(e), 'error'); }
    if (file.current) file.current.value = '';
  };
  const remove = async (c: CustomSound) => {
    await removeCustomSound(c.id);
    if (p.sound === 'custom:' + c.id) setReminderPrefs({ sound: 'bell' });
    refresh();
  };
  const enable = async (v: boolean) => {
    if (v && !(await ensureNotifyPermission())) toast('Izin notifikasi ditolak — alarm tetap berbunyi saat Noto terbuka, tapi tidak muncul di luar jendela', 'error');
    setReminderPrefs({ on: v });
  };

  return (
    <section className="panel">
      <h3>Pengingat & alarm</h3>
      <Row label="Aktifkan pengingat" hint="Untuk tugas yang punya tanggal. Atur jam lewat menu tanggal & jam saat menambah tugas.">
        <Switch label="Pengingat" on={p.on} onChange={(v) => void enable(v)} />
      </Row>
      {p.on && perm === 'denied' && <p className="callout bad">Notifikasi diblokir di browser. Buka pengaturan situs (ikon gembok di kolom alamat) → izinkan Notifikasi.</p>}
      {p.on && perm === 'unsupported' && <p className="callout warn">Browser ini tidak mendukung notifikasi sistem. Alarm di dalam aplikasi tetap berfungsi.</p>}

      <Row label="Gaya">
        <div className="seg" role="radiogroup" aria-label="Gaya pengingat">
          {([['notif', 'Notifikasi'], ['alarm', 'Alarm']] as const).map(([id, l]) => (
            <button key={id} role="radio" aria-checked={p.mode === id} className={p.mode === id ? 'on' : ''} onClick={() => setReminderPrefs({ mode: id })}>
              {p.mode === id && <motion.span layoutId="seg-remmode" className="seg-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}<span>{l}</span>
            </button>
          ))}
        </div>
      </Row>
      <p className="muted small">{p.mode === 'alarm' ? 'Alarm: layar peringatan muncul dan nada berulang sampai kamu menekan Selesai, Tunda, atau Matikan.' : 'Notifikasi: nada sekali + banner kecil, tidak mengganggu.'}</p>

      <Row label="Ingatkan"><select value={p.lead} onChange={(e) => setReminderPrefs({ lead: Number(e.target.value) })} aria-label="Waktu pengingat">{[0, 5, 10, 15, 30, 60, 1440].map((m) => <option key={m} value={m}>{m === 0 ? 'Tepat waktu' : m === 1440 ? '1 hari sebelumnya' : `${m} menit sebelumnya`}</option>)}</select></Row>
      <Row label="Jam untuk tugas tanpa jam" hint="Tugas yang hanya punya tanggal diingatkan pada jam ini"><span className="row gap"><input type="time" value={p.defaultTime} onChange={(e) => setReminderPrefs({ defaultTime: e.target.value })} aria-label="Jam bawaan" />{p.defaultTime && <button className="icon-btn" aria-label="Jangan ingatkan" title="Jangan ingatkan tugas tanpa jam" onClick={() => setReminderPrefs({ defaultTime: '' })}><Icon name="x" size={14} /></button>}</span></Row>
      {p.mode === 'alarm' && <Row label="Alarm berbunyi maksimal"><select value={p.maxSeconds} onChange={(e) => setReminderPrefs({ maxSeconds: Number(e.target.value) })} aria-label="Durasi alarm">{[15, 30, 60, 120, 300].map((s) => <option key={s} value={s}>{s >= 60 ? `${s / 60} menit` : `${s} detik`}</option>)}</select></Row>}
      <Row label="Volume"><input type="range" min={0.1} max={1} step={0.05} value={p.volume} onChange={(e) => setReminderPrefs({ volume: Number(e.target.value) })} aria-label="Volume" /></Row>

      <h4 className="sound-h">Nada</h4>
      <div className="sound-grid" role="radiogroup" aria-label="Pilih nada">
        {BUILTIN_SOUNDS.map((s) => (
          <button key={s.id} role="radio" aria-checked={p.sound === s.id} className={'sound-card' + (p.sound === s.id ? ' on' : '')} onClick={() => choose(s.id)}>
            <span className="sound-ico"><Icon name="bell" size={16} /></span>
            <span className="sound-t"><b>{s.label}</b><small>{s.hint}</small></span>
            {p.sound === s.id && <Icon name="check" size={16} strokeWidth={2.6} />}
          </button>
        ))}
        {custom.map((c) => (
          <div key={c.id} role="radio" aria-checked={p.sound === 'custom:' + c.id} tabIndex={0} className={'sound-card custom' + (p.sound === 'custom:' + c.id ? ' on' : '')} onClick={() => choose('custom:' + c.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose('custom:' + c.id); } }}>
            <span className="sound-ico"><Icon name="upload" size={16} /></span>
            <span className="sound-t"><b>{c.name}</b><small>Impor · {(c.size / 1024 / 1024).toFixed(1)} MB</small></span>
            <button className="icon-btn" aria-label={`Hapus nada ${c.name}`} onClick={(e) => { e.stopPropagation(); void remove(c); }}><Icon name="trash" size={14} /></button>
          </div>
        ))}
      </div>
      <div className="row gap wrap">
        <input ref={file} type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a" multiple hidden onChange={(e) => void importFiles(e.target.files)} />
        <button className="btn soft" onClick={() => file.current?.click()}><Icon name="upload" size={15} /> Impor suara (.mp3)</button>
        <button className="btn ink" onClick={() => void testReminder()}><Icon name="bell" size={15} /> Coba alarm</button>
      </div>
      <p className="muted small">
        {native
          ? 'Di Android, saat aplikasi tertutup nada bawaan dibunyikan lewat sistem (tiap nada punya kanal sendiri). Nada impor berbunyi saat Noto terbuka; saat tertutup dipakai Lonceng.'
          : 'Di browser/desktop, alarm berbunyi selama Noto terbuka (tab boleh di latar belakang). Sekali saja klik di halaman setelah membuka Noto agar browser mengizinkan suara. Nada impor disimpan di perangkat ini saja.'}
      </p>
    </section>
  );
}
