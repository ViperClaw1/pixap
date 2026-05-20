-- Booking credit wallets: intro 3 credits / 7 days, monthly 10, annual 100.

create type public.booking_credit_reason as enum (
  'intro_grant',
  'intro_expire',
  'booking_consume',
  'subscription_refill'
);

create table if not exists public.booking_credit_wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance int not null default 0 check (balance >= 0),
  intro_period_ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  delta int not null,
  balance_after int not null,
  reason public.booking_credit_reason not null,
  booking_id uuid references public.bookings (id) on delete set null,
  product_id text,
  created_at timestamptz not null default now()
);

create index if not exists booking_credit_ledger_user_created_idx
  on public.booking_credit_ledger (user_id, created_at desc);

alter table public.booking_credit_wallets enable row level security;
alter table public.booking_credit_ledger enable row level security;

drop policy if exists "booking_credit_wallets_select_own" on public.booking_credit_wallets;
create policy "booking_credit_wallets_select_own"
  on public.booking_credit_wallets
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "booking_credit_ledger_select_own" on public.booking_credit_ledger;
create policy "booking_credit_ledger_select_own"
  on public.booking_credit_ledger
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

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
      and se.product_id in ('pixai_premium_monthly', 'pixai_premium_annual')
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
    and se.product_id in ('pixai_premium_monthly', 'pixai_premium_annual')
  order by case se.product_id
    when 'pixai_premium_annual' then 2
    when 'pixai_premium_monthly' then 1
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
    when 'pixai_premium_monthly' then 10
    else 0
  end;
$$;

create or replace function public.append_booking_credit_ledger(
  p_user_id uuid,
  p_delta int,
  p_balance_after int,
  p_reason public.booking_credit_reason,
  p_booking_id uuid default null,
  p_product_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.booking_credit_ledger (user_id, delta, balance_after, reason, booking_id, product_id)
  values (p_user_id, p_delta, p_balance_after, p_reason, p_booking_id, p_product_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Wallet lifecycle
-- ---------------------------------------------------------------------------

create or replace function public.ensure_booking_credit_wallet(p_user_id uuid)
returns public.booking_credit_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.booking_credit_wallets;
  v_created_at timestamptz;
  v_intro_ends timestamptz;
begin
  select * into v_wallet from public.booking_credit_wallets where user_id = p_user_id;
  if found then
    return v_wallet;
  end if;

  select u.created_at into v_created_at from auth.users u where u.id = p_user_id;
  if v_created_at is null then
    v_created_at := now();
  end if;
  v_intro_ends := v_created_at + interval '7 days';

  insert into public.booking_credit_wallets (user_id, balance, intro_period_ends_at)
  values (p_user_id, 3, v_intro_ends)
  returning * into v_wallet;

  perform public.append_booking_credit_ledger(
    p_user_id, 3, 3, 'intro_grant', null, null
  );

  return v_wallet;
end;
$$;

create or replace function public.expire_intro_credits_if_needed(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.booking_credit_wallets;
  v_old_balance int;
begin
  perform public.ensure_booking_credit_wallet(p_user_id);

  select * into v_wallet from public.booking_credit_wallets where user_id = p_user_id for update;
  if not found then
    return;
  end if;

  if now() < v_wallet.intro_period_ends_at then
    return;
  end if;

  if public.user_has_active_premium_entitlement(p_user_id) then
    return;
  end if;

  if v_wallet.balance <= 0 then
    return;
  end if;

  v_old_balance := v_wallet.balance;

  update public.booking_credit_wallets
  set balance = 0, updated_at = now()
  where user_id = p_user_id;

  perform public.append_booking_credit_ledger(
    p_user_id, -v_old_balance, 0, 'intro_expire', null, null
  );
end;
$$;

create or replace function public.refill_booking_credits(p_user_id uuid, p_product_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target int;
  v_old_balance int;
  v_delta int;
  v_active_product text;
begin
  v_target := public.booking_credits_for_product(p_product_id);
  if v_target <= 0 then
    return 0;
  end if;

  if not exists (
    select 1
    from public.subscription_entitlements se
    where se.user_id = p_user_id
      and se.product_id = p_product_id
      and se.status in ('active', 'trialing', 'grace_period', 'billing_retry')
  ) then
    return 0;
  end if;

  perform public.ensure_booking_credit_wallet(p_user_id);

  select balance into v_old_balance
  from public.booking_credit_wallets
  where user_id = p_user_id
  for update;

  v_delta := v_target - v_old_balance;

  update public.booking_credit_wallets
  set balance = v_target, updated_at = now()
  where user_id = p_user_id;

  if v_delta <> 0 then
    perform public.append_booking_credit_ledger(
      p_user_id, v_delta, v_target, 'subscription_refill', null, p_product_id
    );
  end if;

  return v_target;
end;
$$;

create or replace function public.refill_booking_credits_for_active_entitlement(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id text;
begin
  v_product_id := public.user_active_premium_product_id(p_user_id);
  if v_product_id is null then
    return 0;
  end if;
  return public.refill_booking_credits(p_user_id, v_product_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Consume on booking insert
-- ---------------------------------------------------------------------------

create or replace function public.consume_booking_credit_on_booking_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.booking_credit_wallets;
  v_new_balance int;
begin
  if new.user_id is null then
    return new;
  end if;

  perform public.ensure_booking_credit_wallet(new.user_id);
  perform public.expire_intro_credits_if_needed(new.user_id);

  select * into v_wallet
  from public.booking_credit_wallets
  where user_id = new.user_id
  for update;

  if v_wallet.balance <= 0 then
    raise exception 'insufficient_booking_credits'
      using errcode = 'P0001';
  end if;

  v_new_balance := v_wallet.balance - 1;

  update public.booking_credit_wallets
  set balance = v_new_balance, updated_at = now()
  where user_id = new.user_id;

  perform public.append_booking_credit_ledger(
    new.user_id, -1, v_new_balance, 'booking_consume', null, null
  );

  return new;
end;
$$;

drop trigger if exists consume_booking_credit_before_insert on public.bookings;
create trigger consume_booking_credit_before_insert
  before insert on public.bookings
  for each row
  execute function public.consume_booking_credit_on_booking_insert();

-- ---------------------------------------------------------------------------
-- Client RPC: read status (expires intro on read)
-- ---------------------------------------------------------------------------

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
    'has_premium_plus', v_product_id = 'pixai_premium_annual',
    'active_product_id', v_product_id
  );
end;
$$;

revoke all on function public.get_booking_credits_status() from public;
grant execute on function public.get_booking_credits_status() to authenticated;

revoke all on function public.ensure_booking_credit_wallet(uuid) from public;
revoke all on function public.expire_intro_credits_if_needed(uuid) from public;
revoke all on function public.refill_booking_credits(uuid, text) from public;
revoke all on function public.refill_booking_credits_for_active_entitlement(uuid) from public;

-- New user signup hook
create or replace function public.on_auth_user_created_booking_credits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_booking_credit_wallet(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_booking_credits on auth.users;
create trigger on_auth_user_created_booking_credits
  after insert on auth.users
  for each row
  execute function public.on_auth_user_created_booking_credits();

-- ---------------------------------------------------------------------------
-- Backfill existing users
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  v_product_id text;
begin
  for r in select id from auth.users loop
    perform public.ensure_booking_credit_wallet(r.id);
    perform public.expire_intro_credits_if_needed(r.id);

    v_product_id := public.user_active_premium_product_id(r.id);
    if v_product_id is not null then
      perform public.refill_booking_credits(r.id, v_product_id);
    end if;
  end loop;
end;
$$;
