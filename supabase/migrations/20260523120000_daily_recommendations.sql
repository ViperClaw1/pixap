-- Daily Personalized Venue Recommendations:
-- history tables, scoring RPC, batch generation, delivery logs, and daily cron at 12:00 UTC.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.daily_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  venue_id uuid not null references public.business_cards (id) on delete cascade,
  recommendation_score numeric not null,
  recommendation_reasons text[] not null default '{}'::text[],
  generated_for_date date not null default (now() at time zone 'utc')::date,
  generated_rank int not null,
  created_at timestamptz not null default now(),
  unique (user_id, venue_id, generated_for_date)
);

create index if not exists daily_recommendations_user_date_rank_idx
  on public.daily_recommendations (user_id, generated_for_date desc, generated_rank asc);

create index if not exists daily_recommendations_generated_for_date_idx
  on public.daily_recommendations (generated_for_date);

create index if not exists daily_recommendations_venue_date_idx
  on public.daily_recommendations (venue_id, generated_for_date desc);

create table if not exists public.recommendation_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  generated_for_date date not null default (now() at time zone 'utc')::date,
  notification_sent boolean not null default false,
  sent_at timestamptz,
  delivery_provider text not null default 'expo',
  error_message text,
  created_at timestamptz not null default now(),
  unique (user_id, generated_for_date)
);

create index if not exists recommendation_delivery_logs_date_idx
  on public.recommendation_delivery_logs (generated_for_date desc, created_at desc);

create table if not exists public.recommendation_generation_runs (
  id uuid primary key default gen_random_uuid(),
  generated_for_date date not null default (now() at time zone 'utc')::date,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  users_processed int not null default 0,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  error_log text
);

create index if not exists recommendation_generation_runs_date_status_idx
  on public.recommendation_generation_runs (generated_for_date desc, status);

create table if not exists public.recommendation_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  venue_id uuid not null references public.business_cards (id) on delete cascade,
  interaction_type text not null check (interaction_type in ('impression', 'open', 'dismiss', 'dislike', 'book', 'save', 'share')),
  source text not null default 'daily_screen' check (source in ('daily_screen', 'home_hero', 'push')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists recommendation_interactions_user_venue_created_idx
  on public.recommendation_interactions (user_id, venue_id, created_at desc);

create index if not exists recommendation_interactions_user_type_created_idx
  on public.recommendation_interactions (user_id, interaction_type, created_at desc);

create table if not exists public.recommendation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists recommendation_events_user_created_idx
  on public.recommendation_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.daily_recommendations enable row level security;
alter table public.recommendation_delivery_logs enable row level security;
alter table public.recommendation_generation_runs enable row level security;
alter table public.recommendation_interactions enable row level security;
alter table public.recommendation_events enable row level security;

drop policy if exists "daily_recommendations_select_own" on public.daily_recommendations;
create policy "daily_recommendations_select_own"
  on public.daily_recommendations for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "recommendation_interactions_select_own" on public.recommendation_interactions;
create policy "recommendation_interactions_select_own"
  on public.recommendation_interactions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "recommendation_interactions_insert_own" on public.recommendation_interactions;
create policy "recommendation_interactions_insert_own"
  on public.recommendation_interactions for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "recommendation_events_select_own" on public.recommendation_events;
create policy "recommendation_events_select_own"
  on public.recommendation_events for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "recommendation_events_insert_own" on public.recommendation_events;
create policy "recommendation_events_insert_own"
  on public.recommendation_events for insert to authenticated
  with check (auth.uid() = user_id);

-- Service role / postgres only for these operational tables.
revoke all on public.recommendation_delivery_logs from anon, authenticated;
revoke all on public.recommendation_generation_runs from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.generate_recommendation_reasons(
  p_affinity_score numeric,
  p_crowd_score numeric,
  p_story_signal numeric,
  p_novelty_score numeric,
  p_popularity_score numeric
)
returns text[]
language plpgsql
stable
set search_path = public
as $$
declare
  v_reasons text[] := '{}'::text[];
begin
  if coalesce(p_affinity_score, 0) >= 0.45 then
    v_reasons := array_append(v_reasons, 'Matches your nightlife vibe');
  end if;
  if coalesce(p_crowd_score, 0) >= 0.55 then
    v_reasons := array_append(v_reasons, 'Trending tonight');
  end if;
  if coalesce(p_story_signal, 0) >= 0.45 then
    v_reasons := array_append(v_reasons, 'Buzzing right now');
  end if;
  if coalesce(p_novelty_score, 0) >= 0.5 then
    v_reasons := array_append(v_reasons, 'New spot for you');
  end if;
  if coalesce(p_popularity_score, 0) >= 0.7 then
    v_reasons := array_append(v_reasons, 'Popular with the community');
  end if;
  if array_length(v_reasons, 1) is null then
    v_reasons := array['Good fit for tonight'];
  end if;
  return v_reasons;
end;
$$;

comment on function public.generate_recommendation_reasons(numeric, numeric, numeric, numeric, numeric) is
  'Build explainable recommendation reason labels from normalized score components.';

create or replace function public.track_recommendation_event(p_event jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.recommendation_events (user_id, event_name, payload)
  values (
    v_uid,
    coalesce(nullif(trim(p_event ->> 'event_name'), ''), 'unknown'),
    coalesce(p_event - 'event_name', '{}'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Core generation (single user)
-- ---------------------------------------------------------------------------

create or replace function public.generate_daily_recommendations(
  p_user_id uuid default auth.uid(),
  p_date date default (now() at time zone 'utc')::date,
  p_limit integer default 8,
  p_force boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_lim integer := greatest(1, least(coalesce(p_limit, 8), 20));
  v_inserted integer := 0;
  v_auth_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'user id is required';
  end if;
  if v_auth_uid is not null and v_auth_uid <> v_uid then
    raise exception 'cannot generate recommendations for another user';
  end if;
  if not exists (
    select 1
    from auth.users u
    where u.id = v_uid
  ) then
    raise exception 'user % does not exist in auth.users', v_uid;
  end if;

  if not p_force and exists (
    select 1
    from public.daily_recommendations dr
    where dr.user_id = v_uid
      and dr.generated_for_date = p_date
  ) then
    return (
      select count(*)
      from public.daily_recommendations dr
      where dr.user_id = v_uid
        and dr.generated_for_date = p_date
    );
  end if;

  if p_force then
    delete from public.daily_recommendations
    where user_id = v_uid
      and generated_for_date = p_date;
  end if;

  with user_ctx as (
    select
      v_uid as user_id,
      nullif(trim(coalesce(p.city, '')), '') as city_q,
      coalesce(up.favorite_categories, '{}'::text[]) as cats,
      coalesce(up.vibe_preferences, '{}'::text[]) as vibes,
      coalesce(up.favorite_music, '{}'::text[]) as music
    from public.profiles p
    left join public.user_preferences up on up.user_id = p.id
    where p.id = v_uid
  ),
  pref_tokens as (
    select distinct lower(btrim(t)) as token, 3::numeric as weight
    from user_ctx, unnest(cats) as t
    where btrim(t) <> ''
    union all
    select distinct lower(btrim(t)) as token, 2::numeric as weight
    from user_ctx, unnest(vibes) as t
    where btrim(t) <> ''
    union all
    select distinct lower(btrim(t)) as token, 1::numeric as weight
    from user_ctx, unnest(music) as t
    where btrim(t) <> ''
  ),
  affinity as (
    select lower(btrim(category)) as token, greatest(0::numeric, score) as score
    from public.category_affinity_scores
    where user_id = v_uid
  ),
  crowd as (
    select
      vcs.venue_id,
      least(1::numeric, count(*) filter (where vcs.signal_type = 'checkin' and vcs.created_at >= now() - interval '1 hour')::numeric / 20::numeric) as crowd_norm,
      least(1::numeric, count(*) filter (where vcs.signal_type = 'story' and vcs.created_at >= now() - interval '30 minutes')::numeric / 30::numeric) as story_norm
    from public.venue_crowd_snapshots vcs
    where vcs.created_at >= now() - interval '2 hours'
    group by vcs.venue_id
  ),
  bookings_live as (
    select
      b.business_card_id as venue_id,
      least(1::numeric, count(*)::numeric / 15::numeric) as booking_norm
    from public.bookings b
    where b.status = 'upcoming'
      and b.date_time >= now()
      and b.date_time < now() + interval '90 minutes'
    group by b.business_card_id
  ),
  negative_feedback as (
    select
      ri.venue_id,
      least(0.7::numeric, count(*)::numeric * 0.15::numeric) as penalty
    from public.recommendation_interactions ri
    where ri.user_id = v_uid
      and ri.interaction_type in ('dismiss', 'dislike')
      and ri.created_at >= now() - interval '30 days'
    group by ri.venue_id
  ),
  candidates as (
    select
      bc.id as venue_id,
      bc.name,
      bc.description,
      bc.city,
      bc.tags,
      bc.images,
      bc.rating,
      coalesce(sum(pt.weight) filter (
        where exists (
          select 1
          from unnest(coalesce(bc.tags, '{}'::text[])) as bt
          where lower(btrim(bt)) = pt.token
        )
      ), 0::numeric) as pref_score,
      coalesce(sum(a.score) filter (
        where exists (
          select 1
          from unnest(coalesce(bc.tags, '{}'::text[])) as bt
          where lower(btrim(bt)) = a.token
        )
      ), 0::numeric) as affinity_score_raw,
      coalesce(c.crowd_norm, 0::numeric) as crowd_norm,
      greatest(coalesce(c.story_norm, 0::numeric), coalesce(bl.booking_norm, 0::numeric)) as story_norm,
      case
        when exists (
          select 1
          from public.daily_recommendations old_dr
          where old_dr.user_id = v_uid
            and old_dr.venue_id = bc.id
            and old_dr.generated_for_date >= p_date - interval '14 days'
        ) then 0::numeric
        else 1::numeric
      end as novelty_norm,
      case
        when bc.type = 'recommended' then 0.9::numeric
        when bc.type = 'featured' then 0.75::numeric
        else 0.55::numeric
      end as popularity_base,
      coalesce(nf.penalty, 0::numeric) as negative_penalty
    from public.business_cards bc
    left join crowd c on c.venue_id = bc.id
    left join bookings_live bl on bl.venue_id = bc.id
    left join pref_tokens pt on true
    left join affinity a on true
    left join negative_feedback nf on nf.venue_id = bc.id
    where not exists (
      select 1
      from public.daily_recommendations recent_dr
      where recent_dr.user_id = v_uid
        and recent_dr.venue_id = bc.id
        and recent_dr.generated_for_date >= p_date - interval '7 days'
    )
      and (
        not exists (select 1 from user_ctx where city_q is not null)
        or lower(btrim(coalesce(bc.city, ''))) = (
          select lower(btrim(city_q)) from user_ctx where city_q is not null limit 1
        )
      )
    group by bc.id, bc.name, bc.description, bc.city, bc.tags, bc.images, bc.rating, bc.type, c.crowd_norm, c.story_norm, bl.booking_norm, nf.penalty
    order by coalesce(bc.rating, 0) desc, bc.created_at desc
    limit 200
  ),
  scored as (
    select
      c.*,
      least(1::numeric, c.affinity_score_raw / 8::numeric) as affinity_norm,
      least(1::numeric, greatest(coalesce(c.rating, 0), 0)::numeric / 5::numeric) as rating_norm,
      (
        (least(1::numeric, c.affinity_score_raw / 8::numeric) * 0.35::numeric) +
        (least(1::numeric, greatest(coalesce(c.rating, 0), 0)::numeric / 5::numeric) * 0.10::numeric) +
        (c.popularity_base * 0.05::numeric) +
        (coalesce(c.crowd_norm, 0::numeric) * 0.15::numeric) +
        (coalesce(c.story_norm, 0::numeric) * 0.10::numeric) +
        (coalesce(c.novelty_norm, 0::numeric) * 0.10::numeric) +
        ((coalesce(c.pref_score, 0::numeric) / 6::numeric) * 0.15::numeric)
      ) * (0.85::numeric + random() * 0.30::numeric) - coalesce(c.negative_penalty, 0::numeric) as final_score
    from candidates c
  ),
  ranked as (
    select
      s.*,
      row_number() over (order by s.final_score desc, random()) as generated_rank
    from scored s
  ),
  inserted as (
    insert into public.daily_recommendations (
      user_id,
      venue_id,
      recommendation_score,
      recommendation_reasons,
      generated_for_date,
      generated_rank
    )
    select
      v_uid,
      r.venue_id,
      round(r.final_score::numeric, 5),
      public.generate_recommendation_reasons(
        r.affinity_norm,
        r.crowd_norm,
        r.story_norm,
        r.novelty_norm,
        r.popularity_base
      ),
      p_date,
      r.generated_rank
    from ranked r
    where r.generated_rank <= v_lim
    on conflict (user_id, venue_id, generated_for_date) do update
      set recommendation_score = excluded.recommendation_score,
          recommendation_reasons = excluded.recommendation_reasons,
          generated_rank = excluded.generated_rank
    returning 1
  )
  select count(*) into v_inserted from inserted;

  return coalesce(v_inserted, 0);
end;
$$;

comment on function public.generate_daily_recommendations(uuid, date, integer, boolean) is
  'Generate top daily recommendations for one user with affinity, crowd, novelty, cooldown, and weighted randomness.';

create or replace function public.get_daily_recommendations(
  p_date date default (now() at time zone 'utc')::date
)
returns table (
  venue_id uuid,
  generated_rank int,
  recommendation_score numeric,
  recommendation_reasons text[],
  name text,
  description text,
  tags text[],
  images text[],
  city text,
  rating numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    dr.venue_id,
    dr.generated_rank,
    dr.recommendation_score,
    dr.recommendation_reasons,
    bc.name,
    bc.description,
    bc.tags,
    bc.images,
    bc.city,
    bc.rating
  from public.daily_recommendations dr
  join public.business_cards bc on bc.id = dr.venue_id
  where dr.user_id = auth.uid()
    and dr.generated_for_date = coalesce(p_date, (now() at time zone 'utc')::date)
  order by dr.generated_rank asc;
$$;

create or replace function public.enqueue_daily_recommendation_push(
  p_user_id uuid,
  p_date date default (now() at time zone 'utc')::date
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_top record;
  v_sent boolean := false;
begin
  if p_user_id is null then
    return false;
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    return false;
  end if;

  select
    dr.venue_id,
    bc.name,
    dr.recommendation_reasons
  into v_top
  from public.daily_recommendations dr
  join public.business_cards bc on bc.id = dr.venue_id
  where dr.user_id = p_user_id
    and dr.generated_for_date = p_date
  order by dr.generated_rank asc
  limit 1;

  if not found then
    insert into public.recommendation_delivery_logs (user_id, generated_for_date, notification_sent, error_message)
    values (p_user_id, p_date, false, 'no_recommendations')
    on conflict (user_id, generated_for_date) do update
      set notification_sent = false,
          error_message = 'no_recommendations',
          created_at = now();
    return false;
  end if;

  if not exists (
    select 1
    from public.user_push_tokens t
    where t.user_id = p_user_id
      and nullif(trim(coalesce(t.expo_push_token, '')), '') is not null
  ) then
    insert into public.recommendation_delivery_logs (user_id, generated_for_date, notification_sent, error_message)
    values (p_user_id, p_date, false, 'missing_push_token')
    on conflict (user_id, generated_for_date) do update
      set notification_sent = false,
          error_message = 'missing_push_token',
          created_at = now();
    return false;
  end if;

  insert into public.push_outbox (user_id, title, body, data)
  values (
    p_user_id,
    'Tonight for you',
    coalesce(v_top.name, 'New venues ready for you'),
    jsonb_build_object(
      'kind', 'daily_recommendation',
      'date', p_date,
      'top_venue_id', v_top.venue_id
    )
  );

  v_sent := true;
  insert into public.recommendation_delivery_logs (
    user_id,
    generated_for_date,
    notification_sent,
    sent_at
  )
  values (
    p_user_id,
    p_date,
    true,
    now()
  )
  on conflict (user_id, generated_for_date) do update
    set notification_sent = true,
        sent_at = excluded.sent_at,
        error_message = null,
        created_at = now();

  return v_sent;
exception
  when others then
    insert into public.recommendation_delivery_logs (user_id, generated_for_date, notification_sent, error_message)
    values (p_user_id, p_date, false, left(sqlerrm, 400))
    on conflict (user_id, generated_for_date) do update
      set notification_sent = false,
          error_message = left(sqlerrm, 400),
          created_at = now();
    return false;
end;
$$;

create or replace function public.run_daily_recommendation_batch(
  p_run_id uuid,
  p_date date default (now() at time zone 'utc')::date,
  p_batch_size integer default 100,
  p_after_user_id uuid default null
)
returns table (
  user_id uuid,
  inserted_count integer,
  push_enqueued boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_size integer := greatest(1, least(coalesce(p_batch_size, 100), 500));
begin
  return query
  with picked_users as (
    select p.id as user_id
    from public.profiles p
    inner join auth.users u on u.id = p.id
    where p.id > coalesce(p_after_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    order by p.id
    limit v_batch_size
  ),
  generated as (
    select
      pu.user_id,
      public.generate_daily_recommendations(pu.user_id, p_date, 8, false) as inserted_count
    from picked_users pu
  ),
  pushed as (
    select
      g.user_id,
      g.inserted_count,
      case
        when g.inserted_count > 0 then public.enqueue_daily_recommendation_push(g.user_id, p_date)
        else false
      end as push_enqueued
    from generated g
  )
  select * from pushed;
end;
$$;

-- ---------------------------------------------------------------------------
-- Daily cron invoker for Edge Function
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function private.invoke_generate_daily_recommendations(payload jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base_url text;
  service_key text;
  request_id bigint;
begin
  select decrypted_secret into base_url
  from vault.decrypted_secrets
  where name = 'project_url'
  limit 1;

  select decrypted_secret into service_key
  from vault.decrypted_secrets
  where name = 'service_role_key'
  limit 1;

  if base_url is null or service_key is null then
    raise warning '[daily-recs] invoke skipped: vault secrets project_url and/or service_role_key missing';
    return null;
  end if;

  select net.http_post(
    url := rtrim(base_url, '/') || '/functions/v1/generate-daily-recommendations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := coalesce(payload, '{}'::jsonb)
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function private.invoke_generate_daily_recommendations(jsonb) from public;
grant execute on function private.invoke_generate_daily_recommendations(jsonb) to postgres, service_role;

do $cron$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id from cron.job where jobname = 'generate-daily-recommendations' limit 1;
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'generate-daily-recommendations',
    '0 12 * * *',
    $job$select private.invoke_generate_daily_recommendations('{}'::jsonb);$job$
  );
exception
  when others then
    raise notice '[daily-recs] pg_cron schedule skipped: %', sqlerrm;
end $cron$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant execute on function public.generate_recommendation_reasons(numeric, numeric, numeric, numeric, numeric) to authenticated, service_role;
grant execute on function public.track_recommendation_event(jsonb) to authenticated;
grant execute on function public.generate_daily_recommendations(uuid, date, integer, boolean) to authenticated, service_role;
grant execute on function public.get_daily_recommendations(date) to authenticated;
grant execute on function public.enqueue_daily_recommendation_push(uuid, date) to service_role;
grant execute on function public.run_daily_recommendation_batch(uuid, date, integer, uuid) to service_role;
