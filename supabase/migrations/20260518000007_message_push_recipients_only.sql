-- Message push: only thread participants other than the sender (never notify the author).

create or replace function public.notify_message_recipients_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  preview text;
  sender_name text;
begin
  preview := left(btrim(regexp_replace(new.content, '\s+', ' ', 'g')), 160);
  if preview is null or preview = '' then
    preview := 'New message';
  end if;

  select nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), '')
  into sender_name
  from public.profiles p
  where p.id = new.sender_id;

  insert into public.push_outbox (user_id, title, body, data)
  select
    mtp.user_id,
    coalesce(sender_name, 'New message'),
    preview,
    jsonb_build_object(
      'kind', 'message',
      'thread_id', new.thread_id,
      'message_id', new.id,
      'sender_id', new.sender_id
    )
  from public.message_thread_participants mtp
  where mtp.thread_id = new.thread_id
    and mtp.user_id is distinct from new.sender_id;

  return new;
end;
$$;
