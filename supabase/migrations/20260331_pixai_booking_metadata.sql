alter table if exists public.cart_items
  add column if not exists persons integer,
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists customer_email text,
  add column if not exists comment text;

alter table if exists public.bookings
  add column if not exists persons integer,
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists customer_email text,
  add column if not exists comment text;

comment on column public.cart_items.persons is 'Number of people for booking draft.';
comment on column public.bookings.persons is 'Number of people for confirmed booking.';
