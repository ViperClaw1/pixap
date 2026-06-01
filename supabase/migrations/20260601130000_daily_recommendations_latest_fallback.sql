-- Keep showing the user's latest recommendation batch until today's cron run inserts a new one.

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
  order by dr.generated_rank asc;
$$;

comment on function public.get_daily_recommendations(date) is
  'Returns recommendations for the requested UTC date, or the latest batch when today''s run has not completed yet.';
