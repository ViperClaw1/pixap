-- Fix support chat open: allow owner to read their support thread row and atomically get/create via RPC.

drop policy if exists "message_threads_select_own_support" on public.message_threads;
create policy "message_threads_select_own_support"
on public.message_threads
for select
to authenticated
using (
  kind = 'support'
  and support_user_id = auth.uid()
);

-- Repair orphaned support threads (row exists but owner is not a participant).
insert into public.message_thread_participants (thread_id, user_id)
select mt.id, mt.support_user_id
from public.message_threads mt
where mt.kind = 'support'
  and mt.support_user_id is not null
  and not exists (
    select 1
    from public.message_thread_participants mtp
    where mtp.thread_id = mt.id
      and mtp.user_id = mt.support_user_id
  )
on conflict do nothing;

-- Ensure admins are participants on existing support threads.
insert into public.message_thread_participants (thread_id, user_id)
select mt.id, p.id
from public.message_threads mt
cross join public.profiles p
where mt.kind = 'support'
  and mt.support_user_id is not null
  and p.account_role = 'admin'
  and p.id <> mt.support_user_id
  and not exists (
    select 1
    from public.message_thread_participants mtp
    where mtp.thread_id = mt.id
      and mtp.user_id = p.id
  )
on conflict do nothing;

create or replace function public.get_or_create_support_thread()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_thread_id uuid;
  v_created boolean := false;
  v_admin_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select id
  into v_thread_id
  from public.message_threads
  where kind = 'support'
    and support_user_id = v_user_id
  limit 1;

  if v_thread_id is null then
    insert into public.message_threads (kind, support_user_id)
    values ('support', v_user_id)
    returning id into v_thread_id;
    v_created := true;
  end if;

  insert into public.message_thread_participants (thread_id, user_id)
  values (v_thread_id, v_user_id)
  on conflict do nothing;

  for v_admin_id in
    select p.id
    from public.profiles p
    where p.account_role = 'admin'
      and p.id <> v_user_id
  loop
    insert into public.message_thread_participants (thread_id, user_id)
    values (v_thread_id, v_admin_id)
    on conflict do nothing;
  end loop;

  if not exists (
    select 1
    from public.profiles p
    where p.account_role = 'admin'
      and p.id <> v_user_id
  ) then
    raise exception 'No support agents are available';
  end if;

  return jsonb_build_object('thread_id', v_thread_id, 'created', v_created);
end;
$$;

revoke all on function public.get_or_create_support_thread() from public;
grant execute on function public.get_or_create_support_thread() to authenticated;
