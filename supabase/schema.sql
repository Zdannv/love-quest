-- Love Quest (CMS) — jalankan sekali di Supabase → SQL Editor.
-- Satu baris `couples` = satu game milik satu pembeli.

create table if not exists public.couples (
  id         uuid        primary key default gen_random_uuid(),
  owner      uuid        not null unique references auth.users (id) on delete cascade,
  slug       text        not null unique check (slug ~ '^[a-z0-9]{10,32}$'),
  content    jsonb       not null default '{}'::jsonb,
  active     boolean     not null default true,   -- nanti dipakai buat status langganan
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.couples enable row level security;

-- Pembeli cuma bisa lihat, bikin, dan ubah game miliknya sendiri
create policy "couples: lihat punya sendiri" on public.couples
  for select to authenticated using (owner = auth.uid());
create policy "couples: bikin punya sendiri" on public.couples
  for insert to authenticated with check (owner = auth.uid());
create policy "couples: ubah punya sendiri" on public.couples
  for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

grant select, insert, update on public.couples to authenticated;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists couples_touch on public.couples;
create trigger couples_touch before update on public.couples
  for each row execute function public.touch_updated_at();

-- Game (tanpa login) ambil isi lewat kode rahasianya saja.
-- Nggak ada cara buat melihat daftar semua game.
create or replace function public.get_couple(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select content from public.couples where slug = p_slug and active limit 1;
$$;

revoke all on function public.get_couple(text) from public;
grant execute on function public.get_couple(text) to anon, authenticated;

-- Foto: bucket publik (bisa dibuka lewat link), tapi cuma pemilik yang bisa upload/hapus
-- di folder miliknya sendiri: <id user>/<nama file>
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "photos: upload punya sendiri" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos: ganti punya sendiri" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos: hapus punya sendiri" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos: lihat daftar punya sendiri" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
