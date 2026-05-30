-- Enrich admin moderation list with navigation targets (post/story/thread).

create or replace function public.admin_list_content_reports(
  p_status public.content_report_status default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 100));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_pending_count bigint;
  v_reports jsonb;
begin
  perform public.assert_admin_analytics_access();

  select count(*)::bigint
  into v_pending_count
  from public.content_reports cr
  where cr.status = 'pending';

  select coalesce(
    jsonb_agg(row_data order by created_at desc),
    '[]'::jsonb
  )
  into v_reports
  from (
    select
      cr.created_at,
      jsonb_build_object(
        'id', cr.id,
        'reporter_id', cr.reporter_id,
        'reporter_first_name', coalesce(rp.first_name, ''),
        'reporter_last_name', coalesce(rp.last_name, ''),
        'reporter_username', rp.username,
        'target_type', cr.target_type,
        'target_id', cr.target_id,
        'reported_user_id', cr.reported_user_id,
        'reported_first_name', coalesce(up.first_name, ''),
        'reported_last_name', coalesce(up.last_name, ''),
        'reported_username', up.username,
        'reason', cr.reason,
        'details', cr.details,
        'status', cr.status,
        'created_at', cr.created_at,
        'reviewed_at', cr.reviewed_at,
        'reviewed_by', cr.reviewed_by,
        'open_content_id',
          case cr.target_type
            when 'post' then cr.target_id
            when 'story' then cr.target_id
            when 'post_comment' then (
              select pc.post_id
              from public.post_comments pc
              where pc.id = cr.target_id
              limit 1
            )
            when 'story_comment' then (
              select sc.story_id
              from public.story_comments sc
              where sc.id = cr.target_id
              limit 1
            )
            else null
          end,
        'message_thread_id',
          case cr.target_type
            when 'message' then (
              select m.thread_id
              from public.messages m
              where m.id = cr.target_id
              limit 1
            )
            else null
          end,
        'story_place_id',
          case cr.target_type
            when 'story' then (
              select s.place_id
              from public.stories s
              where s.id = cr.target_id
              limit 1
            )
            when 'story_comment' then (
              select s.place_id
              from public.stories s
              inner join public.story_comments sc on sc.story_id = s.id
              where sc.id = cr.target_id
              limit 1
            )
            else null
          end
      ) as row_data
    from public.content_reports cr
    left join public.profiles rp on rp.id = cr.reporter_id
    left join public.profiles up on up.id = cr.reported_user_id
    where p_status is null or cr.status = p_status
    order by cr.created_at desc
    limit v_limit
    offset v_offset
  ) rows;

  return jsonb_build_object(
    'reports', v_reports,
    'pending_count', v_pending_count
  );
end;
$$;

notify pgrst, 'reload schema';
