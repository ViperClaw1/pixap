-- Restrict read access for story comments and reactions to authenticated users only.

drop policy if exists "story_comments_select_public" on public.story_comments;
drop policy if exists "story_comments_select_authenticated" on public.story_comments;
create policy "story_comments_select_authenticated"
on public.story_comments
for select
to authenticated
using (true);

drop policy if exists "story_reactions_select_public" on public.story_reactions;
drop policy if exists "story_reactions_select_authenticated" on public.story_reactions;
create policy "story_reactions_select_authenticated"
on public.story_reactions
for select
to authenticated
using (true);
