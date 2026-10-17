-- Love Quest — tahap 13: ⚙️ pengaturan web dari halaman /owner (harga, isi paket, pengumuman, kontak, testimoni)
-- + laporan mingguan otomatis. Jalankan SEKALI di Supabase → SQL Editor (setelah migration-12.sql).

create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security; -- tanpa policy: cuma lewat fungsi di bawah

-- Nilai awal (sama dengan yang sekarang tampil di web)
insert into public.site_settings (key, value) values
  ('prices', '{"basic": 29000, "custom": 49000, "upgrade": 20000}'),
  ('contact', '{"whatsapp": "6285136086902", "email": "zdannfoo@gmail.com", "hours": "Setiap hari, 09.00–21.00 WIB", "instagram": "", "tiktok": ""}'),
  ('announcement', '{"text": "", "where": "both", "until": null}'),
  ('testimonials', '[]')
on conflict (key) do nothing;

-- Dibaca web (anon): semua pengaturan publik sekaligus
create or replace function public.get_site_settings() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from public.site_settings
  where key in ('prices', 'packages', 'contact', 'announcement', 'testimonials');
$$;
revoke all on function public.get_site_settings() from public;
grant execute on function public.get_site_settings() to anon, authenticated;

create or replace function public.admin_set_setting(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'bukan admin'; end if;
  if p_key not in ('prices', 'packages', 'contact', 'announcement', 'testimonials') then raise exception 'pengaturan nggak dikenal'; end if;
  if p_key = 'prices' and (
    coalesce((p_value->>'basic')::int, 0) < 1000 or coalesce((p_value->>'custom')::int, 0) < 1000 or coalesce((p_value->>'upgrade')::int, 0) < 1000
  ) then raise exception 'harga minimal Rp1.000'; end if;
  insert into public.site_settings (key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;
revoke all on function public.admin_set_setting(text, jsonb) from public;
grant execute on function public.admin_set_setting(text, jsonb) to authenticated;

-- Harga promo ikut harga dari pengaturan
create or replace function public.promo_price(p_plan text) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select (value->>p_plan)::int from public.site_settings where key = 'prices'),
    case p_plan when 'basic' then 29000 when 'custom' then 49000 when 'upgrade' then 20000 end);
$$;

-- Laporan mingguan: tiap Senin 07.00 WIB (00:00 UTC) panggil edge function "owner-report".
-- Ganti ISI_CRON_SECRET dengan nilai CRON_SECRET yang sama dengan di Edge Function Secrets.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule(
  'owner-report-senin',
  '0 0 * * 1',
  $$
  select net.http_post(
    url     := 'https://paymeqnshhmjqypergji.supabase.co/functions/v1/owner-report',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'ISI_CRON_SECRET'),
    body    := '{}'::jsonb
  );
  $$
);
