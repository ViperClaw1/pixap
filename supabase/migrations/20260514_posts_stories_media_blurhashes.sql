-- Optional BlurHash placeholders parallel to media_url (JSON array order for multi-image posts).

alter table if exists public.posts
  add column if not exists media_blurhashes jsonb;

alter table if exists public.stories
  add column if not exists media_blurhashes jsonb;

comment on column public.posts.media_blurhashes is
  'JSON array of BlurHash strings in the same order as URLs in media_url when media_url is a JSON array; null for legacy rows.';

comment on column public.stories.media_blurhashes is
  'JSON array of BlurHash strings parallel to media_url when it stores multiple URLs; null for legacy rows.';
