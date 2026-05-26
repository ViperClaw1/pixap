-- Allow message senders to edit their own message text.

drop policy if exists "messages_update_sender_participant" on public.messages;
create policy "messages_update_sender_participant"
on public.messages
for update
to authenticated
using (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.message_thread_participants mtp
    where mtp.thread_id = messages.thread_id
      and mtp.user_id = auth.uid()
  )
)
with check (
  sender_id = auth.uid()
  and char_length(trim(content)) > 0
  and exists (
    select 1
    from public.message_thread_participants mtp
    where mtp.thread_id = messages.thread_id
      and mtp.user_id = auth.uid()
  )
);
