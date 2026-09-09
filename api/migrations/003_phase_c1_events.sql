-- Phase C1: append-only Activity Event ledger (shadow / replay-validation only).
-- Standard PostgreSQL only. No provider-specific features.
-- Firestore remains the live writer/authority for NEW workouts and wellnessLogs;
-- this ledger is a shadow until a later Phase C cutover. No dual writes.
--
-- Model: each historical workout / wellness log maps 1:1 to one canonical event
-- row. Committed event content is never destructively overwritten: corrections
-- arrive as NEW rows referencing the superseded row (see trigger below).
-- Event deletion is not a correction mechanism.

CREATE TABLE IF NOT EXISTS activity_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  member_id UUID NOT NULL REFERENCES members (member_id) ON DELETE RESTRICT,
  -- Transitional identity: challenges/groups have no PostgreSQL authority yet
  -- in C1, so the legacy Firestore document ids are carried as references.
  -- These are NOT authority claims.
  legacy_challenge_id TEXT,
  legacy_group_id TEXT,
  -- Canonical activity key exactly as logged (exerciseId for workouts,
  -- activityId for wellness logs).
  canonical_key TEXT NOT NULL,
  -- Canonical Knowledge pin, resolved at import time from knowledge_items.
  -- NULL when the key cannot be resolved to canonical Knowledge (reported by
  -- the importer, never invented). knowledge_version is the snapshot of
  -- current_version at import; historical pins stay pinned.
  knowledge_id UUID REFERENCES knowledge_items (knowledge_id) ON DELETE RESTRICT,
  knowledge_version INTEGER,
  version_source TEXT,
  -- Event time (historical) vs ledger time (import). occurred_day preserves
  -- the legacy local calendar-day bucket engines reason about.
  occurred_at TIMESTAMPTZ NOT NULL,
  occurred_day DATE NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  value DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL,
  points INTEGER NOT NULL,
  -- Client idempotency key. Legacy imports use the deterministic
  -- `firestore:<collection>:<docId>` key, so retries and re-runs converge.
  client_key TEXT NOT NULL,
  legacy_collection TEXT NOT NULL,
  legacy_id TEXT NOT NULL,
  -- Wellness variant tail (fasting|hydration|sleep|meditation); NULL for workouts.
  log_type TEXT,
  -- Correction chain. A correction/reversal is a NEW event row pointing at the
  -- row it supersedes; the trigger below flips the target to superseded.
  supersedes_event_id UUID REFERENCES activity_events (event_id) ON DELETE RESTRICT,
  correction_kind TEXT,
  status TEXT NOT NULL DEFAULT 'committed',
  -- Structured metadata for genuinely variant tails only (notes, scoring
  -- version, verified flag, wellness variant fields). Never business truth.
  metadata JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT activity_events_type_check CHECK (event_type IN ('workout', 'wellness')),
  CONSTRAINT activity_events_canonical_key_check CHECK (char_length(canonical_key) BETWEEN 1 AND 200),
  CONSTRAINT activity_events_knowledge_pin_check CHECK (
    (knowledge_id IS NULL AND knowledge_version IS NULL AND version_source IS NULL)
    OR (knowledge_id IS NOT NULL AND knowledge_version IS NOT NULL AND version_source IS NOT NULL)
  ),
  CONSTRAINT activity_events_knowledge_version_check CHECK (knowledge_version IS NULL OR knowledge_version >= 1),
  CONSTRAINT activity_events_version_source_check CHECK (version_source IS NULL OR version_source IN ('import_snapshot', 'log_pinned')),
  CONSTRAINT activity_events_value_check CHECK (value >= 0),
  CONSTRAINT activity_events_unit_check CHECK (char_length(unit) BETWEEN 1 AND 40),
  CONSTRAINT activity_events_points_check CHECK (points >= 0),
  CONSTRAINT activity_events_client_key_check CHECK (char_length(client_key) BETWEEN 1 AND 300),
  CONSTRAINT activity_events_client_key_unique UNIQUE (client_key),
  CONSTRAINT activity_events_legacy_check CHECK (legacy_collection IN ('workouts', 'wellnessLogs')),
  CONSTRAINT activity_events_legacy_id_check CHECK (char_length(legacy_id) BETWEEN 1 AND 200),
  CONSTRAINT activity_events_legacy_unique UNIQUE (legacy_collection, legacy_id),
  CONSTRAINT activity_events_log_type_check CHECK (
    (event_type = 'workout' AND log_type IS NULL)
    OR (event_type = 'wellness' AND log_type IN ('fasting', 'hydration', 'sleep', 'meditation'))
  ),
  CONSTRAINT activity_events_correction_check CHECK (
    (supersedes_event_id IS NULL AND correction_kind IS NULL)
    OR (supersedes_event_id IS NOT NULL AND correction_kind IN ('correction', 'reversal'))
  ),
  CONSTRAINT activity_events_no_self_supersede CHECK (supersedes_event_id IS DISTINCT FROM event_id),
  CONSTRAINT activity_events_status_check CHECK (status IN ('committed', 'superseded'))
);

CREATE INDEX IF NOT EXISTS activity_events_member_idx ON activity_events (member_id);
CREATE INDEX IF NOT EXISTS activity_events_challenge_idx ON activity_events (legacy_challenge_id);
CREATE INDEX IF NOT EXISTS activity_events_occurred_idx ON activity_events (occurred_at);
CREATE INDEX IF NOT EXISTS activity_events_knowledge_idx ON activity_events (knowledge_id);
CREATE INDEX IF NOT EXISTS activity_events_supersedes_idx ON activity_events (supersedes_event_id);

-- Immutability: committed content is never destructively overwritten.
-- The ONLY permitted UPDATE flips status committed -> superseded with every
-- other column identical (performed by the correction trigger below).
-- DELETE is never permitted; corrections are INSERTs.
CREATE OR REPLACE FUNCTION activity_events_guard_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'activity_events are append-only: DELETE is not a correction mechanism (insert a correction event instead)';
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status
     AND OLD.status = 'committed' AND NEW.status = 'superseded'
     AND OLD.event_id = NEW.event_id
     AND OLD.event_type = NEW.event_type
     AND OLD.member_id = NEW.member_id
     AND OLD.legacy_challenge_id IS NOT DISTINCT FROM NEW.legacy_challenge_id
     AND OLD.legacy_group_id IS NOT DISTINCT FROM NEW.legacy_group_id
     AND OLD.canonical_key = NEW.canonical_key
     AND OLD.knowledge_id IS NOT DISTINCT FROM NEW.knowledge_id
     AND OLD.knowledge_version IS NOT DISTINCT FROM NEW.knowledge_version
     AND OLD.version_source IS NOT DISTINCT FROM NEW.version_source
     AND OLD.occurred_at = NEW.occurred_at
     AND OLD.occurred_day = NEW.occurred_day
     AND OLD.recorded_at = NEW.recorded_at
     AND OLD.value = NEW.value
     AND OLD.unit = NEW.unit
     AND OLD.points = NEW.points
     AND OLD.client_key = NEW.client_key
     AND OLD.legacy_collection = NEW.legacy_collection
     AND OLD.legacy_id = NEW.legacy_id
     AND OLD.log_type IS NOT DISTINCT FROM NEW.log_type
     AND OLD.supersedes_event_id IS NOT DISTINCT FROM NEW.supersedes_event_id
     AND OLD.correction_kind IS NOT DISTINCT FROM NEW.correction_kind
     AND OLD.metadata = NEW.metadata THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'activity_events are append-only: committed content cannot be overwritten (insert a correction event instead)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activity_events_no_mutation ON activity_events;
CREATE TRIGGER activity_events_no_mutation
  BEFORE UPDATE OR DELETE ON activity_events
  FOR EACH ROW EXECUTE FUNCTION activity_events_guard_mutation();

-- Correction chain: inserting a correction/reversal flips its target from
-- committed to superseded. The target must be committed (linear chain, no
-- double-supersede) and must belong to the same member and event type.
CREATE OR REPLACE FUNCTION activity_events_apply_correction()
RETURNS trigger AS $$
DECLARE
  target activity_events%ROWTYPE;
BEGIN
  IF NEW.supersedes_event_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO target FROM activity_events WHERE event_id = NEW.supersedes_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'correction target event % does not exist', NEW.supersedes_event_id;
  END IF;
  IF target.status <> 'committed' THEN
    RAISE EXCEPTION 'correction target event % is not committed (status=%)', NEW.supersedes_event_id, target.status;
  END IF;
  IF target.member_id IS DISTINCT FROM NEW.member_id OR target.event_type <> NEW.event_type THEN
    RAISE EXCEPTION 'correction must reference the same member and event type';
  END IF;
  UPDATE activity_events SET status = 'superseded' WHERE event_id = NEW.supersedes_event_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activity_events_correction_chain ON activity_events;
CREATE TRIGGER activity_events_correction_chain
  AFTER INSERT ON activity_events
  FOR EACH ROW EXECUTE FUNCTION activity_events_apply_correction();

-- Derived read surface (C1): views only, recomputable, never client-authored.
-- Effective ledger: committed rows, i.e. originals never superseded plus
-- their live corrections.
CREATE OR REPLACE VIEW v_activity_events_effective AS
  SELECT * FROM activity_events WHERE status = 'committed';

-- Per-member / per-challenge totals over the effective ledger.
CREATE OR REPLACE VIEW v_activity_event_totals AS
  SELECT member_id,
         legacy_challenge_id,
         event_type,
         COUNT(*)::BIGINT AS event_count,
         COALESCE(SUM(value), 0) AS value_sum,
         COALESCE(SUM(points), 0)::BIGINT AS points_sum,
         COUNT(DISTINCT occurred_day)::BIGINT AS day_count,
         MIN(occurred_at) AS first_occurred_at,
         MAX(occurred_at) AS last_occurred_at
  FROM activity_events
  WHERE status = 'committed'
  GROUP BY member_id, legacy_challenge_id, event_type;
