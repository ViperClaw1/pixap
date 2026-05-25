-- Distinct business_cards.city values for city pickers (home, vibe match, AI booking).
-- Row-limited client queries missed cities when many venues share the same city label.

create or replace function public.get_business_card_cities()
returns table (city text)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct trim(bc.city) as city
  from public.business_cards bc
  where bc.city is not null
    and trim(bc.city) <> ''
  order by 1;
$$;

comment on function public.get_business_card_cities() is
  'All distinct non-empty business_cards.city values, trimmed and sorted.';

grant execute on function public.get_business_card_cities() to anon, authenticated;
