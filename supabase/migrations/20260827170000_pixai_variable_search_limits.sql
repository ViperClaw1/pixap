-- PixAI search: variable result counts instead of a fixed fallback of 15.
-- Direct FTS matches: p_limit (caller passes random 8..15).
-- Indirect / rating fallback: p_fallback_limit (caller passes random 5..8).

drop function if exists public.search_business_cards_in_city(text, uuid, boolean, integer, text, text);

create or replace function public.search_business_cards_in_city(
  p_city                text,
  p_category_id         uuid    default null,
  p_is_restaurant_table boolean default false,
  p_limit               integer default 8,
  p_category_name       text    default null,
  p_query               text    default null,
  p_fallback_limit      integer default null
)
returns table (
  id            uuid,
  name          text,
  address       text,
  city          text,
  rating        numeric,
  booking_price numeric,
  tags          text[],
  cuisine_types text[],
  menu_items    text[],
  price_tier    smallint,
  category_id   uuid,
  image         text,
  images        text[],
  blurhashes    text[],
  rank          real,
  fts_matched   boolean
)
language plpgsql
stable
as $$
declare
  v_tsquery        tsquery;
  v_fts_count      integer := 0;
  v_limit          integer := greatest(1, least(coalesce(p_limit, 8), 20));
  v_fallback_limit integer := greatest(1, least(coalesce(p_fallback_limit, p_limit, 8), 20));
begin
  if coalesce(trim(p_query), '') <> '' then
    v_tsquery :=
      websearch_to_tsquery('simple', p_query) ||
      websearch_to_tsquery('russian', p_query);
  end if;

  if v_tsquery is not null then
    return query
    select
      bc.id,
      bc.name,
      bc.address,
      bc.city,
      bc.rating,
      bc.booking_price,
      bc.tags,
      coalesce(bc.cuisine_types, '{}'::text[]),
      coalesce(bc.menu_items, '{}'::text[]),
      bc.price_tier,
      bc.category_id,
      bc.image,
      bc.images,
      bc.blurhashes,
      ts_rank(bc.search_vector, v_tsquery) as rank,
      true as fts_matched
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
        or (p_category_id is null and coalesce(trim(p_category_name), '') = '')
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
      and bc.search_vector @@ v_tsquery
    order by rank desc, bc.rating desc nulls last
    limit v_limit;

    get diagnostics v_fts_count = row_count;
  end if;

  if v_tsquery is null or v_fts_count = 0 then
    return query
    select
      bc.id,
      bc.name,
      bc.address,
      bc.city,
      bc.rating,
      bc.booking_price,
      bc.tags,
      coalesce(bc.cuisine_types, '{}'::text[]),
      coalesce(bc.menu_items, '{}'::text[]),
      bc.price_tier,
      bc.category_id,
      bc.image,
      bc.images,
      bc.blurhashes,
      0::real as rank,
      false as fts_matched
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
        or (p_category_id is null and coalesce(trim(p_category_name), '') = '')
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
    order by bc.rating desc nulls last
    limit v_fallback_limit;
  end if;
end;
$$;

grant execute on function public.search_business_cards_in_city(
  text, uuid, boolean, integer, text, text, integer
) to anon, authenticated;

drop function if exists public.search_business_cards_nearby(
  double precision, double precision, double precision, text, uuid, boolean, integer, text, text
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
  p_query               text             default null,
  p_fallback_limit      integer          default null
)
returns table (
  id             uuid,
  name           text,
  address        text,
  city           text,
  rating         numeric,
  booking_price  numeric,
  tags           text[],
  cuisine_types  text[],
  menu_items     text[],
  price_tier     smallint,
  category_id    uuid,
  image          text,
  images         text[],
  blurhashes     text[],
  distance_miles double precision,
  rank           real,
  fts_matched    boolean
)
language plpgsql
stable
as $$
declare
  v_tsquery        tsquery;
  v_fts_count      integer := 0;
  v_limit          integer := greatest(1, least(coalesce(p_limit, 8), 20));
  v_fallback_limit integer := greatest(1, least(coalesce(p_fallback_limit, p_limit, 8), 20));
  v_radius_m       double precision := greatest(0.1, coalesce(p_radius_miles, 5)) * 1609.344;
begin
  if coalesce(trim(p_query), '') <> '' then
    v_tsquery :=
      websearch_to_tsquery('simple', p_query) ||
      websearch_to_tsquery('russian', p_query);
  end if;

  if v_tsquery is not null then
    return query
    select
      bc.id,
      bc.name,
      bc.address,
      bc.city,
      bc.rating,
      bc.booking_price,
      bc.tags,
      coalesce(bc.cuisine_types, '{}'::text[]),
      coalesce(bc.menu_items, '{}'::text[]),
      bc.price_tier,
      bc.category_id,
      bc.image,
      bc.images,
      bc.blurhashes,
      st_distance(
        st_setsrid(st_makepoint(bc.longitude, bc.latitude), 4326)::geography,
        st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography
      ) / 1609.344 as distance_miles,
      ts_rank(bc.search_vector, v_tsquery) as rank,
      true as fts_matched
    from public.business_cards bc
    where bc.latitude is not null
      and bc.longitude is not null
      and st_dwithin(
        st_setsrid(st_makepoint(bc.longitude, bc.latitude), 4326)::geography,
        st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography,
        v_radius_m
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
        or (p_category_id is null and coalesce(trim(p_category_name), '') = '')
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
      and bc.search_vector @@ v_tsquery
    order by rank desc, distance_miles asc, bc.rating desc nulls last
    limit v_limit;

    get diagnostics v_fts_count = row_count;
  end if;

  if v_tsquery is null or v_fts_count = 0 then
    return query
    select
      bc.id,
      bc.name,
      bc.address,
      bc.city,
      bc.rating,
      bc.booking_price,
      bc.tags,
      coalesce(bc.cuisine_types, '{}'::text[]),
      coalesce(bc.menu_items, '{}'::text[]),
      bc.price_tier,
      bc.category_id,
      bc.image,
      bc.images,
      bc.blurhashes,
      st_distance(
        st_setsrid(st_makepoint(bc.longitude, bc.latitude), 4326)::geography,
        st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography
      ) / 1609.344 as distance_miles,
      0::real as rank,
      false as fts_matched
    from public.business_cards bc
    where bc.latitude is not null
      and bc.longitude is not null
      and st_dwithin(
        st_setsrid(st_makepoint(bc.longitude, bc.latitude), 4326)::geography,
        st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography,
        v_radius_m
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
        or (p_category_id is null and coalesce(trim(p_category_name), '') = '')
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
    order by distance_miles asc, bc.rating desc nulls last
    limit v_fallback_limit;
  end if;
end;
$$;

grant execute on function public.search_business_cards_nearby(
  double precision, double precision, double precision, text, uuid, boolean, integer, text, text, integer
) to anon, authenticated;
