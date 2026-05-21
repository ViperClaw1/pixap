-- P2: business-cards + logo buckets, long-lived CDN cache metadata for static assets.

insert into storage.buckets (id, name, public)
values
  ('business-cards', 'business-cards', true),
  ('logo', 'logo', true)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

-- business-cards: public read; uploads under auth uid prefix (mobile admin / partners).
drop policy if exists "business_cards_public_read" on storage.objects;
create policy "business_cards_public_read"
on storage.objects
for select
to public
using (bucket_id = 'business-cards');

drop policy if exists "business_cards_insert_own_folder" on storage.objects;
create policy "business_cards_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-cards'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "business_cards_update_own_folder" on storage.objects;
create policy "business_cards_update_own_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'business-cards'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'business-cards'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "business_cards_delete_own_folder" on storage.objects;
create policy "business_cards_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'business-cards'
  and split_part(name, '/', 1) = auth.uid()::text
);

-- logo: public read only (upload via service role / dashboard).
drop policy if exists "logo_public_read" on storage.objects;
create policy "logo_public_read"
on storage.objects
for select
to public
using (bucket_id = 'logo');

-- Best-effort cache headers for existing auth email logo (new uploads set cacheControl in app).
update storage.objects
set metadata = coalesce(metadata, '{}'::jsonb) || '{"cacheControl": "public, max-age=31536000, immutable"}'::jsonb
where bucket_id = 'logo'
  and name = 'icon.png';
