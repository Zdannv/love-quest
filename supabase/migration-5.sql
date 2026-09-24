-- Love Quest — tahap 5: akun pembeli cuma dibuat owner (lewat halaman /owner).
-- Jalankan SEKALI di Supabase → SQL Editor (setelah migration-4.sql).

-- Pembeli nggak bisa bikin game sendiri lagi dari CMS (bikinnya lewat edge function owner-accounts)
revoke insert on public.couples from authenticated;

-- Jaga-jaga: kalau ada game yang kebikin di luar halaman owner, langsung terkunci
-- sampai owner aktifkan (nggak ada masa coba lagi).
create or replace function public.couples_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.paid_until  := public.today_wib() - 1;
  new.plan        := 'basic';
  new.active      := true;
  new.note        := null;
  new.owner_email := (select email from auth.users where id = new.owner);
  return new;
end $$;
