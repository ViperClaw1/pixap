-- Keep only admin profiles for bax.nick93@gmail.com and atif01.mail.ru.
-- public.public_profiles is a view over public.profiles; pruning the base table
-- removes all other rows from the public projection as well.

do $$
declare
  v_keeper_count integer;
begin
  select count(*)::integer
  into v_keeper_count
  from auth.users u
  where lower(trim(u.email)) in (
    'bax.nick93@gmail.com',
    'atif01.mail.ru'
  );

  if v_keeper_count <> 2 then
    raise exception
      'Expected exactly 2 keeper auth users (bax.nick93@gmail.com, atif01.mail.ru), found %',
      v_keeper_count;
  end if;
end $$;

with keepers as (
  select u.id
  from auth.users u
  where lower(trim(u.email)) in (
    'bax.nick93@gmail.com',
    'atif01.mail.ru'
  )
)
delete from public.profiles p
where not exists (
  select 1
  from keepers k
  where k.id = p.id
);
