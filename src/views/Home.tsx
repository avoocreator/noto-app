import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Icon } from '../ui/Icon.tsx';
import { useApp, useVault } from '../store.ts';
import { addDays, formatLongDate, greeting, relativeTime, startOfDay, ymd, hm } from '../lib/dates.ts';
import { basename, stripExt } from '../lib/analyze.ts';
import { smartParse } from '../lib/smartParse.ts';
import { bucketOf } from '../lib/tasks.ts';
import { newCanvas, newNote, openToday, quickAddTask, toggleTaskItem } from '../actions.ts';
import { useReducedMotion } from '../theme/useTheme.ts';

const DAYS = 14;

/** Bentuk dekoratif pojok kartu (mengikuti referensi: plus, hati, bintang, segitiga). */
function Decor({ kind }: { kind: 'plus' | 'page' | 'star' | 'tri' }) {
  const common = { fill: 'currentColor', opacity: 0.55 };
  return (
    <svg className="decor" viewBox="0 0 120 120" aria-hidden="true">
      {kind === 'plus' && <path {...common} d="M44 10h32v34h34v32H76v34H44V76H10V44h34z" transform="rotate(18 60 60)" />}
      {kind === 'page' && <path {...common} d="M24 10h50l24 24v76H24zM74 10v24h24z" transform="rotate(-8 60 60)" />}
      {kind === 'star' && <path {...common} d="M60 6l12 28 30-8-14 28 26 18-30 6 2 30-26-16-26 16 2-30-30-6 26-18-14-28 30 8z" />}
      {kind === 'tri' && <path {...common} d="M10 14h100L60 108z" transform="rotate(6 60 60)" />}
    </svg>
  );
}

function Sparkline({ values, color = 'currentColor' }: { values: number[]; color?: string }) {
  const max = Math.max(1, ...values);
  const w = 260, h = 70, step = w / (values.length - 1);
  const pts = values.map((v, i) => [i * step, h - 8 - (v / max) * (h - 18)] as const);
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    d += ` C ${x0 + step / 2} ${y0}, ${x1 - step / 2} ${y1}, ${x1} ${y1}`;
  }
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="spark" preserveAspectRatio="none" aria-hidden="true">
      <motion.path d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: 'easeOut' }} />
      <circle cx={last[0]} cy={last[1]} r="4.5" fill={color} />
    </svg>
  );
}

export function Home() {
  const vault = useVault();
  const { openPath, setView, openPalette } = useApp();
  const reduce = useReducedMotion();
  const [quick, setQuick] = useState('');
  const [picked, setPicked] = useState<string | null>(null);

  const data = useMemo(() => {
    if (!vault) return null;
    const today = ymd(new Date());
    const notes = [...vault.notes].sort((a, b) => b.mtime - a.mtime);
    const perDay: number[] = Array(DAYS).fill(0);
    const doneDay: number[] = Array(DAYS).fill(0);
    const start = addDays(startOfDay(new Date()), -(DAYS - 1));
    const idx = (ts: number) => Math.floor((startOfDay(new Date(ts)).getTime() - start.getTime()) / 86400000);
    for (const n of notes) { const i = idx(n.mtime); if (i >= 0 && i < DAYS) perDay[i]++; }
    for (const t of vault.index.tasks) {
      if (t.doneDate) { const d = new Date(t.doneDate + 'T00:00:00'); const i = idx(d.getTime()); if (i >= 0 && i < DAYS) doneDay[i]++; }
    }
    const tasks = vault.index.tasks;
    const b = { overdue: 0, today: 0, upcoming: 0, nodate: 0, done: 0 };
    for (const t of tasks) b[bucketOf(t, today)]++;
    const tags = [...vault.index.tags.entries()].map(([t, p]) => [t, p.length] as const).sort((a, b2) => b2[1] - a[1]).slice(0, 4);
    const canvases = vault.files.filter((f) => f.path.endsWith('.canvas')).sort((a, b2) => b2.mtime - a.mtime);
    const links = vault.index.edges.length;
    const todayTasks = tasks.filter((t) => !t.done && t.due && t.due <= today).sort((a, b2) => (a.due! < b2.due! ? -1 : 1));
    return { notes, perDay, doneDay, b, tags, canvases, links, todayTasks, words: notes.reduce((n, x) => n + x.words, 0) };
  }, [vault?.version]);

  if (!vault || !data) return null;
  const now = new Date();
  const parsed = quick.trim() ? smartParse(quick) : null;
  const maxBar = Math.max(1, ...data.perDay);
  const pickedMeta = (picked && vault.meta(picked)) || data.notes[0];
  const chipTints = ['yellow', 'pink', 'blue', 'green'];

  return (
    <div className="home">
      <div className="home-top">
        <button className="search-pill" onClick={() => openPalette('files')} aria-label="Cari">
          <span className="search-ico"><Icon name="search" size={18} /></span>
          <span className="search-text">Cari catatan, tag, atau perintah…</span>
          <span className="search-scope">
            <i className="on">Catatan</i><i>Tugas</i><i>Canvas</i><kbd>Ctrl</kbd><kbd>O</kbd>
          </span>
        </button>
      </div>

      <motion.h1 className="hero" initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {greeting(now)} 👋
      </motion.h1>
      <p className="muted hero-sub">
        {formatLongDate(now)}. Kamu punya <b>{data.b.today}</b> tugas hari ini{data.b.overdue ? <> dan <b className="warn-text">{data.b.overdue}</b> yang terlambat</> : ''}, dengan {data.notes.length} catatan di vault.
      </p>

      <form
        className="quick"
        onSubmit={async (e) => { e.preventDefault(); if (await quickAddTask(quick)) setQuick(''); }}
      >
        <Icon name="plus" size={18} />
        <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Tugas cepat: beli susu besok jam 10 !penting #belanja" aria-label="Tugas cepat" />
        {parsed && (
          <span className="quick-chips">
            {parsed.due && <i><Icon name="calendar" size={12} /> {parsed.due}</i>}
            {parsed.time && <i><Icon name="clock" size={12} /> {parsed.time}</i>}
            {parsed.priority && <i><Icon name="flag" size={12} /> {parsed.priority === 'high' ? 'penting' : parsed.priority}</i>}
            {parsed.recur && <i><Icon name="repeat" size={12} /> tiap {parsed.recur}</i>}
            {parsed.tags.map((t) => <i key={t}>#{t}</i>)}
          </span>
        )}
        <button className="btn ink" type="submit" disabled={!parsed?.text}>Tambah</button>
      </form>

      <div className="bento">
        <motion.section className="card tint-1 span-2" whileHover={reduce ? undefined : { y: -3 }} onClick={() => setView('notes')}>
          <Decor kind="plus" />
          <h3>Catatan:</h3>
          <div className="stats">
            <div><b>{data.notes.length}</b> catatan<small>{data.words.toLocaleString('id-ID')} kata</small></div>
            <div><b>{data.links}</b> tautan<small>antar catatan</small></div>
            <div><b>{data.tags.length ? vault.index.tags.size : 0}</b> tag<small>unik</small></div>
          </div>
          <div className="bars" aria-label="Catatan diubah 14 hari terakhir">
            {data.perDay.map((v, i) => (
              <motion.i
                key={i}
                className={i === DAYS - 1 ? 'now' : ''}
                initial={reduce ? false : { height: 4 }}
                animate={{ height: 6 + (v / maxBar) * 56 }}
                transition={{ delay: i * 0.03, type: 'spring', stiffness: 260, damping: 22 }}
                title={`${v} catatan`}
              />
            ))}
          </div>
          <div className="axis"><span>14 hari lalu</span><span>hari ini</span></div>
        </motion.section>

        <motion.section className="card tint-2 span-2" whileHover={reduce ? undefined : { y: -3 }} onClick={() => setView('tasks')}>
          <Decor kind="page" />
          <h3>Ringkasan tugas:</h3>
          <div className="stats">
            <div><b>{data.b.today}</b> hari ini<small>{data.b.overdue} terlambat</small></div>
            <div><b>{data.b.upcoming}</b> mendatang<small>{data.b.nodate} tanpa tanggal</small></div>
            <div><b>{data.b.done}</b> selesai<small>total</small></div>
          </div>
          <Sparkline values={data.doneDay} />
          <div className="axis"><span>Tugas selesai · 14 hari</span><span>hari ini</span></div>
        </motion.section>

        <motion.section className="card tint-3" whileHover={reduce ? undefined : { y: -3 }}>
          <Decor kind="tri" />
          <h3>Tag teratas:</h3>
          <div className="tag-list">
            {data.tags.length === 0 && <small>Belum ada tag. Tulis #ide di catatan.</small>}
            {data.tags.map(([t, n]) => (
              <button key={t} onClick={() => openPalette('files', `tag:${t}`)}><b>{n}</b> #{t}</button>
            ))}
          </div>
        </motion.section>

        <motion.section className="card tint-4" whileHover={reduce ? undefined : { y: -3 }}>
          <Decor kind="star" />
          <h3>Canvas:</h3>
          <div className="canvas-list">
            {data.canvases.slice(0, 2).map((c) => (
              <button key={c.path} onClick={() => openPath(c.path)}><Icon name="canvas" size={14} /> {stripExt(basename(c.path))}</button>
            ))}
            {data.canvases.length === 0 && <small>Belum ada canvas.</small>}
            <button className="mini-add" onClick={() => void newCanvas()}><Icon name="plus" size={14} /> Canvas baru</button>
          </div>
        </motion.section>
      </div>

      <div className="home-split">
        <section>
          <div className="row between sec-head">
            <h3>Catatan terbaru</h3>
            <div className="row gap-s">
              <button className="pill ink" onClick={() => void newNote()}><Icon name="plus" size={14} /> Baru</button>
              <button className="pill soft" onClick={() => void openToday()}><Icon name="calendar" size={14} /> Harian</button>
            </div>
          </div>
          <ul className="note-list">
            {data.notes.slice(0, 6).map((n, i) => (
              <motion.li
                key={n.path}
                layout
                initial={reduce ? false : { opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={pickedMeta?.path === n.path ? 'on' : ''}
              >
                <button onClick={() => setPicked(n.path)} onDoubleClick={() => openPath(n.path)}>
                  <span className={'nl-ico ' + chipTints[i % 4]}><Icon name="notes" size={18} /></span>
                  <span className="nl-main"><b>{n.title}</b><small>{n.excerpt || n.folder || 'Kosong'}</small></span>
                  <span className={'time-chip ' + chipTints[i % 4]}>{hm(new Date(n.mtime))}</span>
                </button>
              </motion.li>
            ))}
            {data.notes.length === 0 && <li className="muted pad">Belum ada catatan.</li>}
          </ul>
        </section>

        <section>
          <div className="row between sec-head"><h3>Detail catatan</h3></div>
          {pickedMeta ? (
            <motion.div key={pickedMeta.path} className="detail" initial={reduce ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}>
              <div className="row between">
                <button className="detail-title" onClick={() => openPath(pickedMeta.path)}>{pickedMeta.title}</button>
                <span className="id-chip">{pickedMeta.words} kata</span>
              </div>
              <p className="muted small">{pickedMeta.folder || 'Vault'} · {relativeTime(pickedMeta.mtime)}</p>
              <div className="chips">
                {pickedMeta.tags.slice(0, 5).map((t) => <i key={t} className="chip">{t}</i>)}
                {pickedMeta.tags.length === 0 && <i className="chip dim">tanpa tag</i>}
              </div>
              <dl>
                <dt>Backlink</dt><dd>{vault.index.backlinks.get(pickedMeta.path)?.length ?? 0} catatan</dd>
                <dt>Tautan keluar</dt><dd>{pickedMeta.links.length}</dd>
                <dt>Tugas</dt><dd>{pickedMeta.tasks.filter((t) => !t.done).length} terbuka · {pickedMeta.tasks.filter((t) => t.done).length} selesai</dd>
                <dt>Ringkasan</dt><dd>{pickedMeta.excerpt || '—'}</dd>
              </dl>
              <button className="btn ink wide" onClick={() => openPath(pickedMeta.path)}>Buka catatan</button>
            </motion.div>
          ) : <div className="detail muted">Pilih catatan untuk melihat detail.</div>}
        </section>
      </div>

      {data.todayTasks.length > 0 && (
        <section className="due">
          <h3>Perlu perhatian</h3>
          <ul>
            {data.todayTasks.slice(0, 5).map((t) => (
              <li key={t.path + t.line}>
                <button className="check" aria-label="Selesai" onClick={() => void toggleTaskItem(t)} />
                <button className="due-text" onClick={() => openPath(t.path, { line: t.line })}>{t.text}</button>
                <small className={t.due! < ymd(now) ? 'warn-text' : ''}>{t.due === ymd(now) ? 'hari ini' : t.due}{t.time ? ` · ${t.time}` : ''}</small>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
