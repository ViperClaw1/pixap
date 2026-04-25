-- Dedicated public bucket and object policies for story media uploads.

insert into storage.buckets (id, name, public)
values ('stories', 'stories', true)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

drop policy if exists "stories_public_read" on storage.objects;
create policy "stories_public_read"
on storage.objects
for select
to public
using (bucket_id = 'stories');

drop policy if exists "stories_insert_own_folder" on storage.objects;
create policy "stories_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'stories'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "stories_update_own_folder" on storage.objects;
create policy "stories_update_own_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'stories'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'stories'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "stories_delete_own_folder" on storage.objects;
create policy "stories_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'stories'
  and split_part(name, '/', 1) = auth.uid()::text
);
