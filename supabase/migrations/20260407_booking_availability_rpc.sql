-- Slot picker: return booking timestamps for a business in [p_start, p_end).
-- SECURITY DEFINER so RLS on public.bookings does not block availability reads.

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
    and b.date_time < p_end;
$$;

revoke all on function public.get_bookings_datetimes_for_availability(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_bookings_datetimes_for_availability(uuid, timestamptz, timestamptz) to authenticated;
