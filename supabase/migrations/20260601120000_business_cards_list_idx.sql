-- List queries: eq(type) + eq(city) + order(created_at desc) + limit
create index if not exists business_cards_type_city_created_idx
  on public.business_cards (type, city, created_at desc)
  where type is not null;

create index if not exists business_cards_city_created_idx
  on public.business_cards (city, created_at desc);
