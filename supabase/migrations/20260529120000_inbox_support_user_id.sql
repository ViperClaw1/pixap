-- Inbox: expose support_user_id so admins can list and open customer support threads.

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
  order by l.last_message_at desc;
$$;

grant execute on function public.get_message_inbox_summary() to authenticated;
