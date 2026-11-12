import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from '../ui/Icon.tsx';
import { useApp, useVault } from '../store.ts';
import { DAYS_ID, MONTHS_SHORT_ID, parseYmd, startOfDay, ymd } from '../lib/dates.ts';
import { bucketOf, type TaskBucket } from '../lib/tasks.ts';
import type { TaskWithSource } from '../lib/vaultIndex.ts';
import { basename, stripExt } from '../lib/analyze.ts';
import { toggleTaskItem, updateTask } from '../actions.ts';
import { QuickTask } from '../ui/QuickTask.tsx';
import { TaskPicker } from '../ui/TaskPicker.tsx';
import { useReducedMotion } from '../theme/useTheme.ts';

type Filter = 'open' | TaskBucket;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'open', label: 'Semua aktif' },
  { id: 'today', label: 'Hari ini' },
  { id: 'upcoming', label: 'Mendatang' },
  { id: 'overdue', label: 'Terlambat' },
  { id: 'nodate', label: 'Tanpa tanggal' },
  { id: 'done', label: 'Selesai' },
];
const GROUPS: { id: TaskBucket; label: string; tint: number }[] = [
  { id: 'overdue', label: 'Terlambat', tint: 2 },
  { id: 'today', label: 'Hari ini', tint: 1 },
  { id: 'upcoming', label: 'Mendatang', tint: 4 },
  { id: 'nodate', label: 'Tanpa tanggal', tint: 3 },
  { id: 'done', label: 'Selesai', tint: 3 },
];

function dueLabel(due: string, today: Date): string {
  const d = parseYmd(due);
  if (!d) return due;
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(today).getTime()) / 86400000);
  if (diff === 0) return 'Hari ini';
  if (diff === 1) return 'Besok';
  if (diff === -1) return 'Kemarin';
  if (diff > 1 && diff < 7) return DAYS_ID[d.getDay()];
  return `${d.getDate()} ${MONTHS_SHORT_ID[d.getMonth()]}`;
}

export function TasksView() {
  const vault = useVault();
  const openPath = useApp((s) => s.openPath);
  const reduce = useReducedMotion();
  const [filter, setFilter] = useState<Filter>('open');
  const [tag, setTag] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const today = new Date();
  const todayKey = ymd(today);

  const { groups, counts, tags, doneToday, todayTotal } = useMemo(() => {
    const counts: Record<TaskBucket, number> = { overdue: 0, today: 0, upcoming: 0, nodate: 0, done: 0 };
    const tagSet = new Map<string, number>();
    const all = vault?.index.tasks ?? [];
    for (const t of all) {
      counts[bucketOf(t, todayKey)]++;
      if (!t.done) for (const g of t.tags) tagSet.set(g, (tagSet.get(g) ?? 0) + 1);
    }
    const filtered = all.filter((t) => {
      const b = bucketOf(t, todayKey);
      if (filter === 'open' ? b === 'done' : b !== filter) return false;
      if (tag && !t.tags.includes(tag)) return false;
      if (q && !t.text.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    const by = new Map<TaskBucket, TaskWithSource[]>();
    for (const t of filtered) {
      const b = bucketOf(t, todayKey);
      by.set(b, [...(by.get(b) ?? []), t]);
    }
    const pri = { high: 0, medium: 1, low: 2 } as const;
    for (const arr of by.values()) {
      arr.sort((a, b) => (a.due ?? '9') .localeCompare(b.due ?? '9') || (a.time ?? '99').localeCompare(b.time ?? '99') || (pri[a.priority ?? 'low'] - pri[b.priority ?? 'low']));
    }
    const todays = all.filter((t) => t.due === todayKey || t.doneDate === todayKey);
    return {
      groups: GROUPS.map((g) => ({ ...g, items: by.get(g.id) ?? [] })).filter((g) => g.items.length),
      counts,
      tags: [...tagSet.entries()].sort((a, b) => b[1] - a[1]),
      doneToday: todays.filter((t) => t.done).length,
      todayTotal: todays.length,
    };
  }, [vault?.version, filter, tag, q, todayKey]);

  if (!vault) return null;
  const ratio = todayTotal ? doneToday / todayTotal : 0;
  const R = 26, C = 2 * Math.PI * R;

  return (
    <div className="tasks-view">
      <header className="page-head">
        <div>
          <h1>Tugas</h1>
          <p className="muted">Semua <code>- [ ]</code> dari seluruh vault, di satu tempat. Mencentang di sini mengubah berkas aslinya.</p>
        </div>
        <div className="ring" title={`${doneToday} dari ${todayTotal} tugas hari ini selesai`}>
          <svg viewBox="0 0 64 64" width="72" height="72">
            <circle cx="32" cy="32" r={R} className="ring-bg" />
            <motion.circle cx="32" cy="32" r={R} className="ring-fg" strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - ratio) }} transition={{ duration: 0.7, ease: 'easeOut' }} />
          </svg>
          <span><b>{Math.round(ratio * 100)}%</b><small>hari ini</small></span>
        </div>
      </header>

      <QuickTask big placeholder="Tambah tugas… misalnya: rapat jumat 14:30 !penting #kerja tiap minggu" />

      <div className="filters">
        <div className="seg" role="tablist">
          {FILTERS.map((f) => (
            <button key={f.id} role="tab" aria-selected={filter === f.id} className={filter === f.id ? 'on' : ''} onClick={() => setFilter(f.id)}>
              {filter === f.id && <motion.span layoutId="seg-pill" className="seg-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <span>{f.label}</span>
              {f.id !== 'open' && <i>{counts[f.id as TaskBucket]}</i>}
            </button>
          ))}
        </div>
        <input className="filter-search" placeholder="Saring…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Saring tugas" />
      </div>
      {tags.length > 0 && (
        <div className="chips tagbar">
          {tags.slice(0, 12).map(([t, n]) => (
            <button key={t} className={'chip' + (tag === t ? ' on' : '')} onClick={() => setTag(tag === t ? null : t)}>#{t} <b>{n}</b></button>
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="empty-doc">
          <img src="./art/empty-tasks.svg" alt="" width={180} />
          <h2>{filter === 'done' ? 'Belum ada yang selesai' : 'Tidak ada tugas di sini'}</h2>
          <p className="muted">Tambah tugas di atas, atau tulis <code>- [ ] sesuatu</code> di catatan mana pun.</p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.id} className="task-group">
            <h3><span className={'dot tint-' + g.tint} />{g.label} <i>{g.items.length}</i></h3>
            <ul>
              <AnimatePresence initial={false}>
                {g.items.map((t) => (
                  <motion.li
                    key={t.path + ':' + t.line + t.text}
                    layout={reduce ? false : 'position'}
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 24 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className={'task-row' + (t.done ? ' done' : '') + (g.id === 'overdue' ? ' late' : '')}
                  >
                    <button className={'check' + (t.done ? ' on' : '')} aria-label={t.done ? 'Batalkan selesai' : 'Tandai selesai'} aria-pressed={t.done} onClick={() => void toggleTaskItem(t)}>
                      {t.done && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 20 }}><Icon name="check" size={13} strokeWidth={2.8} /></motion.span>}
                    </button>
                    <button className="task-text" onClick={() => openPath(t.path, { line: t.line })}>
                      <span>{t.text}</span>
                      <small>{stripExt(basename(t.path))}</small>
                    </button>
                    <span className="task-meta">
                      {t.priority && <i className={'pri ' + t.priority} title={`Prioritas ${t.priority}`}><Icon name="flag" size={12} /></i>}
                      {t.recur && <i title={`Berulang tiap ${t.recur}`}><Icon name="repeat" size={12} /></i>}
                      {t.time && <i><Icon name="clock" size={12} /> {t.time}</i>}
                      {t.due && <i className={'due' + (t.due < todayKey && !t.done ? ' late' : '')}><Icon name="calendar" size={12} /> {dueLabel(t.due, today)}</i>}
                    </span>
                    <TaskPicker compact value={{ due: t.due, time: t.time, priority: t.priority, recur: t.recur }} onChange={(v) => void updateTask(t, { due: v.due ?? null, time: v.time ?? null, priority: v.priority ?? null, recur: v.recur ?? null })} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </section>
        ))
      )}
      <p className="muted small foot">Format: <code>- [ ] teks ⏫ 🔁 every week ⏰ 10:00 📅 2026-11-12</code></p>
    </div>
  );
}
