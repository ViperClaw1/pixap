-- Fix social push delivery: always enqueue for content owner, never the actor.
-- Hardening: shared helper, correct like-target priority, DB guard on push_outbox.

create or replace function private.enqueue_social_push(
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

  payload := coalesce(p_data, '{}'::jsonb)
    || jsonb_build_object('actor_id', p_actor_id::text, 'recipient_id', p_recipient_id::text);

  insert into public.push_outbox (user_id, title, body, data)
  values (p_recipient_id, p_title, p_body, payload);
end;
$$;

revoke all on function private.enqueue_social_push(uuid, uuid, text, text, jsonb) from public;
grant execute on function private.enqueue_social_push(uuid, uuid, text, text, jsonb) to postgres, service_role;

create or replace function public.push_outbox_block_actor_self()
returns trigger
language plpgsql
as $$
declare
  actor_id uuid;
  recipient_id uuid;
  kind text;
begin
  kind := coalesce(new.data ->> 'kind', '');
  if kind not in ('post_like', 'story_like', 'post_comment', 'story_comment', 'story_reply') then
    return new;
  end if;

  begin
    actor_id := nullif(new.data ->> 'actor_id', '')::uuid;
    recipient_id := nullif(new.data ->> 'recipient_id', '')::uuid;
  exception
    when invalid_text_representation then
      actor_id := null;
      recipient_id := null;
  end;

  if actor_id is not null and new.user_id is not distinct from actor_id then
    return null;
  end if;

  if recipient_id is not null and new.user_id is distinct from recipient_id then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists push_outbox_block_actor_self_trg on public.push_outbox;
create trigger push_outbox_block_actor_self_trg
before insert on public.push_outbox
for each row
execute function public.push_outbox_block_actor_self();

-- ---------------------------------------------------------------------------
-- Likes (post) — comment target before post target
-- ---------------------------------------------------------------------------
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

  perform private.enqueue_social_push(
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

-- ---------------------------------------------------------------------------
-- Likes (story) — reply > comment > story
-- ---------------------------------------------------------------------------
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

  perform private.enqueue_social_push(
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

-- ---------------------------------------------------------------------------
-- Post comments
-- ---------------------------------------------------------------------------
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

  perform private.enqueue_social_push(
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

-- ---------------------------------------------------------------------------
-- Story comments
-- ---------------------------------------------------------------------------
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

  perform private.enqueue_social_push(
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

-- ---------------------------------------------------------------------------
-- Story replies (story_replies table)
-- ---------------------------------------------------------------------------
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

  perform private.enqueue_social_push(
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
