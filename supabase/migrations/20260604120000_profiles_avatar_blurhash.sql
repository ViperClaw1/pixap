-- BlurHash placeholder for profile avatars (parallel to avatar_url).
-- New view columns must be appended: CREATE OR REPLACE cannot insert columns mid-list (42P16).

alter table if exists public.profiles
  add column if not exists avatar_blurhash text;

comment on column public.profiles.avatar_blurhash is
  'BlurHash string for avatar_url; used as SmartImage placeholder while loading.';

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
  p.last_seen_at,
  p.avatar_blurhash
from public.profiles p;

grant select on table public.public_profiles to anon, authenticated;

create or replace view public.support_staff_profiles as
select
  p.id,
  p.first_name,
  p.last_name,
  p.avatar_url,
  p.username,
  p.avatar_blurhash
from public.profiles p
where p.account_role = 'admin';

grant select on table public.support_staff_profiles to authenticated;
