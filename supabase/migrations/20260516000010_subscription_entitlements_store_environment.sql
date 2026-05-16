-- Store App Store / Play billing environment for clearer UI in sandbox testing.

alter table public.subscription_entitlements
  add column if not exists store_environment text
  check (store_environment in ('production', 'sandbox'));
