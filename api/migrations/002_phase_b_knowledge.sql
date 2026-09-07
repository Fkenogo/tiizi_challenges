-- Phase B knowledge authority: canonical Fitness/Wellness Knowledge + Templates
-- move from Firestore to PostgreSQL as system of record.
--
-- Phase B1 scope (bounded): catalogExercises (fitness) + wellnessActivities
-- (wellness). challengeTemplates / wellnessTemplates are structurally separate
-- (own collections, own CRUD, challenge-assembly semantics) and stay in
-- Firestore until a later domain migration.
--
-- Authority rule after Phase B: PostgreSQL/API is authoritative for canonical
-- Knowledge writes and for challenge-creation canonical resolution.
-- Firestore Knowledge data is retained read-only during transition; ordinary
-- client writes are blocked in firestore.rules (deployed separately).
-- The seven orphan groupMembership rows accepted in Phase A2 are untouched.

-- Existing Tiizi admin role vocabulary (mirrors firestore.rules hasUserRole /
-- src/services/adminAccessService.ts AdminRole). No new governance roles:
-- knowledge administration requires one of the challenge/exercise moderation
-- roles (canModerateChallenges ∪ canManageExercises).
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member',
  ADD CONSTRAINT members_role_check
    CHECK (role IN ('member', 'support', 'moderator', 'content_manager', 'admin', 'super_admin'));

-- Canonical Knowledge identity. Internal UUID primary key; transitional legacy
-- Firestore document ids survive ONLY as lookup keys (never as domain ids).
-- kind-specific structured content (protocols, steps, cues, benefits, ...) that
-- has no stable cross-kind column lives in details JSONB; every stable scalar
-- used by challenge creation / runtime listing is a real column.
CREATE TABLE IF NOT EXISTS knowledge_items (
  knowledge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  legacy_firestore_id TEXT UNIQUE,
  legacy_collection TEXT,
  lifecycle TEXT NOT NULL DEFAULT 'published',
  current_version INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  subcategory TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  metric_unit TEXT NOT NULL DEFAULT '',
  target_value DOUBLE PRECISION,
  target_type TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT '',
  points INTEGER NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_items_kind_check CHECK (kind IN ('fitness', 'wellness')),
  CONSTRAINT knowledge_items_lifecycle_check CHECK (lifecycle IN ('draft', 'published', 'retired')),
  CONSTRAINT knowledge_items_version_check CHECK (current_version >= 1),
  CONSTRAINT knowledge_items_legacy_pair_check CHECK (
    (legacy_firestore_id IS NULL) = (legacy_collection IS NULL)
  ),
  CONSTRAINT knowledge_items_legacy_collection_check CHECK (
    legacy_collection IS NULL OR legacy_collection IN ('catalogExercises', 'wellnessActivities')
  ),
  CONSTRAINT knowledge_items_name_check CHECK (char_length(name) BETWEEN 1 AND 200),
  CONSTRAINT knowledge_items_category_check CHECK (char_length(category) <= 100),
  CONSTRAINT knowledge_items_difficulty_check CHECK (char_length(difficulty) <= 50),
  CONSTRAINT knowledge_items_points_check CHECK (points >= 0)
);

CREATE INDEX IF NOT EXISTS knowledge_items_kind_lifecycle_idx
  ON knowledge_items (kind, lifecycle);
CREATE INDEX IF NOT EXISTS knowledge_items_name_idx
  ON knowledge_items (name);

-- Immutable historical content versions. One row per content revision;
-- lifecycle-only transitions never add a row here. Rows are append-only:
-- the trigger below rejects UPDATE and DELETE so history can never be
-- destructively overwritten (enforced in the database, not just by convention).
CREATE TABLE IF NOT EXISTS knowledge_item_versions (
  item_id UUID NOT NULL REFERENCES knowledge_items (knowledge_id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  subcategory TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  metric_unit TEXT NOT NULL DEFAULT '',
  target_value DOUBLE PRECISION,
  target_type TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT '',
  points INTEGER NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_item_versions_pkey PRIMARY KEY (item_id, version),
  CONSTRAINT knowledge_item_versions_version_check CHECK (version >= 1)
);

CREATE OR REPLACE FUNCTION reject_knowledge_version_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  RAISE EXCEPTION 'knowledge_item_versions is append-only (item_id=%, version=%)', OLD.item_id, OLD.version;
  RETURN NULL;
END;
$func$;

DROP TRIGGER IF EXISTS knowledge_item_versions_immutable ON knowledge_item_versions;

CREATE TRIGGER knowledge_item_versions_immutable
  BEFORE UPDATE OR DELETE ON knowledge_item_versions
  FOR EACH ROW EXECUTE FUNCTION reject_knowledge_version_mutation();
