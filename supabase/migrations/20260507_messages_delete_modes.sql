-- Message delete modes:
-- 1) delete for everyone -> physical delete from public.messages
-- 2) delete for me -> hide message for current user only

create table if not exists public.message_hidden_for_users (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists message_hidden_for_users_user_idx
  on public.message_hidden_for_users (user_id, hidden_at desc);

alter table if exists public.message_hidden_for_users enable row level security;

drop policy if exists "message_hidden_for_users_select_own" on public.message_hidden_for_users;
create policy "message_hidden_for_users_select_own"
on public.message_hidden_for_users
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "message_hidden_for_users_insert_own" on public.message_hidden_for_users;
create policy "message_hidden_for_users_insert_own"
on public.message_hidden_for_users
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.messages m
    join public.message_thread_participants mtp
      on mtp.thread_id = m.thread_id
    where m.id = message_hidden_for_users.message_id
      and m.sender_id = auth.uid()
      and mtp.user_id = auth.uid()
  )
);

drop policy if exists "message_hidden_for_users_delete_own" on public.message_hidden_for_users;
create policy "message_hidden_for_users_delete_own"
on public.message_hidden_for_users
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "messages_select_for_participants" on public.messages;
create policy "messages_select_for_participants"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.message_thread_participants mtp
    where mtp.thread_id = messages.thread_id
      and mtp.user_id = auth.uid()
  )
  and not exists (
    select 1
    from public.message_hidden_for_users mh
    where mh.message_id = messages.id
      and mh.user_id = auth.uid()
  )
);

drop policy if exists "messages_delete_sender_participant" on public.messages;
create policy "messages_delete_sender_participant"
on public.messages
for delete
to authenticated
using (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.message_thread_participants mtp
    where mtp.thread_id = messages.thread_id
      and mtp.user_id = auth.uid()
  )
);
