-- Production hardening for IAP subscriptions:
-- - transaction idempotency;
-- - permanent purchase ownership;
-- - periodic reconciliation audit + scheduler.

create schema if not exists private;

create table if not exists public.processed_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_id text not null,
  platform text not null check (platform in ('ios', 'android')),
  original_transaction_id text,
  purchase_token text,
  user_id uuid references auth.users (id) on delete set null,
  entitlement_id uuid references public.subscription_entitlements (id) on delete set null,
  source text not null check (
    source in ('purchase', 'restore', 'sync', 'apple_assn', 'google_rtdn', 'reconciliation')
  ),
  processed_at timestamptz not null default now(),
  constraint processed_transactions_transaction_id_unique unique (transaction_id)
);

create index if not exists processed_transactions_user_processed_idx
  on public.processed_transactions (user_id, processed_at desc);

create index if not exists processed_transactions_entitlement_idx
  on public.processed_transactions (entitlement_id, processed_at desc);

create table if not exists public.subscription_purchase_ownerships (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('ios', 'android')),
  store_reference text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text,
  original_transaction_id text,
  purchase_token text,
  first_transaction_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_purchase_ownerships_platform_ref_unique unique (platform, store_reference)
);

create index if not exists subscription_purchase_ownerships_user_idx
  on public.subscription_purchase_ownerships (user_id, created_at desc);

create table if not exists public.subscription_reconciliation_audit (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid references public.subscription_entitlements (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  platform text not null check (platform in ('ios', 'android')),
  action text not null check (action in ('no_change', 'state_changed', 'error')),
  previous_status text,
  new_status text,
  previous_expires_at timestamptz,
  new_expires_at timestamptz,
  details jsonb not null default '{}'::jsonb,
  error_text text,
  created_at timestamptz not null default now()
);

create index if not exists subscription_reconciliation_audit_created_idx
  on public.subscription_reconciliation_audit (created_at desc);

create index if not exists subscription_reconciliation_audit_entitlement_idx
  on public.subscription_reconciliation_audit (entitlement_id, created_at desc);

alter table public.processed_transactions enable row level security;
alter table public.subscription_purchase_ownerships enable row level security;
alter table public.subscription_reconciliation_audit enable row level security;

-- Writes and reads are service-role only. Do not expose financial/audit internals via PostgREST.

create unique index if not exists subscription_transactions_platform_transaction_unique
  on public.subscription_transactions (platform, transaction_id)
  where transaction_id is not null;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function private.invoke_iap_reconcile_subscriptions(payload jsonb default '{}'::jsonb)
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
    raise warning '[iap-reconcile] skipped: vault secrets project_url and/or service_role_key missing';
    return null;
  end if;

  select net.http_post(
    url := rtrim(base_url, '/') || '/functions/v1/iap-reconcile-subscriptions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := coalesce(payload, '{}'::jsonb)
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function private.invoke_iap_reconcile_subscriptions(jsonb) from public;
grant execute on function private.invoke_iap_reconcile_subscriptions(jsonb) to postgres, service_role;

do $cron$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id from cron.job where jobname = 'iap-reconcile-subscriptions' limit 1;
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'iap-reconcile-subscriptions',
    '17 3 * * *',
    $job$select private.invoke_iap_reconcile_subscriptions('{"limit": 500}'::jsonb);$job$
  );
exception
  when others then
    raise notice '[iap-reconcile] pg_cron schedule skipped: %', sqlerrm;
end $cron$;
