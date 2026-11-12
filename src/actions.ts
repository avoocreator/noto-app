import { useApp } from './store.ts';
import { smartParse } from './lib/smartParse.ts';
import { formatTaskLine, patchTaskLine, toggleTaskInContent, type TaskPatch } from './lib/tasks.ts';
import { basename, dirname, stripExt } from './lib/analyze.ts';
import { ask, confirmBox } from './ui/dialogs.tsx';

const app = () => useApp.getState();

export async function newNote(dir = '', template?: string) {
  const { vault, openPath, toast } = app();
  if (!vault) return;
  try {
    const p = await vault.createNote({ dir, template });
    openPath(p);
  } catch (e) { toast(errMsg(e), 'error'); }
}

export async function newCanvas(dir = '') {
  const { vault, openPath, toast } = app();
  if (!vault) return;
  try { openPath(await vault.createCanvas(dir)); } catch (e) { toast(errMsg(e), 'error'); }
}

export async function newFolder(parent = '') {
  const { vault, toast } = app();
  if (!vault) return;
  const name = await ask({ title: 'Folder baru', label: 'Nama folder', confirm: 'Buat' });
  if (!name) return;
  try { await vault.createFolder(parent ? `${parent}/${name}` : name); } catch (e) { toast(errMsg(e), 'error'); }
}

export async function openToday() {
  const { vault, openPath, toast } = app();
  if (!vault) return;
  try { openPath(await vault.openDaily(new Date())); } catch (e) { toast(errMsg(e), 'error'); }
}

export async function renameEntry(path: string) {
  const { vault, renameTab, toast } = app();
  if (!vault) return;
  const cur = stripExt(basename(path));
  const name = await ask({ title: 'Ganti nama', label: 'Nama baru', initial: cur, confirm: 'Ganti' });
  if (!name || name === cur) return;
  try {
    const r = await vault.rename(path, name);
    renameTab(path, r.path);
    toast(r.updated ? `Diganti. ${r.updated} tautan diperbarui.` : 'Nama diganti.', 'ok');
  } catch (e) { toast(errMsg(e), 'error'); }
}

export async function renameFolderAction(path: string) {
  const { vault, toast } = app();
  if (!vault) return;
  const cur = basename(path);
  const name = await ask({ title: 'Ganti nama folder', initial: cur, confirm: 'Ganti' });
  if (!name || name === cur) return;
  const d = dirname(path);
  try { await vault.renameFolder(path, d ? `${d}/${name}` : name); } catch (e) { toast(errMsg(e), 'error'); }
}

export async function deleteEntry(path: string, isDir = false) {
  const { vault, closeTab, toast } = app();
  if (!vault) return;
  const ok = await confirmBox(
    isDir ? 'Hapus folder?' : 'Hapus berkas?',
    isDir ? `Folder "${basename(path)}" dan isinya dipindahkan ke Sampah.` : `"${stripExt(basename(path))}" dipindahkan ke Sampah. Bisa dipulihkan.`,
    'Hapus',
    true,
  );
  if (!ok) return;
  try {
    if (isDir) {
      for (const f of vault.files.filter((x) => x.path.startsWith(path + '/'))) closeTab(f.path);
      await vault.removeFolder(path);
    } else {
      closeTab(path);
      await vault.remove(path);
    }
    toast('Dipindahkan ke Sampah', 'ok');
  } catch (e) { toast(errMsg(e), 'error'); }
}

export async function moveEntry(path: string, toDir: string) {
  const { vault, renameTab, toast } = app();
  if (!vault || dirname(path) === toDir) return;
  try {
    const r = await vault.move(path, `${toDir ? toDir + '/' : ''}${basename(path)}`);
    renameTab(path, r.path);
  } catch (e) { toast(errMsg(e), 'error'); }
}

export async function toggleTaskItem(t: { path: string; line: number }) {
  const { vault } = app();
  if (!vault) return;
  const c = vault.content(t.path);
  if (c === undefined) return;
  await vault.write(t.path, toggleTaskInContent(c, t.line));
}

/** Ubah tanggal/jam/prioritas/ulang satu tugas di berkasnya. */
export async function updateTask(t: { path: string; line: number }, patch: TaskPatch) {
  const { vault } = app();
  const c = vault?.content(t.path);
  if (!vault || c === undefined) return;
  const lines = c.split('\n');
  if (lines[t.line] === undefined) return;
  lines[t.line] = patchTaskLine(lines[t.line], patch);
  await vault.write(t.path, lines.join('\n'));
}

export const INBOX = 'Inbox.md';

/** Tambah tugas dari kalimat bebas ke Inbox.md. Mengembalikan teks tugas yang ditulis. */
export async function quickAddTask(input: string, target = INBOX, over: TaskPatch = {}): Promise<string | null> {
  const { vault } = app();
  if (!vault || !input.trim()) return null;
  const parsed = smartParse(input);
  if (!parsed.text) return null;
  // pilihan dari menu tanggal/jam menimpa hasil tebakan teks
  if (over.due !== undefined) parsed.due = over.due ?? undefined;
  if (over.time !== undefined) parsed.time = over.time ?? undefined;
  if (over.priority !== undefined) parsed.priority = over.priority ?? undefined;
  if (over.recur !== undefined) parsed.recur = over.recur ?? undefined;
  const line = formatTaskLine(parsed);
  const cur = vault.content(target);
  const next = cur === undefined ? `# Inbox\n\n${line}\n` : cur.replace(/\n*$/, '\n') + line + '\n';
  await vault.write(target, next);
  return line;
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function downloadBlob(name: string, data: Uint8Array | string, type = 'application/octet-stream') {
  const blob = new Blob([data as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
