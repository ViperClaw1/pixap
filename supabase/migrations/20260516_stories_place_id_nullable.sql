-- Stories may exist without a business_card (e.g. "add to story" from address-only posts).

alter table public.stories alter column place_id drop not null;
