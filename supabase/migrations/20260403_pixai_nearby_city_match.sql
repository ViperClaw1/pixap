-- Case-insensitive, trimmed city match for PixAI nearby search (matches city-wide query behavior).
create or replace function public.search_business_cards_nearby(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_miles double precision default 5,
  p_city text default null,
  p_category_id uuid default null,
  p_is_restaurant_table boolean default false,
  p_limit integer default 8
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
      or trim(bc.city) ilike trim(p_city)
    )
    and (p_category_id is null or bc.category_id = p_category_id)
    and (
      p_is_restaurant_table = false
      or lower(bc.name) like '%restaurant%'
      or coalesce(bc.tags, '{}') @> array['restaurant']::text[]
      or coalesce(bc.tags, '{}') @> array['table']::text[]
    )
  order by distance_miles asc, bc.rating desc
  limit greatest(1, least(coalesce(p_limit, 8), 20));
$$;
