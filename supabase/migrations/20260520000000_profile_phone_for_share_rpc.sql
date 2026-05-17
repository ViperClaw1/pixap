-- Allow authenticated users to read a peer's phone for in-app share → WhatsApp (profiles RLS is own-row only).

create or replace function public.get_profile_phone_for_share(p_user_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select nullif(trim(p.phone), '')
  from public.profiles p
  where p.id = p_user_id;
$$;

revoke all on function public.get_profile_phone_for_share(uuid) from public;
grant execute on function public.get_profile_phone_for_share(uuid) to authenticated;

comment on function public.get_profile_phone_for_share(uuid) is
  'Returns profiles.phone for WhatsApp/deep-link share; callable by any signed-in user.';
