-- Allow guests (anon) to read posts feed entities.

drop policy if exists "posts_select_authenticated" on public.posts;
drop policy if exists "posts_select_public" on public.posts;
create policy "posts_select_public"
on public.posts
for select
to public
using (true);

drop policy if exists "post_comments_select_authenticated" on public.post_comments;
drop policy if exists "post_comments_select_public" on public.post_comments;
create policy "post_comments_select_public"
on public.post_comments
for select
to public
using (true);

drop policy if exists "post_reactions_select_authenticated" on public.post_reactions;
drop policy if exists "post_reactions_select_public" on public.post_reactions;
create policy "post_reactions_select_public"
on public.post_reactions
for select
to public
using (true);
