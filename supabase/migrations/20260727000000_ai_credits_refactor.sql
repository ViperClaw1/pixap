-- Decouple booking credits from bookings; retarget them at Pix AI concierge (Gemini) usage
-- and route building (Google Maps Directions) usage. Balances move from int to numeric(10,2)
-- because both consumption paths spend fractional credits.
--
-- New model:
--   - intro grant: 10 credits, 1-day trial window (was 3 / 7 days)
--   - pix_weekly / pixai_premium_weekly:   +100 credits  (was 10, "set to")
--   - pix_monthly / pixai_premium_monthly: +250 credits  (was 20, "set to")
--   - pix_annual / pixai_premium_annual:   +1500 credits (was 100, "set to")
--   - subscription credits are additive and non-expiring (stack on top of unused balance)
--   - booking inserts no longer consume credits (trigger dropped)
--   - AI chat turns consume 0.25-0.5 credits via consume_ai_query_credit (service_role only)
--   - route builds consume 0.10-0.25 credits via consume_route_build_credit (client RPC)
--
-- Refill idempotency: refill_booking_credits is invoked only after claimProcessedTransaction()
-- confirms first-processing of a given store transaction id (see supabase/functions/_shared/
-- iapIdempotency.ts + all iap-* call sites), so making it additive here does not risk
-- double-crediting on retried webhooks / repeated verify-purchase calls / reconciliation polls.

-- ---------------------------------------------------------------------------
-- 1. Balances/deltas move to numeric(10,2)
-- ---------------------------------------------------------------------------

alter table public.booking_credit_wallets
  alter column balance type numeric(10,2) using balance::numeric(10,2);

alter table public.booking_credit_ledger
  alter column delta type numeric(10,2) using delta::numeric(10,2),
  alter column balance_after type numeric(10,2) using balance_after::numeric(10,2);

-- ---------------------------------------------------------------------------
-- 2. New ledger reasons + metadata columns for AI/route consumption
-- ---------------------------------------------------------------------------

alter type public.booking_credit_reason add value if not exists 'ai_query_consume';
alter type public.booking_credit_reason add value if not exists 'route_build_consume';

alter table public.booking_credit_ledger
  add column if not exists action_type text,
  add column if not exists token_metadata jsonb;

-- ---------------------------------------------------------------------------
-- 3. Bookings no longer consume credits
-- ---------------------------------------------------------------------------

drop trigger if exists consume_booking_credit_before_insert on public.bookings;

-- ---------------------------------------------------------------------------
-- 4. Intro grant: 10 credits / 1 day (was 3 / 7 days)
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
  v_intro_ends := v_created_at + interval '1 day';

  insert into public.booking_credit_wallets (user_id, balance, intro_period_ends_at)
  values (p_user_id, 10.00, v_intro_ends)
  returning * into v_wallet;

  perform public.append_booking_credit_ledger(
    p_user_id, 10.00, 10.00, 'intro_grant', null, null
  );

  return v_wallet;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4a. append_booking_credit_ledger took `p_delta int, p_balance_after int` —
--     any fractional value routed through it (a subscription refill landing on
--     top of a fractional balance, or intro-expiry zeroing a fractional balance)
--     would silently round in the ledger audit row, even though the wallet's
--     real balance stays correct (it's always set explicitly, not derived from
--     the ledger). Changing parameter types via CREATE OR REPLACE creates a
--     *second* overload rather than replacing the first, so the old int-typed
--     signature must be dropped explicitly first — otherwise calls with a plain
--     numeric literal become ambiguous between the two overloads.
-- ---------------------------------------------------------------------------

drop function if exists public.append_booking_credit_ledger(
  uuid, int, int, public.booking_credit_reason, uuid, text
);

create or replace function public.append_booking_credit_ledger(
  p_user_id uuid,
  p_delta numeric,
  p_balance_after numeric,
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
-- 4b. expire_intro_credits_if_needed used an `int` local for the balance being
--     zeroed out on ledger write — now that balances can be fractional (e.g. 9.75
--     left when the trial day ends), that local must be numeric too, or the
--     ledger audit entry silently rounds the recorded delta (wallet balance itself
--     was already fine, since it's always explicitly set to 0).
-- ---------------------------------------------------------------------------

create or replace function public.expire_intro_credits_if_needed(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.booking_credit_wallets;
  v_old_balance numeric;
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

-- ---------------------------------------------------------------------------
-- 5. Product credit grants: weekly=100, monthly=250, annual=1500
--    (accept both Google Play `pixai_premium_*` and App Store `pix_*` SKUs)
--    Return type changes int -> numeric, so CREATE OR REPLACE can't just patch it in place.
-- ---------------------------------------------------------------------------

drop function if exists public.booking_credits_for_product(text);

create or replace function public.booking_credits_for_product(p_product_id text)
returns numeric
language sql
immutable
as $$
  select case p_product_id
    when 'pixai_premium_weekly' then 100.00
    when 'pix_weekly'           then 100.00
    when 'pixai_premium_monthly' then 250.00
    when 'pix_monthly'           then 250.00
    when 'pixai_premium_annual'  then 1500.00
    when 'pix_annual'            then 1500.00
    else 0.00
  end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Refill becomes additive (credits stack, never expire once granted by a
--    subscription). Idempotency is enforced upstream by claimProcessedTransaction,
--    so each call here corresponds to exactly one real renewal/purchase event.
--    Return type changes int -> numeric, so this also needs an explicit drop first.
-- ---------------------------------------------------------------------------

drop function if exists public.refill_booking_credits(uuid, text);

create or replace function public.refill_booking_credits(p_user_id uuid, p_product_id text)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant numeric;
  v_old_balance numeric;
  v_new_balance numeric;
begin
  v_grant := public.booking_credits_for_product(p_product_id);
  if v_grant <= 0 then
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

  v_new_balance := v_old_balance + v_grant;

  update public.booking_credit_wallets
  set balance = v_new_balance, updated_at = now()
  where user_id = p_user_id;

  perform public.append_booking_credit_ledger(
    p_user_id, v_grant, v_new_balance, 'subscription_refill', null, p_product_id
  );

  return v_new_balance;
end;
$$;

-- DROP FUNCTION resets privileges to the default (EXECUTE to PUBLIC) — restore the
-- original lockdown from 20260521120000_booking_credits.sql (only SECURITY DEFINER
-- callers / service_role, never a direct client RPC).
revoke all on function public.refill_booking_credits(uuid, text) from public;

-- ---------------------------------------------------------------------------
-- 7. Consume AI query credit (Gemini turns in Pix AI concierge).
--    Called from the pixai-booking-chat Edge Function with the service_role
--    client — never exposed to the authenticated client role directly.
-- ---------------------------------------------------------------------------

create or replace function public.consume_ai_query_credit(
  p_user_id uuid,
  p_delta numeric,
  p_input_tokens int default null,
  p_output_tokens int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.booking_credit_wallets;
  v_new_balance numeric;
begin
  if p_delta > 0 then
    raise exception 'invalid_delta' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.profiles where id = p_user_id and account_role = 'admin'::public.profile_account_role
  ) then
    return jsonb_build_object('ok', true, 'balance', -1);
  end if;

  perform public.ensure_booking_credit_wallet(p_user_id);
  perform public.expire_intro_credits_if_needed(p_user_id);

  select * into v_wallet
  from public.booking_credit_wallets
  where user_id = p_user_id
  for update;

  if v_wallet.balance + p_delta < 0 then
    raise exception 'insufficient_ai_credits' using errcode = 'P0001';
  end if;

  v_new_balance := v_wallet.balance + p_delta;

  update public.booking_credit_wallets
  set balance = v_new_balance, updated_at = now()
  where user_id = p_user_id;

  insert into public.booking_credit_ledger
    (user_id, delta, balance_after, reason, action_type, token_metadata)
  values (
    p_user_id, p_delta, v_new_balance, 'ai_query_consume', 'ai_chat_turn',
    jsonb_build_object('input_tokens', p_input_tokens, 'output_tokens', p_output_tokens)
  );

  return jsonb_build_object('ok', true, 'balance', v_new_balance);
end;
$$;

revoke all on function public.consume_ai_query_credit(uuid, numeric, int, int) from public;
grant execute on function public.consume_ai_query_credit(uuid, numeric, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- 8. Consume route-build credit (Google Maps Directions calls). Called
--    directly from the client after a successful route fetch, since the
--    Google Maps API call itself happens on-device.
--    1 stop = 0.10, 2 = 0.15, 3 = 0.20, 4+ = 0.25.
-- ---------------------------------------------------------------------------

create or replace function public.consume_route_build_credit(p_stop_count int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_delta numeric;
  v_wallet public.booking_credit_wallets;
  v_new_balance numeric;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if p_stop_count is null or p_stop_count < 1 then
    return jsonb_build_object('ok', true, 'balance', null);
  end if;

  v_delta := -1.0 * least(0.10 + greatest(0, p_stop_count - 1) * 0.05, 0.25);

  if exists (
    select 1 from public.profiles where id = v_user_id and account_role = 'admin'::public.profile_account_role
  ) then
    return jsonb_build_object('ok', true, 'balance', -1);
  end if;

  perform public.ensure_booking_credit_wallet(v_user_id);
  perform public.expire_intro_credits_if_needed(v_user_id);

  select * into v_wallet
  from public.booking_credit_wallets
  where user_id = v_user_id
  for update;

  if v_wallet.balance + v_delta < 0 then
    raise exception 'insufficient_ai_credits' using errcode = 'P0001';
  end if;

  v_new_balance := v_wallet.balance + v_delta;

  update public.booking_credit_wallets
  set balance = v_new_balance, updated_at = now()
  where user_id = v_user_id;

  insert into public.booking_credit_ledger
    (user_id, delta, balance_after, reason, action_type, token_metadata)
  values (
    v_user_id, v_delta, v_new_balance, 'route_build_consume', 'route_build',
    jsonb_build_object('stop_count', p_stop_count)
  );

  return jsonb_build_object('ok', true, 'balance', v_new_balance);
end;
$$;

revoke all on function public.consume_route_build_credit(int) from public;
grant execute on function public.consume_route_build_credit(int) to authenticated;
