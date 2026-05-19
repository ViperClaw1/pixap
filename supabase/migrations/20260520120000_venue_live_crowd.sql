-- Live Crowd Meter: check-in snapshots + aggregation RPCs.

create table if not exists public.venue_crowd_snapshots (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.business_cards (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  signal_type text not null check (signal_type in ('checkin', 'story', 'booking')),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists venue_crowd_snapshots_venue_created_idx
  on public.venue_crowd_snapshots (venue_id, created_at desc);

create index if not exists venue_crowd_snapshots_venue_user_created_idx
  on public.venue_crowd_snapshots (venue_id, user_id, created_at desc)
  where signal_type = 'checkin';

create index if not exists venue_crowd_snapshots_checkin_venue_hour_idx
  on public.venue_crowd_snapshots (venue_id, created_at desc)
  where signal_type = 'checkin';

create index if not exists bookings_business_upcoming_dt_idx
  on public.bookings (business_card_id, date_time)
  where status = 'upcoming';

alter table public.venue_crowd_snapshots enable row level security;

-- No direct client writes; reads only via RPC aggregates for most clients.
drop policy if exists "venue_crowd_snapshots_select_authenticated" on public.venue_crowd_snapshots;
create policy "venue_crowd_snapshots_select_authenticated"
on public.venue_crowd_snapshots
for select
to authenticated
using (true);

revoke insert, update, delete on public.venue_crowd_snapshots from authenticated, anon;

-- ---------------------------------------------------------------------------
-- record_venue_crowd_checkin
-- ---------------------------------------------------------------------------

create or replace function public.record_venue_crowd_checkin(
  p_venue_id uuid,
  p_latitude double precision,
  p_longitude double precision
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_venue_lat double precision;
  v_venue_lng double precision;
  v_venue_point geography;
  v_user_point geography;
  v_distance_m double precision;
  v_recent_exists boolean;
begin
  if v_user_id is null then
    return jsonb_build_object('recorded', false, 'reason', 'not_authenticated');
  end if;

  if p_latitude is null
    or p_longitude is null
    or not (p_latitude between -90 and 90)
    or not (p_longitude between -180 and 180) then
    return jsonb_build_object('recorded', false, 'reason', 'invalid_coordinates');
  end if;

  -- Build venue point from lat/lng (same as client + search_business_cards_nearby).
  -- Avoid selecting business_cards.location into plpgsql — some rows parse as invalid geometry.
  select bc.latitude, bc.longitude
  into v_venue_lat, v_venue_lng
  from public.business_cards bc
  where bc.id = p_venue_id;

  if not found
    or v_venue_lat is null
    or v_venue_lng is null
    or not (v_venue_lat between -90 and 90)
    or not (v_venue_lng between -180 and 180) then
    return jsonb_build_object('recorded', false, 'reason', 'no_geo');
  end if;

  v_venue_point := st_setsrid(st_makepoint(v_venue_lng, v_venue_lat), 4326)::geography;
  v_user_point := st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography;

  if not st_dwithin(v_venue_point, v_user_point, 100) then
    v_distance_m := st_distance(v_venue_point, v_user_point);
    return jsonb_build_object(
      'recorded', false,
      'reason', 'too_far',
      'distance_m', round(v_distance_m::numeric, 1)
    );
  end if;

  select exists (
    select 1
    from public.venue_crowd_snapshots s
    where s.venue_id = p_venue_id
      and s.user_id = v_user_id
      and s.signal_type = 'checkin'
      and s.created_at > now() - interval '15 minutes'
  )
  into v_recent_exists;

  if v_recent_exists then
    return jsonb_build_object('recorded', false, 'reason', 'rate_limited');
  end if;

  v_distance_m := st_distance(v_venue_point, v_user_point);

  insert into public.venue_crowd_snapshots (venue_id, user_id, signal_type, metadata)
  values (
    p_venue_id,
    v_user_id,
    'checkin',
    jsonb_build_object(
      'lat', p_latitude,
      'lng', p_longitude,
      'venue_lat', v_venue_lat,
      'venue_lng', v_venue_lng,
      'distance_m', round(v_distance_m::numeric, 1)
    )
  );

  return jsonb_build_object('recorded', true);
end;
$$;

revoke all on function public.record_venue_crowd_checkin(uuid, double precision, double precision) from public;
grant execute on function public.record_venue_crowd_checkin(uuid, double precision, double precision) to authenticated;

comment on function public.record_venue_crowd_checkin is
  'Records a geo check-in when the user is within 100m of the venue (max 1 per 15 min per user).';

-- ---------------------------------------------------------------------------
-- get_venue_live_crowd
-- ---------------------------------------------------------------------------

create or replace function public.get_venue_live_crowd(p_venue_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_checkins int := 0;
  v_bookings int := 0;
  v_stories_velocity int := 0;
  v_norm_checkins numeric;
  v_norm_bookings numeric;
  v_norm_stories numeric;
  v_score int;
  v_level text;
begin
  if p_venue_id is null then
    return jsonb_build_object(
      'crowd_score', 0,
      'crowd_level', 'empty',
      'checkins_last_hour', 0,
      'active_bookings', 0,
      'stories_velocity', 0
    );
  end if;

  select count(*)::int
  into v_checkins
  from public.venue_crowd_snapshots s
  where s.venue_id = p_venue_id
    and s.signal_type = 'checkin'
    and s.created_at > now() - interval '1 hour';

  select count(*)::int
  into v_bookings
  from public.bookings b
  where b.business_card_id = p_venue_id
    and b.status = 'upcoming'
    and b.date_time >= now()
    and b.date_time < now() + interval '90 minutes';

  select (
    coalesce((
      select count(*)::int
      from public.stories st
      where st.place_id = p_venue_id
        and st.created_at > now() - interval '30 minutes'
    ), 0)
    + coalesce((
      select count(*)::int
      from public.story_comments sc
      inner join public.stories st on st.id = sc.story_id
      where st.place_id = p_venue_id
        and sc.created_at > now() - interval '30 minutes'
    ), 0)
    + coalesce((
      select count(*)::int
      from public.story_reactions sr
      inner join public.stories st on st.id = sr.story_id
      where st.place_id = p_venue_id
        and sr.story_id is not null
        and sr.created_at > now() - interval '30 minutes'
    ), 0)
    + coalesce((
      select count(*)::int
      from public.story_reactions sr
      inner join public.story_comments sc on sc.id = sr.comment_id
      inner join public.stories st on st.id = sc.story_id
      where st.place_id = p_venue_id
        and sr.comment_id is not null
        and sr.created_at > now() - interval '30 minutes'
    ), 0)
  )
  into v_stories_velocity;

  v_norm_checkins := least(v_checkins, 20)::numeric / 20;
  v_norm_bookings := least(v_bookings, 15)::numeric / 15;
  v_norm_stories := least(v_stories_velocity, 30)::numeric / 30;

  v_score := round(100 * (
    v_norm_checkins * 0.45
    + v_norm_bookings * 0.35
    + v_norm_stories * 0.20
  ))::int;

  v_score := greatest(0, least(100, v_score));

  v_level := case
    when v_score <= 15 then 'empty'
    when v_score <= 35 then 'low'
    when v_score <= 55 then 'medium'
    when v_score <= 75 then 'busy'
    else 'packed'
  end;

  return jsonb_build_object(
    'crowd_score', v_score,
    'crowd_level', v_level,
    'checkins_last_hour', v_checkins,
    'active_bookings', v_bookings,
    'stories_velocity', v_stories_velocity
  );
end;
$$;

revoke all on function public.get_venue_live_crowd(uuid) from public;
grant execute on function public.get_venue_live_crowd(uuid) to authenticated;

comment on function public.get_venue_live_crowd is
  'Returns live crowd score and signal breakdown for a venue.';
