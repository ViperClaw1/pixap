alter table public.business_cards
  add column if not exists blurhashes text[] not null default '{}';

comment on column public.business_cards.blurhashes is
  'BlurHash strings in the same order as images[]. Used as loading placeholder.';
