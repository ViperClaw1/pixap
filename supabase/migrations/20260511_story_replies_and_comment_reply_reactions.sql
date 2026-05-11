-- Story replies table (if missing) + likes on replies via story_reactions.reply_id

create table if not exists public.story_replies (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.story_comments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists story_replies_comment_id_created_at_idx
  on public.story_replies (comment_id, created_at asc);

alter table if exists public.story_replies enable row level security;

drop policy if exists "story_replies_select_public" on public.story_replies;
create policy "story_replies_select_public"
on public.story_replies
for select
to public
using (true);

drop policy if exists "story_replies_insert_own" on public.story_replies;
create policy "story_replies_insert_own"
on public.story_replies
for insert
to authenticated
with check (auth.uid() = user_id);

alter table public.story_reactions
  add column if not exists reply_id uuid references public.story_replies (id) on delete cascade;

alter table public.story_reactions drop constraint if exists story_reactions_exactly_one_target;

alter table public.story_reactions add constraint story_reactions_exactly_one_target check (
  (case when story_id is not null then 1 else 0 end)
  + (case when comment_id is not null then 1 else 0 end)
  + (case when reply_id is not null then 1 else 0 end)
  = 1
);

create unique index if not exists story_reactions_unique_user_reply_target
  on public.story_reactions (user_id, reply_id)
  where reply_id is not null;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      where p.pubname = 'supabase_realtime'
        and n.nspname = 'public'
        and c.relname = 'story_replies'
    ) then
      alter publication supabase_realtime add table public.story_replies;
    end if;
  end if;
end $$;
