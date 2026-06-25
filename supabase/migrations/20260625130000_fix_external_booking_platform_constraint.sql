-- Relax the check to explicitly allow NULL so updating other columns on a row
-- where external_booking_platform is not yet set doesn't fail.
alter table business_cards
  drop constraint if exists chk_external_booking_platform;

alter table business_cards
  add constraint chk_external_booking_platform
    check (external_booking_platform is null or external_booking_platform in ('resy', 'opentable', 'tock'));
