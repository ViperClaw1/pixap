-- Profile account roles (user | admin) and per-user support chat threads.

do $$
begin
  create type public.profile_account_role as enum ('user', 'admin');
exception
  when duplicate_object then null;
end $$;

alter table if exists public.profiles
  add column if not exists account_role public.profile_account_role not null default 'user';

alter table if exists public.message_threads
  add column if not exists kind text not null default 'direct';

alter table if exists public.message_threads
  drop constraint if exists message_threads_kind_check;

alter table if exists public.message_threads
  add constraint message_threads_kind_check check (kind in ('direct', 'support'));

alter table if exists public.message_threads
  add column if not exists support_user_id uuid references public.profiles (id) on delete cascade;

create unique index if not exists message_threads_support_user_unique_idx
  on public.message_threads (support_user_id)
  where kind = 'support' and support_user_id is not null;

create or replace view public.public_profiles as
select
  p.id,
  p.first_name,
  p.last_name,
  p.avatar_url,
  p.username,
  p.followers,
  p.bio,
  p.is_verified,
  p.account_role
from public.profiles p;

grant select on table public.public_profiles to anon, authenticated;

create or replace view public.support_staff_profiles as
select
  p.id,
  p.first_name,
  p.last_name,
  p.avatar_url,
  p.username
from public.profiles p
where p.account_role = 'admin';

grant select on table public.support_staff_profiles to authenticated;
