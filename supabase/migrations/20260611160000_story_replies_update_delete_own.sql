-- Allow owners to edit and delete their story replies (parity with story_comments).

drop policy if exists "story_replies_update_own" on public.story_replies;
create policy "story_replies_update_own"
on public.story_replies
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "story_replies_delete_own" on public.story_replies;
create policy "story_replies_delete_own"
on public.story_replies
for delete
to authenticated
using (auth.uid() = user_id);
