-- One boost per post per hour.

create or replace function public.boost_post(p_post_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_boosted_at timestamptz;
  v_last_boost timestamptz;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if not public.user_can_boost_posts(v_user_id) then
    raise exception 'post_boost_not_allowed' using errcode = 'P0001';
  end if;

  select p.boosted_at into v_last_boost
  from public.posts p
  where p.id = p_post_id
    and p.user_id = v_user_id;

  if v_last_boost is not null and v_last_boost > now() - interval '1 hour' then
    raise exception 'post_boost_cooldown' using errcode = 'P0001';
  end if;

  update public.posts
  set boosted_at = now()
  where id = p_post_id
    and user_id = v_user_id
  returning boosted_at into v_boosted_at;

  if v_boosted_at is null then
    raise exception 'post_not_found_or_not_owner' using errcode = 'P0001';
  end if;

  return v_boosted_at;
end;
$$;
