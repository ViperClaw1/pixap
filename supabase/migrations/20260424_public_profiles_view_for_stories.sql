-- Public-safe profile projection for story authors.
-- Exposes only id + display identity fields required in stories UI.

create or replace view public.public_profiles as
select
  p.id,
  p.first_name,
  p.last_name,
  p.avatar_url
from public.profiles p;

grant select on table public.public_profiles to anon, authenticated;
