-- Google Places may expose a Turkish district as administrative_area_level_2
-- and the actual city/province as administrative_area_level_1.
with normalized as (
  select
    id,
    trim(substring(address from '/([^/,]+),[[:space:]]*Türkiye[[:space:]]*$')) as city_name
  from public.business_cards
  where address ~ '/[^/,]+,[[:space:]]*Türkiye[[:space:]]*$'
)
update public.business_cards as bc
set city = normalized.city_name || ', Türkiye'
from normalized
where bc.id = normalized.id
  and normalized.city_name is not null
  and bc.city is distinct from normalized.city_name || ', Türkiye';
