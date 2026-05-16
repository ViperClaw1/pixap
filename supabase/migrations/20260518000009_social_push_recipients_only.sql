-- Social push: only content author (post/story/comment), never the actor who liked/commented.

-- ---------------------------------------------------------------------------
-- Likes (post / comment)
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
  if new.post_id is not null then
    select p.user_id into owner_id from public.posts p where p.id = new.post_id;
    snippet := 'liked your post';
  elsif new.comment_id is not null then
    select c.user_id into owner_id from public.post_comments c where c.id = new.comment_id;
    snippet := 'liked your comment';
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

  insert into public.push_outbox (user_id, title, body, data)
  values (
    owner_id,
    coalesce(actor_name, 'New like'),
    snippet,
    jsonb_build_object(
      'kind', 'post_like',
      'reaction_id', new.id,
      'actor_id', new.user_id,
      'post_id', new.post_id,
      'comment_id', new.comment_id
    )
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Likes (story / comment / reply)
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
  if new.story_id is not null then
    select s.user_id into owner_id from public.stories s where s.id = new.story_id;
    snippet := 'liked your story';
  elsif new.comment_id is not null then
    select c.user_id into owner_id from public.story_comments c where c.id = new.comment_id;
    snippet := 'liked your comment';
  elsif new.reply_id is not null then
    select r.user_id into owner_id from public.story_replies r where r.id = new.reply_id;
    snippet := 'liked your reply';
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

  insert into public.push_outbox (user_id, title, body, data)
  values (
    owner_id,
    coalesce(actor_name, 'New like'),
    snippet,
    jsonb_build_object(
      'kind', 'story_like',
      'reaction_id', new.id,
      'actor_id', new.user_id,
      'story_id', new.story_id,
      'comment_id', new.comment_id,
      'reply_id', new.reply_id
    )
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Post comments (top-level -> post author; reply -> parent comment author)
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

  insert into public.push_outbox (user_id, title, body, data)
  values (
    recipient_id,
    coalesce(actor_name, 'New comment'),
    snippet || ': ' || preview,
    jsonb_build_object(
      'kind', 'post_comment',
      'post_id', new.post_id,
      'comment_id', new.id,
      'parent_id', new.parent_id,
      'actor_id', new.user_id
    )
  );
  return new;
end;
$$;

drop trigger if exists notify_post_comment_push_trg on public.post_comments;
create trigger notify_post_comment_push_trg
after insert on public.post_comments
for each row
execute function public.notify_post_comment_push();

-- ---------------------------------------------------------------------------
-- Story comments (top-level -> story author; reply -> parent comment author)
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

  insert into public.push_outbox (user_id, title, body, data)
  values (
    recipient_id,
    coalesce(actor_name, 'New comment'),
    snippet || ': ' || preview,
    jsonb_build_object(
      'kind', 'story_comment',
      'story_id', new.story_id,
      'comment_id', new.id,
      'parent_id', new.parent_id,
      'actor_id', new.user_id
    )
  );
  return new;
end;
$$;

drop trigger if exists notify_story_comment_push_trg on public.story_comments;
create trigger notify_story_comment_push_trg
after insert on public.story_comments
for each row
execute function public.notify_story_comment_push();

-- ---------------------------------------------------------------------------
-- Story replies (story_replies -> parent comment author)
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

  insert into public.push_outbox (user_id, title, body, data)
  values (
    recipient_id,
    coalesce(actor_name, 'New reply'),
    'replied to your comment: ' || preview,
    jsonb_build_object(
      'kind', 'story_reply',
      'comment_id', new.comment_id,
      'reply_id', new.id,
      'actor_id', new.user_id
    )
  );
  return new;
end;
$$;

drop trigger if exists notify_story_reply_push_trg on public.story_replies;
create trigger notify_story_reply_push_trg
after insert on public.story_replies
for each row
execute function public.notify_story_reply_push();
