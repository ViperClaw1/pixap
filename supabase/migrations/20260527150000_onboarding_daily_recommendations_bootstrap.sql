-- Per-user daily recommendations bootstrap (e.g. after first onboarding completion).
-- Does NOT write to recommendation_generation_runs — pg_cron batch is unaffected.

create or replace function public.bootstrap_my_daily_recommendations(
  p_date date default (now() at time zone 'utc')::date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inserted integer := 0;
  v_push_enqueued boolean := false;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  v_inserted := public.generate_daily_recommendations(v_uid, p_date, 8, false);

  if v_inserted > 0 then
    v_push_enqueued := public.enqueue_daily_recommendation_push(v_uid, p_date);
  end if;

  return jsonb_build_object(
    'inserted_count', coalesce(v_inserted, 0),
    'push_enqueued', coalesce(v_push_enqueued, false),
    'generated_for_date', p_date
  );
end;
$$;

comment on function public.bootstrap_my_daily_recommendations(date) is
  'Generate today''s daily recommendations for auth.uid() and enqueue push. Skips global generation runs (cron-safe).';

revoke all on function public.bootstrap_my_daily_recommendations(date) from public;
grant execute on function public.bootstrap_my_daily_recommendations(date) to authenticated, service_role;
