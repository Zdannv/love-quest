-- Love Quest — tahap 6: logo aplikasi dari foto (paket Premium).
-- Jalankan SEKALI di Supabase → SQL Editor (setelah migration-5.sql).

create or replace function public.get_couple(p_slug text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'status', case
      when not active then 'inactive'
      when paid_until is not null and paid_until < public.today_wib() then 'expired'
      else 'ok' end,
    'content', case
      when active and (paid_until is null or paid_until >= public.today_wib()) then
        -- tema, karakter, lagu, foto muka & logo aplikasi cuma berlaku di paket Premium
        case when plan = 'custom' then content
             else (content - 'theme' - 'characters' - 'music') #- '{photos,faces}' #- '{photos,icon}' end
      end
  )
  from public.couples where slug = p_slug limit 1;
$$;
revoke all on function public.get_couple(text) from public;
grant execute on function public.get_couple(text) to anon, authenticated;
