-- Reactions for direct messages.

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (char_length(trim(reaction)) > 0),
  created_at timestamptz not null default now()
);

create unique index if not exists message_reactions_unique_idx
  on public.message_reactions (message_id, user_id, reaction);

create index if not exists message_reactions_message_idx
  on public.message_reactions (message_id, created_at desc);

alter table if exists public.message_reactions enable row level security;

drop policy if exists "message_reactions_select_participants" on public.message_reactions;
create policy "message_reactions_select_participants"
on public.message_reactions
for select
to authenticated
using (
  exists (
    select 1
    from public.messages m
    join public.message_thread_participants mtp
      on mtp.thread_id = m.thread_id
    where m.id = message_reactions.message_id
      and mtp.user_id = auth.uid()
  )
);

drop policy if exists "message_reactions_insert_own" on public.message_reactions;
create policy "message_reactions_insert_own"
on public.message_reactions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.messages m
    join public.message_thread_participants mtp
      on mtp.thread_id = m.thread_id
    where m.id = message_reactions.message_id
      and mtp.user_id = auth.uid()
  )
);

drop policy if exists "message_reactions_delete_own" on public.message_reactions;
create policy "message_reactions_delete_own"
on public.message_reactions
for delete
to authenticated
using (user_id = auth.uid());
