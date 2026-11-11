-- Noto v3 — skema Supabase. Jalankan SEKALI di Supabase → SQL Editor.
-- Aman dijalankan ulang (idempotent).

create table if not exists public.noto_vaults (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.noto_files (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vault_id    uuid not null references public.noto_vaults(id) on delete cascade,
  path        text not null,
  kind        text not null default 'text' check (kind in ('text', 'blob')),
  content     text not null default '',        -- isi untuk kind = text; blob disimpan di Storage
  hash        text not null,
  deleted     boolean not null default false,  -- tombstone, supaya penghapusan ikut tersinkron
  updated_at  timestamptz not null default now(),
  primary key (user_id, vault_id, path)
);

create index if not exists noto_files_vault_idx on public.noto_files (vault_id, updated_at desc);

alter table public.noto_vaults enable row level security;
alter table public.noto_files  enable row level security;

drop policy if exists "vaults: pemilik" on public.noto_vaults;
create policy "vaults: pemilik" on public.noto_vaults
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "files: pemilik" on public.noto_files;
create policy "files: pemilik" on public.noto_files
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Lampiran (gambar, PDF) → Storage privat. Path objek: <user_id>/<vault_id>/<path>
insert into storage.buckets (id, name, public)
values ('noto-attachments', 'noto-attachments', false)
on conflict (id) do nothing;

drop policy if exists "attachments: baca milik sendiri" on storage.objects;
create policy "attachments: baca milik sendiri" on storage.objects
  for select using (bucket_id = 'noto-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "attachments: tulis milik sendiri" on storage.objects;
create policy "attachments: tulis milik sendiri" on storage.objects
  for insert with check (bucket_id = 'noto-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "attachments: ubah milik sendiri" on storage.objects;
create policy "attachments: ubah milik sendiri" on storage.objects
  for update using (bucket_id = 'noto-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "attachments: hapus milik sendiri" on storage.objects;
create policy "attachments: hapus milik sendiri" on storage.objects
  for delete using (bucket_id = 'noto-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
