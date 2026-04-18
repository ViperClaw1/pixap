-- WhatsApp / n8n automation state for service cart rows (venue outreach + status UI).

alter table public.cart_items
  add column if not exists wa_n8n_callback_token uuid null;

alter table public.cart_items
  add column if not exists wa_n8n_started_at timestamptz null;

alter table public.cart_items
  add column if not exists wa_status_lines jsonb not null default '[]'::jsonb;

alter table public.cart_items
  add column if not exists wa_confirmable boolean not null default false;

alter table public.cart_items
  add column if not exists wa_confirmed_slot text null;

alter table public.cart_items
  add column if not exists wa_confirmed_price text null;

comment on column public.cart_items.wa_n8n_callback_token is 'Secret correlation id for n8n → app callbacks; set before first outbound n8n POST.';
comment on column public.cart_items.wa_n8n_started_at is 'Set when outbound n8n webhook was successfully invoked (idempotency).';
comment on column public.cart_items.wa_status_lines is 'Ordered status lines shown in Cart (JSON array of strings).';
comment on column public.cart_items.wa_confirmable is 'When true, user may Confirm to move booking off cart.';
comment on column public.cart_items.wa_confirmed_slot is 'Optional slot label from n8n (e.g. 20:30).';
comment on column public.cart_items.wa_confirmed_price is 'Optional price string from n8n (e.g. $25).';
