-- Booking status emails + 1-hour reminder cron (pg_net → Edge Functions).
-- Vault one-time setup (if not already done):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url', 'project_url');
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key', 'service_role_key');
-- Optional:
--   select vault.create_secret('<REMINDER_CRON_SECRET>', 'reminder_cron_secret', 'reminder_cron_secret');

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function private.invoke_send_booking_email(
  p_booking_id uuid,
  p_kind text default 'status_update'
)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base_url text;
  service_key text;
  request_id bigint;
begin
  select decrypted_secret into base_url
  from vault.decrypted_secrets
  where name = 'project_url'
  limit 1;

  select decrypted_secret into service_key
  from vault.decrypted_secrets
  where name = 'service_role_key'
  limit 1;

  if base_url is null or service_key is null then
    raise warning '[booking-email] invoke skipped: vault secrets project_url and/or service_role_key missing';
    return null;
  end if;

  select net.http_post(
    url := rtrim(base_url, '/') || '/functions/v1/send-booking-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'booking_id', p_booking_id,
      'kind', p_kind
    )
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function private.invoke_send_booking_email(uuid, text) from public;
grant execute on function private.invoke_send_booking_email(uuid, text) to postgres, service_role;

create or replace function private.invoke_booking_reminder_cron(payload jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base_url text;
  service_key text;
  reminder_secret text;
  headers jsonb;
  request_id bigint;
begin
  select decrypted_secret into base_url
  from vault.decrypted_secrets
  where name = 'project_url'
  limit 1;

  select decrypted_secret into service_key
  from vault.decrypted_secrets
  where name = 'service_role_key'
  limit 1;

  if base_url is null or service_key is null then
    raise warning '[booking-reminder] invoke skipped: vault secrets project_url and/or service_role_key missing';
    return null;
  end if;

  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || service_key
  );

  select decrypted_secret into reminder_secret
  from vault.decrypted_secrets
  where name = 'reminder_cron_secret'
  limit 1;

  if reminder_secret is not null then
    headers := headers || jsonb_build_object('x-reminder-cron-secret', reminder_secret);
  end if;

  select net.http_post(
    url := rtrim(base_url, '/') || '/functions/v1/booking-reminder-cron',
    headers := headers,
    body := coalesce(payload, '{}'::jsonb)
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function private.invoke_booking_reminder_cron(jsonb) from public;
grant execute on function private.invoke_booking_reminder_cron(jsonb) to postgres, service_role;

do $cron$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id from cron.job where jobname = 'booking-reminder-every-5min' limit 1;
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'booking-reminder-every-5min',
    '*/5 * * * *',
    $job$select private.invoke_booking_reminder_cron('{}'::jsonb);$job$
  );
exception
  when others then
    raise notice '[booking-reminder] pg_cron schedule skipped: %', sqlerrm;
end $cron$;
