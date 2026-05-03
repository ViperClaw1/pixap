-- PixAI Vibe Match: user preferences + ranked venue search for mood/timeline flows.
-- vibe_preferences JSON shape (documented): { "preferred_tags": string[], "avoid_tags"?: string[] }

alter table if exists public.profiles
  add column if not exists vibe_preferences jsonb not null default '{}'::jsonb;

comment on column public.profiles.vibe_preferences is
  'JSON: { "preferred_tags"?: string[], "avoid_tags"?: string[] } — boosts vibe RPC scoring.';

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
      nullif(trim(coalesce(p_city, '')), '') as city_q,
      greatest(1, least(coalesce(p_limit, 5), 20)) as lim,
      trim(coalesce(p_mood, '')) as mood_plain
  ),
  prefs as (
    select coalesce(
      (select p.vibe_preferences from public.profiles p where p.id = auth.uid()),
      '{}'::jsonb
    ) as j
  ),
  mood_tokens as (
    select distinct lower(btrim(u.t)) as t
    from params x
    cross join lateral unnest(regexp_split_to_array(lower(coalesce(x.mood_plain, '')), '\s+')) as u(t)
    where length(btrim(u.t)) > 0
  ),
  pref_tags as (
    select distinct lower(btrim(elt::text)) as t
    from prefs pr
    cross join lateral jsonb_array_elements_text(
      case
        when jsonb_typeof(pr.j -> 'preferred_tags') = 'array' then pr.j -> 'preferred_tags'
        else '[]'::jsonb
      end
    ) as elt
  ),
  all_tokens as (
    select t from mood_tokens
    union
    select t from pref_tags where t is not null and t <> ''
  ),
  scored as (
    select
      bc.id as venue_id,
      bc.name::text as name,
      (
        coalesce(
          (
            select sum(2::numeric)
            from all_tokens at
            where at.t <> ''
              and lower(coalesce(bc.name, '')) like '%' || at.t || '%'
          ),
          0::numeric
        )
        + coalesce(
          (
            select sum(1::numeric)
            from all_tokens at
            where at.t <> ''
              and lower(coalesce(bc.description, '')) like '%' || at.t || '%'
          ),
          0::numeric
        )
        + coalesce(
          (
            select sum(3::numeric)
            from all_tokens at
            where at.t <> ''
              and exists (
                select 1
                from unnest(coalesce(bc.tags, '{}'::text[])) as tg(tag)
                where lower(tg.tag) = at.t
                  or lower(tg.tag) like '%' || at.t || '%'
              )
          ),
          0::numeric
        )
      )::numeric as vibe_score,
      bc.booking_price::numeric as booking_price,
      coalesce(bc.description, '')::text as description,
      (
        lower(coalesce(bc.name, '')) like '%restaurant%'
        or coalesce(bc.tags, '{}'::text[]) @> array['restaurant']::text[]
        or coalesce(bc.tags, '{}'::text[]) @> array['table']::text[]
      ) as is_restaurant_table,
      bc.rating::numeric as rating
    from public.business_cards bc
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
          case when s.vibe_score > 0 then 0 else 1 end,
          s.vibe_score desc nulls last,
          s.rating desc nulls last
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
  'Rank business_cards in p_city by mood/tags overlap + profiles.vibe_preferences.preferred_tags; p_timeline reserved for callers.';

grant execute on function public.search_by_vibe(text, text, text, integer) to authenticated;
