-- Love Quest — tahap 10: 📊 statistik corong penjualan (anonim, cuma hitungan per hari, tanpa data pribadi).
-- Jalankan SEKALI di Supabase → SQL Editor (setelah migration-9.sql).
create table if not exists public.event_counts (
  day  date not null,
  name text not null,
  n    integer not null default 0,
  primary key (day, name)
);
alter table public.event_counts enable row level security; -- tanpa policy: cuma lewat fungsi di bawah

-- Dipanggil dari web (anon): nambah 1 ke hitungan hari ini. Nama event dibatasi biar tabelnya nggak bisa diisi sembarangan.
create or replace function public.track_event(p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_name not in ('landing_view', 'try_click', 'paket_open', 'bayar_view', 'bayar_submit', 'bayar_paid', 'game_open', 'upgrade_click') then return; end if;
  insert into public.event_counts (day, name, n) values ((now() at time zone 'Asia/Jakarta')::date, p_name, 1)
  on conflict (day, name) do update set n = public.event_counts.n + 1;
end $$;
revoke all on function public.track_event(text) from public;
grant execute on function public.track_event(text) to anon, authenticated;

-- Buat halaman /owner (admin saja)
create or replace function public.admin_event_counts(p_days integer default 30)
returns table (day date, name text, n integer)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'bukan admin'; end if;
  return query select e.day, e.name, e.n from public.event_counts e
    where e.day > (now() at time zone 'Asia/Jakarta')::date - greatest(1, least(p_days, 365)) order by e.day;
end $$;
revoke all on function public.admin_event_counts(integer) from public;
grant execute on function public.admin_event_counts(integer) to authenticated;
