-- ============================================================
-- NOTO v2 — Schema Supabase (GRATIS)
-- Cara pakai:
--   1. Buka https://supabase.com → Sign up (gratis) → New project
--   2. Setelah project jadi, buka menu "SQL Editor" (ikon >_ di sidebar kiri)
--   3. Klik "New query" → copy SEMUA isi file ini → klik "Run"
--   4. Selesai! Tabel siap dipakai aplikasi Noto (web & APK).
-- ============================================================

-- ─── CATATAN ────────────────────────────────────────────────
create table if not exists public.notes (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Catatan tanpa judul',
  content text default '',
  tags jsonb default '[]'::jsonb,
  pinned boolean default false,
  color text default '',
  created_at timestamptz,
  updated_at timestamptz,
  deleted boolean default false
);

-- ─── DAFTAR TUGAS ───────────────────────────────────────────
create table if not exists public.todo_lists (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text default '#f97316',
  emoji text default '📋',
  sort_order int default 0,
  created_at timestamptz,
  updated_at timestamptz,
  deleted boolean default false
);

-- ─── TUGAS ──────────────────────────────────────────────────
create table if not exists public.todos (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text default '',
  done boolean default false,
  priority int default 1,          -- 0 = rendah, 1 = sedang, 2 = tinggi
  due_date timestamptz,
  reminder_at timestamptz,
  list_id text,
  tags jsonb default '[]'::jsonb,
  sort_order int default 0,
  created_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz,
  deleted boolean default false
);

-- ─── PAPAN KANVAS ───────────────────────────────────────────
create table if not exists public.boards (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text default 'Papan tanpa nama',
  data jsonb default '{"items":[],"edges":[]}'::jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  deleted boolean default false
);

-- ─── RINGKASAN WIDGET (dibaca widget Android) ───────────────
create table if not exists public.widget_summary (
  user_id uuid primary key references auth.users(id) on delete cascade,
  todos_text text default '',
  todo_count int default 0,
  todo_done int default 0,          -- jumlah tugas selesai (untuk progress bar widget)
  todo_total int default 0,         -- jumlah semua tugas
  theme_json jsonb default '{}'::jsonb,  -- warna tema aplikasi → widget ikut tema
  widget_token uuid not null default gen_random_uuid(),
  updated_at timestamptz not null default now()
);

-- ─── INDEKS PENDUKUNG SINKRONISASI ──────────────────────────
create index if not exists notes_user_updated_idx on public.notes (user_id, updated_at);
create index if not exists todo_lists_user_updated_idx on public.todo_lists (user_id, updated_at);
create index if not exists todos_user_updated_idx on public.todos (user_id, updated_at);
create index if not exists boards_user_updated_idx on public.boards (user_id, updated_at);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Tiap user HANYA bisa melihat & mengubah data miliknya sendiri.
-- ============================================================
alter table public.notes enable row level security;
alter table public.todo_lists enable row level security;
alter table public.todos enable row level security;
alter table public.boards enable row level security;
alter table public.widget_summary enable row level security;

-- Kebijakan umum: pemilik data (login via email OTP)
create policy "note_owner_all" on public.notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "list_owner_all" on public.todo_lists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "todo_owner_all" on public.todos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "board_owner_all" on public.boards for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "widget_owner_all" on public.widget_summary for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Kebijakan khusus widget: aplikasi widget boleh MEMBACA ringkasan
-- asalkan membawa token rahasia di header x-widget-token
create policy "widget_read_by_token" on public.widget_summary for select using (
  widget_token::text = coalesce(current_setting('request.headers', true)::json->>'x-widget-token', '')
);

-- Selesai! Lanjut: salin Project URL & anon key ke aplikasi Noto
-- (Pengaturan → Cloud & Sinkronisasi).
