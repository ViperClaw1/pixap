-- Posts may exist without a business_card: store geocoded address on the row itself.

alter table public.posts alter column place_id drop not null;

alter table public.posts
  add column if not exists geo_place_name text,
  add column if not exists geo_formatted_address text,
  add column if not exists geo_latitude double precision,
  add column if not exists geo_longitude double precision,
  add column if not exists geo_google_place_id text;

alter table public.posts drop constraint if exists posts_place_or_geo_check;

alter table public.posts
  add constraint posts_place_or_geo_check check (
    (place_id is not null)
    or (
      geo_formatted_address is not null
      and geo_latitude is not null
      and geo_longitude is not null
      and trim(geo_formatted_address) <> ''
    )
  );
