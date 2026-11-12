import { useState } from 'react';
import { smartParse } from '../lib/smartParse.ts';
import { quickAddTask } from '../actions.ts';
import { Icon } from './Icon.tsx';
import { TaskPicker, type TaskWhen } from './TaskPicker.tsx';

/** Kolom tambah tugas: ketik bebas ("rapat jumat 14:30") dan/atau pakai menu tanggal & jam. Pilihan menu menang atas tebakan teks. */
export function QuickTask({ placeholder, big, label }: { placeholder: string; big?: boolean; label?: string }) {
  const [text, setText] = useState('');
  const [when, setWhen] = useState<TaskWhen>({});
  const parsed = text.trim() ? smartParse(text) : null;
  const eff = { due: when.due ?? parsed?.due, time: when.time ?? parsed?.time, priority: when.priority ?? parsed?.priority, recur: when.recur ?? parsed?.recur };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const over = { due: when.due, time: when.time, priority: when.priority, recur: when.recur };
    if (await quickAddTask(text, undefined, over)) { setText(''); setWhen({}); }
  };
  return (
    <form className={'quick' + (big ? ' big' : '')} onSubmit={(e) => void submit(e)}>
      <Icon name="plus" size={18} />
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={label ?? 'Tambah tugas'} />
      {(eff.priority || eff.recur || parsed?.tags.length) ? (
        <span className="quick-chips">
          {eff.priority && <i><Icon name="flag" size={12} /> {eff.priority === 'high' ? 'penting' : eff.priority}</i>}
          {eff.recur && <i><Icon name="repeat" size={12} /> tiap {eff.recur}</i>}
          {parsed?.tags.map((t) => <i key={t}>#{t}</i>)}
        </span>
      ) : null}
      <TaskPicker value={{ ...when, due: eff.due, time: eff.time, priority: eff.priority, recur: eff.recur }} onChange={(v) => setWhen(v)} />
      <button className="btn ink" type="submit" disabled={!parsed?.text}>Tambah</button>
    </form>
  );
}
