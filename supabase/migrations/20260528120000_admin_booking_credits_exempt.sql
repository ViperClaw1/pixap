-- Admins (profiles.account_role = admin) do not consume booking credits on insert.

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

  if exists (
    select 1
    from public.profiles p
    where p.id = new.user_id
      and p.account_role = 'admin'::public.profile_account_role
  ) then
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
