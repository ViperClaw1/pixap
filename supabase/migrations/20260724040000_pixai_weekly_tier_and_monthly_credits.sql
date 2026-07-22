-- Add Pix AI Weekly tier (pixai_premium_weekly / pix_weekly), bump monthly credits 10 -> 20.
-- Weekly ranks below monthly for "active premium product" precedence; premium-plus (post boost) stays annual-only.

create or replace function public.user_has_active_premium_entitlement(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscription_entitlements se
    where se.user_id = p_user_id
      and se.status in ('active', 'trialing', 'grace_period', 'billing_retry')
      and se.product_id in (
        'pixai_premium_weekly',
        'pixai_premium_monthly',
        'pixai_premium_annual',
        'pix_weekly',
        'pix_monthly',
        'pix_annual'
      )
  );
$$;

create or replace function public.user_active_premium_product_id(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select se.product_id
  from public.subscription_entitlements se
  where se.user_id = p_user_id
    and se.status in ('active', 'trialing', 'grace_period', 'billing_retry')
    and se.product_id in (
      'pixai_premium_weekly',
      'pixai_premium_monthly',
      'pixai_premium_annual',
      'pix_weekly',
      'pix_monthly',
      'pix_annual'
    )
  order by case se.product_id
    when 'pixai_premium_annual' then 3
    when 'pix_annual' then 3
    when 'pixai_premium_monthly' then 2
    when 'pix_monthly' then 2
    when 'pixai_premium_weekly' then 1
    when 'pix_weekly' then 1
    else 0
  end desc
  limit 1;
$$;

create or replace function public.booking_credits_for_product(p_product_id text)
returns int
language sql
immutable
as $$
  select case p_product_id
    when 'pixai_premium_annual' then 100
    when 'pix_annual' then 100
    when 'pixai_premium_monthly' then 20
    when 'pix_monthly' then 20
    when 'pixai_premium_weekly' then 10
    when 'pix_weekly' then 10
    else 0
  end;
$$;

-- Backfill: bump existing active monthly subscribers from 10 to 20 credits immediately.
do $$
declare
  r record;
begin
  for r in
    select distinct se.user_id
    from public.subscription_entitlements se
    where se.status in ('active', 'trialing', 'grace_period', 'billing_retry')
      and se.product_id in ('pixai_premium_monthly', 'pix_monthly')
  loop
    perform public.refill_booking_credits_for_active_entitlement(r.user_id);
  end loop;
end;
$$;
