-- Rows created by payment webhooks must be paid. Inserts that omit payment_status were
-- defaulting to pending (20260413). Draft bookings still set payment_status explicitly to pending.

alter table public.bookings alter column payment_status set default 'paid';
