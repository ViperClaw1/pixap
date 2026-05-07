-- Followers references on profiles + fix participants insert policy for direct chats.

alter table if exists public.profiles
  add column if not exists followers uuid[] not null default '{}';

-- Rewire message-related user references from auth.users to public.profiles
-- so chat participants can be created for profile ids used in app-level lists.
alter table if exists public.message_thread_participants
  drop constraint if exists message_thread_participants_user_id_fkey;
alter table if exists public.message_thread_participants
  add constraint message_thread_participants_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table if exists public.messages
  drop constraint if exists messages_sender_id_fkey;
alter table if exists public.messages
  add constraint messages_sender_id_fkey
  foreign key (sender_id) references public.profiles(id) on delete cascade;

alter table if exists public.message_reactions
  drop constraint if exists message_reactions_user_id_fkey;
alter table if exists public.message_reactions
  add constraint message_reactions_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

drop policy if exists "message_thread_participants_insert_own" on public.message_thread_participants;
drop policy if exists "message_thread_participants_insert_member" on public.message_thread_participants;
create policy "message_thread_participants_insert_member"
on public.message_thread_participants
for insert
to authenticated
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.message_thread_participants mtp
    where mtp.thread_id = message_thread_participants.thread_id
      and mtp.user_id = auth.uid()
  )
);

create or replace view public.public_profiles as
select
  p.id,
  p.first_name,
  p.last_name,
  p.avatar_url,
  p.username,
  p.followers
from public.profiles p;

grant select on table public.public_profiles to anon, authenticated;
