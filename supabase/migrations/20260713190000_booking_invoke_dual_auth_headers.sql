-- pg_net: send both Authorization and apikey for legacy JWT keys (Supabase gateway compatibility).

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
  headers jsonb;
  request_id bigint;
begin
  select decrypted_secret into base_url
  from vault.decrypted_secrets
  where name in ('project_url', 'SUPABASE_URL', 'supabase_url')
  limit 1;

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

  if base_url is null or service_key is null or service_key like '<%' then
    raise warning '[booking-email] invoke skipped: vault secrets project_url and/or service key missing';
    return null;
  end if;

  headers := jsonb_build_object('Content-Type', 'application/json');

  if service_key like 'sb_secret_%' then
    headers := headers || jsonb_build_object(
      'apikey', service_key,
      'Authorization', 'Bearer ' || service_key
    );
  else
    headers := headers || jsonb_build_object(
      'Authorization', 'Bearer ' || service_key,
      'apikey', service_key
    );
  end if;

  select net.http_post(
    url := rtrim(base_url, '/') || '/functions/v1/send-booking-email',
    headers := headers,
    body := jsonb_build_object(
      'booking_id', p_booking_id,
      'kind', p_kind
    )
  ) into request_id;

  return request_id;
end;
$$;

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
  where name in ('project_url', 'SUPABASE_URL', 'supabase_url')
  limit 1;

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

  select decrypted_secret into reminder_secret
  from vault.decrypted_secrets
  where name in ('reminder_cron_secret', 'REMINDER_CRON_SECRET')
  limit 1;

  if base_url is null then
    raise warning '[booking-reminder] invoke skipped: vault secret project_url missing';
    return null;
  end if;

  headers := jsonb_build_object('Content-Type', 'application/json');

  if reminder_secret is not null then
    headers := headers || jsonb_build_object('x-reminder-cron-secret', reminder_secret);
  elsif service_key is not null and service_key not like '<%' then
    if service_key like 'sb_secret_%' then
      headers := headers || jsonb_build_object(
        'apikey', service_key,
        'Authorization', 'Bearer ' || service_key
      );
    else
      headers := headers || jsonb_build_object(
        'Authorization', 'Bearer ' || service_key,
        'apikey', service_key
      );
    end if;
  else
    raise warning '[booking-reminder] invoke skipped: set vault secret reminder_cron_secret or service key';
    return null;
  end if;

  select net.http_post(
    url := rtrim(base_url, '/') || '/functions/v1/booking-reminder-cron',
    headers := headers,
    body := coalesce(payload, '{}'::jsonb)
  ) into request_id;

  return request_id;
end;
$$;
