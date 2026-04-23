-- User Stories backend schema, RLS, and realtime support.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'story_reaction_type'
      and n.nspname = 'public'
  ) then
    create type public.story_reaction_type as enum ('like', 'dislike', 'sticker');
  end if;
end $$;

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id uuid not null references public.business_cards (id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  media_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.story_comments (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now(),
  constraint story_comments_parent_not_self check (parent_id is null or parent_id <> id),
  constraint story_comments_id_story_unique unique (id, story_id),
  constraint story_comments_parent_fk
    foreign key (parent_id, story_id)
    references public.story_comments (id, story_id)
    on delete cascade
);

create table if not exists public.stickers (
  id text primary key,
  name text not null,
  icon_url text not null
);

create table if not exists public.story_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  story_id uuid references public.stories (id) on delete cascade,
  comment_id uuid references public.story_comments (id) on delete cascade,
  type public.story_reaction_type not null,
  sticker_id text references public.stickers (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint story_reactions_exactly_one_target
    check ((story_id is not null) <> (comment_id is not null)),
  constraint story_reactions_sticker_check
    check (
      (type = 'sticker' and sticker_id is not null)
      or (type <> 'sticker' and sticker_id is null)
    )
);

create index if not exists stories_place_id_created_at_idx
  on public.stories (place_id, created_at desc);

create index if not exists story_comments_story_id_created_at_idx
  on public.story_comments (story_id, created_at asc);

create index if not exists story_comments_parent_id_created_at_idx
  on public.story_comments (parent_id, created_at asc)
  where parent_id is not null;

create index if not exists story_reactions_story_id_idx
  on public.story_reactions (story_id)
  where story_id is not null;

create index if not exists story_reactions_comment_id_idx
  on public.story_reactions (comment_id)
  where comment_id is not null;

create unique index if not exists story_reactions_unique_user_story_target
  on public.story_reactions (user_id, story_id)
  where story_id is not null;

create unique index if not exists story_reactions_unique_user_comment_target
  on public.story_reactions (user_id, comment_id)
  where comment_id is not null;

alter table if exists public.stories enable row level security;
alter table if exists public.story_comments enable row level security;
alter table if exists public.story_reactions enable row level security;
alter table if exists public.stickers enable row level security;

drop policy if exists "stories_select_public" on public.stories;
create policy "stories_select_public"
on public.stories
for select
to public
using (true);

drop policy if exists "stories_insert_own" on public.stories;
create policy "stories_insert_own"
on public.stories
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "stories_update_own" on public.stories;
create policy "stories_update_own"
on public.stories
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "stories_delete_own" on public.stories;
create policy "stories_delete_own"
on public.stories
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "story_comments_select_public" on public.story_comments;
create policy "story_comments_select_public"
on public.story_comments
for select
to public
using (true);

drop policy if exists "story_comments_insert_own" on public.story_comments;
create policy "story_comments_insert_own"
on public.story_comments
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "story_comments_update_own" on public.story_comments;
create policy "story_comments_update_own"
on public.story_comments
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "story_comments_delete_own" on public.story_comments;
create policy "story_comments_delete_own"
on public.story_comments
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "story_reactions_select_public" on public.story_reactions;
create policy "story_reactions_select_public"
on public.story_reactions
for select
to public
using (true);

drop policy if exists "story_reactions_insert_own" on public.story_reactions;
create policy "story_reactions_insert_own"
on public.story_reactions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "story_reactions_delete_own" on public.story_reactions;
create policy "story_reactions_delete_own"
on public.story_reactions
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "stickers_select_public" on public.stickers;
create policy "stickers_select_public"
on public.stickers
for select
to public
using (true);

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      where p.pubname = 'supabase_realtime'
        and n.nspname = 'public'
        and c.relname = 'stories'
    ) then
      alter publication supabase_realtime add table public.stories;
    end if;

    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      where p.pubname = 'supabase_realtime'
        and n.nspname = 'public'
        and c.relname = 'story_comments'
    ) then
      alter publication supabase_realtime add table public.story_comments;
    end if;

    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      where p.pubname = 'supabase_realtime'
        and n.nspname = 'public'
        and c.relname = 'story_reactions'
    ) then
      alter publication supabase_realtime add table public.story_reactions;
    end if;
  end if;
end $$;
