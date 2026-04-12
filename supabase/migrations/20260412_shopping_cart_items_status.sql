-- Active cart lines stay status = created; after successful payment they become paid (kept for history).
alter table if exists public.shopping_cart_items
  add column if not exists status text not null default 'created',
  add column if not exists paid_at timestamptz;

alter table if exists public.shopping_cart_items
  drop constraint if exists shopping_cart_items_status_check;

alter table if exists public.shopping_cart_items
  add constraint shopping_cart_items_status_check
  check (status in ('created', 'paid'));

comment on column public.shopping_cart_items.status is 'created = in cart; paid = checkout completed.';
comment on column public.shopping_cart_items.paid_at is 'Set when payment succeeds.';
