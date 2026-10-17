-- Love Quest — tahap 12: 🐾 paket biasa cuma bisa pelihara kucing, Premium bebas pilih semua hewan.
-- Jalankan SEKALI di Supabase → SQL Editor (setelah migration-11.sql).

-- get_couple sekarang ikut ngasih tahu paketnya (dipakai game buat ngunci pilihan hewan)
create or replace function public.get_couple(p_slug text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'status', case
      when not active then 'inactive'
      when paid_until is not null and paid_until < public.today_wib() then 'expired'
      else 'ok' end,
    'plan', plan,
    'content', case
      when active and (paid_until is null or paid_until >= public.today_wib()) then
        case when plan = 'custom' then content
             else (content - 'theme' - 'characters' - 'music') #- '{photos,faces}' end
      end
  )
  from public.couples where slug = p_slug limit 1;
$$;

-- pet_save: paket biasa nggak boleh ganti ke hewan selain kucing.
-- Yang udah terlanjur punya hewan lain sebelum aturan ini tetap boleh (nggak dipaksa ganti).
create or replace function public.pet_save(p_slug text, p_state jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare cid uuid := public.active_couple_id(p_slug); pl text; old_kind text; new_kind text := p_state->>'kind';
begin
  if cid is null or char_length(p_state::text) > 20000 then return false; end if;
  select plan into pl from public.couples where id = cid;
  select state->>'kind' into old_kind from public.pets where couple_id = cid;
  if pl <> 'custom' and new_kind is not null and new_kind <> 'kucing' and new_kind is distinct from old_kind then return false; end if;
  insert into public.pets (couple_id, state, updated_at) values (cid, p_state, now())
  on conflict (couple_id) do update set state = excluded.state, updated_at = now();
  return true;
end $$;
