-- App Store uses pixai_monthly / pixai_annual; Google Play keeps pixai_premium_* SKUs.

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
        'pixai_premium_monthly',
        'pixai_premium_annual',
        'pixai_monthly',
        'pixai_annual'
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
      'pixai_premium_monthly',
      'pixai_premium_annual',
      'pixai_monthly',
      'pixai_annual'
    )
  order by case se.product_id
    when 'pixai_premium_annual' then 2
    when 'pixai_annual' then 2
    when 'pixai_premium_monthly' then 1
    when 'pixai_monthly' then 1
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
    when 'pixai_annual' then 100
    when 'pixai_premium_monthly' then 10
    when 'pixai_monthly' then 10
    else 0
  end;
$$;

create or replace function public.get_booking_credits_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet public.booking_credit_wallets;
  v_product_id text;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  perform public.ensure_booking_credit_wallet(v_user_id);
  perform public.expire_intro_credits_if_needed(v_user_id);

  select * into v_wallet from public.booking_credit_wallets where user_id = v_user_id;
  v_product_id := public.user_active_premium_product_id(v_user_id);

  return jsonb_build_object(
    'balance', coalesce(v_wallet.balance, 0),
    'intro_period_ends_at', v_wallet.intro_period_ends_at,
    'is_intro_active', now() < v_wallet.intro_period_ends_at,
    'has_paid_premium', v_product_id is not null,
    'has_premium_plus', v_product_id in ('pixai_premium_annual', 'pixai_annual'),
    'active_product_id', v_product_id
  );
end;
$$;

create or replace function public.user_can_boost_posts(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.account_role = 'admin'::public.profile_account_role
  )
  or exists (
    select 1
    from public.subscription_entitlements se
    where se.user_id = p_user_id
      and se.status in ('active', 'trialing', 'grace_period', 'billing_retry')
      and se.product_id in ('pixai_premium_annual', 'pixai_annual')
  );
$$;
