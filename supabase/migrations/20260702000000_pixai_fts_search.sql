-- Add full-text search support to business_cards for PixAI specific queries
-- (e.g. "restaurants with cheap pizza").
--
-- Three changes:
--   1. search_vector tsvector column (generated stored) covering name, description,
--      tags in both 'simple' and 'russian' dictionaries, including i18n _ru columns.
--   2. GIN index on search_vector.
--   3. Updated search_business_cards_in_city and search_business_cards_nearby RPCs
--      with a new optional p_query parameter for FTS filtering + ranking.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. search_vector column
--    Cannot use GENERATED ALWAYS AS because to_tsvector('russian',...) is STABLE
--    not IMMUTABLE. Use a trigger + backfill instead.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.business_cards
  add column if not exists search_vector tsvector;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. GIN index
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists business_cards_search_vector_gin
  on public.business_cards using gin(search_vector);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trigger function to keep search_vector up to date on INSERT / UPDATE
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.business_cards_search_vector_update()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple',  coalesce(new.name,            '')), 'A') ||
    setweight(to_tsvector('russian', coalesce(new.name_ru, new.name,   '')), 'A') ||
    setweight(to_tsvector('simple',  coalesce(new.description,     '')), 'B') ||
    setweight(to_tsvector('russian', coalesce(new.description_ru, new.description, '')), 'B') ||
    setweight(to_tsvector('simple',  coalesce(array_to_string(new.tags,    ' '), '')), 'B') ||
    setweight(to_tsvector('russian', coalesce(array_to_string(new.tags_ru, ' '), array_to_string(new.tags, ' '), '')), 'B');
  return new;
end;
$$;

create trigger business_cards_search_vector_trigger
  before insert or update on public.business_cards
  for each row execute function public.business_cards_search_vector_update();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Backfill existing rows
-- ─────────────────────────────────────────────────────────────────────────────

update public.business_cards
set search_vector =
  setweight(to_tsvector('simple',  coalesce(name,            '')), 'A') ||
  setweight(to_tsvector('russian', coalesce(name_ru, name,   '')), 'A') ||
  setweight(to_tsvector('simple',  coalesce(description,     '')), 'B') ||
  setweight(to_tsvector('russian', coalesce(description_ru, description, '')), 'B') ||
  setweight(to_tsvector('simple',  coalesce(array_to_string(tags,    ' '), '')), 'B') ||
  setweight(to_tsvector('russian', coalesce(array_to_string(tags_ru, ' '), array_to_string(tags, ' '), '')), 'B')
where search_vector is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5a. search_business_cards_in_city — add p_query + FTS
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists public.search_business_cards_in_city(text, uuid, boolean, integer, text);

create or replace function public.search_business_cards_in_city(
  p_city              text,
  p_category_id       uuid    default null,
  p_is_restaurant_table boolean default false,
  p_limit             integer default 8,
  p_category_name     text    default null,
  p_query             text    default null
)
returns table (
  id            uuid,
  name          text,
  address       text,
  city          text,
  rating        numeric,
  booking_price numeric,
  tags          text[],
  category_id   uuid,
  image         text,
  images        text[],
  blurhashes    text[],
  rank          real
)
language sql
stable
as $$
  select
    bc.id,
    bc.name,
    bc.address,
    bc.city,
    bc.rating,
    bc.booking_price,
    bc.tags,
    bc.category_id,
    bc.image,
    bc.images,
    bc.blurhashes,
    case
      when coalesce(trim(p_query), '') <> ''
        then ts_rank(
               bc.search_vector,
               websearch_to_tsquery('simple',  p_query) ||
               websearch_to_tsquery('russian', p_query)
             )
      else 0
    end as rank
  from public.business_cards bc
  where trim(coalesce(bc.city, '')) <> ''
    and trim(coalesce(bc.city, '')) ilike trim(coalesce(p_city, ''))
    and (
      p_is_restaurant_table = false
      or lower(bc.name) like '%restaurant%'
      or coalesce(bc.tags, '{}') @> array['restaurant']::text[]
      or coalesce(bc.tags, '{}') @> array['table']::text[]
    )
    and (
      p_is_restaurant_table = true
      or (
        (p_category_id is not null and bc.category_id = p_category_id)
        or (
          coalesce(trim(p_category_name), '') <> ''
          and exists (
            select 1
            from public.categories c
            where c.id = bc.category_id
              and lower(trim(c.name)) = lower(trim(p_category_name))
          )
        )
      )
    )
    and (
      coalesce(trim(p_query), '') = ''
      or bc.search_vector @@
         (websearch_to_tsquery('simple',  p_query) ||
          websearch_to_tsquery('russian', p_query))
    )
  order by
    rank desc,
    bc.rating desc nulls last
  limit greatest(1, least(coalesce(p_limit, 8), 20));
$$;

grant execute on function public.search_business_cards_in_city(
  text, uuid, boolean, integer, text, text
) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5b. search_business_cards_nearby — add p_query + FTS
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists public.search_business_cards_nearby(
  double precision, double precision, double precision, text, uuid, boolean, integer, text
);

create or replace function public.search_business_cards_nearby(
  p_latitude            double precision,
  p_longitude           double precision,
  p_radius_miles        double precision default 5,
  p_city                text             default null,
  p_category_id         uuid             default null,
  p_is_restaurant_table boolean          default false,
  p_limit               integer          default 8,
  p_category_name       text             default null,
  p_query               text             default null
)
returns table (
  id             uuid,
  name           text,
  address        text,
  city           text,
  rating         numeric,
  booking_price  numeric,
  tags           text[],
  category_id    uuid,
  image          text,
  images         text[],
  blurhashes     text[],
  distance_miles double precision,
  rank           real
)
language sql
stable
as $$
  select
    bc.id,
    bc.name,
    bc.address,
    bc.city,
    bc.rating,
    bc.booking_price,
    bc.tags,
    bc.category_id,
    bc.image,
    bc.images,
    bc.blurhashes,
    st_distance(
      st_setsrid(st_makepoint(bc.longitude, bc.latitude), 4326)::geography,
      st_setsrid(st_makepoint(p_longitude,  p_latitude),  4326)::geography
    ) / 1609.344 as distance_miles,
    case
      when coalesce(trim(p_query), '') <> ''
        then ts_rank(
               bc.search_vector,
               websearch_to_tsquery('simple',  p_query) ||
               websearch_to_tsquery('russian', p_query)
             )
      else 0
    end as rank
  from public.business_cards bc
  where bc.latitude  is not null
    and bc.longitude is not null
    and st_dwithin(
      st_setsrid(st_makepoint(bc.longitude, bc.latitude), 4326)::geography,
      st_setsrid(st_makepoint(p_longitude,  p_latitude),  4326)::geography,
      greatest(0.1, coalesce(p_radius_miles, 5)) * 1609.344
    )
    and (
      p_city is null
      or trim(coalesce(bc.city, '')) ilike trim(coalesce(p_city, ''))
    )
    and (
      p_is_restaurant_table = false
      or lower(bc.name) like '%restaurant%'
      or coalesce(bc.tags, '{}') @> array['restaurant']::text[]
      or coalesce(bc.tags, '{}') @> array['table']::text[]
    )
    and (
      p_is_restaurant_table = true
      or (
        (p_category_id is not null and bc.category_id = p_category_id)
        or (
          coalesce(trim(p_category_name), '') <> ''
          and exists (
            select 1
            from public.categories c
            where c.id = bc.category_id
              and lower(trim(c.name)) = lower(trim(p_category_name))
          )
        )
      )
    )
    and (
      coalesce(trim(p_query), '') = ''
      or bc.search_vector @@
         (websearch_to_tsquery('simple',  p_query) ||
          websearch_to_tsquery('russian', p_query))
    )
  order by
    rank desc,
    distance_miles asc,
    bc.rating desc nulls last
  limit greatest(1, least(coalesce(p_limit, 8), 20));
$$;

grant execute on function public.search_business_cards_nearby(
  double precision, double precision, double precision, text, uuid, boolean, integer, text, text
) to anon, authenticated;
