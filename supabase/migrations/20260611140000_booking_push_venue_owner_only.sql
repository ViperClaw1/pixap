-- Booking push/in-app notifications:
-- 1) bookings UPDATE: skip when the guest cancels their own upcoming booking.
-- 2) cart_items UPDATE: notify on venue WhatsApp responses (confirm / reject / payment link).

create or replace function private.wa_status_lines_text(p_lines jsonb)
returns text
language sql
immutable
as $$
  select lower(coalesce(
    (
      select string_agg(value, ' ')
      from jsonb_array_elements_text(coalesce(p_lines, '[]'::jsonb)) as t(value)
    ),
    ''
  ));
$$;

create or replace function private.wa_status_indicates_rejection(p_lines jsonb)
returns boolean
language sql
immutable
as $$
  select private.wa_status_lines_text(p_lines) ~ '(not available|unavailable|slot is not available|declin|недоступен|отклон|reject)';
$$;

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

  return new;
end;
$$;

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
    display_status := 'cancelled';
    notif_text := venue_label || ': Your booking was cancelled.';
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
    'Booking updated',
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

drop trigger if exists notify_cart_item_venue_booking_response_trg on public.cart_items;
create trigger notify_cart_item_venue_booking_response_trg
after update on public.cart_items
for each row
execute function public.notify_cart_item_venue_booking_response();
