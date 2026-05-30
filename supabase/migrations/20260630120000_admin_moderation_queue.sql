-- Admin moderation queue: list and resolve content_reports (staff only).

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
        'reviewed_by', cr.reviewed_by
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

create or replace function public.admin_update_content_report_status(
  p_report_id uuid,
  p_status public.content_report_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_analytics_access();

  if p_report_id is null then
    raise exception 'report_id_required' using errcode = 'P0001';
  end if;

  if p_status = 'pending'::public.content_report_status then
    raise exception 'invalid_status_transition' using errcode = 'P0001';
  end if;

  update public.content_reports cr
  set
    status = p_status,
    reviewed_at = now(),
    reviewed_by = auth.uid()
  where cr.id = p_report_id
    and cr.status = 'pending'::public.content_report_status;

  if not found then
    raise exception 'report_not_found_or_already_resolved' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.admin_list_content_reports(public.content_report_status, integer, integer) from public;
grant execute on function public.admin_list_content_reports(public.content_report_status, integer, integer) to authenticated;

revoke all on function public.admin_update_content_report_status(uuid, public.content_report_status) from public;
grant execute on function public.admin_update_content_report_status(uuid, public.content_report_status) to authenticated;

notify pgrst, 'reload schema';
