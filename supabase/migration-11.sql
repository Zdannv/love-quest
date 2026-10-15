-- Love Quest — tahap 11: 🏷️ kode promo (11.11, 12.12, tanggal kembar, dll.), diatur dari halaman /owner.
-- Jalankan SEKALI di Supabase → SQL Editor (setelah migration-10.sql).
create table if not exists public.promo_codes (
  code       text primary key check (code ~ '^[A-Z0-9]{3,20}$'),
  kind       text not null default 'amount' check (kind in ('amount', 'percent')), -- potongan rupiah / persen
  value      integer not null check (value > 0),
  plans      text[] not null default array['basic', 'custom'],                  -- paket yang boleh pakai
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz not null,
  max_uses   integer,                     -- kosong = nggak dibatasi
  used       integer not null default 0,  -- dihitung pas pembayaran lunas
  active     boolean not null default true,
  banner     text,                        -- kalau diisi: tampil sebagai pita promo di halaman depan
  note       text,
  created_at timestamptz not null default now()
);
alter table public.promo_codes enable row level security; -- tanpa policy: cuma lewat fungsi di bawah
alter table public.orders add column if not exists promo_code text;
alter table public.orders add column if not exists discount integer not null default 0;

-- Harga per paket (harus sama dengan edge function checkout)
create or replace function public.promo_price(p_plan text) returns integer language sql immutable as $$
  select case p_plan when 'basic' then 29000 when 'custom' then 49000 when 'upgrade' then 20000 else null end;
$$;

-- Cek kode promo (dipanggil halaman /bayar & edge function). Harga akhir minimal Rp1.000.
create or replace function public.promo_check(p_code text, p_plan text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p public.promo_codes; price integer := public.promo_price(p_plan); disc integer;
begin
  if price is null then return jsonb_build_object('ok', false, 'message', 'Paket nggak dikenal'); end if;
  select * into p from public.promo_codes where code = upper(trim(coalesce(p_code, '')));
  if not found or not p.active then return jsonb_build_object('ok', false, 'message', 'Kode promo nggak ditemukan'); end if;
  if now() < p.starts_at then return jsonb_build_object('ok', false, 'message', 'Promo ini belum mulai'); end if;
  if now() > p.ends_at then return jsonb_build_object('ok', false, 'message', 'Promo ini udah berakhir'); end if;
  if p.max_uses is not null and p.used >= p.max_uses then return jsonb_build_object('ok', false, 'message', 'Kuota promo ini udah habis'); end if;
  if not (p_plan = any(p.plans)) then return jsonb_build_object('ok', false, 'message', 'Kode ini nggak berlaku buat paket yang dipilih'); end if;
  disc := case p.kind when 'percent' then (price * least(p.value, 90)) / 100 else p.value end;
  disc := least(disc, price - 1000);
  return jsonb_build_object('ok', true, 'code', p.code, 'discount', disc, 'price', price, 'final', price - disc,
    'message', format('Hemat Rp%s 🎉', to_char(disc, 'FM999G999G999')));
end $$;
revoke all on function public.promo_check(text, text) from public;
grant execute on function public.promo_check(text, text) to anon, authenticated, service_role;

-- Pita promo di halaman depan: promo aktif yang punya teks banner
create or replace function public.promo_banner()
returns table (code text, banner text, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select code, banner, ends_at from public.promo_codes
  where active and banner is not null and banner <> '' and now() between starts_at and ends_at
    and (max_uses is null or used < max_uses)
  order by ends_at limit 1;
$$;
revoke all on function public.promo_banner() from public;
grant execute on function public.promo_banner() to anon, authenticated;

-- Dipanggil edge function pas pembayaran lunas
create or replace function public.promo_use(p_code text) returns void
language sql security definer set search_path = public as $$
  update public.promo_codes set used = used + 1 where code = upper(p_code);
$$;
revoke all on function public.promo_use(text) from public;
grant execute on function public.promo_use(text) to service_role;

-- Buat halaman /owner (admin saja)
create or replace function public.admin_list_promos() returns setof public.promo_codes
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'bukan admin'; end if;
  return query select * from public.promo_codes order by created_at desc;
end $$;
create or replace function public.admin_save_promo(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'bukan admin'; end if;
  insert into public.promo_codes (code, kind, value, plans, starts_at, ends_at, max_uses, active, banner, note)
  values (upper(trim(p->>'code')), coalesce(p->>'kind', 'amount'), (p->>'value')::int,
          coalesce(array(select jsonb_array_elements_text(p->'plans')), array['basic', 'custom']),
          coalesce((p->>'starts_at')::timestamptz, now()), (p->>'ends_at')::timestamptz,
          nullif(p->>'max_uses', '')::int, coalesce((p->>'active')::boolean, true), nullif(p->>'banner', ''), nullif(p->>'note', ''))
  on conflict (code) do update set kind = excluded.kind, value = excluded.value, plans = excluded.plans,
    starts_at = excluded.starts_at, ends_at = excluded.ends_at, max_uses = excluded.max_uses,
    active = excluded.active, banner = excluded.banner, note = excluded.note;
end $$;
create or replace function public.admin_delete_promo(p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'bukan admin'; end if;
  delete from public.promo_codes where code = upper(p_code);
end $$;
revoke all on function public.admin_list_promos() from public;
revoke all on function public.admin_save_promo(jsonb) from public;
revoke all on function public.admin_delete_promo(text) from public;
grant execute on function public.admin_list_promos() to authenticated;
grant execute on function public.admin_save_promo(jsonb) to authenticated;
grant execute on function public.admin_delete_promo(text) to authenticated;
