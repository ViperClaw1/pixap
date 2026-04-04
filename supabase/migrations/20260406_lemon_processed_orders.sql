-- Idempotency for Lemon Squeezy webhooks (order_created).

create table if not exists public.processed_lemon_orders (
  lemon_order_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  checkout_type text not null default 'shopping_cart',
  created_at timestamptz not null default now()
);

alter table public.processed_lemon_orders enable row level security;

-- No user-facing policies; only service role (webhook) writes.

comment on table public.processed_lemon_orders is 'Dedupes Lemon Squeezy order_created webhooks before side effects (e.g. clearing cart).';
