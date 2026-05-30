-- Idempotent schema ensure for ops scripts (service_role only).
-- Mirrors 20260514_posts_stories_media_blurhashes.sql.

create or replace function public.ensure_feed_media_blurhash_columns()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  alter table if exists public.posts
    add column if not exists media_blurhashes jsonb;
  alter table if exists public.stories
    add column if not exists media_blurhashes jsonb;
  return true;
end;
$$;

revoke all on function public.ensure_feed_media_blurhash_columns() from public;
grant execute on function public.ensure_feed_media_blurhash_columns() to service_role;

comment on function public.ensure_feed_media_blurhash_columns() is
  'Adds posts/stories.media_blurhashes if missing. Callable only with service_role (backfill scripts).';
