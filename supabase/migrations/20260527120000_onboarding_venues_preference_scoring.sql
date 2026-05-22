-- Stronger onboarding venue ranking: habits, category names, client prefs override, per-user ordering.

drop function if exists public.get_recommended_onboarding_venues(integer, integer);

create or replace function public.get_recommended_onboarding_venues(
  p_limit integer default 12,
  p_offset integer default 0,
  p_prefs jsonb default null
)
returns table (
  venue_id uuid,
  name text,
  description text,
  tags text[],
  images text[],
  city text,
  category_name text,
  match_score numeric,
  rating numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      auth.uid() as uid,
      greatest(1, least(coalesce(p_limit, 12), 20)) as lim,
      greatest(0, coalesce(p_offset, 0)) as off
  ),
  prefs_raw as (
    select
      coalesce(up.favorite_categories, '{}'::text[]) as db_cats,
      coalesce(up.vibe_preferences, '{}'::text[]) as db_vibes,
      coalesce(up.favorite_music, '{}'::text[]) as db_music,
      coalesce(up.habits, '{}'::text[]) as db_habits
    from params pr
    left join public.user_preferences up on up.user_id = pr.uid
  ),
  prefs as (
    select
      case
        when p_prefs ? 'favorite_categories' then
          coalesce(
            (select array_agg(lower(btrim(x)) order by lower(btrim(x)))
             from jsonb_array_elements_text(p_prefs -> 'favorite_categories') as x
             where btrim(x) <> ''),
            '{}'::text[]
          )
        else pr.db_cats
      end as cats,
      case
        when p_prefs ? 'vibe_preferences' then
          coalesce(
            (select array_agg(lower(btrim(x)) order by lower(btrim(x)))
             from jsonb_array_elements_text(p_prefs -> 'vibe_preferences') as x
             where btrim(x) <> ''),
            '{}'::text[]
          )
        else pr.db_vibes
      end as vibes,
      case
        when p_prefs ? 'favorite_music' then
          coalesce(
            (select array_agg(lower(btrim(x)) order by lower(btrim(x)))
             from jsonb_array_elements_text(p_prefs -> 'favorite_music') as x
             where btrim(x) <> ''),
            '{}'::text[]
          )
        else pr.db_music
      end as music,
      case
        when p_prefs ? 'habits' then
          coalesce(
            (select array_agg(lower(btrim(x)) order by lower(btrim(x)))
             from jsonb_array_elements_text(p_prefs -> 'habits') as x
             where btrim(x) <> ''),
            '{}'::text[]
          )
        else pr.db_habits
      end as habits
    from prefs_raw pr
  ),
  pref_tokens as (
    select distinct lower(btrim(t)) as token, 3::numeric as weight
    from prefs, unnest(cats) as t
    where btrim(t) <> ''
    union
    select distinct lower(btrim(t)), 2::numeric
    from prefs, unnest(vibes) as t
    where btrim(t) <> ''
    union
    select distinct lower(btrim(t)), 1.5::numeric
    from prefs, unnest(habits) as t
    where btrim(t) <> ''
    union
    select distinct lower(btrim(t)), 1::numeric
    from prefs, unnest(music) as t
    where btrim(t) <> ''
  ),
  user_city as (
    select nullif(trim(coalesce(p.city, '')), '') as city_q
    from params pr
    left join public.profiles p on p.id = pr.uid
  ),
  rated as (
    select vr.venue_id
    from params pr
    join public.venue_ratings vr on vr.user_id = pr.uid
    where vr.rating_context = 'onboarding'
  ),
  scored as (
    select
      bc.id as venue_id,
      bc.name::text as name,
      coalesce(bc.description, '')::text as description,
      coalesce(bc.tags, '{}'::text[]) as tags,
      coalesce(bc.images, '{}'::text[]) as images,
      bc.city::text as city,
      coalesce(c.name, '')::text as category_name,
      (
        coalesce((
          select sum(pt.weight)
          from pref_tokens pt
          where exists (
            select 1
            from unnest(coalesce(bc.tags, '{}'::text[])) as tg(tag)
            where lower(btrim(tg.tag)) = pt.token
          )
        ), 0::numeric)
        + coalesce((
          select sum(pt.weight)
          from pref_tokens pt
          where lower(regexp_replace(trim(coalesce(c.name, '')), '\s+', '_', 'g')) = pt.token
            or lower(trim(coalesce(c.name, ''))) = replace(pt.token, '_', ' ')
        ), 0::numeric)
        + case when bc.type = 'recommended' then 0.15 else 0 end
      )::numeric as match_score,
      bc.rating::numeric as rating
    from public.business_cards bc
    left join public.categories c on c.id = bc.category_id
    cross join user_city uc
    where not exists (select 1 from rated r where r.venue_id = bc.id)
      and (
        uc.city_q is null
        or trim(coalesce(bc.city, '')) ilike uc.city_q
      )
  ),
  ranked as (
    select
      s.*,
      row_number() over (
        order by
          case when s.match_score > 0 then 0 else 1 end,
          s.match_score desc nulls last,
          md5((select uid::text from params) || s.venue_id::text) asc,
          s.rating desc nulls last,
          s.name asc
      ) as rn
    from scored s
  )
  select
    r.venue_id,
    r.name,
    r.description,
    r.tags,
    r.images,
    r.city,
    r.category_name,
    r.match_score,
    r.rating
  from ranked r
  cross join params pr
  where r.rn > pr.off and r.rn <= pr.off + pr.lim;
$$;

comment on function public.get_recommended_onboarding_venues(integer, integer, jsonb) is
  'Rank business_cards for onboarding by user taste (tags, category, habits); optional p_prefs overrides DB; per-user tie-break.';

grant execute on function public.get_recommended_onboarding_venues(integer, integer, jsonb) to authenticated;
