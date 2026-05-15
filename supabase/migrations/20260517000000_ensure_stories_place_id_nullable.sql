-- Idempotent: safe if 20260516_stories_place_id_nullable.sql already ran.
-- Fixes inserts when place_id is unknown (e.g. story from geo-only post) on DBs that still had NOT NULL.

alter table if exists public.stories alter column place_id drop not null;
