-- TIIZI-S4A-CORR-001 — richer Group identity (Founder-authorised bounded extension).
--
-- Adds presentation-level Group identity columns mirroring the governed live
-- Firestore document (the mirror pattern already used for name/description/
-- is_private). These columns NEVER authorize: the live Group authority
-- remains Firestore; the shadow stays a lookup key + read-model anchor.
--
-- - cover_id: curated catalogue key (cover-1..cover-8), NULL for legacy
--   Groups (client renders the deterministic fallback). No URLs, no uploads.
-- - tagline: short purpose (1..140 chars when present).
-- - location: descriptive local context only (1..120 chars when present).
--   Never access control, filtering, or discovery semantics.
-- - focus_tags: free-text focus chips (presentation only, never authority).
-- - rules: community norms (display in About; no versioning, no enforcement,
--   no editing engine — Charter lifecycle stays deferred per EA-01 M20).
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS cover_id TEXT,
  ADD COLUMN IF NOT EXISTS tagline TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS focus_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rules TEXT[] NOT NULL DEFAULT '{}';

-- Catalogue guard at the relational layer mirrors the API allowlist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'groups_cover_check') THEN
    ALTER TABLE groups
      ADD CONSTRAINT groups_cover_check
      CHECK (cover_id IS NULL OR cover_id IN
        ('cover-1','cover-2','cover-3','cover-4','cover-5','cover-6','cover-7','cover-8'));
  END IF;
END
$$;
