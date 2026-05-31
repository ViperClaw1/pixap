-- Restore profiles rows for retained admin auth users after accidental wipe.
-- Resolves user ids by email from auth.users (no hard-coded UUIDs).

do $$
declare
  v_user_count integer;
begin
  select count(*)::integer
  into v_user_count
  from auth.users u
  where lower(trim(u.email)) in (
    'bax.nick93@gmail.com',
    'atif01.mail.ru'
  );

  if v_user_count <> 2 then
    raise exception
      'Expected exactly 2 auth users (bax.nick93@gmail.com, atif01.mail.ru), found %',
      v_user_count;
  end if;
end $$;

insert into public.profiles (
  id,
  email,
  first_name,
  last_name,
  username,
  account_role,
  is_verified,
  updated_at
)
select
  u.id,
  u.email,
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'first_name'), ''),
    nullif(trim(u.raw_user_meta_data->>'name'), ''),
    initcap(replace(split_part(u.email, '@', 1), '.', ' '))
  ) as first_name,
  coalesce(nullif(trim(u.raw_user_meta_data->>'last_name'), ''), '') as last_name,
  lower(
    regexp_replace(
      coalesce(nullif(split_part(u.email, '@', 1), ''), left(u.id::text, 8)),
      '[^a-zA-Z0-9_]+',
      '_',
      'g'
    )
  ) as username,
  'admin'::public.profile_account_role as account_role,
  (u.email_confirmed_at is not null) as is_verified,
  now() as updated_at
from auth.users u
where lower(trim(u.email)) in (
  'bax.nick93@gmail.com',
  'atif01.mail.ru'
)
on conflict (id) do update
set
  email = excluded.email,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  username = coalesce(profiles.username, excluded.username),
  account_role = 'admin'::public.profile_account_role,
  updated_at = now();
