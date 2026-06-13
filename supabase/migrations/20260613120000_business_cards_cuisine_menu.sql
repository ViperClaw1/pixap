-- Add cuisine/menu metadata to business_cards for PixAI dish search (FTS).
-- Populated from Google Places New API (primaryType → cuisine_types) and static menu dictionary.

alter table public.business_cards
  add column if not exists cuisine_types   text[]   default '{}',
  add column if not exists menu_items      text[]   default '{}',
  add column if not exists price_tier      smallint default null,
  add column if not exists google_place_id text     default null;

create index if not exists business_cards_google_place_id_idx
  on public.business_cards (google_place_id)
  where google_place_id is not null;

-- Keep search_vector in sync with cuisine_types and menu_items.
create or replace function public.business_cards_search_vector_update()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple',  coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('russian', coalesce(new.name_ru, new.name, '')), 'A') ||
    setweight(to_tsvector('simple',  coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('russian', coalesce(new.description_ru, new.description, '')), 'B') ||
    setweight(to_tsvector('simple',  coalesce(array_to_string(new.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('russian', coalesce(array_to_string(new.tags_ru, ' '), array_to_string(new.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('simple',  coalesce(array_to_string(new.cuisine_types, ' '), '')), 'A') ||
    setweight(to_tsvector('simple',  coalesce(array_to_string(new.menu_items, ' '), '')), 'B') ||
    setweight(to_tsvector('russian', coalesce(array_to_string(new.menu_items, ' '), '')), 'B');
  return new;
end;
$$;

-- Rebuild search_vector for all existing rows (trigger only fires on INSERT/UPDATE).
update public.business_cards
set
  cuisine_types = coalesce(cuisine_types, '{}'),
  menu_items    = coalesce(menu_items, '{}')
where true;
