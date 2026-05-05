-- Add explicit 24h lifetime marker for active stories.

alter table if exists public.stories
  add column if not exists expiry_time timestamptz;

update public.stories
set expiry_time = created_at + interval '24 hours'
where expiry_time is null;

alter table if exists public.stories
  alter column expiry_time set default (now() + interval '24 hours');

alter table if exists public.stories
  alter column expiry_time set not null;

create index if not exists stories_expiry_time_idx
  on public.stories (expiry_time desc);
