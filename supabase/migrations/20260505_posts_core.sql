-- Posts domain (posts, post_comments, post_reactions) mirroring stories structure.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'post_reaction_type'
      and n.nspname = 'public'
  ) then
    create type public.post_reaction_type as enum ('like', 'dislike', 'sticker');
  end if;
end $$;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id uuid not null references public.business_cards (id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  media_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now(),
  constraint post_comments_parent_not_self check (parent_id is null or parent_id <> id),
  constraint post_comments_id_post_unique unique (id, post_id),
  constraint post_comments_parent_fk
    foreign key (parent_id, post_id)
    references public.post_comments (id, post_id)
    on delete cascade
);

create table if not exists public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.post_comments (id) on delete cascade,
  type public.post_reaction_type not null,
  sticker_id text references public.stickers (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint post_reactions_exactly_one_target
    check ((post_id is not null) <> (comment_id is not null)),
  constraint post_reactions_sticker_check
    check (
      (type = 'sticker' and sticker_id is not null)
      or (type <> 'sticker' and sticker_id is null)
    )
);

create index if not exists posts_place_id_created_at_idx on public.posts (place_id, created_at desc);
create index if not exists post_comments_post_id_created_at_idx on public.post_comments (post_id, created_at asc);
create index if not exists post_comments_parent_id_created_at_idx on public.post_comments (parent_id, created_at asc) where parent_id is not null;
create index if not exists post_reactions_post_id_idx on public.post_reactions (post_id) where post_id is not null;
create index if not exists post_reactions_comment_id_idx on public.post_reactions (comment_id) where comment_id is not null;

create unique index if not exists post_reactions_unique_user_post_target
  on public.post_reactions (user_id, post_id)
  where post_id is not null;

create unique index if not exists post_reactions_unique_user_comment_target
  on public.post_reactions (user_id, comment_id)
  where comment_id is not null;

alter table if exists public.posts enable row level security;
alter table if exists public.post_comments enable row level security;
alter table if exists public.post_reactions enable row level security;

drop policy if exists "posts_select_authenticated" on public.posts;
create policy "posts_select_authenticated"
on public.posts
for select
to authenticated
using (true);

drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own"
on public.posts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own"
on public.posts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own"
on public.posts
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "post_comments_select_authenticated" on public.post_comments;
create policy "post_comments_select_authenticated"
on public.post_comments
for select
to authenticated
using (true);

drop policy if exists "post_comments_insert_own" on public.post_comments;
create policy "post_comments_insert_own"
on public.post_comments
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "post_comments_update_own" on public.post_comments;
create policy "post_comments_update_own"
on public.post_comments
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "post_comments_delete_own" on public.post_comments;
create policy "post_comments_delete_own"
on public.post_comments
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "post_reactions_select_authenticated" on public.post_reactions;
create policy "post_reactions_select_authenticated"
on public.post_reactions
for select
to authenticated
using (true);

drop policy if exists "post_reactions_insert_own" on public.post_reactions;
create policy "post_reactions_insert_own"
on public.post_reactions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "post_reactions_delete_own" on public.post_reactions;
create policy "post_reactions_delete_own"
on public.post_reactions
for delete
to authenticated
using (auth.uid() = user_id);

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
        and c.relname = 'posts'
    ) then
      alter publication supabase_realtime add table public.posts;
    end if;

    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      where p.pubname = 'supabase_realtime'
        and n.nspname = 'public'
        and c.relname = 'post_comments'
    ) then
      alter publication supabase_realtime add table public.post_comments;
    end if;

    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      where p.pubname = 'supabase_realtime'
        and n.nspname = 'public'
        and c.relname = 'post_reactions'
    ) then
      alter publication supabase_realtime add table public.post_reactions;
    end if;
  end if;
end $$;
