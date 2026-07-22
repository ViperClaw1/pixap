-- Notify all admin profiles (profiles.account_role = 'admin') by push + email
-- whenever a new booking is created — separate from the existing customer-facing
-- notify_booking_insert_draft trigger, which only notifies the booking's own user.
--
-- Push delivery reuses the existing push_outbox pipeline (push_outbox_invoke_consume_trg
-- already fires consume-push-outbox for every inserted row — no extra wiring needed).
-- Email reuses the existing private.invoke_send_booking_email() pg_net helper; the
-- 'admin_new_booking' kind is handled in supabase/functions/send-booking-email.

create or replace function public.notify_admins_new_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  place_name text;
  notif_text text;
  admin_row record;
begin
  select bc.name into place_name
  from public.business_cards bc
  where bc.id = new.business_card_id;

  notif_text := coalesce(place_name, 'A venue') || ' — new booking request for '
    || to_char(new.date_time, 'DD.MM.YYYY HH24:MI');

  for admin_row in
    select p.id
    from public.profiles p
    where p.account_role = 'admin'::public.profile_account_role
  loop
    insert into public.push_outbox (user_id, title, body, data)
    values (
      admin_row.id,
      'New booking',
      notif_text,
      jsonb_build_object(
        'kind', 'admin_new_booking',
        'booking_id', new.id,
        'business_card_id', new.business_card_id
      )
    );
  end loop;

  perform private.invoke_send_booking_email(new.id, 'admin_new_booking');

  return new;
end;
$$;

drop trigger if exists notify_admins_new_booking_trg on public.bookings;
create trigger notify_admins_new_booking_trg
after insert on public.bookings
for each row
execute function public.notify_admins_new_booking();
