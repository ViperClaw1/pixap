-- Faster author timeline: filter by user_id, sort boosted_at then created_at.

create index if not exists posts_user_boost_created_idx
  on public.posts (user_id, boosted_at desc nulls last, created_at desc);
