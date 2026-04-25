-- Minimal social graph for stories feed.

create table if not exists public.user_follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_follows_no_self check (follower_id <> following_id),
  constraint user_follows_pk primary key (follower_id, following_id)
);

create index if not exists user_follows_following_created_at_idx
  on public.user_follows (following_id, created_at desc);

create index if not exists user_follows_follower_created_at_idx
  on public.user_follows (follower_id, created_at desc);

alter table if exists public.user_follows enable row level security;

drop policy if exists "user_follows_select_authenticated" on public.user_follows;
create policy "user_follows_select_authenticated"
on public.user_follows
for select
to authenticated
using (true);

drop policy if exists "user_follows_insert_own" on public.user_follows;
create policy "user_follows_insert_own"
on public.user_follows
for insert
to authenticated
with check (auth.uid() = follower_id);

drop policy if exists "user_follows_delete_own" on public.user_follows;
create policy "user_follows_delete_own"
on public.user_follows
for delete
to authenticated
using (auth.uid() = follower_id);
