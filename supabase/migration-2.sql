-- Love Quest — tahap 2: langganan manual, halaman owner, tema & karakter, streak per pasangan.
-- Jalankan SEKALI di Supabase → SQL Editor (setelah schema.sql).
-- Di paling bawah ada 1 baris yang perlu kamu ganti email-nya (buat jadi admin/owner).

-- =====================================================================
-- 1) LANGGANAN
-- =====================================================================
alter table public.couples add column if not exists owner_email text;
alter table public.couples add column if not exists plan text not null default 'basic';
alter table public.couples add column if not exists paid_until date;
alter table public.couples add column if not exists note text;
alter table public.couples drop constraint if exists couples_plan_check;
alter table public.couples add constraint couples_plan_check check (plan in ('basic', 'custom'));

create or replace function public.today_wib() returns date
language sql stable as $$ select (now() at time zone 'Asia/Jakarta')::date $$;

-- Game baru otomatis dapat masa coba 3 hari. Pembeli nggak bisa ngatur ini sendiri.
create or replace function public.couples_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.paid_until  := public.today_wib() + 3;
  new.plan        := 'basic';
  new.active      := true;
  new.note        := null;
  new.owner_email := (select email from auth.users where id = new.owner);
  return new;
end $$;

drop trigger if exists couples_insert on public.couples;
create trigger couples_insert before insert on public.couples
  for each row execute function public.couples_before_insert();

-- Game yang sudah ada sebelum migrasi ini: kasih masa coba juga
update public.couples set paid_until = public.today_wib() + 3 where paid_until is null;
update public.couples c set owner_email = u.email from auth.users u where u.id = c.owner and c.owner_email is null;

-- Pembeli cuma boleh mengisi/mengubah ISI game, bukan status langganan
revoke all on public.couples from anon;
revoke insert, update on public.couples from authenticated;
grant insert (owner, slug, content) on public.couples to authenticated;
grant update (content) on public.couples to authenticated;

-- Game ambil isi + status langganannya
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
        -- tema & karakter cuma berlaku di paket custom
        case when plan = 'custom' then content else content - 'theme' - 'characters' end
      end
  )
  from public.couples where slug = p_slug limit 1;
$$;
revoke all on function public.get_couple(text) from public;
grant execute on function public.get_couple(text) to anon, authenticated;

-- =====================================================================
-- 2) ADMIN / OWNER (kamu)
-- =====================================================================
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security; -- sengaja tanpa policy

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.admin_list_couples()
returns table (id uuid, slug text, owner_email text, names jsonb, plan text, paid_until date,
               active boolean, note text, created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'bukan admin'; end if;
  return query
    select c.id, c.slug, c.owner_email, c.content -> 'names', c.plan, c.paid_until,
           c.active, c.note, c.created_at, c.updated_at
    from public.couples c order by c.created_at desc;
end $$;

create or replace function public.admin_update_couple(p_id uuid, p_plan text, p_paid_until date, p_active boolean, p_note text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'bukan admin'; end if;
  update public.couples
     set plan = p_plan, paid_until = p_paid_until, active = p_active, note = p_note
   where id = p_id;
end $$;

revoke all on function public.is_admin() from public;
revoke all on function public.admin_list_couples() from public;
revoke all on function public.admin_update_couple(uuid, text, date, boolean, text) from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_list_couples() to authenticated;
grant execute on function public.admin_update_couple(uuid, text, date, boolean, text) to authenticated;

-- =====================================================================
-- 3) STREAK & NOTIFIKASI PER PASANGAN
--    Semua akses lewat fungsi di bawah (cek kode game + langganan aktif).
-- =====================================================================
create table if not exists public.plays (
  couple_id  uuid        not null references public.couples (id) on delete cascade,
  player     text        not null check (player in ('pasangan', 'pengirim')),
  day        date        not null,
  created_at timestamptz not null default now(),
  primary key (couple_id, player, day)
);
alter table public.plays enable row level security;

create table if not exists public.push_subscriptions (
  endpoint   text        primary key,
  couple_id  uuid        not null references public.couples (id) on delete cascade,
  player     text        not null check (player in ('pasangan', 'pengirim')),
  p256dh     text        not null,
  auth       text        not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

create table if not exists public.notify_log (
  couple_id  uuid        not null references public.couples (id) on delete cascade,
  day        date        not null,
  kind       text        not null,
  player     text        not null,
  created_at timestamptz not null default now(),
  primary key (couple_id, day, kind, player)
);
alter table public.notify_log enable row level security;

create or replace function public.active_couple_id(p_slug text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.couples
   where slug = p_slug and active and (paid_until is null or paid_until >= public.today_wib())
   limit 1;
$$;

-- Catat "sudah main hari ini". Balikannya true kalau ini catatan pertama hari ini.
create or replace function public.record_play(p_slug text, p_player text) returns boolean
language plpgsql security definer set search_path = public as $$
declare cid uuid := public.active_couple_id(p_slug); n int;
begin
  if cid is null or p_player not in ('pasangan', 'pengirim') then return false; end if;
  insert into public.plays (couple_id, player, day) values (cid, p_player, public.today_wib())
  on conflict do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;

create or replace function public.get_plays(p_slug text)
returns table (player text, day date)
language sql stable security definer set search_path = public as $$
  select p.player, p.day from public.plays p
   where p.couple_id = public.active_couple_id(p_slug) and p.day >= public.today_wib() - 120
   order by p.day desc;
$$;

create or replace function public.save_push(p_slug text, p_player text, p_endpoint text, p_p256dh text, p_auth text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare cid uuid := public.active_couple_id(p_slug);
begin
  if cid is null or p_player not in ('pasangan', 'pengirim') then return false; end if;
  insert into public.push_subscriptions (endpoint, couple_id, player, p256dh, auth)
  values (p_endpoint, cid, p_player, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set couple_id = excluded.couple_id, player = excluded.player, p256dh = excluded.p256dh, auth = excluded.auth;
  return true;
end $$;

revoke all on function public.active_couple_id(text) from public;
revoke all on function public.record_play(text, text) from public;
revoke all on function public.get_plays(text) from public;
revoke all on function public.save_push(text, text, text, text, text) from public;
grant execute on function public.record_play(text, text) to anon, authenticated;
grant execute on function public.get_plays(text) to anon, authenticated;
grant execute on function public.save_push(text, text, text, text, text) to anon, authenticated;

-- =====================================================================
-- 4) JADIKAN KAMU ADMIN — ganti email di bawah dengan email akun CMS kamu
-- =====================================================================
insert into public.admins (user_id)
select id from auth.users where email = 'GANTI_DENGAN_EMAIL_KAMU'
on conflict do nothing;
