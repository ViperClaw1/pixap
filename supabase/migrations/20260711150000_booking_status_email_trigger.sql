-- Extend booking status notifications with Resend email (async via pg_net).

create or replace function public.notify_booking_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  place_name text;
  venue_label text;
  notif_text text;
  display_status text;
begin
  if old.status is not distinct from new.status
     and old.payment_status is not distinct from new.payment_status then
    return new;
  end if;

  -- Guest cancelled their own booking from the app — no push/in-app row.
  if auth.uid() is not null
     and auth.uid() = new.user_id
     and old.status = 'upcoming'
     and new.status = 'expired' then
    return new;
  end if;

  -- WhatsApp venue rejection already notifies through cart_items.wa_status_lines.
  if old.status = 'upcoming'
     and new.status = 'expired'
     and exists (
       select 1
       from public.cart_items ci
       where ci.user_id = new.user_id
         and ci.business_card_id = new.business_card_id
         and ci.date_time = new.date_time
         and private.wa_status_indicates_rejection(ci.wa_status_lines)
       limit 1
     ) then
    return new;
  end if;

  select bc.name into place_name
  from public.business_cards bc
  where bc.id = new.business_card_id;

  venue_label := coalesce(place_name, 'Venue');

  if new.status = 'expired' then
    display_status := 'cancelled';
    notif_text := venue_label || ': Your booking was cancelled.';
  elsif old.payment_status = 'pending' and new.payment_status = 'paid' then
    display_status := 'confirmed';
    notif_text := venue_label || ': Your booking is confirmed.';
  elsif new.status = 'completed' then
    display_status := 'completed';
    notif_text := venue_label || ': Your booking is completed.';
  else
    display_status := new.status::text;
    notif_text := venue_label || ': Booking updated — status '
      || new.status::text || ', payment ' || new.payment_status::text;
  end if;

  insert into public.notifications (user_id, text, business_card_id)
  values (new.user_id, notif_text, new.business_card_id);

  insert into public.push_outbox (user_id, title, body, data)
  values (
    new.user_id,
    'Booking updated',
    notif_text,
    jsonb_build_object(
      'kind', 'booking_status',
      'booking_id', new.id,
      'business_card_id', new.business_card_id,
      'status', new.status,
      'payment_status', new.payment_status,
      'display_status', display_status
    )
  );

  perform private.invoke_send_booking_email(new.id, 'status_update');

  return new;
end;
$$;
