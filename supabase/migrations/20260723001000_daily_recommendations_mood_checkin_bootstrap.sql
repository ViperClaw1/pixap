-- Daily mood check-in integration for today's recommendations.
-- Step 2 (daily_mood_checkins + upsert_my_daily_mood_checkin) is expected to exist.

create or replace function public.generate_daily_recommendations(
  p_user_id uuid,
  p_date date,
  p_limit integer,
  p_force boolean,
  p_mood_tags text[],
  p_energy_level smallint
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_auth_uid uuid := auth.uid();
  v_lim integer := greatest(1, least(coalesce(p_limit, 8), 20));
  v_city text;
  v_mood_tags text[] := coalesce(p_mood_tags, '{}'::text[]);
  v_mood_text text;
  v_timeline text;
  v_inserted integer := 0;
begin
  if v_uid is null then
    raise exception 'user id is required';
  end if;
  if v_auth_uid is not null and v_auth_uid <> v_uid then
    raise exception 'cannot generate recommendations for another user';
  end if;
  if not exists (select 1 from auth.users u where u.id = v_uid) then
    raise exception 'user % does not exist in auth.users', v_uid;
  end if;

  v_mood_text := nullif(array_to_string(v_mood_tags, ' '), '');
  select nullif(btrim(coalesce(p.city, '')), '') into v_city
  from public.profiles p
  where p.id = v_uid;

  if v_mood_text is null or v_city is null then
    return public.generate_daily_recommendations(v_uid, p_date, v_lim, coalesce(p_force, false));
  end if;

  if not coalesce(p_force, false) and exists (
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

  if coalesce(p_force, false) then
    delete from public.daily_recommendations
    where user_id = v_uid
      and generated_for_date = p_date;
  end if;

  v_timeline := case
    when coalesce(p_energy_level, 3) >= 4 then 'night'
    when coalesce(p_energy_level, 3) <= 2 then 'evening'
    else 'evening'
  end;

  with ranked as (
    select
      s.venue_id,
      greatest(0::numeric, coalesce(s.vibe_score, 0::numeric)) as vibe_score,
      row_number() over (order by coalesce(s.vibe_score, 0::numeric) desc, s.name asc) as generated_rank
    from public.search_by_vibe(v_mood_text, v_timeline, v_city, v_lim) s
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
      round((r.vibe_score / 20::numeric)::numeric, 5),
      array['Matches today''s vibe', 'Based on your mood check-in']::text[],
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

  if v_inserted = 0 then
    return public.generate_daily_recommendations(v_uid, p_date, v_lim, true);
  end if;

  return coalesce(v_inserted, 0);
end;
$$;

comment on function public.generate_daily_recommendations(uuid, date, integer, boolean, text[], smallint) is
  'Generate daily recommendations from explicit daily mood check-in; falls back to the historical generator when mood/city is missing.';

create or replace function public.bootstrap_my_daily_recommendations(
  p_date date default null,
  p_force boolean default false,
  p_mood_tags text[] default null,
  p_energy_level smallint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_local_date date;
  v_inserted integer := 0;
  v_push_enqueued boolean := false;
  v_mood_tags text[] := coalesce(p_mood_tags, '{}'::text[]);
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  v_local_date := coalesce(
    p_date,
    public.profile_local_date(v_uid)
  );

  if array_length(v_mood_tags, 1) is not null or p_energy_level is not null then
    perform public.upsert_my_daily_mood_checkin(
      v_local_date,
      v_mood_tags,
      p_energy_level,
      null,
      false
    );
    v_inserted := public.generate_daily_recommendations(
      v_uid,
      v_local_date,
      8,
      coalesce(p_force, true),
      v_mood_tags,
      p_energy_level
    );
  else
    v_inserted := public.generate_daily_recommendations(v_uid, v_local_date, 8, coalesce(p_force, false));
  end if;

  if v_inserted > 0 then
    v_push_enqueued := public.enqueue_daily_recommendation_push(v_uid, v_local_date, 'noon');
  end if;

  return jsonb_build_object(
    'inserted_count', coalesce(v_inserted, 0),
    'push_enqueued', coalesce(v_push_enqueued, false),
    'generated_for_date', v_local_date
  );
end;
$$;

comment on function public.bootstrap_my_daily_recommendations(date, boolean, text[], smallint) is
  'Generate today''s daily recommendations for auth.uid(), optionally using explicit daily mood check-in context.';

grant execute on function public.generate_daily_recommendations(uuid, date, integer, boolean, text[], smallint) to authenticated, service_role;
grant execute on function public.bootstrap_my_daily_recommendations(date, boolean, text[], smallint) to authenticated, service_role;
