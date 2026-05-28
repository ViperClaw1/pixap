-- Missing pre-generated WebP variants (object/public paths — no render quota).
-- Run: supabase db query --file supabase/smoke/storage_pregen_missing_audit.sql
--
-- Backfill:
--   node scripts/backfill-business-card-pregen.mjs [--dry-run]
--   node scripts/backfill-stories-pregen.mjs [--dry-run]

-- ---------------------------------------------------------------------------
-- Summary: missing pregen counts by bucket / variant
-- ---------------------------------------------------------------------------
with business_card_primaries as (
  select name
  from storage.objects
  where bucket_id = 'business-cards'
    and (metadata->>'mimetype') ilike 'image/%'
    and name !~ '_thumb\.webp$'
    and name !~ '_hero\.webp$'
    and name !~ '_gallery\.webp$'
),
business_card_missing as (
  select
    p.name as primary_path,
    not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'business-cards'
        and o.name = regexp_replace(p.name, '\.[^./]+$', '_thumb.webp')
    ) as missing_thumb,
    not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'business-cards'
        and o.name = regexp_replace(p.name, '\.[^./]+$', '_hero.webp')
    ) as missing_hero,
    not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'business-cards'
        and o.name = regexp_replace(p.name, '\.[^./]+$', '_gallery.webp')
    ) as missing_gallery
  from business_card_primaries p
),
avatar_primaries as (
  select name
  from storage.objects
  where bucket_id = 'avatars'
    and (metadata->>'mimetype') ilike 'image/%'
    and name !~ '_thumb\.webp$'
),
avatar_missing as (
  select
    p.name as primary_path,
    not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'avatars'
        and o.name = regexp_replace(p.name, '\.[^./]+$', '_thumb.webp')
    ) as missing_thumb
  from avatar_primaries p
),
stories_primaries as (
  select name
  from storage.objects
  where bucket_id = 'stories'
    and (metadata->>'mimetype') ilike 'image/%'
    and name !~ '_feed\.webp$'
    and name !~ '_story\.webp$'
    and name !~ '-poster\.webp$'
),
stories_missing as (
  select
    p.name as primary_path,
    case when p.name ~ '/post-' then '_feed.webp' when p.name ~ '/story-' then '_story.webp' else null end as expected_variant,
    case
      when p.name ~ '/post-' then not exists (
        select 1 from storage.objects o
        where o.bucket_id = 'stories'
          and o.name = regexp_replace(p.name, '\.[^./]+$', '_feed.webp')
      )
      when p.name ~ '/story-' then not exists (
        select 1 from storage.objects o
        where o.bucket_id = 'stories'
          and o.name = regexp_replace(p.name, '\.[^./]+$', '_story.webp')
      )
      else false
    end as missing_expected
  from stories_primaries p
)
select 'business-cards' as bucket, 'thumb' as variant, count(*) filter (where missing_thumb) as missing_count
from business_card_missing
union all
select 'business-cards', 'hero', count(*) filter (where missing_hero) from business_card_missing
union all
select 'business-cards', 'gallery', count(*) filter (where missing_gallery) from business_card_missing
union all
select 'avatars', 'thumb', count(*) filter (where missing_thumb) from avatar_missing
union all
select 'stories', 'feed_or_story', count(*) filter (where missing_expected) from stories_missing
order by bucket, variant;

-- ---------------------------------------------------------------------------
-- Sample: business-cards primaries missing any pregen (up to 25)
-- ---------------------------------------------------------------------------
with business_card_primaries as (
  select name
  from storage.objects
  where bucket_id = 'business-cards'
    and (metadata->>'mimetype') ilike 'image/%'
    and name !~ '_thumb\.webp$'
    and name !~ '_hero\.webp$'
    and name !~ '_gallery\.webp$'
)
select
  p.name as primary_path,
  regexp_replace(p.name, '\.[^./]+$', '_thumb.webp') as thumb_path,
  exists (
    select 1 from storage.objects o
    where o.bucket_id = 'business-cards' and o.name = regexp_replace(p.name, '\.[^./]+$', '_thumb.webp')
  ) as has_thumb,
  exists (
    select 1 from storage.objects o
    where o.bucket_id = 'business-cards' and o.name = regexp_replace(p.name, '\.[^./]+$', '_hero.webp')
  ) as has_hero,
  exists (
    select 1 from storage.objects o
    where o.bucket_id = 'business-cards' and o.name = regexp_replace(p.name, '\.[^./]+$', '_gallery.webp')
  ) as has_gallery
from business_card_primaries p
where not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'business-cards'
      and o.name = regexp_replace(p.name, '\.[^./]+$', '_thumb.webp')
  )
   or not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'business-cards'
      and o.name = regexp_replace(p.name, '\.[^./]+$', '_hero.webp')
  )
   or not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'business-cards'
      and o.name = regexp_replace(p.name, '\.[^./]+$', '_gallery.webp')
  )
order by p.name
limit 25;

-- ---------------------------------------------------------------------------
-- Sample: avatars missing _thumb.webp (up to 25)
-- ---------------------------------------------------------------------------
select
  o.name as primary_path,
  regexp_replace(o.name, '\.[^./]+$', '_thumb.webp') as expected_thumb
from storage.objects o
where o.bucket_id = 'avatars'
  and (o.metadata->>'mimetype') ilike 'image/%'
  and o.name !~ '_thumb\.webp$'
  and not exists (
    select 1 from storage.objects t
    where t.bucket_id = 'avatars'
      and t.name = regexp_replace(o.name, '\.[^./]+$', '_thumb.webp')
  )
order by o.name
limit 25;

-- ---------------------------------------------------------------------------
-- Sample: stories bucket images missing expected pregen (up to 25)
-- ---------------------------------------------------------------------------
select
  o.name as primary_path,
  case
    when o.name ~ '/post-' then regexp_replace(o.name, '\.[^./]+$', '_feed.webp')
    when o.name ~ '/story-' then regexp_replace(o.name, '\.[^./]+$', '_story.webp')
    else null
  end as expected_pregen
from storage.objects o
where o.bucket_id = 'stories'
  and (o.metadata->>'mimetype') ilike 'image/%'
  and o.name !~ '_feed\.webp$'
  and o.name !~ '_story\.webp$'
  and o.name !~ '-poster\.webp$'
  and (
    (o.name ~ '/post-' and not exists (
      select 1 from storage.objects p
      where p.bucket_id = 'stories'
        and p.name = regexp_replace(o.name, '\.[^./]+$', '_feed.webp')
    ))
    or (o.name ~ '/story-' and not exists (
      select 1 from storage.objects p
      where p.bucket_id = 'stories'
        and p.name = regexp_replace(o.name, '\.[^./]+$', '_story.webp')
    ))
  )
order by o.name
limit 25;
