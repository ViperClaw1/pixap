-- Post feed boost: Premium Plus annual or profile admin can pin own posts to the top of discovery.

alter table public.posts
  add column if not exists boosted_at timestamptz;

create index if not exists posts_boosted_at_idx
  on public.posts (boosted_at desc nulls last)
  where boosted_at is not null;

create or replace function public.user_can_boost_posts(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.account_role = 'admin'::public.profile_account_role
  )
  or exists (
    select 1
    from public.subscription_entitlements se
    where se.user_id = p_user_id
      and se.status in ('active', 'trialing', 'grace_period', 'billing_retry')
      and se.product_id = 'pixai_premium_annual'
  );
$$;

create or replace function public.boost_post(p_post_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_boosted_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if not public.user_can_boost_posts(v_user_id) then
    raise exception 'post_boost_not_allowed' using errcode = 'P0001';
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

revoke all on function public.user_can_boost_posts(uuid) from public;
revoke all on function public.boost_post(uuid) from public;
grant execute on function public.boost_post(uuid) to authenticated;
