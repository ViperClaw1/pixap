create or replace function public.get_business_cards_localized(
  p_type text default null,
  p_city text default null,
  p_lang text default 'en',
  p_limit int default 120
)
returns table (
  id uuid,
  name text,
  description text,
  tags text[],
  images text[],
  image text,
  category_id uuid,
  city text,
  address text,
  rating double precision,
  booking_price numeric,
  phone text,
  contact_whatsapp text,
  type public.business_card_type,
  created_at timestamptz,
  latitude double precision,
  longitude double precision,
  blurhashes text[],
  category jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      nullif(lower(btrim(coalesce(p_type, ''))), '') as type_filter,
      nullif(
        lower(
          btrim(
            regexp_replace(
              replace(coalesce(p_city, ''), chr(160), ' '),
              '[[:space:]]+',
              ' ',
              'g'
            )
          )
        ),
        ''
      ) as city_filter,
      lower(coalesce(nullif(trim(p_lang), ''), 'en')) as lang
  )
  select
    bc.id,
    case params.lang
      when 'ru' then coalesce(nullif(trim(bc.name_ru), ''), bc.name)
      when 'es' then coalesce(nullif(trim(bc.name_es), ''), bc.name)
      when 'pt' then coalesce(nullif(trim(bc.name_pt), ''), bc.name)
      when 'fr' then coalesce(nullif(trim(bc.name_fr), ''), bc.name)
      when 'de' then coalesce(nullif(trim(bc.name_de), ''), bc.name)
      else bc.name
    end as name,
    case params.lang
      when 'ru' then coalesce(nullif(trim(bc.description_ru), ''), bc.description)
      when 'es' then coalesce(nullif(trim(bc.description_es), ''), bc.description)
      when 'pt' then coalesce(nullif(trim(bc.description_pt), ''), bc.description)
      when 'fr' then coalesce(nullif(trim(bc.description_fr), ''), bc.description)
      when 'de' then coalesce(nullif(trim(bc.description_de), ''), bc.description)
      else bc.description
    end as description,
    case params.lang
      when 'ru' then coalesce(bc.tags_ru, bc.tags)
      when 'es' then coalesce(bc.tags_es, bc.tags)
      when 'pt' then coalesce(bc.tags_pt, bc.tags)
      when 'fr' then coalesce(bc.tags_fr, bc.tags)
      when 'de' then coalesce(bc.tags_de, bc.tags)
      else bc.tags
    end as tags,
    bc.images,
    bc.image,
    bc.category_id,
    bc.city,
    bc.address,
    bc.rating,
    bc.booking_price,
    bc.phone,
    bc.contact_whatsapp,
    bc.type,
    bc.created_at,
    bc.latitude,
    bc.longitude,
    bc.blurhashes,
    case
      when c.id is not null then jsonb_build_object('id', c.id, 'name', c.name)
      else null
    end as category
  from public.business_cards bc
  left join public.categories c on c.id = bc.category_id
  cross join params
  where (params.type_filter is null or bc.type = params.type_filter::public.business_card_type)
    and (
      params.city_filter is null
      or lower(
        btrim(
          regexp_replace(
            replace(coalesce(bc.city, ''), chr(160), ' '),
            '[[:space:]]+',
            ' ',
            'g'
          )
        )
      ) = params.city_filter
    )
  order by bc.created_at desc
  limit greatest(1, least(coalesce(p_limit, 120), 500));
$$;

grant execute on function public.get_business_cards_localized(text, text, text, int) to anon, authenticated;
