-- Love Quest — tahap 3: streak tetap kecatat walau mainnya pas offline.
-- Jalankan SEKALI di Supabase → SQL Editor (setelah migration-2.sql).
-- record_play sekarang boleh dikasih tanggal mainnya (maks 1 hari ke belakang / ke depan dari hari ini WIB).

drop function if exists public.record_play(text, text);

create or replace function public.record_play(p_slug text, p_player text, p_day date default null)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public.active_couple_id(p_slug);
  d date := coalesce(p_day, public.today_wib());
  n int;
begin
  if cid is null or p_player not in ('pasangan', 'pengirim') then return false; end if;
  if d < public.today_wib() - 1 or d > public.today_wib() + 1 then return false; end if;
  insert into public.plays (couple_id, player, day) values (cid, p_player, d)
  on conflict do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke all on function public.record_play(text, text, date) from public;
grant execute on function public.record_play(text, text, date) to anon, authenticated;
