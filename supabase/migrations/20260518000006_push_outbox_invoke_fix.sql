-- Fix DB invoke when Vault secrets use alternate names or only PUSH_CRON_SECRET is configured.
-- Fallback project URL matches linked Supabase project (ylcyktbppowabnxuwdrr).

create or replace function private.invoke_consume_push_outbox(payload jsonb default '{}'::jsonb)
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
  where name in ('service_role_key', 'SUPABASE_SERVICE_ROLE_KEY', 'supabase_service_role_key')
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
  elsif service_key is not null then
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    );
  else
    raise warning '[push] consume-push-outbox skipped: set vault secret service_role_key or push_cron_secret (same value as Edge PUSH_CRON_SECRET)';
    return null;
  end if;

  select net.http_post(
    url := rtrim(base_url, '/') || '/functions/v1/consume-push-outbox',
    headers := headers,
    body := coalesce(payload, '{}'::jsonb)
  ) into request_id;

  return request_id;
end;
$$;
