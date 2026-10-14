-- Love Quest — tahap 9: owner bisa lihat daftar pembayaran otomatis (Midtrans) di halaman /owner.
-- + pesanan upgrade ke Premium (Rp20.000) dari CMS.
-- Jalankan SEKALI di Supabase → SQL Editor (setelah migration-8.sql).
alter table public.orders drop constraint if exists orders_plan_check;
alter table public.orders add constraint orders_plan_check check (plan in ('basic', 'custom', 'upgrade'));
create or replace function public.admin_list_orders()
returns table (id text, plan text, amount integer, email text, names jsonb, status text, pay_status text,
               slug text, note text, claimed integer, created_at timestamptz, paid_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'bukan admin'; end if;
  return query
    select o.id, o.plan, o.amount, o.email, o.names, o.status, o.pay_status, o.slug, o.note, o.claimed, o.created_at, o.paid_at
    from public.orders o order by o.created_at desc limit 200;
end $$;
revoke all on function public.admin_list_orders() from public;
grant execute on function public.admin_list_orders() to authenticated;
