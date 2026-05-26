-- Inbox realtime: per-user fan-out events so clients subscribe with user_id filter
-- instead of listening to every row in public.messages.

create table if not exists public.message_inbox_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  thread_id uuid not null references public.message_threads (id) on delete cascade,
  event_kind text not null check (event_kind in ('message', 'participant')),
  created_at timestamptz not null default now()
);

create index if not exists message_inbox_events_user_id_id_idx
  on public.message_inbox_events (user_id, id desc);

create index if not exists message_inbox_events_created_at_idx
  on public.message_inbox_events (created_at);

alter table public.message_inbox_events enable row level security;

drop policy if exists "message_inbox_events_select_own" on public.message_inbox_events;
create policy "message_inbox_events_select_own"
on public.message_inbox_events
for select
to authenticated
using (user_id = auth.uid());

revoke all on table public.message_inbox_events from public;
grant select on table public.message_inbox_events to authenticated;

create or replace function public.fanout_message_inbox_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread_id uuid;
begin
  v_thread_id := coalesce(new.thread_id, old.thread_id);
  if v_thread_id is null then
    return coalesce(new, old);
  end if;

  insert into public.message_inbox_events (user_id, thread_id, event_kind)
  select mtp.user_id, v_thread_id, 'message'
  from public.message_thread_participants mtp
  where mtp.thread_id = v_thread_id;

  delete from public.message_inbox_events e
  where e.created_at < now() - interval '6 hours';

  return coalesce(new, old);
end;
$$;

create or replace function public.fanout_participant_inbox_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and old.last_read_message_at is not distinct from new.last_read_message_at
    and old.joined_at is not distinct from new.joined_at then
    return new;
  end if;

  insert into public.message_inbox_events (user_id, thread_id, event_kind)
  values (new.user_id, new.thread_id, 'participant');

  delete from public.message_inbox_events e
  where e.created_at < now() - interval '6 hours';

  return new;
end;
$$;

drop trigger if exists fanout_message_inbox_events_trg on public.messages;
create trigger fanout_message_inbox_events_trg
after insert or update or delete on public.messages
for each row
execute function public.fanout_message_inbox_events();

drop trigger if exists fanout_participant_inbox_events_ins_trg on public.message_thread_participants;
create trigger fanout_participant_inbox_events_ins_trg
after insert on public.message_thread_participants
for each row
execute function public.fanout_participant_inbox_events();

drop trigger if exists fanout_participant_inbox_events_upd_trg on public.message_thread_participants;
create trigger fanout_participant_inbox_events_upd_trg
after update on public.message_thread_participants
for each row
execute function public.fanout_participant_inbox_events();

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
        and c.relname = 'message_inbox_events'
    ) then
      alter publication supabase_realtime add table public.message_inbox_events;
    end if;
  end if;
end $$;

comment on table public.message_inbox_events is
  'Realtime fan-out for inbox: one row per participant per message/participant change; subscribe with user_id filter.';

notify pgrst, 'reload schema';
