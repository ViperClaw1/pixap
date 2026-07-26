-- Admin dashboard: manual "Approve" action on a "Recent booking requests" card.
-- Lets an admin confirm a booking by hand (e.g. venue confirmed by phone instead of WA)
-- without waiting on the n8n WhatsApp callback.
--
-- Reuses the existing confirmation signal (`cart_items.wa_confirmable = true`, see
-- 20260701120600_wa_confirmed_booking_availability.sql) so the booking shows as
-- "confirmed" on the user's BookingsPage (deriveBookingDisplayStatus) and blocks the
-- slot from availability, exactly like a venue-confirmed WA reply would.
-- Notification is sent via the existing triggers:
--   - notify_cart_item_venue_booking_response (cart_items.wa_confirmable false->true)
--   - notify_booking_status_change (bookings.status/payment_status change, used as a
--     fallback when there's no linked cart_items row for this booking)

create or replace function public.admin_confirm_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_cart_item_id uuid;
begin
  perform public.assert_admin_analytics_access();

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  select ci.id into v_cart_item_id
  from public.cart_items ci
  where ci.business_card_id = v_booking.business_card_id
    and ci.date_time = v_booking.date_time
    and ci.status = 'created'
  order by abs(extract(epoch from (ci.created_at - v_booking.created_at))) asc
  limit 1;

  update public.bookings
  set status = case when status = 'expired' then 'upcoming' else status end,
      payment_status = case when v_cart_item_id is null then 'paid' else payment_status end
  where id = p_booking_id;

  if v_cart_item_id is not null then
    update public.cart_items
    set wa_confirmable = true,
        wa_payment_link = null
    where id = v_cart_item_id;
  end if;
end;
$$;

revoke all on function public.admin_confirm_booking(uuid) from public;
grant execute on function public.admin_confirm_booking(uuid) to authenticated;
