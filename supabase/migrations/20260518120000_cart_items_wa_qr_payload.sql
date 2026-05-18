alter table public.cart_items
  add column if not exists wa_qr_payload jsonb null;

comment on column public.cart_items.wa_qr_payload is 'JSON payload encoded in booking QR (client, place, slot, price terms).';
