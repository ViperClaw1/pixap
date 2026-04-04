-- Include business_cards.image in PixAI search RPCs for list thumbnails.

drop function if exists public.search_business_cards_nearby(
  double precision,
  double precision,
  double precision,
  text,
  uuid,
  boolean,
  integer,
  text
);

drop function if exists public.search_business_cards_in_city(
  text,
  uuid,
  boolean,
  integer,
  text
);

create or replace function public.search_business_cards_nearby(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_miles double precision default 5,
  p_city text default null,
  p_category_id uuid default null,
  p_is_restaurant_table boolean default false,
  p_limit integer default 8,
  p_category_name text default null
)
returns table (
  id uuid,
  name text,
  address text,
  city text,
  rating numeric,
  booking_price numeric,
  tags text[],
  category_id uuid,
  image text,
  distance_miles double precision
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
    st_distance(
      bc.location,
      st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography
    ) / 1609.344 as distance_miles
  from public.business_cards bc
  where bc.location is not null
    and st_dwithin(
      bc.location,
      st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography,
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
  order by distance_miles asc, bc.rating desc
  limit greatest(1, least(coalesce(p_limit, 8), 20));
$$;

grant execute on function public.search_business_cards_nearby(
  double precision,
  double precision,
  double precision,
  text,
  uuid,
  boolean,
  integer,
  text
) to anon, authenticated;

create or replace function public.search_business_cards_in_city(
  p_city text,
  p_category_id uuid default null,
  p_is_restaurant_table boolean default false,
  p_limit integer default 8,
  p_category_name text default null
)
returns table (
  id uuid,
  name text,
  address text,
  city text,
  rating numeric,
  booking_price numeric,
  tags text[],
  category_id uuid,
  image text
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
    bc.image
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
  order by bc.rating desc nulls last
  limit greatest(1, least(coalesce(p_limit, 8), 20));
$$;

grant execute on function public.search_business_cards_in_city(
  text,
  uuid,
  boolean,
  integer,
  text
) to anon, authenticated;
