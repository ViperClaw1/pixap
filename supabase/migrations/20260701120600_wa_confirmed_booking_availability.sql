-- Availability should block only venue-confirmed WhatsApp bookings, regardless of payment status.

create or replace function public.get_bookings_datetimes_for_availability(
  p_business_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns timestamptz[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(b.date_time order by b.date_time), '{}')
  from public.bookings b
  where b.business_card_id = p_business_id
    and b.date_time >= p_start
    and b.date_time < p_end
    and b.status <> 'expired'
    and exists (
      select 1
      from public.cart_items ci
      where ci.business_card_id = b.business_card_id
        and ci.date_time = b.date_time
        and ci.wa_confirmable = true
      limit 1
    );
$$;
