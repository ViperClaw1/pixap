-- Ensure PostgREST exposes posts.boosted_at after column migration.
notify pgrst, 'reload schema';
