-- Booking: no in-app notification or push on new draft insert; only on status/payment_status update.

drop trigger if exists notify_booking_insert_draft_trg on public.bookings;
drop function if exists public.notify_booking_insert_draft();
