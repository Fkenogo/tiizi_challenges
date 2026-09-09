-- Phase C1 (clean V2): Member Activity Event ledger — reported Evidence.
--
-- Clean-state principle (Founder decision): Tiizi has not launched and V1
-- Firestore workouts/wellnessLogs are development/test data. They do NOT
-- migrate. This table represents V2 business truth, not Firestore migration
-- mechanics: no legacy_collection / legacy_id / legacy_challenge_id /
-- legacy_group_id, and no Challenge-derived score/progress fields.
--
-- Domain separation (Stage F logical model):
--   Member Activity Event  = Evidence (THIS table: what the member reported).
--   Challenge-Specific Activity Record = C2 application of one event within
--     one Challenge/Participation (event FK + challenge + config version +
--     acceptance state + scoring result). NOT implemented here.
--   Derived Truth = calculated challenge outcome (recomputable, C2).
-- Conceptual flow: Member Activity Event -> Challenge-Specific Activity
-- Record -> Challenge Engine -> Derived Truth.
--
-- Consequences for this schema:
-- - NO challenge_id: a logging action occurs in a Challenge context, but the
--   association is recorded by the C2 application record, not the Evidence.
--   Cross-challenge reuse stays prohibited: a log in Challenge A never
--   automatically counts in Challenge B, and Tiizi is not a personal diary.
-- - NO points / scoring_method / scoring_version: scoring is Challenge
--   application (engine + challenge config), computed at application time,
--   never stored on the Evidence.
-- - `event_id` is a stable UUID PRIMARY KEY so a future
--   challenge_activity_records table can reference it WITHOUT any change to
--   this schema.
-- - Knowledge pin (knowledge_id + knowledge_version, always complete) is
--   server-resolved at write time against canonical Knowledge. Client input
--   supplies only the canonical key (+variant); it never determines the
--   authoritative version.
-- - `occurred_day` is the authoritative local calendar day the engines reason
--   about; `occurred_tz` records the originating timezone when known.
--
-- Standard PostgreSQL only. Firestore remains the temporary V1 writer while
-- C1/C2 complete; the V2 cutover starts from a CLEAN event state (no import).
-- Corrections arrive as NEW rows referencing the superseded row (trigger
-- below). Event deletion is not a correction mechanism.

CREATE TABLE IF NOT EXISTS member_activity_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- V2 member identity: internal UUID FK. Firebase UIDs never appear here.
  member_id UUID NOT NULL REFERENCES members (member_id) ON DELETE RESTRICT,
  -- Activity domain: Knowledge-aligned kind + canonical activity identity.
  activity_kind TEXT NOT NULL,
  canonical_key TEXT NOT NULL,
  -- Optional Knowledge variant (e.g. a push-up variant or measurement mode
  -- defined by the canonical Activity). NULL when the Activity has no variant.
  activity_variant TEXT,
  -- Canonical Knowledge pin, server-resolved at write time. Always complete:
  -- V2 events never carry partial pins and never invent Knowledge.
  knowledge_id UUID NOT NULL REFERENCES knowledge_items (knowledge_id) ON DELETE RESTRICT,
  knowledge_version INTEGER NOT NULL,
  -- Event time (when the activity happened) vs ledger time (recorded_at).
  occurred_at TIMESTAMPTZ NOT NULL,
  occurred_day DATE NOT NULL,
  -- Originating IANA timezone for occurred_day (e.g. 'Africa/Lagos').
  -- NULL means the day was derived from occurred_at in UTC.
  occurred_tz TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Reported measurement. No scoring: points are Challenge application (C2).
  value DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL,
  -- Client idempotency key (V2 client-generated, opaque). Duplicate retries
  -- converge on this key; business identity is event_id.
  client_key TEXT NOT NULL,
  -- Correction chain. A correction/reversal is a NEW event row pointing at the
  -- row it supersedes; the trigger below flips the target to superseded.
  supersedes_event_id UUID REFERENCES member_activity_events (event_id) ON DELETE RESTRICT,
  correction_kind TEXT,
  status TEXT NOT NULL DEFAULT 'committed',
  -- Structured metadata for genuinely variant tails only. Never business truth.
  metadata JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT member_activity_events_kind_check CHECK (activity_kind IN ('fitness', 'wellness')),
  CONSTRAINT member_activity_events_canonical_key_check CHECK (char_length(canonical_key) BETWEEN 1 AND 200),
  CONSTRAINT member_activity_events_variant_check CHECK (activity_variant IS NULL OR char_length(activity_variant) BETWEEN 1 AND 120),
  CONSTRAINT member_activity_events_knowledge_version_check CHECK (knowledge_version >= 1),
  CONSTRAINT member_activity_events_value_check CHECK (value >= 0),
  CONSTRAINT member_activity_events_unit_check CHECK (char_length(unit) BETWEEN 1 AND 40),
  CONSTRAINT member_activity_events_client_key_check CHECK (char_length(client_key) BETWEEN 1 AND 300),
  CONSTRAINT member_activity_events_client_key_unique UNIQUE (client_key),
  CONSTRAINT member_activity_events_correction_check CHECK (
    (supersedes_event_id IS NULL AND correction_kind IS NULL)
    OR (supersedes_event_id IS NOT NULL AND correction_kind IN ('correction', 'reversal'))
  ),
  CONSTRAINT member_activity_events_no_self_supersede CHECK (supersedes_event_id IS DISTINCT FROM event_id),
  CONSTRAINT member_activity_events_status_check CHECK (status IN ('committed', 'superseded'))
);

CREATE INDEX IF NOT EXISTS member_activity_events_member_idx ON member_activity_events (member_id);
CREATE INDEX IF NOT EXISTS member_activity_events_occurred_idx ON member_activity_events (occurred_at);
CREATE INDEX IF NOT EXISTS member_activity_events_knowledge_idx ON member_activity_events (knowledge_id);
CREATE INDEX IF NOT EXISTS member_activity_events_supersedes_idx ON member_activity_events (supersedes_event_id);

-- Immutability: committed content is never destructively overwritten.
-- The ONLY permitted UPDATE flips status committed -> superseded with every
-- other column identical (performed by the correction trigger below).
-- DELETE is never permitted; corrections are INSERTs.
CREATE OR REPLACE FUNCTION member_activity_events_guard_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'member_activity_events are append-only: DELETE is not a correction mechanism (insert a correction event instead)';
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status
     AND OLD.status = 'committed' AND NEW.status = 'superseded'
     AND OLD.event_id = NEW.event_id
     AND OLD.member_id = NEW.member_id
     AND OLD.activity_kind = NEW.activity_kind
     AND OLD.canonical_key = NEW.canonical_key
     AND OLD.activity_variant IS NOT DISTINCT FROM NEW.activity_variant
     AND OLD.knowledge_id IS NOT DISTINCT FROM NEW.knowledge_id
     AND OLD.knowledge_version IS NOT DISTINCT FROM NEW.knowledge_version
     AND OLD.occurred_at = NEW.occurred_at
     AND OLD.occurred_day = NEW.occurred_day
     AND OLD.occurred_tz IS NOT DISTINCT FROM NEW.occurred_tz
     AND OLD.recorded_at = NEW.recorded_at
     AND OLD.value = NEW.value
     AND OLD.unit = NEW.unit
     AND OLD.client_key = NEW.client_key
     AND OLD.supersedes_event_id IS NOT DISTINCT FROM NEW.supersedes_event_id
     AND OLD.correction_kind IS NOT DISTINCT FROM NEW.correction_kind
     AND OLD.metadata = NEW.metadata THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'member_activity_events are append-only: committed content cannot be overwritten (insert a correction event instead)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS member_activity_events_no_mutation ON member_activity_events;
CREATE TRIGGER member_activity_events_no_mutation
  BEFORE UPDATE OR DELETE ON member_activity_events
  FOR EACH ROW EXECUTE FUNCTION member_activity_events_guard_mutation();

-- Correction chain: inserting a correction/reversal flips its target from
-- committed to superseded. The target must be committed (linear chain, no
-- double-supersede) and must belong to the same member and activity kind.
CREATE OR REPLACE FUNCTION member_activity_events_apply_correction()
RETURNS trigger AS $$
DECLARE
  target member_activity_events%ROWTYPE;
BEGIN
  IF NEW.supersedes_event_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO target FROM member_activity_events WHERE event_id = NEW.supersedes_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'correction target event % does not exist', NEW.supersedes_event_id;
  END IF;
  IF target.status <> 'committed' THEN
    RAISE EXCEPTION 'correction target event % is not committed (status=%)', NEW.supersedes_event_id, target.status;
  END IF;
  IF target.member_id IS DISTINCT FROM NEW.member_id OR target.activity_kind <> NEW.activity_kind THEN
    RAISE EXCEPTION 'correction must reference the same member and activity kind';
  END IF;
  UPDATE member_activity_events SET status = 'superseded' WHERE event_id = NEW.supersedes_event_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS member_activity_events_correction_chain ON member_activity_events;
CREATE TRIGGER member_activity_events_correction_chain
  AFTER INSERT ON member_activity_events
  FOR EACH ROW EXECUTE FUNCTION member_activity_events_apply_correction();

-- Derived read surface (C1): views only, recomputable, never client-authored.
-- Effective ledger: committed rows, i.e. originals never superseded plus
-- their live corrections.
CREATE OR REPLACE VIEW v_member_activity_events_effective AS
  SELECT * FROM member_activity_events WHERE status = 'committed';

-- Per-member totals over the effective ledger (measurement only, no scoring).
CREATE OR REPLACE VIEW v_member_activity_event_totals AS
  SELECT member_id,
         activity_kind,
         COUNT(*)::BIGINT AS event_count,
         COALESCE(SUM(value), 0) AS value_sum,
         COUNT(DISTINCT occurred_day)::BIGINT AS day_count,
         MIN(occurred_at) AS first_occurred_at,
         MAX(occurred_at) AS last_occurred_at
  FROM member_activity_events
  WHERE status = 'committed'
  GROUP BY member_id, activity_kind;
