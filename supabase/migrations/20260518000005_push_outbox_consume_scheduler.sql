-- Schedule + immediate invoke of Edge Function `consume-push-outbox` for pending push_outbox rows.
--
-- One-time setup (Supabase SQL editor), if cron/trigger does nothing after deploy:
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url', 'project_url');
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key', 'service_role_key');
-- Service role key: Dashboard → Project Settings → API → service_role (secret).

create schema if not exists private;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function private.invoke_consume_push_outbox(payload jsonb default '{}'::jsonb)
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
    raise warning '[push] consume-push-outbox skipped: vault secrets project_url and/or service_role_key missing';
    return null;
  end if;

  select net.http_post(
    url := rtrim(base_url, '/') || '/functions/v1/consume-push-outbox',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := coalesce(payload, '{}'::jsonb)
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function private.invoke_consume_push_outbox(jsonb) from public;
grant execute on function private.invoke_consume_push_outbox(jsonb) to postgres, service_role;

create or replace function public.on_push_outbox_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform private.invoke_consume_push_outbox(jsonb_build_object('outbox_id', new.id));
  return new;
end;
$$;

drop trigger if exists push_outbox_invoke_consume_trg on public.push_outbox;
create trigger push_outbox_invoke_consume_trg
after insert on public.push_outbox
for each row
execute function public.on_push_outbox_insert();

do $cron$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id from cron.job where jobname = 'consume-push-outbox' limit 1;
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'consume-push-outbox',
    '* * * * *',
    $job$select private.invoke_consume_push_outbox('{"limit": 50}'::jsonb);$job$
  );
exception
  when others then
    raise notice '[push] pg_cron schedule skipped: %', sqlerrm;
end $cron$;
