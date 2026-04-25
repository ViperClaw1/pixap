-- Core subscription model for PixAI premium entitlement.

create table if not exists public.subscription_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  product_id text not null,
  status text not null check (status in ('active', 'trialing', 'grace_period', 'expired', 'revoked', 'billing_retry')),
  expires_at timestamptz,
  is_trial boolean not null default false,
  will_renew boolean not null default false,
  original_transaction_id text,
  purchase_token text,
  latest_transaction_id text,
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_entitlements_user_product_platform_key unique (user_id, product_id, platform),
  constraint subscription_entitlements_reference_required check (
    coalesce(original_transaction_id, '') <> '' or coalesce(purchase_token, '') <> ''
  )
);

create index if not exists subscription_entitlements_user_status_idx
  on public.subscription_entitlements (user_id, status);

create index if not exists subscription_entitlements_user_expires_idx
  on public.subscription_entitlements (user_id, expires_at desc);

create table if not exists public.subscription_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entitlement_id uuid references public.subscription_entitlements (id) on delete set null,
  platform text not null check (platform in ('ios', 'android')),
  product_id text not null,
  transaction_id text,
  original_transaction_id text,
  purchase_token text,
  starts_at timestamptz,
  expires_at timestamptz,
  status text not null check (status in ('purchased', 'trialing', 'renewed', 'grace_period', 'expired', 'revoked', 'refunded', 'billing_retry')),
  is_trial boolean not null default false,
  raw_payload jsonb not null default '{}'::jsonb,
  raw_payload_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscription_transactions_user_created_idx
  on public.subscription_transactions (user_id, created_at desc);

create index if not exists subscription_transactions_ref_lookup_idx
  on public.subscription_transactions (platform, coalesce(original_transaction_id, purchase_token), created_at desc);

create table if not exists public.subscription_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  product_id text,
  original_transaction_id text,
  purchase_token text,
  source text not null check (source in ('purchase', 'restore', 'sync', 'apple_assn', 'google_rtdn')),
  raw_payload jsonb not null default '{}'::jsonb,
  raw_payload_hash text not null,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists subscription_receipts_user_verified_idx
  on public.subscription_receipts (user_id, verified_at desc);

create unique index if not exists subscription_receipts_payload_hash_unique
  on public.subscription_receipts (platform, raw_payload_hash);

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('ios', 'android')),
  source text not null check (source in ('apple_assn', 'google_rtdn', 'manual_sync')),
  event_id text not null,
  event_type text,
  event_time timestamptz,
  payload jsonb not null default '{}'::jsonb,
  payload_hash text,
  processed boolean not null default false,
  processed_at timestamptz,
  error_text text,
  created_at timestamptz not null default now(),
  constraint subscription_events_platform_event_unique unique (platform, event_id)
);

create index if not exists subscription_events_unprocessed_idx
  on public.subscription_events (processed, created_at desc);

alter table if exists public.subscription_entitlements enable row level security;
alter table if exists public.subscription_transactions enable row level security;
alter table if exists public.subscription_receipts enable row level security;
alter table if exists public.subscription_events enable row level security;

drop policy if exists "subscription_entitlements_select_own" on public.subscription_entitlements;
create policy "subscription_entitlements_select_own"
on public.subscription_entitlements
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "subscription_transactions_select_own" on public.subscription_transactions;
create policy "subscription_transactions_select_own"
on public.subscription_transactions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "subscription_receipts_select_own" on public.subscription_receipts;
create policy "subscription_receipts_select_own"
on public.subscription_receipts
for select
to authenticated
using (auth.uid() = user_id);

-- Writes are service-role only. No authenticated insert/update/delete policies are created.
