-- Daily recommendations: deliver at 12:00 and 17:00 in each user's local timezone.
-- Hourly pg_cron invokes the edge function; SQL batch picks users whose local hour is 12 or 17.

alter table if exists public.profiles
  add column if not exists timezone text;

comment on column public.profiles.timezone is
  'IANA timezone for local daily recommendation delivery (e.g. Europe/Moscow). Synced from the client.';

alter table if exists public.recommendation_delivery_logs
  add column if not exists delivery_slot text not null default 'noon';

alter table if exists public.recommendation_delivery_logs
  drop constraint if exists recommendation_delivery_logs_delivery_slot_check;

alter table if exists public.recommendation_delivery_logs
  add constraint recommendation_delivery_logs_delivery_slot_check
  check (delivery_slot in ('noon', 'evening'));

alter table if exists public.recommendation_delivery_logs
  drop constraint if exists recommendation_delivery_logs_user_id_generated_for_date_key;

alter table if exists public.recommendation_delivery_logs
  add constraint recommendation_delivery_logs_user_date_slot_key
  unique (user_id, generated_for_date, delivery_slot);

create or replace function public.sync_profile_timezone(p_timezone text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text := nullif(btrim(p_timezone), '');
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if v_tz is null then
    return;
  end if;

  perform now() at time zone v_tz;

  update public.profiles
  set timezone = v_tz,
      updated_at = now()
  where id = v_uid;
exception
  when invalid_parameter_value then
    raise exception 'invalid timezone: %', p_timezone;
end;
$$;

comment on function public.sync_profile_timezone(text) is
  'Persist IANA timezone from the signed-in client for local daily recommendation cron.';

revoke all on function public.sync_profile_timezone(text) from public;
grant execute on function public.sync_profile_timezone(text) to authenticated, service_role;

create or replace function public.profile_local_date(
  p_user_id uuid,
  p_at timestamptz default now()
)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select (coalesce(p_at, now()) at time zone coalesce(nullif(btrim(p.timezone), ''), 'UTC'))::date
  from public.profiles p
  where p.id = p_user_id;
$$;

revoke all on function public.profile_local_date(uuid, timestamptz) from public;
grant execute on function public.profile_local_date(uuid, timestamptz) to authenticated, service_role;

create or replace function public.enqueue_daily_recommendation_push(
  p_user_id uuid,
  p_date date default (now() at time zone 'utc')::date,
  p_delivery_slot text default 'noon'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_top record;
  v_slot text := case when p_delivery_slot = 'evening' then 'evening' else 'noon' end;
begin
  if p_user_id is null then
    return false;
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    return false;
  end if;

  if exists (
    select 1
    from public.recommendation_delivery_logs dl
    where dl.user_id = p_user_id
      and dl.generated_for_date = p_date
      and dl.delivery_slot = v_slot
      and dl.notification_sent = true
  ) then
    return false;
  end if;

  select
    dr.venue_id,
    bc.name,
    dr.recommendation_reasons
  into v_top
  from public.daily_recommendations dr
  join public.business_cards bc on bc.id = dr.venue_id
  where dr.user_id = p_user_id
    and dr.generated_for_date = p_date
  order by dr.generated_rank asc
  limit 1;

  if not found then
    insert into public.recommendation_delivery_logs (user_id, generated_for_date, delivery_slot, notification_sent, error_message)
    values (p_user_id, p_date, v_slot, false, 'no_recommendations')
    on conflict (user_id, generated_for_date, delivery_slot) do update
      set notification_sent = false,
          error_message = 'no_recommendations',
          created_at = now();
    return false;
  end if;

  if not exists (
    select 1
    from public.user_push_tokens t
    where t.user_id = p_user_id
      and nullif(trim(coalesce(t.expo_push_token, '')), '') is not null
  ) then
    insert into public.recommendation_delivery_logs (user_id, generated_for_date, delivery_slot, notification_sent, error_message)
    values (p_user_id, p_date, v_slot, false, 'missing_push_token')
    on conflict (user_id, generated_for_date, delivery_slot) do update
      set notification_sent = false,
          error_message = 'missing_push_token',
          created_at = now();
    return false;
  end if;

  insert into public.push_outbox (user_id, title, body, data)
  values (
    p_user_id,
    'Tonight for you',
    coalesce(v_top.name, 'New venues ready for you'),
    jsonb_build_object(
      'kind', 'daily_recommendation',
      'date', p_date,
      'delivery_slot', v_slot,
      'top_venue_id', v_top.venue_id,
      'venue_id', v_top.venue_id,
      'url', 'pixap://place/' || v_top.venue_id::text
    )
  );

  insert into public.recommendation_delivery_logs (
    user_id,
    generated_for_date,
    delivery_slot,
    notification_sent,
    sent_at
  )
  values (
    p_user_id,
    p_date,
    v_slot,
    true,
    now()
  )
  on conflict (user_id, generated_for_date, delivery_slot) do update
    set notification_sent = true,
        sent_at = excluded.sent_at,
        error_message = null,
        created_at = now();

  return true;
exception
  when others then
    insert into public.recommendation_delivery_logs (user_id, generated_for_date, delivery_slot, notification_sent, error_message)
    values (p_user_id, p_date, v_slot, false, left(sqlerrm, 400))
    on conflict (user_id, generated_for_date, delivery_slot) do update
      set notification_sent = false,
          error_message = left(sqlerrm, 400),
          created_at = now();
    return false;
end;
$$;

create or replace function public.run_daily_recommendation_batch(
  p_run_id uuid,
  p_date date default (now() at time zone 'utc')::date,
  p_batch_size integer default 1,
  p_after_user_id uuid default null
)
returns table (
  user_id uuid,
  inserted_count integer,
  push_enqueued boolean
)
language plpgsql
security definer
set search_path = public
set statement_timeout = '30s'
as $$
declare
  v_batch_size integer := greatest(1, least(coalesce(p_batch_size, 1), 25));
begin
  return query
  with picked_users as (
    select
      p.id as user_id,
      (now() at time zone coalesce(nullif(btrim(p.timezone), ''), 'UTC'))::date as local_date,
      extract(hour from (now() at time zone coalesce(nullif(btrim(p.timezone), ''), 'UTC')))::int as local_hour
    from public.profiles p
    inner join auth.users u on u.id = p.id
    where p.id > coalesce(p_after_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and extract(hour from (now() at time zone coalesce(nullif(btrim(p.timezone), ''), 'UTC')))::int in (12, 17)
    order by p.id
    limit v_batch_size
  ),
  generated as (
    select
      pu.user_id,
      pu.local_date,
      pu.local_hour,
      case
        when pu.local_hour = 12 then
          public.generate_daily_recommendations(pu.user_id, pu.local_date, 8, false)
        when pu.local_hour = 17 then
          public.generate_daily_recommendations(pu.user_id, pu.local_date, 8, true)
        else 0
      end as inserted_count
    from picked_users pu
  ),
  pushed as (
    select
      g.user_id,
      g.inserted_count,
      case
        when g.local_hour = 12 and g.inserted_count > 0 then
          public.enqueue_daily_recommendation_push(g.user_id, g.local_date, 'noon')
        when g.local_hour = 17 and g.inserted_count > 0 then
          public.enqueue_daily_recommendation_push(g.user_id, g.local_date, 'evening')
        else false
      end as push_enqueued
    from generated g
  )
  select pushed.user_id, pushed.inserted_count, pushed.push_enqueued from pushed;
end;
$$;

create or replace function public.bootstrap_my_daily_recommendations(
  p_date date default null,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_local_date date;
  v_inserted integer := 0;
  v_push_enqueued boolean := false;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  v_local_date := coalesce(
    p_date,
    public.profile_local_date(v_uid)
  );

  v_inserted := public.generate_daily_recommendations(v_uid, v_local_date, 8, coalesce(p_force, false));

  if v_inserted > 0 then
    v_push_enqueued := public.enqueue_daily_recommendation_push(v_uid, v_local_date, 'noon');
  end if;

  return jsonb_build_object(
    'inserted_count', coalesce(v_inserted, 0),
    'push_enqueued', coalesce(v_push_enqueued, false),
    'generated_for_date', v_local_date
  );
end;
$$;

comment on function public.bootstrap_my_daily_recommendations(date, boolean) is
  'Generate today''s daily recommendations for auth.uid() in the user''s local timezone and enqueue the noon push.';

comment on function public.run_daily_recommendation_batch(uuid, date, integer, uuid) is
  'Cron batch: at local 12:00 generate + noon push; at local 17:00 force-regenerate + evening push. Uses profiles.timezone (UTC fallback).';

do $cron$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id from cron.job where jobname = 'generate-daily-recommendations' limit 1;
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'generate-daily-recommendations',
    '0 * * * *',
    $job$select private.invoke_generate_daily_recommendations('{"batch_size":1}'::jsonb);$job$
  );
exception
  when others then
    raise notice '[daily-recs] pg_cron schedule skipped: %', sqlerrm;
end $cron$;
