-- Love Quest — tahap 7: 🐾 Peliharaan Kita (satu peliharaan bareng per pasangan, disimpen sebagai JSON).
-- Jalankan SEKALI di Supabase → SQL Editor (setelah migration-6.sql).
-- Aksesnya pakai slug link pasangan, sama kayak streak (record_play/get_plays).

create table if not exists public.pets (
  couple_id  uuid primary key references public.couples(id) on delete cascade,
  state      jsonb       not null,
  updated_at timestamptz not null default now()
);
alter table public.pets enable row level security;

create or replace function public.pet_get(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select state from public.pets where couple_id = public.active_couple_id(p_slug);
$$;

create or replace function public.pet_save(p_slug text, p_state jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare cid uuid := public.active_couple_id(p_slug);
begin
  if cid is null or char_length(p_state::text) > 20000 then return false; end if;
  insert into public.pets (couple_id, state, updated_at) values (cid, p_state, now())
  on conflict (couple_id) do update set state = excluded.state, updated_at = now();
  return true;
end $$;

revoke all on function public.pet_get(text) from public;
revoke all on function public.pet_save(text, jsonb) from public;
grant execute on function public.pet_get(text) to anon, authenticated;
grant execute on function public.pet_save(text, jsonb) to anon, authenticated;
