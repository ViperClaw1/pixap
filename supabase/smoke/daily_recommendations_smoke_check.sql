-- Daily Recommendations smoke-check (cron + idempotency)
-- Run in Supabase SQL Editor on STAGING first.
-- Safe by default: does not delete production data.

-- =============================================================================
-- 0) Preconditions
-- =============================================================================
-- Replace this with a real user from your project (preferably staging test user).
-- Tip:
--   select id, email from auth.users order by created_at desc limit 20;

-- IMPORTANT:
--  - User MUST exist in `auth.users` (FK target), not only in `profiles`
--  - At least some rows should exist in `business_cards`
--  - For push smoke path, user should have `user_push_tokens.expo_push_token`

-- Set variables.
do $$
begin
  perform set_config('app.smoke_user_id', '00000000-0000-0000-0000-000000000000', false); -- TODO: replace
  perform set_config('app.smoke_date', to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD'), false);
end $$;

-- Pick a valid smoke user (profile + auth.users):
-- select u.id, u.email
-- from auth.users u
-- inner join public.profiles p on p.id = u.id
-- order by u.created_at desc
-- limit 10;

-- Quick visibility check.
select
  current_setting('app.smoke_user_id')::uuid as smoke_user_id,
  current_setting('app.smoke_date')::date as smoke_date;

-- Preflight: fail fast if smoke user is orphaned profile-only.
select
  p.id as profile_id,
  exists (select 1 from auth.users u where u.id = p.id) as in_auth_users,
  case
    when exists (select 1 from auth.users u where u.id = p.id) then 'ok'
    else 'INVALID: set app.smoke_user_id to auth.users.id'
  end as smoke_user_status
from public.profiles p
where p.id = current_setting('app.smoke_user_id')::uuid;


-- =============================================================================
-- 1) Cron plumbing / invoke function check
-- =============================================================================
-- 1.1 Cron job exists and runs hourly for timezone-aware noon/evening delivery.
select
  jobid,
  jobname,
  schedule,
  command,
  active
from cron.job
where jobname = 'generate-daily-recommendations';

-- Expect:
--  - exactly 1 row
--  - schedule = '0 * * * *'
--  - command contains: private.invoke_generate_daily_recommendations

-- 1.2 Manual invoke function dry call (checks pg_net/vault wiring).
-- NOTE: this only enqueues HTTP request to edge function.
select private.invoke_generate_daily_recommendations(
  jsonb_build_object(
    'date', current_setting('app.smoke_date')::date
  )
) as request_id;

-- If request_id is null, check vault secrets project_url/service_role_key.


-- =============================================================================
-- 2) Baseline snapshot for selected user/date
-- =============================================================================
with p as (
  select
    current_setting('app.smoke_user_id')::uuid as uid,
    current_setting('app.smoke_date')::date as d
)
select
  (select count(*) from public.daily_recommendations dr, p where dr.user_id = p.uid and dr.generated_for_date = p.d) as rec_count_before,
  (select count(*) from public.recommendation_delivery_logs dl, p where dl.user_id = p.uid and dl.generated_for_date = p.d) as delivery_count_before,
  (select count(*) from public.push_outbox po, p
    where po.user_id = p.uid
      and coalesce(po.data ->> 'kind', '') = 'daily_recommendation'
      and (po.data ->> 'date')::date = p.d
  ) as push_outbox_count_before;


-- =============================================================================
-- 3) Single-user generation smoke
-- =============================================================================
-- 3.1 Generate recommendations for one user/date.
select public.generate_daily_recommendations(
  current_setting('app.smoke_user_id')::uuid,
  current_setting('app.smoke_date')::date,
  8,
  false
) as inserted_count_first;

-- 3.2 Verify rows and ranking continuity.
with p as (
  select
    current_setting('app.smoke_user_id')::uuid as uid,
    current_setting('app.smoke_date')::date as d
)
select
  count(*) as rec_count,
  min(generated_rank) as min_rank,
  max(generated_rank) as max_rank,
  count(distinct venue_id) as distinct_venues
from public.daily_recommendations dr, p
where dr.user_id = p.uid
  and dr.generated_for_date = p.d;

-- Expect:
--  - rec_count > 0
--  - distinct_venues = rec_count
--  - ranks normally start from 1

-- 3.3 Read client RPC payload shape smoke.
select *
from public.get_daily_recommendations(current_setting('app.smoke_date')::date)
limit 8;


-- =============================================================================
-- 4) Push enqueue smoke
-- =============================================================================
select public.enqueue_daily_recommendation_push(
  current_setting('app.smoke_user_id')::uuid,
  current_setting('app.smoke_date')::date
) as push_enqueued;

-- Verify delivery log and outbox row.
with p as (
  select
    current_setting('app.smoke_user_id')::uuid as uid,
    current_setting('app.smoke_date')::date as d
)
select
  dl.notification_sent,
  dl.sent_at,
  dl.delivery_provider,
  dl.error_message
from public.recommendation_delivery_logs dl, p
where dl.user_id = p.uid
  and dl.generated_for_date = p.d;

with p as (
  select
    current_setting('app.smoke_user_id')::uuid as uid,
    current_setting('app.smoke_date')::date as d
)
select
  po.id,
  po.created_at,
  po.delivered_at,
  po.title,
  po.body,
  po.data
from public.push_outbox po, p
where po.user_id = p.uid
  and coalesce(po.data ->> 'kind', '') = 'daily_recommendation'
  and (po.data ->> 'date')::date = p.d
order by po.created_at desc
limit 5;


-- =============================================================================
-- 5) Idempotency checks
-- =============================================================================
-- 5.1 Repeat generation without force.
select public.generate_daily_recommendations(
  current_setting('app.smoke_user_id')::uuid,
  current_setting('app.smoke_date')::date,
  8,
  false
) as inserted_count_second;

-- 5.2 Validate there are no duplicates (user_id, venue_id, date).
with p as (
  select
    current_setting('app.smoke_user_id')::uuid as uid,
    current_setting('app.smoke_date')::date as d
)
select
  count(*) as total_rows,
  count(distinct venue_id) as distinct_venues
from public.daily_recommendations dr, p
where dr.user_id = p.uid
  and dr.generated_for_date = p.d;

-- Expect:
--  - total_rows = distinct_venues

-- 5.3 Optional force regenerate (should replace/re-upsert, still no duplicates).
select public.generate_daily_recommendations(
  current_setting('app.smoke_user_id')::uuid,
  current_setting('app.smoke_date')::date,
  8,
  true
) as inserted_count_force;

with p as (
  select
    current_setting('app.smoke_user_id')::uuid as uid,
    current_setting('app.smoke_date')::date as d
)
select
  count(*) as total_rows_after_force,
  count(distinct venue_id) as distinct_venues_after_force
from public.daily_recommendations dr, p
where dr.user_id = p.uid
  and dr.generated_for_date = p.d;


-- =============================================================================
-- 6) Batch runner smoke
-- =============================================================================
-- Create dedicated run row and process tiny batch.
with new_run as (
  insert into public.recommendation_generation_runs (
    generated_for_date,
    status,
    started_at,
    users_processed
  )
  values (
    current_setting('app.smoke_date')::date,
    'running',
    now(),
    0
  )
  returning id
)
select *
from public.run_daily_recommendation_batch(
  (select id from new_run),
  current_setting('app.smoke_date')::date,
  5,
  null
);

-- Close the run row manually for smoke session.
update public.recommendation_generation_runs
set status = 'completed',
    completed_at = now()
where status = 'running'
  and generated_for_date = current_setting('app.smoke_date')::date;


-- =============================================================================
-- 7) Operational diagnostics (quick)
-- =============================================================================
-- Last runs today.
select
  id,
  generated_for_date,
  status,
  users_processed,
  started_at,
  completed_at,
  error_log
from public.recommendation_generation_runs
where generated_for_date = current_setting('app.smoke_date')::date
order by started_at desc
limit 20;

-- Delivery success ratio today.
select
  count(*) as total_logs,
  count(*) filter (where notification_sent) as sent_ok,
  count(*) filter (where not notification_sent) as sent_failed
from public.recommendation_delivery_logs
where generated_for_date = current_setting('app.smoke_date')::date;


-- =============================================================================
-- 8) Optional cleanup for smoke user/date
-- =============================================================================
-- Uncomment ONLY in staging if you want a clean rerun.
--
-- delete from public.recommendation_delivery_logs
-- where user_id = current_setting('app.smoke_user_id')::uuid
--   and generated_for_date = current_setting('app.smoke_date')::date;
--
-- delete from public.daily_recommendations
-- where user_id = current_setting('app.smoke_user_id')::uuid
--   and generated_for_date = current_setting('app.smoke_date')::date;
--
-- delete from public.push_outbox
-- where user_id = current_setting('app.smoke_user_id')::uuid
--   and coalesce(data ->> 'kind', '') = 'daily_recommendation'
--   and (data ->> 'date')::date = current_setting('app.smoke_date')::date;
