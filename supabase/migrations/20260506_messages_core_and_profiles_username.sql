-- Messages core entities + public username in profiles/public_profiles.

alter table if exists public.profiles
  add column if not exists username text;

update public.profiles
set username = lower(
  regexp_replace(
    coalesce(nullif(split_part(email, '@', 1), ''), left(id::text, 8)),
    '[^a-zA-Z0-9_]+',
    '_',
    'g'
  )
)
where username is null or btrim(username) = '';

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null;

create table if not exists public.message_threads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.message_thread_participants (
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_message_at timestamptz null,
  primary key (thread_id, user_id)
);

create index if not exists message_thread_participants_user_idx
  on public.message_thread_participants (user_id, joined_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists messages_thread_created_idx
  on public.messages (thread_id, created_at desc);

create index if not exists messages_sender_created_idx
  on public.messages (sender_id, created_at desc);

alter table if exists public.message_threads enable row level security;
alter table if exists public.message_thread_participants enable row level security;
alter table if exists public.messages enable row level security;

drop policy if exists "message_threads_select_participant" on public.message_threads;
create policy "message_threads_select_participant"
on public.message_threads
for select
to authenticated
using (
  exists (
    select 1
    from public.message_thread_participants mtp
    where mtp.thread_id = message_threads.id
      and mtp.user_id = auth.uid()
  )
);

drop policy if exists "message_threads_insert_authenticated" on public.message_threads;
create policy "message_threads_insert_authenticated"
on public.message_threads
for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists "message_thread_participants_select_own" on public.message_thread_participants;
create policy "message_thread_participants_select_own"
on public.message_thread_participants
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "message_thread_participants_insert_own" on public.message_thread_participants;
create policy "message_thread_participants_insert_own"
on public.message_thread_participants
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "message_thread_participants_update_own" on public.message_thread_participants;
create policy "message_thread_participants_update_own"
on public.message_thread_participants
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

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
);

drop policy if exists "messages_insert_sender_participant" on public.messages;
create policy "messages_insert_sender_participant"
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.message_thread_participants mtp
    where mtp.thread_id = messages.thread_id
      and mtp.user_id = auth.uid()
  )
);

create or replace view public.public_profiles as
select
  p.id,
  p.first_name,
  p.last_name,
  p.avatar_url,
  p.username
from public.profiles p;

grant select on table public.public_profiles to anon, authenticated;
