-- Clearer push/in-app copy when a venue declines a booking slot via WhatsApp.

create or replace function public.notify_cart_item_venue_booking_response()
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
  has_payment_link boolean;
  became_confirmable boolean;
  became_rejected boolean;
begin
  if new.status <> 'created' then
    return new;
  end if;

  if old.wa_confirmable is not distinct from new.wa_confirmable
     and old.wa_status_lines is not distinct from new.wa_status_lines
     and old.wa_payment_link is not distinct from new.wa_payment_link then
    return new;
  end if;

  -- Direct edits by the guest should not enqueue venue-response pushes.
  if auth.uid() is not null and auth.uid() = new.user_id then
    return new;
  end if;

  became_rejected :=
    private.wa_status_indicates_rejection(new.wa_status_lines)
    and not private.wa_status_indicates_rejection(old.wa_status_lines);

  became_confirmable := new.wa_confirmable = true and coalesce(old.wa_confirmable, false) = false;

  has_payment_link :=
    coalesce(length(btrim(coalesce(new.wa_payment_link, ''))), 0) > 0
    and coalesce(length(btrim(coalesce(old.wa_payment_link, ''))), 0) = 0;

  if not became_rejected and not became_confirmable and not has_payment_link then
    return new;
  end if;

  select bc.name into place_name
  from public.business_cards bc
  where bc.id = new.business_card_id;

  venue_label := coalesce(place_name, 'Venue');

  if became_rejected then
    display_status := 'venue_declined';
    notif_text :=
      venue_label
      || ': The venue could not confirm your booking — this time slot is not available. Please choose another date or time.';
  elsif has_payment_link then
    display_status := 'payment awaiting';
    notif_text := venue_label || ': Your booking awaits payment.';
  elsif became_confirmable then
    display_status := 'confirmed';
    notif_text := venue_label || ': Your booking is confirmed.';
  end if;

  insert into public.notifications (user_id, text, business_card_id)
  values (new.user_id, notif_text, new.business_card_id);

  insert into public.push_outbox (user_id, title, body, data)
  values (
    new.user_id,
    'Booking update',
    notif_text,
    jsonb_build_object(
      'kind', 'booking_status',
      'cart_item_id', new.id,
      'business_card_id', new.business_card_id,
      'display_status', display_status
    )
  );

  return new;
end;
$$;
