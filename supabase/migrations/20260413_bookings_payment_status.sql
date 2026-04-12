-- Paid vs pending on bookings; list UI filters paid only and tabs use date_time vs now.

alter table public.bookings
  add column if not exists payment_status text not null default 'pending';

alter table public.bookings
  drop constraint if exists bookings_payment_status_check;

alter table public.bookings
  add constraint bookings_payment_status_check
  check (payment_status in ('pending', 'paid'));

update public.bookings set payment_status = 'paid';

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
    and b.payment_status = 'paid';
$$;
