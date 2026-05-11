-- Align user_follows with public.profiles (same identity as public_profiles / messaging).
-- Previously FKs pointed at auth.users; inserts failed when following_id existed as a profile
-- used in the app but did not satisfy the auth.users edge (or DB used a different users mapping).
--
-- Add user_push_tokens for Expo/native push registration (see src/services/pushNotifications.ts).

-- Remove follow edges that cannot reference profiles (invalid data).
delete from public.user_follows uf
where not exists (select 1 from public.profiles p where p.id = uf.follower_id)
   or not exists (select 1 from public.profiles p where p.id = uf.following_id);

alter table public.user_follows drop constraint if exists user_follows_follower_id_fkey;
alter table public.user_follows drop constraint if exists user_follows_following_id_fkey;

alter table public.user_follows
  add constraint user_follows_follower_id_fkey
  foreign key (follower_id) references public.profiles (id) on delete cascade;

alter table public.user_follows
  add constraint user_follows_following_id_fkey
  foreign key (following_id) references public.profiles (id) on delete cascade;

-- Push notification device tokens (FCM/APNs via Expo).
create table if not exists public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  platform text not null,
  updated_at timestamptz not null default now(),
  constraint user_push_tokens_user_token_unique unique (user_id, token)
);

create index if not exists user_push_tokens_user_id_idx on public.user_push_tokens (user_id);

alter table public.user_push_tokens enable row level security;

drop policy if exists "user_push_tokens_select_own" on public.user_push_tokens;
create policy "user_push_tokens_select_own"
on public.user_push_tokens
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_push_tokens_insert_own" on public.user_push_tokens;
create policy "user_push_tokens_insert_own"
on public.user_push_tokens
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_push_tokens_update_own" on public.user_push_tokens;
create policy "user_push_tokens_update_own"
on public.user_push_tokens
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_push_tokens_delete_own" on public.user_push_tokens;
create policy "user_push_tokens_delete_own"
on public.user_push_tokens
for delete
to authenticated
using (auth.uid() = user_id);
