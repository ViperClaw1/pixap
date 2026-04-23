# User Stories Query Examples

These examples target:
- `public.stories`
- `public.story_comments`
- `public.story_reactions`
- `public.stickers`

## 1) Create story

```sql
insert into public.stories (user_id, place_id, content, media_url)
values (auth.uid(), :place_id, :content, :media_url)
returning *;
```

Supabase JS:

```ts
const { data, error } = await supabase
  .from('stories')
  .insert({
    user_id: user.id,
    place_id,
    content,
    media_url: mediaUrl ?? null,
  })
  .select()
  .single();
```

## 2) Get stories by place

### Date sorted

```sql
select s.*
from public.stories s
where s.place_id = :place_id
order by s.created_at desc
limit :limit offset :offset;
```

### Popularity sorted (reactions + comments)

```sql
select
  s.*,
  coalesce(rc.reaction_count, 0) as reaction_count,
  coalesce(cc.comment_count, 0) as comment_count,
  (coalesce(rc.reaction_count, 0) * 2 + coalesce(cc.comment_count, 0)) as popularity_score
from public.stories s
left join (
  select story_id, count(*) as reaction_count
  from public.story_reactions
  where story_id is not null
  group by story_id
) rc on rc.story_id = s.id
left join (
  select story_id, count(*) as comment_count
  from public.story_comments
  group by story_id
) cc on cc.story_id = s.id
where s.place_id = :place_id
order by popularity_score desc, s.created_at desc
limit :limit offset :offset;
```

## 3) Add comment (supports `parent_id`)

```sql
insert into public.story_comments (story_id, user_id, parent_id, content)
values (:story_id, auth.uid(), :parent_id, :content)
returning *;
```

Notes:
- `parent_id` can be `null` for top-level comments.
- Cross-story parenting is blocked by the composite FK (`parent_id`, `story_id`).

## 4) Get comments

### Option A (recommended for large threads): flat list + build tree in app

```sql
select c.*
from public.story_comments c
where c.story_id = :story_id
order by c.created_at asc;
```

Why this scales better:
- simpler query plan
- predictable pagination behavior
- tree assembly can be done in API/app memory

### Option B: recursive CTE (server-side hierarchy)

```sql
with recursive comment_tree as (
  select
    c.id,
    c.story_id,
    c.user_id,
    c.parent_id,
    c.content,
    c.created_at,
    0 as depth,
    array[c.created_at, c.id::text] as path_key
  from public.story_comments c
  where c.story_id = :story_id
    and c.parent_id is null

  union all

  select
    child.id,
    child.story_id,
    child.user_id,
    child.parent_id,
    child.content,
    child.created_at,
    parent.depth + 1 as depth,
    parent.path_key || child.created_at || child.id::text
  from public.story_comments child
  join comment_tree parent on parent.id = child.parent_id
)
select *
from comment_tree
order by path_key;
```

## 5) Add / upsert reaction

`story_reactions` enforces one target (`story_id` xor `comment_id`) and one reaction per user per target via partial unique indexes.

### React to story

```sql
insert into public.story_reactions (user_id, story_id, type, sticker_id)
values (auth.uid(), :story_id, :reaction_type, :sticker_id)
on conflict (user_id, story_id) where story_id is not null
do update
set
  type = excluded.type,
  sticker_id = excluded.sticker_id,
  created_at = now()
returning *;
```

### React to comment

```sql
insert into public.story_reactions (user_id, comment_id, type, sticker_id)
values (auth.uid(), :comment_id, :reaction_type, :sticker_id)
on conflict (user_id, comment_id) where comment_id is not null
do update
set
  type = excluded.type,
  sticker_id = excluded.sticker_id,
  created_at = now()
returning *;
```

## 6) Remove reaction

### Remove reaction from story

```sql
delete from public.story_reactions
where user_id = auth.uid()
  and story_id = :story_id;
```

### Remove reaction from comment

```sql
delete from public.story_reactions
where user_id = auth.uid()
  and comment_id = :comment_id;
```

## 7) Realtime setup

The migration already adds these tables to `supabase_realtime` publication:
- `public.stories`
- `public.story_comments`
- `public.story_reactions`

Supabase JS subscription examples:

```ts
// New stories by place
const storiesChannel = supabase
  .channel(`stories:place:${placeId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'stories',
      filter: `place_id=eq.${placeId}`,
    },
    (payload) => {
      // handle new story
    }
  )
  .subscribe();

// New comments by story
const commentsChannel = supabase
  .channel(`comments:story:${storyId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'story_comments',
      filter: `story_id=eq.${storyId}`,
    },
    (payload) => {
      // handle new comment
    }
  )
  .subscribe();

// Reactions for story or comment
const reactionsChannel = supabase
  .channel(`reactions:story:${storyId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'story_reactions',
      filter: `story_id=eq.${storyId}`,
    },
    (payload) => {
      // handle insert/update/delete
    }
  )
  .subscribe();
```

RLS note:
- Realtime streams only rows visible through `SELECT` policies.
