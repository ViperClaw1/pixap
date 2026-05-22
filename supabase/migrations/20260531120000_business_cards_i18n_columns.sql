-- Localized copies of business_cards.name, description, tags.
-- Base columns (name, description, tags) remain English (en).
-- type stays a single business_card_type enum (featured | recommended) for all locales.

comment on column public.business_cards.name is 'Venue name (English).';
comment on column public.business_cards.description is 'Venue description (English).';
comment on column public.business_cards.tags is 'Venue tags (English).';

alter table public.business_cards
  add column if not exists name_ru text,
  add column if not exists name_es text,
  add column if not exists name_pt text,
  add column if not exists name_fr text,
  add column if not exists name_de text,
  add column if not exists description_ru text,
  add column if not exists description_es text,
  add column if not exists description_pt text,
  add column if not exists description_fr text,
  add column if not exists description_de text,
  add column if not exists tags_ru text[],
  add column if not exists tags_es text[],
  add column if not exists tags_pt text[],
  add column if not exists tags_fr text[],
  add column if not exists tags_de text[];

comment on column public.business_cards.name_ru is 'Venue name (Russian).';
comment on column public.business_cards.name_es is 'Venue name (Spanish).';
comment on column public.business_cards.name_pt is 'Venue name (Portuguese).';
comment on column public.business_cards.name_fr is 'Venue name (French).';
comment on column public.business_cards.name_de is 'Venue name (German).';

comment on column public.business_cards.description_ru is 'Venue description (Russian).';
comment on column public.business_cards.description_es is 'Venue description (Spanish).';
comment on column public.business_cards.description_pt is 'Venue description (Portuguese).';
comment on column public.business_cards.description_fr is 'Venue description (French).';
comment on column public.business_cards.description_de is 'Venue description (German).';

comment on column public.business_cards.tags_ru is 'Venue tags (Russian).';
comment on column public.business_cards.tags_es is 'Venue tags (Spanish).';
comment on column public.business_cards.tags_pt is 'Venue tags (Portuguese).';
comment on column public.business_cards.tags_fr is 'Venue tags (French).';
comment on column public.business_cards.tags_de is 'Venue tags (German).';
