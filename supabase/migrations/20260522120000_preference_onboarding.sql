-- Smart Preference Onboarding: user_preferences, venue_ratings, affinity scores, analytics, RPC.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  favorite_categories text[] not null default '{}'::text[],
  favorite_music text[] not null default '{}'::text[],
  vibe_preferences text[] not null default '{}'::text[],
  habits text[] not null default '{}'::text[],
  temperament jsonb not null default '{}'::jsonb,
  onboarding_completed boolean not null default false,
  onboarding_step text not null default 'venue_categories',
  onboarding_skipped_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.user_preferences is
  'Per-user taste profile from preference onboarding; vibe_preferences is text[] (not profiles.vibe_preferences jsonb).';

create index if not exists user_preferences_onboarding_incomplete_idx
  on public.user_preferences (user_id)
  where onboarding_completed = false;

create table if not exists public.venue_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  venue_id uuid not null references public.business_cards (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  rated_at timestamptz not null default now(),
  rating_context text not null default 'onboarding',
  unique (user_id, venue_id)
);

create index if not exists venue_ratings_user_rated_at_idx
  on public.venue_ratings (user_id, rated_at desc);

create index if not exists venue_ratings_venue_id_idx
  on public.venue_ratings (venue_id);

create table if not exists public.category_affinity_scores (
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  score numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

create index if not exists category_affinity_scores_user_score_idx
  on public.category_affinity_scores (user_id, score desc);

create table if not exists public.onboarding_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_name text not null,
  step text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists onboarding_events_user_created_idx
  on public.onboarding_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.user_preferences enable row level security;
alter table public.venue_ratings enable row level security;
alter table public.category_affinity_scores enable row level security;
alter table public.onboarding_events enable row level security;

drop policy if exists "user_preferences_select_own" on public.user_preferences;
create policy "user_preferences_select_own"
  on public.user_preferences for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_preferences_insert_own" on public.user_preferences;
create policy "user_preferences_insert_own"
  on public.user_preferences for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_preferences_update_own" on public.user_preferences;
create policy "user_preferences_update_own"
  on public.user_preferences for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "venue_ratings_select_own" on public.venue_ratings;
create policy "venue_ratings_select_own"
  on public.venue_ratings for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "venue_ratings_insert_own" on public.venue_ratings;
create policy "venue_ratings_insert_own"
  on public.venue_ratings for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "venue_ratings_update_own" on public.venue_ratings;
create policy "venue_ratings_update_own"
  on public.venue_ratings for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "category_affinity_scores_select_own" on public.category_affinity_scores;
create policy "category_affinity_scores_select_own"
  on public.category_affinity_scores for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "onboarding_events_select_own" on public.onboarding_events;
create policy "onboarding_events_select_own"
  on public.onboarding_events for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "onboarding_events_insert_own" on public.onboarding_events;
create policy "onboarding_events_insert_own"
  on public.onboarding_events for insert to authenticated
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Sync profiles.vibe_preferences from user_preferences (internal)
-- ---------------------------------------------------------------------------

create or replace function public.sync_profiles_vibe_preferences_from_user_preferences(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_up public.user_preferences%rowtype;
  v_preferred jsonb;
  v_avoid jsonb;
begin
  select * into v_up from public.user_preferences where user_id = p_user_id;
  if not found then
    return;
  end if;

  select coalesce(p.vibe_preferences -> 'avoid_tags', '[]'::jsonb)
  into v_avoid
  from public.profiles p
  where p.id = p_user_id;

  select coalesce(
    jsonb_agg(distinct lower(btrim(t))),
    '[]'::jsonb
  )
  into v_preferred
  from (
    select unnest(
      coalesce(v_up.favorite_categories, '{}'::text[])
      || coalesce(v_up.vibe_preferences, '{}'::text[])
      || coalesce(v_up.favorite_music, '{}'::text[])
    ) as t
  ) s
  where btrim(t) <> '';

  update public.profiles
  set
    vibe_preferences = jsonb_build_object(
      'preferred_tags', coalesce(v_preferred, '[]'::jsonb),
      'avoid_tags', coalesce(v_avoid, '[]'::jsonb)
    ),
    updated_at = now()
  where id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- upsert_user_preferences
-- ---------------------------------------------------------------------------

create or replace function public.upsert_user_preferences(p_patch jsonb)
returns public.user_preferences
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.user_preferences%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.user_preferences (user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  update public.user_preferences up
  set
    favorite_categories = case
      when p_patch ? 'favorite_categories' then
        coalesce(
          (select array_agg(lower(btrim(x)) order by lower(btrim(x)))
           from jsonb_array_elements_text(p_patch -> 'favorite_categories') as x
           where btrim(x) <> ''),
          '{}'::text[]
        )
      else up.favorite_categories
    end,
    favorite_music = case
      when p_patch ? 'favorite_music' then
        coalesce(
          (select array_agg(lower(btrim(x)) order by lower(btrim(x)))
           from jsonb_array_elements_text(p_patch -> 'favorite_music') as x
           where btrim(x) <> ''),
          '{}'::text[]
        )
      else up.favorite_music
    end,
    vibe_preferences = case
      when p_patch ? 'vibe_preferences' then
        coalesce(
          (select array_agg(lower(btrim(x)) order by lower(btrim(x)))
           from jsonb_array_elements_text(p_patch -> 'vibe_preferences') as x
           where btrim(x) <> ''),
          '{}'::text[]
        )
      else up.vibe_preferences
    end,
    habits = case
      when p_patch ? 'habits' then
        coalesce(
          (select array_agg(btrim(x) order by btrim(x))
           from jsonb_array_elements_text(p_patch -> 'habits') as x
           where btrim(x) <> ''),
          '{}'::text[]
        )
      else up.habits
    end,
    temperament = case
      when p_patch ? 'temperament' then coalesce(p_patch -> 'temperament', '{}'::jsonb)
      else up.temperament
    end,
    onboarding_completed = case
      when p_patch ? 'onboarding_completed' then coalesce((p_patch ->> 'onboarding_completed')::boolean, false)
      else up.onboarding_completed
    end,
    onboarding_step = case
      when p_patch ? 'onboarding_step' then coalesce(nullif(trim(p_patch ->> 'onboarding_step'), ''), up.onboarding_step)
      else up.onboarding_step
    end,
    onboarding_skipped_at = case
      when p_patch ? 'onboarding_skipped_at' then (p_patch ->> 'onboarding_skipped_at')::timestamptz
      when p_patch ? 'clear_skipped' and (p_patch ->> 'clear_skipped')::boolean = true then null
      else up.onboarding_skipped_at
    end,
    updated_at = now()
  where up.user_id = v_uid
  returning * into v_row;

  perform public.sync_profiles_vibe_preferences_from_user_preferences(v_uid);
  return v_row;
end;
$$;

comment on function public.upsert_user_preferences(jsonb) is
  'Merge-patch user_preferences for auth.uid(); syncs profiles.vibe_preferences.preferred_tags.';

-- ---------------------------------------------------------------------------
-- get_recommended_onboarding_venues
-- ---------------------------------------------------------------------------

create or replace function public.get_recommended_onboarding_venues(
  p_limit integer default 12,
  p_offset integer default 0
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
  prefs as (
    select
      coalesce(up.favorite_categories, '{}'::text[]) as cats,
      coalesce(up.vibe_preferences, '{}'::text[]) as vibes,
      coalesce(up.favorite_music, '{}'::text[]) as music
    from params pr
    left join public.user_preferences up on up.user_id = pr.uid
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
            where lower(tg.tag) = pt.token
              or lower(tg.tag) like '%' || pt.token || '%'
          )
        ), 0::numeric)
        + case when bc.type = 'recommended' then 0.5 else 0 end
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

comment on function public.get_recommended_onboarding_venues(integer, integer) is
  'Rank business_cards for onboarding swipe by user_preferences tag overlap; excludes onboarding-rated venues.';

-- ---------------------------------------------------------------------------
-- calculate_user_affinity
-- ---------------------------------------------------------------------------

create or replace function public.calculate_user_affinity(p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_top jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if auth.uid() is distinct from v_uid and auth.uid() is not null then
    raise exception 'Forbidden';
  end if;

  delete from public.category_affinity_scores where user_id = v_uid;

  insert into public.category_affinity_scores (user_id, category, score, updated_at)
  select
    v_uid,
    agg.category,
    least(10::numeric, greatest(-10::numeric, agg.total_score)),
    now()
  from (
    select
      lower(btrim(tag)) as category,
      sum(((vr.rating - 3)::numeric / 2.0)) as total_score
    from public.venue_ratings vr
    join public.business_cards bc on bc.id = vr.venue_id
    cross join lateral unnest(coalesce(bc.tags, '{}'::text[])) as tag
    where vr.user_id = v_uid
      and btrim(tag) <> ''
    group by lower(btrim(tag))
  ) agg
  on conflict (user_id, category) do update
  set score = excluded.score, updated_at = excluded.updated_at;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('category', s.category, 'score', s.score)
      order by s.score desc
    ),
    '[]'::jsonb
  )
  into v_top
  from (
    select category, score
    from public.category_affinity_scores
    where user_id = v_uid
    order by score desc
    limit 20
  ) s;

  return jsonb_build_object('user_id', v_uid, 'top_categories', v_top);
end;
$$;

comment on function public.calculate_user_affinity(uuid) is
  'Aggregate venue_ratings into category_affinity_scores by business_cards.tags.';

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant execute on function public.upsert_user_preferences(jsonb) to authenticated;
grant execute on function public.get_recommended_onboarding_venues(integer, integer) to authenticated;
grant execute on function public.calculate_user_affinity(uuid) to authenticated;

revoke all on function public.sync_profiles_vibe_preferences_from_user_preferences(uuid) from public;
grant execute on function public.sync_profiles_vibe_preferences_from_user_preferences(uuid) to service_role;
