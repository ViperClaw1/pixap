-- RLS policies must not self-query message_thread_participants (causes 42P17 recursion).
-- Use a SECURITY DEFINER helper to check membership without re-entering RLS.

create or replace function public.is_message_thread_member(p_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.message_thread_participants
    where thread_id = p_thread_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_message_thread_member(uuid) from public;
grant execute on function public.is_message_thread_member(uuid) to authenticated;

drop policy if exists "message_thread_participants_select_co_members" on public.message_thread_participants;
create policy "message_thread_participants_select_co_members"
on public.message_thread_participants
for select
to authenticated
using (public.is_message_thread_member(thread_id));

drop policy if exists "message_thread_participants_insert_member" on public.message_thread_participants;
create policy "message_thread_participants_insert_member"
on public.message_thread_participants
for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.is_message_thread_member(thread_id)
);
