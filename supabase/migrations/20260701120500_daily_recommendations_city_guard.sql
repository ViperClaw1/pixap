-- Regenerate daily recommendations when the user's city changes, and keep the
-- read RPC city-scoped as a server-side safety net.

drop function if exists public.bootstrap_my_daily_recommendations(date);

create or replace function public.bootstrap_my_daily_recommendations(
  p_date date default (now() at time zone 'utc')::date,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inserted integer := 0;
  v_push_enqueued boolean := false;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  v_inserted := public.generate_daily_recommendations(v_uid, p_date, 8, coalesce(p_force, false));

  if v_inserted > 0 then
    v_push_enqueued := public.enqueue_daily_recommendation_push(v_uid, p_date);
  end if;

  return jsonb_build_object(
    'inserted_count', coalesce(v_inserted, 0),
    'push_enqueued', coalesce(v_push_enqueued, false),
    'generated_for_date', p_date
  );
end;
$$;

comment on function public.bootstrap_my_daily_recommendations(date, boolean) is
  'Generate today''s daily recommendations for auth.uid() and enqueue push. When p_force is true, replaces the existing batch for the date.';

revoke all on function public.bootstrap_my_daily_recommendations(date, boolean) from public;
grant execute on function public.bootstrap_my_daily_recommendations(date, boolean) to authenticated, service_role;

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
  with requested_date as (
    select coalesce(p_date, (now() at time zone 'utc')::date) as d
  ),
  profile_city as (
    select nullif(btrim(p.city), '') as city
    from public.profiles p
    where p.id = auth.uid()
  ),
  effective_date as (
    select case
      when exists (
        select 1
        from public.daily_recommendations dr
        where dr.user_id = auth.uid()
          and dr.generated_for_date = (select d from requested_date)
      ) then (select d from requested_date)
      else (
        select max(dr.generated_for_date)
        from public.daily_recommendations dr
        where dr.user_id = auth.uid()
      )
    end as d
  )
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
    and dr.generated_for_date = (select d from effective_date)
    and (
      not exists (select 1 from profile_city pc where pc.city is not null)
      or bc.city is null
      or lower(btrim(bc.city)) = (
        select lower(btrim(pc.city))
        from profile_city pc
        where pc.city is not null
        limit 1
      )
    )
  order by dr.generated_rank asc;
$$;

comment on function public.get_daily_recommendations(date) is
  'Returns recommendations for the requested UTC date, or the latest batch when today''s run has not completed yet. If the profile has a city, only same-city venues are returned.';
