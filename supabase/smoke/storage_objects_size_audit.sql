-- Storage object inventory (DB size, not CDN egress). Run weekly for sanity checks.
-- supabase db query --file supabase/smoke/storage_objects_size_audit.sql

select
  bucket_id,
  count(*) as object_count,
  pg_size_pretty(coalesce(sum((metadata->>'size')::bigint), 0)) as total_bytes_meta,
  pg_size_pretty(coalesce(avg((metadata->>'size')::bigint), 0)) as avg_bytes_meta
from storage.objects
group by bucket_id
order by coalesce(sum((metadata->>'size')::bigint), 0) desc;

-- Largest objects (candidates for re-encode / wrong upload path)
select
  bucket_id,
  name,
  (metadata->>'size')::bigint as size_bytes,
  metadata->>'mimetype' as mimetype,
  created_at
from storage.objects
where coalesce((metadata->>'size')::bigint, 0) > 800000
order by (metadata->>'size')::bigint desc nulls last
limit 25;
