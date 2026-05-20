-- Guard daily recommendation writes against orphaned profile IDs.
-- FK targets auth.users; profiles.id can exist without a matching auth.users row.

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

  if not exists (
    select 1
    from auth.users u
    where u.id = p_user_id
  ) then
    -- Cannot write delivery_logs for orphaned profile IDs (same auth.users FK).
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
