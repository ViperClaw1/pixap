-- In-app notifications + push outbox for booking drafts/status, new messages, and likes.
-- Push rows are consumed by Edge Function `consume-push-outbox` (service role), which sends via Expo Push API
-- using `user_push_tokens.expo_push_token`. Schedule that function (e.g. every minute) in the Supabase dashboard
-- or call it manually after deploy.

do $ext$
begin
  create extension if not exists pg_net with schema extensions;
exception
  when others then
    raise notice 'pg_net extension skipped: %', sqlerrm;
end $ext$;

alter table public.user_push_tokens
  add column if not exists expo_push_token text;

create index if not exists user_push_tokens_expo_idx
  on public.user_push_tokens (user_id)
  where expo_push_token is not null;

create table if not exists public.push_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  delivered_at timestamptz null
);

create index if not exists push_outbox_pending_idx
  on public.push_outbox (created_at asc)
  where delivered_at is null;

alter table public.push_outbox enable row level security;

-- No policies: only service role / postgres can read/write (bypass RLS).

-- ---------------------------------------------------------------------------
-- Booking: new draft (pending payment) -> notification + push
-- ---------------------------------------------------------------------------
create or replace function public.notify_booking_insert_draft()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  place_name text;
begin
  if new.payment_status = 'pending' then
    select bc.name into place_name from public.business_cards bc where bc.id = new.business_card_id;
    insert into public.notifications (user_id, text, business_card_id)
    values (
      new.user_id,
      'New booking draft' || case when place_name is not null then ': ' || place_name else '' end,
      new.business_card_id
    );
    insert into public.push_outbox (user_id, title, body, data)
    values (
      new.user_id,
      'Booking',
      'You have a new booking draft' || case when place_name is not null then ' at ' || place_name else '' end,
      jsonb_build_object('kind', 'booking_draft', 'booking_id', new.id, 'business_card_id', new.business_card_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_booking_insert_draft_trg on public.bookings;
create trigger notify_booking_insert_draft_trg
after insert on public.bookings
for each row
execute function public.notify_booking_insert_draft();

-- ---------------------------------------------------------------------------
-- Booking: status or payment_status changed -> notification + push
-- ---------------------------------------------------------------------------
create or replace function public.notify_booking_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  place_name text;
  summary text;
begin
  if old.status is not distinct from new.status and old.payment_status is not distinct from new.payment_status then
    return new;
  end if;
  select bc.name into place_name from public.business_cards bc where bc.id = new.business_card_id;
  summary :=
    'Status: ' || new.status::text
    || ', payment: ' || new.payment_status::text
    || case when place_name is not null then ' · ' || place_name else '' end;
  insert into public.notifications (user_id, text, business_card_id)
  values (new.user_id, 'Booking updated — ' || summary, new.business_card_id);
  insert into public.push_outbox (user_id, title, body, data)
  values (
    new.user_id,
    'Booking updated',
    summary,
    jsonb_build_object(
      'kind',
      'booking_status',
      'booking_id',
      new.id,
      'business_card_id',
      new.business_card_id,
      'status',
      new.status,
      'payment_status',
      new.payment_status
    )
  );
  return new;
end;
$$;

drop trigger if exists notify_booking_status_change_trg on public.bookings;
create trigger notify_booking_status_change_trg
after update on public.bookings
for each row
execute function public.notify_booking_status_change();

-- ---------------------------------------------------------------------------
-- Messages: push to other thread participants (no in-app notifications row)
-- ---------------------------------------------------------------------------
create or replace function public.notify_message_recipients_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  preview text;
begin
  preview := left(btrim(regexp_replace(new.content, '\s+', ' ', 'g')), 160);
  if preview is null or preview = '' then
    preview := 'New message';
  end if;
  insert into public.push_outbox (user_id, title, body, data)
  select
    mtp.user_id,
    'New message',
    preview,
    jsonb_build_object('kind', 'message', 'thread_id', new.thread_id, 'message_id', new.id)
  from public.message_thread_participants mtp
  where mtp.thread_id = new.thread_id
    and mtp.user_id <> new.sender_id;
  return new;
end;
$$;

drop trigger if exists notify_message_recipients_push_trg on public.messages;
create trigger notify_message_recipients_push_trg
after insert on public.messages
for each row
execute function public.notify_message_recipients_push();

-- ---------------------------------------------------------------------------
-- Post / comment likes -> push to author (not liker)
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
begin
  if new.type <> 'like'::public.post_reaction_type then
    return new;
  end if;
  if new.post_id is not null then
    select p.user_id into owner_id from public.posts p where p.id = new.post_id;
    snippet := 'Someone liked your post';
  elsif new.comment_id is not null then
    select c.user_id into owner_id from public.post_comments c where c.id = new.comment_id;
    snippet := 'Someone liked your comment';
  else
    return new;
  end if;
  if owner_id is null or owner_id = new.user_id then
    return new;
  end if;
  insert into public.push_outbox (user_id, title, body, data)
  values (
    owner_id,
    'New like',
    snippet,
    jsonb_build_object('kind', 'post_like', 'reaction_id', new.id, 'actor_id', new.user_id)
  );
  return new;
end;
$$;

drop trigger if exists notify_post_like_push_trg on public.post_reactions;
create trigger notify_post_like_push_trg
after insert on public.post_reactions
for each row
execute function public.notify_post_like_push();

-- ---------------------------------------------------------------------------
-- Story / comment / reply likes -> push to author
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
begin
  if new.type <> 'like'::public.story_reaction_type then
    return new;
  end if;
  if new.story_id is not null then
    select s.user_id into owner_id from public.stories s where s.id = new.story_id;
    snippet := 'Someone liked your story';
  elsif new.comment_id is not null then
    select c.user_id into owner_id from public.story_comments c where c.id = new.comment_id;
    snippet := 'Someone liked your comment';
  elsif new.reply_id is not null then
    select r.user_id into owner_id from public.story_replies r where r.id = new.reply_id;
    snippet := 'Someone liked your reply';
  else
    return new;
  end if;
  if owner_id is null or owner_id = new.user_id then
    return new;
  end if;
  insert into public.push_outbox (user_id, title, body, data)
  values (
    owner_id,
    'New like',
    snippet,
    jsonb_build_object('kind', 'story_like', 'reaction_id', new.id, 'actor_id', new.user_id)
  );
  return new;
end;
$$;

drop trigger if exists notify_story_like_push_trg on public.story_reactions;
create trigger notify_story_like_push_trg
after insert on public.story_reactions
for each row
execute function public.notify_story_like_push();
