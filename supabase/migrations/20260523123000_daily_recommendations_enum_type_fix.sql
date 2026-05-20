-- Hotfix: avoid invalid enum cast in generate_daily_recommendations.
-- Root cause: coalesce(bc.type, '') attempted to cast '' into enum business_card_type.

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
