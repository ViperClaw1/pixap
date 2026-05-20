-- Global last-seen for messaging presence (updated by clients while app is active).

alter table if exists public.profiles
  add column if not exists last_seen_at timestamptz;

create index if not exists profiles_last_seen_at_idx
  on public.profiles (last_seen_at desc nulls last);

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
  p.account_role,
  p.last_seen_at
from public.profiles p;

grant select on table public.public_profiles to anon, authenticated;
