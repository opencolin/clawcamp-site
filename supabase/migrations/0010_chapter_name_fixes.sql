-- =============================================================================
-- ClawCamp — Migration 0010: chapter name corrections
-- =============================================================================
-- The 0002 seed used the original card names. The site renamed two chapters:
--   "ClawCamp SF, CA"  -> "ClawCamp San Francisco"
--   "Other Events"     -> "Online Events"
-- 0002's seed is ON CONFLICT DO NOTHING (won't overwrite existing rows), so this
-- migration applies the renames explicitly. Idempotent — safe to re-run.
-- =============================================================================
UPDATE public.chapters SET name = 'ClawCamp San Francisco' WHERE slug = 'sf';
UPDATE public.chapters SET name = 'Online Events'          WHERE slug = 'online';
