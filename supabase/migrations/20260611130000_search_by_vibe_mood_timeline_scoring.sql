-- Vibe Match: slug-based mood tokens, timeline boosts, user_preferences scoring, i18n tags.

create or replace function public.search_by_vibe(
  p_mood text,
  p_timeline text,
  p_city text,
  p_limit integer default 5
)
returns table (
  venue_id uuid,
  name text,
  vibe_score numeric,
  booking_price numeric,
  description text,
  is_restaurant_table boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      auth.uid() as uid,
      nullif(trim(coalesce(p_city, '')), '') as city_q,
      greatest(1, least(coalesce(p_limit, 5), 20)) as lim,
      trim(coalesce(p_mood, '')) as mood_plain,
      lower(trim(coalesce(p_timeline, ''))) as timeline_q
  ),
  profile_prefs as (
    select coalesce(
      (select p.vibe_preferences from public.profiles p where p.id = (select uid from params)),
      '{}'::jsonb
    ) as j
  ),
  user_prefs as (
    select
      coalesce(up.favorite_categories, '{}'::text[]) as cats,
      coalesce(up.vibe_preferences, '{}'::text[]) as vibes,
      coalesce(up.habits, '{}'::text[]) as habits,
      coalesce(up.favorite_music, '{}'::text[]) as music
    from params pr
    left join public.user_preferences up on up.user_id = pr.uid
  ),
  mood_tokens as (
    select distinct lower(btrim(regexp_replace(u.t, '[^a-z0-9_]+', '', 'g'))) as token, 5::numeric as weight
    from params x
    cross join lateral unnest(
      regexp_split_to_array(lower(coalesce(x.mood_plain, '')), '[,\s;]+')
    ) as u(t)
    where length(btrim(regexp_replace(u.t, '[^a-z0-9_]+', '', 'g'))) > 0
  ),
  pref_tokens as (
    select distinct lower(btrim(t)) as token, 2::numeric as weight
    from user_prefs, unnest(cats) as t
    where btrim(t) <> ''
    union
    select distinct lower(btrim(t)), 3.5::numeric
    from user_prefs, unnest(vibes) as t
    where btrim(t) <> ''
    union
    select distinct lower(btrim(t)), 1.5::numeric
    from user_prefs, unnest(habits) as t
    where btrim(t) <> ''
    union
    select distinct lower(btrim(t)), 1::numeric
    from user_prefs, unnest(music) as t
    where btrim(t) <> ''
    union
    select distinct lower(btrim(elt::text)), 2.5::numeric
    from profile_prefs pr
    cross join lateral jsonb_array_elements_text(
      case
        when jsonb_typeof(pr.j -> 'preferred_tags') = 'array' then pr.j -> 'preferred_tags'
        else '[]'::jsonb
      end
    ) as elt
    where btrim(elt::text) <> ''
  ),
  avoid_tokens as (
    select distinct lower(btrim(elt::text)) as token
    from profile_prefs pr
    cross join lateral jsonb_array_elements_text(
      case
        when jsonb_typeof(pr.j -> 'avoid_tags') = 'array' then pr.j -> 'avoid_tags'
        else '[]'::jsonb
      end
    ) as elt
    where btrim(elt::text) <> ''
  ),
  timeline_tokens as (
    select distinct lower(btrim(t)) as token, 3::numeric as weight
    from params x
    cross join lateral unnest(
      case x.timeline_q
        when 'evening' then array[
          'restaurants', 'wine_bars', 'cocktail_bars', 'rooftop', 'lounges', 'cafes',
          'romantic', 'cozy', 'aesthetic', 'casual', 'jazz_bars'
        ]::text[]
        when 'night' then array[
          'bars', 'clubs', 'live_music', 'party_places', 'social', 'energetic',
          'lounges', 'cocktail_bars', 'networking'
        ]::text[]
        when 'late_night' then array[
          'clubs', 'underground', 'techno', 'party_places', 'chaotic', 'loud',
          'hookah_lounges', 'energetic'
        ]::text[]
        else array[]::text[]
      end
    ) as t
    where btrim(t) <> ''
  ),
  scored as (
    select
      bc.id as venue_id,
      bc.name::text as name,
      (
        coalesce((
          select sum(mt.weight)
          from mood_tokens mt
          where exists (
            select 1
            from unnest(
              coalesce(bc.tags, '{}'::text[])
              || coalesce(bc.tags_ru, '{}'::text[])
              || coalesce(bc.tags_es, '{}'::text[])
              || coalesce(bc.tags_pt, '{}'::text[])
              || coalesce(bc.tags_fr, '{}'::text[])
              || coalesce(bc.tags_de, '{}'::text[])
            ) as tg(tag)
            where lower(btrim(tg.tag)) = mt.token
          )
        ), 0::numeric)
        + coalesce((
          select sum(mt.weight * 0.4)
          from mood_tokens mt
          where lower(regexp_replace(trim(coalesce(c.name, '')), '\s+', '_', 'g')) = mt.token
            or lower(trim(coalesce(c.name, ''))) = replace(mt.token, '_', ' ')
        ), 0::numeric)
        + coalesce((
          select sum(pt.weight)
          from pref_tokens pt
          where exists (
            select 1
            from unnest(
              coalesce(bc.tags, '{}'::text[])
              || coalesce(bc.tags_ru, '{}'::text[])
              || coalesce(bc.tags_es, '{}'::text[])
              || coalesce(bc.tags_pt, '{}'::text[])
              || coalesce(bc.tags_fr, '{}'::text[])
              || coalesce(bc.tags_de, '{}'::text[])
            ) as tg(tag)
            where lower(btrim(tg.tag)) = pt.token
          )
        ), 0::numeric)
        + coalesce((
          select sum(pt.weight * 0.5)
          from pref_tokens pt
          where lower(regexp_replace(trim(coalesce(c.name, '')), '\s+', '_', 'g')) = pt.token
            or lower(trim(coalesce(c.name, ''))) = replace(pt.token, '_', ' ')
        ), 0::numeric)
        + coalesce((
          select sum(tt.weight)
          from timeline_tokens tt
          where exists (
            select 1
            from unnest(
              coalesce(bc.tags, '{}'::text[])
              || coalesce(bc.tags_ru, '{}'::text[])
              || coalesce(bc.tags_es, '{}'::text[])
              || coalesce(bc.tags_pt, '{}'::text[])
              || coalesce(bc.tags_fr, '{}'::text[])
              || coalesce(bc.tags_de, '{}'::text[])
            ) as tg(tag)
            where lower(btrim(tg.tag)) = tt.token
          )
        ), 0::numeric)
        + coalesce((
          select sum(tt.weight * 0.35)
          from timeline_tokens tt
          where lower(regexp_replace(trim(coalesce(c.name, '')), '\s+', '_', 'g')) = tt.token
            or lower(trim(coalesce(c.name, ''))) = replace(tt.token, '_', ' ')
        ), 0::numeric)
        - coalesce((
          select sum(4::numeric)
          from avoid_tokens av
          where exists (
            select 1
            from unnest(
              coalesce(bc.tags, '{}'::text[])
              || coalesce(bc.tags_ru, '{}'::text[])
              || coalesce(bc.tags_es, '{}'::text[])
              || coalesce(bc.tags_pt, '{}'::text[])
              || coalesce(bc.tags_fr, '{}'::text[])
              || coalesce(bc.tags_de, '{}'::text[])
            ) as tg(tag)
            where lower(btrim(tg.tag)) = av.token
          )
        ), 0::numeric)
        + case when bc.type = 'recommended' then 0.1 else 0 end
      )::numeric as vibe_score,
      bc.booking_price::numeric as booking_price,
      coalesce(bc.description, '')::text as description,
      (
        lower(coalesce(bc.name, '')) like '%restaurant%'
        or coalesce(bc.tags, '{}'::text[]) @> array['restaurant', 'restaurants']::text[]
        or coalesce(bc.tags, '{}'::text[]) @> array['table']::text[]
      ) as is_restaurant_table,
      bc.rating::numeric as rating
    from public.business_cards bc
    left join public.categories c on c.id = bc.category_id
    cross join params pr
    where pr.city_q is not null
      and trim(coalesce(bc.city, '')) ilike pr.city_q
  ),
  ranked as (
    select
      s.venue_id,
      s.name,
      s.vibe_score,
      s.booking_price,
      s.description,
      s.is_restaurant_table,
      row_number() over (
        order by
          s.vibe_score desc nulls last,
          md5(
            coalesce((select mood_plain from params), '')
            || '|'
            || coalesce((select timeline_q from params), '')
            || '|'
            || coalesce((select uid::text from params), '')
            || s.venue_id::text
          ) asc,
          s.rating desc nulls last,
          s.name asc
      ) as rn
    from scored s
  )
  select
    r.venue_id,
    r.name,
    r.vibe_score,
    r.booking_price,
    r.description,
    r.is_restaurant_table
  from ranked r
  cross join params pr
  where r.rn <= pr.lim;
$$;

comment on function public.search_by_vibe(text, text, text, integer) is
  'Rank business_cards in p_city by mood slug tokens, user_preferences, timeline tag boosts, and profiles avoid_tags.';

grant execute on function public.search_by_vibe(text, text, text, integer) to authenticated;
