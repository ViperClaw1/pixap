-- Denormalize store_environment + price onto subscription_transactions for reliable admin revenue.
-- Backfill existing Apple rows from signedTransactionInfo JWT (environment, price in milliunits).

alter table public.subscription_transactions
  add column if not exists store_environment text
    check (store_environment in ('production', 'sandbox')),
  add column if not exists price_cents integer
    check (price_cents is null or price_cents >= 0);

create or replace function public.decode_jwt_payload_json(p_jwt text)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_part text;
  v_pad int;
begin
  if p_jwt is null or btrim(p_jwt) = '' then
    return null;
  end if;

  v_part := split_part(p_jwt, '.', 2);
  if v_part = '' then
    return null;
  end if;

  v_part := translate(v_part, '-_', '+/');
  v_pad := (4 - length(v_part) % 4) % 4;

  return convert_from(decode(v_part || repeat('=', v_pad), 'base64'), 'utf8')::jsonb;
exception
  when others then
    return null;
end;
$$;

create or replace function public.subscription_transaction_catalog_price_cents(p_product_id text)
returns integer
language sql
immutable
as $$
  select case p_product_id
    when 'pixai_premium_annual' then 9999
    when 'pix_annual' then 9999
    when 'pixai_premium_monthly' then 1299
    when 'pix_monthly' then 1299
    else 1299
  end;
$$;

create or replace function public.subscription_transaction_revenue_cents(
  p_price_cents integer,
  p_product_id text
)
returns bigint
language sql
immutable
as $$
  select coalesce(
    p_price_cents::bigint,
    public.subscription_transaction_catalog_price_cents(p_product_id)::bigint
  );
$$;

create or replace function public.subscription_transaction_is_production(
  p_tx_store_environment text,
  p_entitlement_store_environment text
)
returns boolean
language sql
immutable
as $$
  select coalesce(p_tx_store_environment, p_entitlement_store_environment) = 'production';
$$;

-- Backfill from linked entitlements first.
update public.subscription_transactions st
set store_environment = se.store_environment
from public.subscription_entitlements se
where st.entitlement_id = se.id
  and st.store_environment is null
  and se.store_environment is not null;

-- Backfill Apple environment + price from JWT payload.
update public.subscription_transactions st
set
  store_environment = coalesce(
    st.store_environment,
    lower(nullif(btrim(jwt.payload->>'environment'), ''))
  ),
  price_cents = coalesce(
    st.price_cents,
    case
      when jwt.payload->>'price' ~ '^\d+$'
        then greatest(0, round((jwt.payload->>'price')::numeric / 10)::integer)
      else null
    end
  )
from (
  select
    st2.id,
    public.decode_jwt_payload_json(st2.raw_payload->>'signedTransactionInfo') as payload
  from public.subscription_transactions st2
  where st2.platform = 'ios'
    and st2.raw_payload ? 'signedTransactionInfo'
) jwt
where st.id = jwt.id
  and jwt.payload is not null
  and (
    st.store_environment is null
    or st.price_cents is null
  );

create or replace function public.admin_analytics_summary(p_period_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days int;
  v_from date;
  v_to date;
  v_prev_from date;
  v_prev_to date;
  v_reg_total int;
  v_reg_prev int;
  v_reg_growth numeric;
  v_reg_series jsonb;
  v_dau_today int;
  v_dau_avg numeric;
  v_dau_prev_avg numeric;
  v_dau_vs_prev numeric;
  v_dau_series jsonb;
  v_wa_started int;
  v_wa_success int;
  v_wa_missing int;
  v_wa_reject int;
  v_wa_other int;
  v_wa_conv numeric;
  v_sub_total int;
  v_sub_prev int;
  v_sub_growth numeric;
  v_sub_series jsonb;
  v_mrr_current bigint;
  v_mrr_series jsonb;
  v_revenue_ios bigint;
  v_revenue_android bigint;
begin
  perform public.assert_admin_analytics_access();

  v_days := greatest(1, least(coalesce(p_period_days, 30), 366));
  v_to := current_date;
  v_from := v_to - (v_days - 1);
  v_prev_to := v_from - 1;
  v_prev_from := v_prev_to - (v_days - 1);

  select count(*)::int into v_reg_total
  from public.profiles p
  where (p.created_at at time zone 'utc')::date between v_from and v_to;

  select count(*)::int into v_reg_prev
  from public.profiles p
  where (p.created_at at time zone 'utc')::date between v_prev_from and v_prev_to;

  if v_reg_prev = 0 then
    v_reg_growth := case when v_reg_total > 0 then 100 else 0 end;
  else
    v_reg_growth := round(((v_reg_total - v_reg_prev)::numeric / v_reg_prev) * 1000, 1) / 10;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', to_char(d.day, 'YYYY-MM-DD'),
        'value', coalesce(r.cnt, 0)
      )
      order by d.day
    ),
    '[]'::jsonb
  )
  into v_reg_series
  from (
    select gs::date as day
    from generate_series(v_from::timestamp, v_to::timestamp, interval '1 day') gs
  ) d
  left join (
    select (p.created_at at time zone 'utc')::date as day, count(*)::int as cnt
    from public.profiles p
    where (p.created_at at time zone 'utc')::date between v_from and v_to
    group by 1
  ) r on r.day = d.day;

  select count(distinct p.id)::int into v_dau_today
  from public.profiles p
  where p.last_seen_at is not null
    and (p.last_seen_at at time zone 'utc')::date = v_to;

  select coalesce(avg(daily.cnt), 0) into v_dau_avg
  from (
    select coalesce(r.cnt, 0)::numeric as cnt
    from (
      select gs::date as day
      from generate_series(v_to - 6, v_to, interval '1 day') gs
    ) last7
    left join (
      select (p.last_seen_at at time zone 'utc')::date as day, count(distinct p.id)::int as cnt
      from public.profiles p
      where p.last_seen_at is not null
        and (p.last_seen_at at time zone 'utc')::date between v_to - 6 and v_to
      group by 1
    ) r on r.day = last7.day
  ) daily;

  select coalesce(avg(daily.cnt), 0) into v_dau_prev_avg
  from (
    select coalesce(r.cnt, 0)::numeric as cnt
    from (
      select gs::date as day
      from generate_series(v_prev_to - 6, v_prev_to, interval '1 day') gs
    ) last7
    left join (
      select (p.last_seen_at at time zone 'utc')::date as day, count(distinct p.id)::int as cnt
      from public.profiles p
      where p.last_seen_at is not null
        and (p.last_seen_at at time zone 'utc')::date between v_prev_to - 6 and v_prev_to
      group by 1
    ) r on r.day = last7.day
  ) daily;

  if v_dau_prev_avg = 0 then
    v_dau_vs_prev := case when v_dau_today > 0 then 100 else 0 end;
  else
    v_dau_vs_prev := round(((v_dau_today - v_dau_prev_avg) / v_dau_prev_avg) * 1000, 1) / 10;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', to_char(d.day, 'YYYY-MM-DD'),
        'value', coalesce(r.cnt, 0)
      )
      order by d.day
    ),
    '[]'::jsonb
  )
  into v_dau_series
  from (
    select gs::date as day
    from generate_series(v_from::timestamp, v_to::timestamp, interval '1 day') gs
  ) d
  left join (
    select (p.last_seen_at at time zone 'utc')::date as day, count(distinct p.id)::int as cnt
    from public.profiles p
    where p.last_seen_at is not null
      and (p.last_seen_at at time zone 'utc')::date between v_from and v_to
    group by 1
  ) r on r.day = d.day;

  select count(*)::int into v_wa_started
  from public.cart_items ci
  where ci.wa_n8n_started_at is not null
    and (ci.wa_n8n_started_at at time zone 'utc')::date between v_from and v_to;

  select count(*)::int into v_wa_success
  from public.cart_items ci
  where ci.wa_n8n_started_at is not null
    and (ci.wa_n8n_started_at at time zone 'utc')::date between v_from and v_to
    and (
      ci.wa_confirmable = true
      or nullif(btrim(coalesce(ci.wa_payment_link, '')), '') is not null
    );

  select count(*)::int into v_wa_missing
  from public.cart_items ci
  join public.business_cards bc on bc.id = ci.business_card_id
  where (ci.created_at at time zone 'utc')::date between v_from and v_to
    and ci.wa_n8n_started_at is null
    and nullif(btrim(coalesce(bc.contact_whatsapp, '')), '') is null;

  select count(*)::int into v_wa_reject
  from public.cart_items ci
  where ci.wa_n8n_started_at is not null
    and (ci.wa_n8n_started_at at time zone 'utc')::date between v_from and v_to
    and not (
      ci.wa_confirmable = true
      or nullif(btrim(coalesce(ci.wa_payment_link, '')), '') is not null
    )
    and (
      ci.wa_status_lines::text ilike '%reject%'
      or ci.wa_status_lines::text ilike '%declin%'
      or ci.wa_status_lines::text ilike '%отказ%'
      or ci.wa_status_lines::text ilike '%refus%'
    );

  v_wa_other := greatest(0, v_wa_started - v_wa_success - v_wa_reject);

  if v_wa_started = 0 then
    v_wa_conv := 0;
  else
    v_wa_conv := round((v_wa_success::numeric / v_wa_started) * 1000, 1) / 10;
  end if;

  -- Subscriptions: production only (tx store_environment preferred, entitlement fallback).
  select count(*)::int into v_sub_total
  from public.subscription_transactions st
  left join public.subscription_entitlements se on se.id = st.entitlement_id
  where public.subscription_transaction_is_production(st.store_environment, se.store_environment)
    and st.status in ('purchased', 'renewed', 'trialing')
    and (st.created_at at time zone 'utc')::date between v_from and v_to;

  select count(*)::int into v_sub_prev
  from public.subscription_transactions st
  left join public.subscription_entitlements se on se.id = st.entitlement_id
  where public.subscription_transaction_is_production(st.store_environment, se.store_environment)
    and st.status in ('purchased', 'renewed', 'trialing')
    and (st.created_at at time zone 'utc')::date between v_prev_from and v_prev_to;

  if v_sub_prev = 0 then
    v_sub_growth := case when v_sub_total > 0 then 100 else 0 end;
  else
    v_sub_growth := round(((v_sub_total - v_sub_prev)::numeric / v_sub_prev) * 1000, 1) / 10;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', to_char(d.day, 'YYYY-MM-DD'),
        'value', coalesce(s.cnt, 0)
      )
      order by d.day
    ),
    '[]'::jsonb
  )
  into v_sub_series
  from (
    select gs::date as day
    from generate_series(v_from::timestamp, v_to::timestamp, interval '1 day') gs
  ) d
  left join (
    select (st.created_at at time zone 'utc')::date as day, count(*)::int as cnt
    from public.subscription_transactions st
    left join public.subscription_entitlements se on se.id = st.entitlement_id
    where public.subscription_transaction_is_production(st.store_environment, se.store_environment)
      and st.status in ('purchased', 'renewed', 'trialing')
      and (st.created_at at time zone 'utc')::date between v_from and v_to
    group by 1
  ) s on s.day = d.day;

  select coalesce(sum(
    public.subscription_transaction_revenue_cents(st.price_cents, st.product_id)
  ), 0)::bigint into v_revenue_ios
  from public.subscription_transactions st
  left join public.subscription_entitlements se on se.id = st.entitlement_id
  where public.subscription_transaction_is_production(st.store_environment, se.store_environment)
    and st.platform = 'ios'
    and st.status in ('purchased', 'renewed')
    and (st.created_at at time zone 'utc')::date between v_from and v_to;

  select coalesce(sum(
    public.subscription_transaction_revenue_cents(st.price_cents, st.product_id)
  ), 0)::bigint into v_revenue_android
  from public.subscription_transactions st
  left join public.subscription_entitlements se on se.id = st.entitlement_id
  where public.subscription_transaction_is_production(st.store_environment, se.store_environment)
    and st.platform = 'android'
    and st.status in ('purchased', 'renewed')
    and (st.created_at at time zone 'utc')::date between v_from and v_to;

  select coalesce(sum(
    case se.product_id
      when 'pixai_premium_annual' then public.subscription_transaction_catalog_price_cents(se.product_id) / 12
      when 'pix_annual' then public.subscription_transaction_catalog_price_cents(se.product_id) / 12
      else public.subscription_transaction_catalog_price_cents(se.product_id)
    end
  ), 0)::bigint into v_mrr_current
  from public.subscription_entitlements se
  where se.store_environment = 'production'
    and se.status in ('active', 'trialing', 'grace_period', 'billing_retry')
    and se.product_id in (
      'pixai_premium_monthly',
      'pixai_premium_annual',
      'pix_monthly',
      'pix_annual'
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', to_char(d.day, 'YYYY-MM-DD'),
        'value', v_mrr_current
      )
      order by d.day
    ),
    '[]'::jsonb
  )
  into v_mrr_series
  from (
    select gs::date as day
    from generate_series(v_from::timestamp, v_to::timestamp, interval '1 day') gs
  ) d;

  return jsonb_build_object(
    'period', v_days,
    'period_from', to_char(v_from, 'YYYY-MM-DD'),
    'period_to', to_char(v_to, 'YYYY-MM-DD'),
    'registrations', jsonb_build_object(
      'total', v_reg_total,
      'growth_pct', v_reg_growth,
      'series', v_reg_series
    ),
    'dau', jsonb_build_object(
      'today', v_dau_today,
      'avg_7d', round(v_dau_avg)::int,
      'vs_previous_pct', v_dau_vs_prev,
      'series', v_dau_series
    ),
    'whatsapp', jsonb_build_object(
      'campaigns_started', v_wa_started,
      'successful_bookings', v_wa_success,
      'conversion_pct', v_wa_conv,
      'success_rate_pct', v_wa_conv,
      'outcomes', jsonb_build_object(
        'success', v_wa_success,
        'missing_whatsapp', v_wa_missing,
        'venue_rejection', v_wa_reject,
        'other', v_wa_other
      )
    ),
    'subscriptions', jsonb_build_object(
      'total_purchased', v_sub_total,
      'growth_pct', v_sub_growth,
      'purchases_series', v_sub_series,
      'mrr_series', v_mrr_series,
      'mrr_current', v_mrr_current,
      'revenue_ios', v_revenue_ios,
      'revenue_android', v_revenue_android
    )
  );
end;
$$;
