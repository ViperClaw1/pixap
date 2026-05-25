-- Venue catalogue default booking price is 0 until the owner confirms a price (e.g. via WhatsApp).
-- Column: business_cards.booking_price (not a separate "price" column).

alter table if exists public.business_cards
  alter column booking_price set default 0;

update public.business_cards
set booking_price = 0
where booking_price is distinct from 0;

comment on column public.business_cards.booking_price is
  'Default booking price for the venue (0 until owner confirms cost; may be updated after WhatsApp booking flow).';
