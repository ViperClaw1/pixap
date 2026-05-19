-- Fix check-in RPC: use latitude/longitude + st_makepoint instead of reading location column
-- (avoids "parse error - invalid geometry" when location is unreadable in plpgsql).

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

comment on function public.record_venue_crowd_checkin is
  'Records a geo check-in when the user is within 100m of the venue lat/lng (max 1 per 15 min per user).';
