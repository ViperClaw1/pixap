-- Add profile bio and expose it in public profile projection.

alter table if exists public.profiles
  add column if not exists bio text;

create or replace view public.public_profiles as
select
  p.id,
  p.first_name,
  p.last_name,
  p.avatar_url,
  p.username,
  p.followers,
  p.bio
from public.profiles p;

grant select on table public.public_profiles to anon, authenticated;
