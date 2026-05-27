-- Fix daily recommendations cron timeout: PostgREST RPC ~8s limit vs heavy per-user generation.
-- Also align invoke auth with new Supabase secret API keys (apikey header).

create or replace function private.invoke_generate_daily_recommendations(payload jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base_url text;
  service_key text;
  cron_secret text;
  request_id bigint;
  headers jsonb;
  invoke_body jsonb := coalesce(payload, '{}'::jsonb);
begin
  select decrypted_secret into base_url
  from vault.decrypted_secrets
  where name in ('project_url', 'SUPABASE_URL', 'supabase_url')
  limit 1;

  if base_url is null then
    base_url := 'https://ylcyktbppowabnxuwdrr.supabase.co';
  end if;

  select decrypted_secret into service_key
  from vault.decrypted_secrets
  where name in (
    'secret_key',
    'SUPABASE_SECRET_KEY',
    'supabase_secret_key',
    'service_role_key',
    'SUPABASE_SERVICE_ROLE_KEY',
    'supabase_service_role_key'
  )
  limit 1;

  select decrypted_secret into cron_secret
  from vault.decrypted_secrets
  where name in ('push_cron_secret', 'PUSH_CRON_SECRET')
  limit 1;

  if cron_secret is not null then
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-cron-secret', cron_secret
    );
  elsif service_key is not null and service_key not like '<%' then
    if service_key like 'sb_secret_%' then
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', service_key
      );
    else
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      );
    end if;
  else
    raise warning '[daily-recs] invoke skipped: set vault secret secret_key/push_cron_secret (push_cron_secret should match Edge PUSH_CRON_SECRET)';
    return null;
  end if;

  if not invoke_body ? 'batch_size' then
    invoke_body := invoke_body || jsonb_build_object('batch_size', 1);
  end if;

  select net.http_post(
    url := rtrim(base_url, '/') || '/functions/v1/generate-daily-recommendations',
    headers := headers,
    body := invoke_body
  ) into request_id;

  return request_id;
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
    select p.id as user_id
    from public.profiles p
    inner join auth.users u on u.id = p.id
    where p.id > coalesce(p_after_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    order by p.id
    limit v_batch_size
  ),
  generated as (
    select
      pu.user_id,
      public.generate_daily_recommendations(pu.user_id, p_date, 8, false) as inserted_count
    from picked_users pu
  ),
  pushed as (
    select
      g.user_id,
      g.inserted_count,
      case
        when g.inserted_count > 0 then public.enqueue_daily_recommendation_push(g.user_id, p_date)
        else false
      end as push_enqueued
    from generated g
  )
  select * from pushed;
end;
$$;

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
    '0 12 * * *',
    $job$select private.invoke_generate_daily_recommendations('{"batch_size":1}'::jsonb);$job$
  );
exception
  when others then
    raise notice '[daily-recs] pg_cron schedule skipped: %', sqlerrm;
end $cron$;
