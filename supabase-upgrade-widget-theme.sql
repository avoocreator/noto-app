-- ============================================================
-- NOTO — Upgrade widget (tema ikut aplikasi + progress bar)
-- Untuk kamu yang SUDAH pernah menjalankan supabase-schema.sql
-- versi lama. Jalankan SEKALI di Supabase SQL Editor → Run.
-- (Schema baru tidak perlu file ini — kolomnya sudah ada.)
-- ============================================================

alter table public.widget_summary add column if not exists todo_done int default 0;
alter table public.widget_summary add column if not exists todo_total int default 0;
alter table public.widget_summary add column if not exists theme_json jsonb default '{}'::jsonb;

-- Selesai! Setelah ini buka aplikasi Noto → tunggu sinkron otomatis
-- → tekan tombol ⟳ di widget: warnanya sekarang mengikuti tema aplikasi.
