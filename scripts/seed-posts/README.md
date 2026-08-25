# Seed `posts`

Creates feed posts for random users with existing public profiles. Each post is attached to a `business_cards` row, copies that card's existing Google/Storage photos into the public `stories` bucket, creates the `*_feed.webp` variant and BlurHash, then inserts the post.

## Prerequisites

The root `.env` or `.env.local` must contain:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

The database must contain:

- users exposed through `public.public_profiles`;
- `business_cards` rows with at least one reachable image URL;
- the `posts` table with `media_blurhashes`;
- the public `stories` Storage bucket.

## Run

```powershell
# Inspect the planned authors, places and image counts without writes
npm run seed:posts:dry

# Create 10 posts
npm run seed:posts

# Create 25 posts using cards from one city
node scripts/seed-posts/seed.mjs --count 25 --city Paris

# Copy up to 4 card images into every post
node scripts/seed-posts/seed.mjs --count 10 --images 4

# Add exactly 12 likes from different random users to every post
node scripts/seed-posts/seed.mjs --count 10 --likes 12

# Create missing seed users, then add 500 unique likes to every post
node scripts/seed-posts/seed.mjs --count 3 --city Almaty --images 2 --likes 500 --create-users

# Rewrite content on all existing posts (varied templates)
npm run seed:posts:reword:dry
npm run seed:posts:reword
```

Options:

- `--count 1..100` — number of posts; default `10`.
- `--images 1..8` — requested photos per post; default is random `1..3`. If a card has fewer photos, all available photos are used.
- `--likes 0..1000` — exact number of likes from unique random users for every post; default `0`. The post author is excluded.
- `--create-users` — create enough Supabase Auth users and `profiles` rows to satisfy `--likes`. Existing profiles and previously created seed users are reused.
- `--city <name>` — use only cards whose `city` contains this value case-insensitively (`Paris` matches `Paris, France`).
- `--dry-run` — read and validate source data without Storage or database writes.

Reword existing posts:

```powershell
npm run seed:posts:reword:dry
npm run seed:posts:reword
node scripts/seed-posts/randomize-content.mjs --limit 50
```

Uses a larger template pool (composite opener/middle/closer + full sentences) so feed copy stops repeating the same 12 lines.

Uploaded objects use unique paths:

```text
stories/<user-id>/seed-posts/<post-token>/01.webp
stories/<user-id>/seed-posts/<post-token>/01_feed.webp
```

If inserting a post or its likes fails, the post, cascaded reactions and newly uploaded objects are removed.

Seed users have random inaccessible passwords and `user_metadata.seeded_by = "seed-posts"`. They remain in Auth after the command so later seed runs can reuse them.

Only profiles backed by a real `auth.users` row are used as authors or likers. Orphaned `public_profiles` rows are ignored to preserve the `post_reactions.user_id` foreign key.
