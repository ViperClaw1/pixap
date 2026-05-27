-- Add PlaceDetail deep link to daily recommendation push payload.

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
      'top_venue_id', v_top.venue_id,
      'venue_id', v_top.venue_id,
      'url', 'pixap://place/' || v_top.venue_id::text
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
