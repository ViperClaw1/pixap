-- Custom profile verification flag controlled by app callback flow.

alter table if exists public.profiles
  add column if not exists is_verified boolean not null default false;

update public.profiles
set is_verified = false
where is_verified is null;

create or replace view public.public_profiles as
select
  p.id,
  p.first_name,
  p.last_name,
  p.avatar_url,
  p.username,
  p.followers,
  p.bio,
  p.is_verified
from public.profiles p;

grant select on table public.public_profiles to anon, authenticated;

