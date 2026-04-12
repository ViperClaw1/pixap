alter table public.business_cards
  add column if not exists contact_whatsapp text null;

comment on column public.business_cards.contact_whatsapp is 'Vendor WhatsApp (E.164 or digits); used for availability deep links.';

alter table public.cart_items
  add column if not exists is_restaurant_table boolean not null default false;

comment on column public.cart_items.is_restaurant_table is 'True when draft is a restaurant table request (PixAI); drives WhatsApp template.';
