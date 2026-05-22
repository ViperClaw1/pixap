-- Remove localized type columns if an earlier revision of 20260531120000 was applied.

alter table public.business_cards
  drop column if exists type_ru,
  drop column if exists type_es,
  drop column if exists type_pt,
  drop column if exists type_fr,
  drop column if exists type_de;
