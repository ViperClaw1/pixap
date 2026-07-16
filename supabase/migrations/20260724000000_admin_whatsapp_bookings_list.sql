-- Admin dashboard: per-booking WhatsApp list (staff only, reuses assert_admin_analytics_access).

create or replace function public.admin_whatsapp_bookings_list(
  p_period_days integer default 30,
  p_limit integer default 50
)
returns table (
  id uuid,
  venue_name text,
  venue_address text,
  date_time timestamptz,
  persons integer,
  customer_name text,
  customer_phone text,
  status text,
  wa_status_lines jsonb,
  wa_confirmable boolean,
  wa_confirmed_price text,
  wa_payment_link text,
  response_deadline_at timestamptz,
  response_timed_out_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_analytics_access();

  return query
  select
    ci.id, bc.name, bc.address, ci.date_time, ci.persons,
    ci.customer_name, ci.customer_phone, ci.status,
    ci.wa_status_lines, ci.wa_confirmable, ci.wa_confirmed_price, ci.wa_payment_link,
    ci.response_deadline_at, ci.response_timed_out_at, ci.created_at
  from public.cart_items ci
  join public.business_cards bc on bc.id = ci.business_card_id
  where ci.created_at >= now() - make_interval(days => p_period_days)
    and ci.wa_n8n_started_at is not null
  order by ci.created_at desc
  limit p_limit;
end;
$$;

revoke all on function public.admin_whatsapp_bookings_list(integer, integer) from public;
grant execute on function public.admin_whatsapp_bookings_list(integer, integer) to authenticated;
