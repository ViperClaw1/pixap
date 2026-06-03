-- Enable Supabase Realtime for booking cards.
-- The Bookings screen derives display status from both bookings and linked cart_items.

alter table if exists public.bookings replica identity full;
alter table if exists public.cart_items replica identity full;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      where p.pubname = 'supabase_realtime'
        and n.nspname = 'public'
        and c.relname = 'bookings'
    ) then
      alter publication supabase_realtime add table public.bookings;
    end if;

    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      where p.pubname = 'supabase_realtime'
        and n.nspname = 'public'
        and c.relname = 'cart_items'
    ) then
      alter publication supabase_realtime add table public.cart_items;
    end if;
  end if;
end $$;
