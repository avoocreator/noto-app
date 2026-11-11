import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vault } from '../src/vault/vault.ts';
import { MemoryFS } from '../src/vault/memoryFs.ts';
import { MemoryRemote, runSync } from '../src/sync/engine.ts';

async function mk(label: string) {
  let t = 1;
  const fs = new MemoryFS(label, () => ++t);
  const v = new Vault(fs);
  await v.load();
  await v.setConfig({ deviceId: label });
  return v;
}

test('sync: dua perangkat, push/pull/hapus/konflik/lampiran', async () => {
  const remote = new MemoryRemote();
  const laptop = await mk('laptop');
  const hp = await mk('hp');

  // laptop menulis → push
  await laptop.write('Ide.md', '# Ide\nsatu\n');
  await laptop.saveAttachment('foto.png', new Uint8Array([9, 8, 7]));
  let r = await runSync(laptop, remote);
  assert.equal(r.pushed, 2);
  assert.deepEqual(r.errors, []);

  // hp menarik
  r = await runSync(hp, remote);
  assert.equal(r.pulled, 2);
  assert.equal(hp.content('Ide.md'), '# Ide\nsatu\n');
  assert.deepEqual([...(await hp.fs.readBinary('Lampiran/foto.png'))], [9, 8, 7]);

  // sync ulang tanpa perubahan = tidak ada aksi
  r = await runSync(hp, remote);
  assert.equal(r.pushed + r.pulled + r.deleted, 0);

  // edit bersamaan → konflik
  await laptop.write('Ide.md', '# Ide\nversi laptop\n');
  await hp.write('Ide.md', '# Ide\nversi hp\n');
  await runSync(laptop, remote); // laptop menang duluan ke remote
  r = await runSync(hp, remote);
  assert.deepEqual(r.conflicts, ['Ide.md']);
  assert.equal(hp.content('Ide.md'), '# Ide\nversi laptop\n'); // versi remote ditarik
  const copy = hp.notes.find((n) => n.path.includes('konflik hp'));
  assert.ok(copy, 'salinan konflik dibuat');
  assert.equal(hp.content(copy!.path), '# Ide\nversi hp\n'); // edit hp tidak hilang

  // salinan konflik ikut naik, lalu sampai ke laptop
  await runSync(hp, remote);
  await runSync(laptop, remote);
  assert.ok(laptop.notes.some((n) => n.path.includes('konflik hp')));

  // hapus di laptop → hilang di hp (masuk trash hp)
  await laptop.remove('Ide.md');
  await runSync(laptop, remote);
  r = await runSync(hp, remote);
  assert.equal(hp.has('Ide.md'), false);
  assert.equal((await hp.listTrash()).length, 1);
  assert.equal(remote.files.has('Ide.md'), false);
});
