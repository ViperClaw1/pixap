-- Allow authenticated clients to insert community catalogue rows when publishing a feed post from a Google address.

alter table public.business_cards enable row level security;

drop policy if exists "business_cards_select_public" on public.business_cards;

create policy "business_cards_select_public"
  on public.business_cards for select to authenticated, anon
  using (true);

drop policy if exists "business_cards_insert_authenticated" on public.business_cards;

create policy "business_cards_insert_authenticated"
  on public.business_cards for insert to authenticated
  with check (true);
