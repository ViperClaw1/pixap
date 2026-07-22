-- Admin dashboard: the previous version only ever read `cart_items`, but a booking
-- created through the normal booking flow (`useCreateBooking`) lands in `bookings` —
-- `cart_items` only gets a row for the WA-outreach/service-cart path, and even then
-- there's no FK between them (BookingsPage links them client-side by business_card_id
-- + date_time, see linkCartItemForBooking.ts). That's why "Recent booking requests"
-- stayed empty even with fresh bookings visible on BookingsPage.
--
-- Source from `bookings` (same table BookingsPage reads) and enrich with the matching
-- cart_items row when one exists, using the same matching rule as linkCartItemForBooking:
-- same business_card_id + date_time, preferring an open ("created") cart row and the
-- one whose created_at is closest to the booking's.

drop function if exists public.admin_whatsapp_bookings_list(integer, integer);

create function public.admin_whatsapp_bookings_list(
  p_period_days integer default 30,
  p_limit integer default 50
)
returns table (
  id uuid,
  venue_name text,
  venue_address text,
  venue_phone text,
  venue_contact_whatsapp text,
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
    b.id, bc.name, bc.address, bc.phone, bc.contact_whatsapp,
    b.date_time, b.persons,
    b.customer_name, b.customer_phone,
    coalesce(ci.status::text, b.status::text),
    ci.wa_status_lines,
    coalesce(ci.wa_confirmable, false),
    ci.wa_confirmed_price,
    ci.wa_payment_link,
    ci.response_deadline_at,
    ci.response_timed_out_at,
    b.created_at
  from public.bookings b
  join public.business_cards bc on bc.id = b.business_card_id
  left join lateral (
    select ci2.*
    from public.cart_items ci2
    where ci2.business_card_id = b.business_card_id
      and ci2.date_time = b.date_time
    order by
      (ci2.status = 'created') desc,
      abs(extract(epoch from (ci2.created_at - b.created_at))) asc
    limit 1
  ) ci on true
  where b.created_at >= now() - make_interval(days => p_period_days)
  order by b.created_at desc
  limit p_limit;
end;
$$;

revoke all on function public.admin_whatsapp_bookings_list(integer, integer) from public;
grant execute on function public.admin_whatsapp_bookings_list(integer, integer) to authenticated;
