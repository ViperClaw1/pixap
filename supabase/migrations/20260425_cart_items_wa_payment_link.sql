alter table public.cart_items
  add column if not exists wa_payment_link text null;

comment on column public.cart_items.wa_payment_link is 'Payment URL received from venue via WhatsApp get_payment_link template.';
