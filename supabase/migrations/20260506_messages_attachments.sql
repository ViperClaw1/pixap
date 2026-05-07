alter table if exists public.messages
  add column if not exists attachments text[] not null default '{}';
