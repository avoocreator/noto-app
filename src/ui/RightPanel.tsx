import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Icon, type IconName } from './Icon.tsx';
import { Calendar } from './Calendar.tsx';
import { useApp, useVault, type RightTab } from '../store.ts';
import { formatLongDate, relativeTime, ymd } from '../lib/dates.ts';
import { basename, isNotePath, stripExt } from '../lib/analyze.ts';
import { unlinkedMentions } from '../lib/vaultIndex.ts';
import { smartParse } from '../lib/smartParse.ts';
import { formatTaskLine } from '../lib/tasks.ts';
import { INBOX, toggleTaskItem } from '../actions.ts';
import { ask } from './dialogs.tsx';
import type { HistoryEntry } from '../vault/vault.ts';

const TABS: { id: RightTab; label: string; icon: IconName }[] = [
  { id: 'day', label: 'Hari', icon: 'calendar' },
  { id: 'outline', label: 'Outline', icon: 'list' },
  { id: 'links', label: 'Tautan', icon: 'link' },
  { id: 'history', label: 'Versi', icon: 'history' },
];

export function RightPanel() {
  const tab = useApp((s) => s.rightTab);
  const setTab = useApp((s) => s.setRightTab);
  const toggleRight = useApp((s) => s.toggleRight);

  return (
    <aside className="right" aria-label="Panel konteks">
      <div className="right-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={'rtab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>
            {tab === t.id && <motion.span layoutId="rtab-pill" className="rtab-pill" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
            <Icon name={t.icon} size={15} /> <span>{t.label}</span>
          </button>
        ))}
        <button className="icon-btn tiny rtab-close" aria-label="Tutup panel" onClick={toggleRight}><Icon name="x" size={14} /></button>
      </div>
      <div className="right-body">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}>
            {tab === 'day' && <DayTab />}
            {tab === 'outline' && <OutlineTab />}
            {tab === 'links' && <LinksTab />}
            {tab === 'history' && <HistoryTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </aside>
  );
}

/* ── Hari: kalender + timeline tugas ─────────────────────────────────────────────────── */
function DayTab() {
  const vault = useVault();
  const openPath = useApp((s) => s.openPath);
  const toast = useApp((s) => s.toast);
  const [sel, setSel] = useState(() => new Date());
  const key = ymd(sel);

  const marks = useMemo(() => {
    const m = new Map<string, 'note' | 'task' | 'both'>();
    if (!vault) return m;
    for (const t of vault.index.tasks) if (t.due && !t.done) m.set(t.due, 'task');
    for (const n of vault.notes) {
      const d = /(\d{4}-\d{2}-\d{2})\.md$/.exec(n.path)?.[1];
      if (d && n.folder === vault.config.dailyFolder) m.set(d, m.get(d) === 'task' ? 'both' : 'note');
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vault?.version]);

  if (!vault) return null;
  const tasks = vault.index.tasks
    .filter((t) => t.due === key)
    .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99') || Number(a.done) - Number(b.done));
  const daily = vault.dailyPath(sel);
  const now = new Date();
  const isToday = key === ymd(now);
  const nowHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const add = async () => {
    const text = await ask({ title: `Tambah tugas · ${formatLongDate(sel)}`, label: 'Apa yang perlu dilakukan?', placeholder: 'mis. rapat jam 14:00 !penting', confirm: 'Tambah' });
    if (!text) return;
    const p = smartParse(text);
    p.due = p.due ?? key;
    const line = formatTaskLine(p);
    const cur = vault.content(INBOX);
    await vault.write(INBOX, cur === undefined ? `# Inbox\n\n${line}\n` : cur.replace(/\n*$/, '\n') + line + '\n');
    toast('Tugas ditambahkan ke Inbox', 'ok');
  };

  return (
    <div className="stack">
      <Calendar selected={sel} onSelect={setSel} marks={marks} />
      <div className="row between">
        <button className="btn ink wide" onClick={() => void add()}><Icon name="plus" size={16} /> Tambah tugas</button>
        <button
          className="icon-btn round"
          title={vault.has(daily) ? 'Buka catatan harian' : 'Buat catatan harian'}
          aria-label="Catatan harian"
          onClick={async () => openPath(await vault.openDaily(sel))}
        >
          <Icon name="notes" size={16} />
        </button>
      </div>
      <h3 className="day-title">{isToday ? 'Hari ini' : formatLongDate(sel)}</h3>
      <ol className="timeline">
        {tasks.length === 0 && <li className="muted small">Tidak ada tugas bertanggal. Nikmati harimu ✨</li>}
        {tasks.map((t, i) => {
          const showNow = isToday && !t.done && t.time && t.time > nowHM && (i === 0 || (tasks[i - 1].time ?? '') <= nowHM);
          return (
            <li key={t.path + t.line}>
              {showNow && <div className="now-line"><span>{nowHM}</span></div>}
              <div className={'tl-card tint-' + ((i % 4) + 1) + (t.done ? ' done' : '')}>
                <button className={'check' + (t.done ? ' on' : '')} aria-label={t.done ? 'Batalkan' : 'Selesai'} onClick={() => void toggleTaskItem(t)}>
                  {t.done && <Icon name="check" size={13} strokeWidth={2.6} />}
                </button>
                <button className="tl-main" onClick={() => openPath(t.path, { line: t.line })}>
                  <b>{t.text}</b>
                  <small>{t.time ?? 'Sepanjang hari'} · {stripExt(basename(t.path))}</small>
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ── Outline ─────────────────────────────────────────────────────────────────────────── */
function OutlineTab() {
  const vault = useVault();
  const active = useApp((s) => s.active);
  const openPath = useApp((s) => s.openPath);
  const meta = vault && active ? vault.meta(active) : undefined;
  if (!meta) return <Empty icon="list" text="Buka sebuah catatan untuk melihat outline-nya." />;
  if (meta.headings.length === 0) return <Empty icon="list" text="Belum ada judul. Awali baris dengan # untuk membuat judul." />;
  const min = Math.min(...meta.headings.map((h) => h.level));
  return (
    <ul className="outline">
      {meta.headings.map((h, i) => (
        <li key={i} style={{ paddingLeft: (h.level - min) * 14 }}>
          <button onClick={() => openPath(meta.path, { line: h.line })}><span className={'h-dot h' + h.level} />{h.text}</button>
        </li>
      ))}
    </ul>
  );
}

/* ── Tautan: backlink, penyebutan, keluar ────────────────────────────────────────────── */
function LinksTab() {
  const vault = useVault();
  const active = useApp((s) => s.active);
  const openPath = useApp((s) => s.openPath);
  if (!vault || !active || !isNotePath(active)) return <Empty icon="link" text="Buka sebuah catatan untuk melihat tautannya." />;
  const back = vault.index.backlinks.get(active) ?? [];
  const mentions = unlinkedMentions(active, vault.index, (p) => vault.content(p), 15);
  const meta = vault.meta(active);
  const out = (meta?.links ?? []).filter((l) => !l.embed || true);
  const seen = new Set<string>();
  const outgoing = out.map((l) => ({ l, to: vault.resolve(l.target, active) })).filter(({ l }) => (seen.has(l.target.toLowerCase()) ? false : (seen.add(l.target.toLowerCase()), true)));

  const ctx = (c: string) => <p className="snippet">{c}</p>;
  return (
    <div className="stack">
      <Section title={`Backlink · ${back.length}`}>
        {back.length === 0 && <p className="muted small">Belum ada catatan yang menautkan ke sini.</p>}
        {back.map((b, i) => (
          <button className="link-card" key={i} onClick={() => openPath(b.from, { line: b.line })}>
            <b>{stripExt(basename(b.from))}</b>{ctx(b.context)}
          </button>
        ))}
      </Section>
      <Section title={`Penyebutan tanpa tautan · ${mentions.length}`}>
        {mentions.map((b, i) => (
          <div className="link-card" key={i}>
            <button className="link-card-main" onClick={() => openPath(b.from, { line: b.line })}>
              <b>{stripExt(basename(b.from))}</b>{ctx(b.context)}
            </button>
            <button
              className="btn tiny ghost"
              onClick={async () => {
                const t = vault.meta(active)!;
                const names = [t.title, stripExt(basename(active)), ...t.aliases];
                const src = vault.content(b.from) ?? '';
                const lines = src.split('\n');
                const low = lines[b.line].toLowerCase();
                const hit = names.find((n) => low.includes(n.toLowerCase()));
                if (hit) {
                  const idx = low.indexOf(hit.toLowerCase());
                  lines[b.line] = lines[b.line].slice(0, idx) + `[[${stripExt(basename(active))}${hit.toLowerCase() === stripExt(basename(active)).toLowerCase() ? '' : '|' + lines[b.line].slice(idx, idx + hit.length)}]]` + lines[b.line].slice(idx + hit.length);
                  await vault.write(b.from, lines.join('\n'));
                }
              }}
            >
              Tautkan
            </button>
          </div>
        ))}
        {mentions.length === 0 && <p className="muted small">Tidak ada.</p>}
      </Section>
      <Section title={`Tautan keluar · ${outgoing.length}`}>
        {outgoing.map(({ l, to }) => (
          <button className={'chip-link' + (to ? '' : ' missing')} key={l.target} onClick={() => (to ? openPath(to) : void vault.createNote({ title: l.target }).then((p) => openPath(p)))}>
            <Icon name={to ? 'notes' : 'plus'} size={14} /> {l.target}
          </button>
        ))}
        {outgoing.length === 0 && <p className="muted small">Tidak ada.</p>}
      </Section>
    </div>
  );
}

/* ── Riwayat versi ───────────────────────────────────────────────────────────────────── */
function HistoryTab() {
  const vault = useVault();
  const active = useApp((s) => s.active);
  const toast = useApp((s) => s.toast);
  const [list, setList] = useState<HistoryEntry[]>([]);
  const [preview, setPreview] = useState<HistoryEntry | null>(null);
  const version = vault?.version;

  useEffect(() => {
    let alive = true;
    setPreview(null);
    if (vault && active && isNotePath(active)) void vault.getHistory(active).then((l) => { if (alive) setList(l); });
    else setList([]);
    return () => { alive = false; };
  }, [vault, active, version]);

  if (!vault || !active || !isNotePath(active)) return <Empty icon="history" text="Buka sebuah catatan untuk melihat riwayat versinya." />;
  if (list.length === 0) return <Empty icon="history" text="Belum ada versi lama. Versi disimpan otomatis tiap beberapa menit saat kamu mengedit." />;
  return (
    <div className="stack">
      {list.map((h) => (
        <div key={h.ts} className={'hist' + (preview?.ts === h.ts ? ' on' : '')}>
          <button className="hist-main" onClick={() => setPreview(preview?.ts === h.ts ? null : h)}>
            <b>{relativeTime(h.ts)}</b>
            <small>{new Date(h.ts).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} · {h.content.length} karakter</small>
          </button>
          <AnimatePresence>
            {preview?.ts === h.ts && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                <pre className="hist-pre">{h.content.slice(0, 1200)}{h.content.length > 1200 ? '\n…' : ''}</pre>
                <button className="btn ink tiny" onClick={async () => { await vault.restoreVersion(active, h.ts); toast('Versi dipulihkan', 'ok'); }}>Pulihkan versi ini</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rsec"><h4>{title}</h4>{children}</section>;
}
function Empty({ icon, text }: { icon: IconName; text: string }) {
  return <div className="empty-mini"><Icon name={icon} size={22} /><p>{text}</p></div>;
}
