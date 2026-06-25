alter table business_cards
  add column if not exists external_booking_platform text
    constraint chk_external_booking_platform
      check (external_booking_platform in ('resy', 'opentable', 'tock')),
  add column if not exists external_booking_url text,
  add column if not exists contact_email text;

comment on column business_cards.external_booking_platform is
  'Third-party booking platform (resy/opentable/tock). If set, voice/SMS booking flow is skipped and user is redirected to book directly.';
comment on column business_cards.external_booking_url is
  'Direct booking URL on the external platform (e.g. https://resy.com/cities/nyc/eleven-madison-park).';
comment on column business_cards.contact_email is
  'Venue contact email for email booking fallback. Used for US venues where SMS is blocked by carrier regulations.';
