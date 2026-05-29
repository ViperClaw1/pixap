-- UGC moderation: content reports, user blocks, terms acceptance, feed/inbox filters.

do $$
begin
  create type public.content_report_target_type as enum (
    'post',
    'story',
    'post_comment',
    'story_comment',
    'message',
    'user',
    'ai_response'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.content_report_reason as enum (
    'spam',
    'harassment',
    'hate_speech',
    'nudity',
    'violence',
    'illegal',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.content_report_status as enum (
    'pending',
    'reviewed',
    'dismissed',
    'action_taken'
  );
exception
  when duplicate_object then null;
end $$;

alter table if exists public.profiles
  add column if not exists terms_accepted_at timestamptz;

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.content_report_target_type not null,
  target_id uuid,
  reported_user_id uuid references public.profiles (id) on delete set null,
  reason public.content_report_reason not null,
  details text,
  status public.content_report_status not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null
);

create index if not exists content_reports_status_created_idx
  on public.content_reports (status, created_at desc);

create index if not exists content_reports_reporter_idx
  on public.content_reports (reporter_id, created_at desc);

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_blocks_no_self check (blocker_id <> blocked_id),
  constraint user_blocks_unique unique (blocker_id, blocked_id)
);

create index if not exists user_blocks_blocker_idx on public.user_blocks (blocker_id);
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.content_reports enable row level security;
alter table public.user_blocks enable row level security;

drop policy if exists content_reports_insert_own on public.content_reports;
create policy content_reports_insert_own
  on public.content_reports
  for insert
  to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists content_reports_select_own on public.content_reports;
create policy content_reports_select_own
  on public.content_reports
  for select
  to authenticated
  using (
    reporter_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.account_role = 'admin'::public.profile_account_role
    )
  );

drop policy if exists user_blocks_select_own on public.user_blocks;
create policy user_blocks_select_own
  on public.user_blocks
  for select
  to authenticated
  using (blocker_id = auth.uid());

drop policy if exists user_blocks_insert_own on public.user_blocks;
create policy user_blocks_insert_own
  on public.user_blocks
  for insert
  to authenticated
  with check (blocker_id = auth.uid());

drop policy if exists user_blocks_delete_own on public.user_blocks;
create policy user_blocks_delete_own
  on public.user_blocks
  for delete
  to authenticated
  using (blocker_id = auth.uid());

create or replace function public.users_are_blocked(p_viewer uuid, p_other uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    p_viewer is not null
    and p_other is not null
    and p_viewer <> p_other
    and exists (
      select 1
      from public.user_blocks ub
      where (ub.blocker_id = p_viewer and ub.blocked_id = p_other)
         or (ub.blocker_id = p_other and ub.blocked_id = p_viewer)
    );
$$;

create or replace function public.report_content(
  p_target_type public.content_report_target_type,
  p_reason public.content_report_reason,
  p_target_id uuid default null,
  p_reported_user_id uuid default null,
  p_details text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.content_reports (
    reporter_id,
    target_type,
    target_id,
    reported_user_id,
    reason,
    details
  )
  values (
    v_uid,
    p_target_type,
    p_target_id,
    p_reported_user_id,
    p_reason,
    nullif(trim(coalesce(p_details, '')), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.block_user(p_blocked_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_blocked_id = v_uid then
    raise exception 'Cannot block yourself';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id)
  values (v_uid, p_blocked_id)
  on conflict (blocker_id, blocked_id) do nothing;

  delete from public.user_follows uf
  where (uf.follower_id = v_uid and uf.following_id = p_blocked_id)
     or (uf.follower_id = p_blocked_id and uf.following_id = v_uid);
end;
$$;

create or replace function public.unblock_user(p_blocked_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.user_blocks ub
  where ub.blocker_id = v_uid
    and ub.blocked_id = p_blocked_id;
end;
$$;

create or replace function public.accept_terms_of_service()
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.profiles
  set terms_accepted_at = coalesce(terms_accepted_at, now()),
      updated_at = now()
  where id = auth.uid();
end;
$$;

grant execute on function public.users_are_blocked(uuid, uuid) to authenticated;
grant execute on function public.report_content(public.content_report_target_type, public.content_report_reason, uuid, uuid, text) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.accept_terms_of_service() to authenticated;

-- Inbox: hide direct threads with blocked peers (keep support threads).
drop function if exists public.get_message_inbox_summary();

create function public.get_message_inbox_summary()
returns table (
  thread_id uuid,
  last_message_id uuid,
  last_message_text text,
  last_message_at timestamptz,
  last_sender_id uuid,
  unread_count bigint,
  is_support boolean,
  support_user_id uuid,
  participants jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  with my_threads as (
    select mtp.thread_id, mtp.last_read_message_at
    from public.message_thread_participants mtp
    where mtp.user_id = auth.uid()
  ),
  latest_per_thread as (
    select distinct on (m.thread_id)
      m.thread_id,
      m.id as last_message_id,
      m.content as last_message_text,
      m.created_at as last_message_at,
      m.sender_id as last_sender_id
    from public.messages m
    join my_threads mt on mt.thread_id = m.thread_id
    order by m.thread_id, m.created_at desc
  ),
  unread as (
    select
      m.thread_id,
      count(*)::bigint as unread_count
    from public.messages m
    join my_threads mt on mt.thread_id = m.thread_id
    where m.sender_id <> auth.uid()
      and (
        mt.last_read_message_at is null
        or m.created_at > mt.last_read_message_at
      )
    group by m.thread_id
  ),
  thread_participants as (
    select
      mtp.thread_id,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'first_name', p.first_name,
            'last_name', p.last_name,
            'avatar_url', p.avatar_url,
            'username', p.username
          )
          order by p.id
        ) filter (where p.id is not null),
        '[]'::jsonb
      ) as participants
    from public.message_thread_participants mtp
    join my_threads mt on mt.thread_id = mtp.thread_id
    left join public.public_profiles p on p.id = mtp.user_id
    group by mtp.thread_id
  )
  select
    l.thread_id,
    l.last_message_id,
    l.last_message_text,
    l.last_message_at,
    l.last_sender_id,
    coalesce(u.unread_count, 0) as unread_count,
    (t.kind = 'support') as is_support,
    t.support_user_id,
    coalesce(tp.participants, '[]'::jsonb) as participants
  from latest_per_thread l
  join public.message_threads t on t.id = l.thread_id
  left join unread u on u.thread_id = l.thread_id
  left join thread_participants tp on tp.thread_id = l.thread_id
  where t.kind = 'support'
     or not exists (
       select 1
       from public.message_thread_participants mtp_peer
       where mtp_peer.thread_id = l.thread_id
         and mtp_peer.user_id <> auth.uid()
         and public.users_are_blocked(auth.uid(), mtp_peer.user_id)
     )
  order by l.last_message_at desc;
$$;

grant execute on function public.get_message_inbox_summary() to authenticated;

notify pgrst, 'reload schema';
