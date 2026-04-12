-- When a service booking cart line is paid, we keep the row (status = paid) for purchase history.
alter table if exists public.cart_items
  add column if not exists paid_at timestamptz;

comment on column public.cart_items.paid_at is 'Set when payment succeeds (e.g. PayPal capture).';
