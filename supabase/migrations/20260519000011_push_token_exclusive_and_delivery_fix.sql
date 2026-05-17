-- One Expo push token → one user (device). Fixes pushes arriving on the actor's phone when
-- multiple accounts registered the same ExponentPushToken on one device.
-- Also moves enqueue helper to public schema and hardens delivery metadata.

-- ---------------------------------------------------------------------------
-- Dedupe expo tokens (keep newest row per token) before unique index
-- ---------------------------------------------------------------------------
delete from public.user_push_tokens upt
where upt.id in (
  select u.id
  from public.user_push_tokens u
  inner join (
    select expo_push_token, max(updated_at) as max_updated
    from public.user_push_tokens
    where expo_push_token is not null
    group by expo_push_token
    having count(*) > 1
  ) d on d.expo_push_token = u.expo_push_token
  where u.updated_at < d.max_updated
);

create unique index if not exists user_push_tokens_expo_push_token_unique
  on public.user_push_tokens (expo_push_token)
  where expo_push_token is not null;

-- ---------------------------------------------------------------------------
-- Claim token for current user (removes same expo token from other users)
-- ---------------------------------------------------------------------------
create or replace function public.claim_expo_push_token(
  p_device_token text,
  p_platform text,
  p_expo_push_token text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_expo_push_token is null or btrim(p_expo_push_token) = '' then
    return;
  end if;
  if p_device_token is null or btrim(p_device_token) = '' then
    raise exception 'Device token required';
  end if;
  if p_platform is null or btrim(p_platform) = '' then
    raise exception 'Platform required';
  end if;

  delete from public.user_push_tokens
  where expo_push_token = p_expo_push_token
    and user_id <> uid;

  insert into public.user_push_tokens (user_id, token, platform, expo_push_token, updated_at)
  values (uid, p_device_token, p_platform, p_expo_push_token, now())
  on conflict (user_id, token) do update
  set
    platform = excluded.platform,
    expo_push_token = excluded.expo_push_token,
    updated_at = now();
end;
$$;

revoke all on function public.claim_expo_push_token(text, text, text) from public;
grant execute on function public.claim_expo_push_token(text, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Public enqueue helper (callable from trigger functions)
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_social_push(
  p_recipient_id uuid,
  p_actor_id uuid,
  p_title text,
  p_body text,
  p_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
begin
  if p_recipient_id is null or p_actor_id is null then
    return;
  end if;
  if p_recipient_id is not distinct from p_actor_id then
    return;
  end if;

  payload :=
    coalesce(p_data, '{}'::jsonb)
    || jsonb_build_object(
      'actor_id', p_actor_id::text,
      'recipient_id', p_recipient_id::text
    );

  insert into public.push_outbox (user_id, title, body, data)
  values (p_recipient_id, p_title, p_body, payload);
end;
$$;

revoke all on function public.enqueue_social_push(uuid, uuid, text, text, jsonb) from public;
grant execute on function public.enqueue_social_push(uuid, uuid, text, text, jsonb) to postgres, service_role;

drop function if exists private.enqueue_social_push(uuid, uuid, text, text, jsonb);

-- Re-point notify triggers to public.enqueue_social_push (same bodies as 20260519000010)
create or replace function public.notify_post_like_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  snippet text;
  actor_name text;
begin
  if new.type <> 'like'::public.post_reaction_type then
    return new;
  end if;

  if new.comment_id is not null then
    select c.user_id into owner_id from public.post_comments c where c.id = new.comment_id;
    snippet := 'liked your comment';
  elsif new.post_id is not null then
    select p.user_id into owner_id from public.posts p where p.id = new.post_id;
    snippet := 'liked your post';
  else
    return new;
  end if;

  if owner_id is null or owner_id is not distinct from new.user_id then
    return new;
  end if;

  select nullif(btrim(concat_ws(' ', pr.first_name, pr.last_name)), '')
  into actor_name
  from public.profiles pr
  where pr.id = new.user_id;

  perform public.enqueue_social_push(
    owner_id,
    new.user_id,
    coalesce(actor_name, 'New like'),
    snippet,
    jsonb_build_object(
      'kind', 'post_like',
      'reaction_id', new.id,
      'post_id', new.post_id,
      'comment_id', new.comment_id
    )
  );

  return new;
end;
$$;

create or replace function public.notify_story_like_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  snippet text;
  actor_name text;
begin
  if new.type <> 'like'::public.story_reaction_type then
    return new;
  end if;

  if new.reply_id is not null then
    select r.user_id into owner_id from public.story_replies r where r.id = new.reply_id;
    snippet := 'liked your reply';
  elsif new.comment_id is not null then
    select c.user_id into owner_id from public.story_comments c where c.id = new.comment_id;
    snippet := 'liked your comment';
  elsif new.story_id is not null then
    select s.user_id into owner_id from public.stories s where s.id = new.story_id;
    snippet := 'liked your story';
  else
    return new;
  end if;

  if owner_id is null or owner_id is not distinct from new.user_id then
    return new;
  end if;

  select nullif(btrim(concat_ws(' ', pr.first_name, pr.last_name)), '')
  into actor_name
  from public.profiles pr
  where pr.id = new.user_id;

  perform public.enqueue_social_push(
    owner_id,
    new.user_id,
    coalesce(actor_name, 'New like'),
    snippet,
    jsonb_build_object(
      'kind', 'story_like',
      'reaction_id', new.id,
      'story_id', new.story_id,
      'comment_id', new.comment_id,
      'reply_id', new.reply_id
    )
  );

  return new;
end;
$$;

create or replace function public.notify_post_comment_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_id uuid;
  preview text;
  snippet text;
  actor_name text;
begin
  preview := left(btrim(regexp_replace(new.content, '\s+', ' ', 'g')), 120);
  if preview is null or preview = '' then
    preview := 'New comment';
  end if;

  if new.parent_id is null then
    select p.user_id into recipient_id from public.posts p where p.id = new.post_id;
    snippet := 'commented on your post';
  else
    select c.user_id into recipient_id from public.post_comments c where c.id = new.parent_id;
    snippet := 'replied to your comment';
  end if;

  if recipient_id is null or recipient_id is not distinct from new.user_id then
    return new;
  end if;

  select nullif(btrim(concat_ws(' ', pr.first_name, pr.last_name)), '')
  into actor_name
  from public.profiles pr
  where pr.id = new.user_id;

  perform public.enqueue_social_push(
    recipient_id,
    new.user_id,
    coalesce(actor_name, 'New comment'),
    snippet || ': ' || preview,
    jsonb_build_object(
      'kind', 'post_comment',
      'post_id', new.post_id,
      'comment_id', new.id,
      'parent_id', new.parent_id
    )
  );

  return new;
end;
$$;

create or replace function public.notify_story_comment_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_id uuid;
  preview text;
  snippet text;
  actor_name text;
begin
  preview := left(btrim(regexp_replace(new.content, '\s+', ' ', 'g')), 120);
  if preview is null or preview = '' then
    preview := 'New comment';
  end if;

  if new.parent_id is null then
    select s.user_id into recipient_id from public.stories s where s.id = new.story_id;
    snippet := 'commented on your story';
  else
    select c.user_id into recipient_id from public.story_comments c where c.id = new.parent_id;
    snippet := 'replied to your comment';
  end if;

  if recipient_id is null or recipient_id is not distinct from new.user_id then
    return new;
  end if;

  select nullif(btrim(concat_ws(' ', pr.first_name, pr.last_name)), '')
  into actor_name
  from public.profiles pr
  where pr.id = new.user_id;

  perform public.enqueue_social_push(
    recipient_id,
    new.user_id,
    coalesce(actor_name, 'New comment'),
    snippet || ': ' || preview,
    jsonb_build_object(
      'kind', 'story_comment',
      'story_id', new.story_id,
      'comment_id', new.id,
      'parent_id', new.parent_id
    )
  );

  return new;
end;
$$;

create or replace function public.notify_story_reply_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_id uuid;
  preview text;
  actor_name text;
begin
  select c.user_id into recipient_id from public.story_comments c where c.id = new.comment_id;

  if recipient_id is null or recipient_id is not distinct from new.user_id then
    return new;
  end if;

  preview := left(btrim(regexp_replace(new.content, '\s+', ' ', 'g')), 120);
  if preview is null or preview = '' then
    preview := 'New reply';
  end if;

  select nullif(btrim(concat_ws(' ', pr.first_name, pr.last_name)), '')
  into actor_name
  from public.profiles pr
  where pr.id = new.user_id;

  perform public.enqueue_social_push(
    recipient_id,
    new.user_id,
    coalesce(actor_name, 'New reply'),
    'replied to your comment: ' || preview,
    jsonb_build_object(
      'kind', 'story_reply',
      'comment_id', new.comment_id,
      'reply_id', new.id
    )
  );

  return new;
end;
$$;
