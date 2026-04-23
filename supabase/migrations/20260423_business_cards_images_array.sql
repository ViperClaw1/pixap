-- Replace legacy single-image column with an ordered images list.
-- Keep `image` during transition to avoid breaking older clients/functions.

alter table if exists public.business_cards
  add column if not exists images text[] not null default '{}';

update public.business_cards
set images = array[image]
where (images is null or cardinality(images) = 0)
  and image is not null
  and btrim(image) <> '';
