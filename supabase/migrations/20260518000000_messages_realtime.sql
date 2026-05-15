-- Enable Supabase Realtime for direct messages (inbox + thread views).
-- FULL replica identity so UPDATE/DELETE filters (e.g. thread_id) receive old row values.

alter table if exists public.messages replica identity full;
alter table if exists public.message_reactions replica identity full;
alter table if exists public.message_hidden_for_users replica identity full;
alter table if exists public.message_thread_participants replica identity full;

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
        and c.relname = 'messages'
    ) then
      alter publication supabase_realtime add table public.messages;
    end if;

    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      where p.pubname = 'supabase_realtime'
        and n.nspname = 'public'
        and c.relname = 'message_reactions'
    ) then
      alter publication supabase_realtime add table public.message_reactions;
    end if;

    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      where p.pubname = 'supabase_realtime'
        and n.nspname = 'public'
        and c.relname = 'message_hidden_for_users'
    ) then
      alter publication supabase_realtime add table public.message_hidden_for_users;
    end if;

    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      where p.pubname = 'supabase_realtime'
        and n.nspname = 'public'
        and c.relname = 'message_thread_participants'
    ) then
      alter publication supabase_realtime add table public.message_thread_participants;
    end if;
  end if;
end $$;
