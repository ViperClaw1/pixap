alter table public.business_cards
  add column if not exists preferred_booking_channel text null
  constraint business_cards_preferred_booking_channel_check
    check (preferred_booking_channel in ('whatsapp', 'voice', 'sms') or preferred_booking_channel is null);

comment on column public.business_cards.preferred_booking_channel is
  'Manual override for booking channel. null = auto-detect from owner_phone country code via bookingChannelFromOwnerPhone().';
