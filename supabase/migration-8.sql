-- Love Quest — tahap 8: 💳 bayar otomatis (Midtrans). Pesanan disimpen di sini, cuma bisa diakses
-- edge function "checkout" (pakai service role). Pembeli nggak bisa baca/ubah tabel ini langsung.
-- Jalankan SEKALI di Supabase → SQL Editor (setelah migration-7.sql).

create table if not exists public.orders (
  id          text primary key,                 -- order_id Midtrans, contoh LQ-20261015-ab12cd
  plan        text not null check (plan in ('basic', 'custom')),
  amount      integer not null,
  email       text not null,
  names       jsonb not null default '{}'::jsonb,
  token_hash  text not null,                    -- sha256 kode rahasia di HP pembeli (buat ambil login setelah bayar)
  status      text not null default 'pending',  -- pending | paid | failed | need_help
  pay_status  text,                             -- status terakhir dari Midtrans (settlement, expire, dll.)
  couple_id   uuid references public.couples(id) on delete set null,
  slug        text,
  note        text,
  claimed     integer not null default 0,       -- berapa kali login diambil (tiap ambil = password baru)
  created_at  timestamptz not null default now(),
  paid_at     timestamptz
);
alter table public.orders enable row level security;  -- tanpa policy: anon & user biasa nggak bisa akses sama sekali
create index if not exists orders_email_idx on public.orders (email);

-- Owner bisa lihat daftar pesanan dari SQL Editor:
--   select id, plan, amount, email, status, pay_status, slug, created_at, paid_at from public.orders order by created_at desc;
