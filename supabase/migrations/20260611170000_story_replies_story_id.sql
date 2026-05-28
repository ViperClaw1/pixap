-- Denormalize story_id on story_replies for Realtime row-level filtering.

alter table public.story_replies
  add column if not exists story_id uuid references public.stories (id) on delete cascade;

update public.story_replies sr
set story_id = sc.story_id
from public.story_comments sc
where sc.id = sr.comment_id
  and sr.story_id is null;

alter table public.story_replies
  alter column story_id set not null;

create index if not exists story_replies_story_id_idx
  on public.story_replies (story_id);

create or replace function public.set_story_reply_story_id()
returns trigger
language plpgsql
as $$
begin
  select story_id into new.story_id
  from public.story_comments
  where id = new.comment_id;

  if new.story_id is null then
    raise exception 'story comment not found for comment_id %', new.comment_id;
  end if;

  return new;
end;
$$;

drop trigger if exists story_replies_set_story_id on public.story_replies;

create trigger story_replies_set_story_id
  before insert on public.story_replies
  for each row
  execute function public.set_story_reply_story_id();
