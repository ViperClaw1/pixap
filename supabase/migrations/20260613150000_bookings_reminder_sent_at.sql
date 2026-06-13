-- Track 1-hour booking reminders (push + email).
alter table public.bookings
  add column if not exists reminder_sent_at timestamptz default null;

create index if not exists bookings_reminder_idx
  on public.bookings (date_time asc)
  where status = 'upcoming'
    and reminder_sent_at is null;
