-- Admins were exempt from consume_ai_query_credit (balance sentinel -1, charged 0).
-- That prevented wallet deductions and left the credits badge unchanged during Pix AI testing.
-- Route-build credits keep the admin exemption; AI concierge turns bill everyone.

create or replace function public.consume_ai_query_credit(
  p_user_id uuid,
  p_delta numeric,
  p_input_tokens int default null,
  p_output_tokens int default null,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.booking_credit_wallets;
  v_new_balance numeric;
  v_existing_delta numeric;
begin
  if p_delta > 0 then
    raise exception 'invalid_delta' using errcode = 'P0001';
  end if;

  if p_request_id is null then
    raise exception 'missing_request_id' using errcode = 'P0001';
  end if;

  perform public.ensure_booking_credit_wallet(p_user_id);
  perform public.expire_intro_credits_if_needed(p_user_id);

  select * into v_wallet
  from public.booking_credit_wallets
  where user_id = p_user_id
  for update;

  select delta into v_existing_delta
  from public.booking_credit_ledger
  where user_id = p_user_id and request_id = p_request_id;

  if found then
    return jsonb_build_object(
      'ok', true,
      'balance', v_wallet.balance,
      'charged', abs(v_existing_delta),
      'deduplicated', true
    );
  end if;

  if v_wallet.balance + p_delta < 0 then
    raise exception 'insufficient_ai_credits' using errcode = 'P0001';
  end if;

  v_new_balance := v_wallet.balance + p_delta;

  update public.booking_credit_wallets
  set balance = v_new_balance, updated_at = now()
  where user_id = p_user_id;

  insert into public.booking_credit_ledger
    (user_id, delta, balance_after, reason, action_type, token_metadata, request_id)
  values (
    p_user_id,
    p_delta,
    v_new_balance,
    'ai_query_consume',
    'ai_chat_turn',
    jsonb_build_object('input_tokens', p_input_tokens, 'output_tokens', p_output_tokens),
    p_request_id
  );

  return jsonb_build_object(
    'ok', true,
    'balance', v_new_balance,
    'charged', abs(p_delta),
    'deduplicated', false
  );
end;
$$;
