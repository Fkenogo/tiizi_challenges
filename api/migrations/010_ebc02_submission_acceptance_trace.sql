-- EBC-02: Submission / Eligibility / Acceptance trace
-- (Engine Baseline Closure slice 2).
--
-- Makes the existing automatic ordinary activity-acceptance path explicitly
-- traceable and auditable WITHOUT changing the approved self-accountability
-- model:
--
--   Submission Intent
--     -> Evidence Eligibility (server-owned determination)
--     -> Acceptance Decision (automatic_system authority, NOT "verified")
--     -> Accepted Activity Event (member_activity_events)
--     -> Challenge Application (challenge_activity_records)
--     -> Calculation / Derived Truth
--
-- One user action in one Challenge produces ONE attributable, deterministic
-- activity_submission_intents row, persisted for BOTH accepted and
-- domain-ineligible submissions. Transport/schema failures never reach this
-- table (the API/domain boundary rejects them before intent persistence).
--
-- The base Evidence row (member_activity_events) is unchanged: no
-- challenge_id, no Challenge score/points, no acceptance authority, no
-- eligibility outcome live on it. Challenge association and the decision
-- trace live HERE and in the application record.
--
-- Additive only: a new table; no existing column is altered, no table is
-- dropped, no production data is rewritten. Pre-EBC-02 accepted V2 rows
-- (events + applications without an intent) remain legacy and are never
-- backfilled or fabricated into this table. Idempotent retry of such a
-- legacy row keeps returning the existing application without minting an
-- intent.
--
-- Accepted != verified: acceptance_authority is the stable automatic system
-- identity, not a human reviewer and not factual certification. ACT-03
-- Verification and ACT-04 Correction remain deferred.
--
-- Standard PostgreSQL only. No Firebase/Firestore identifiers. No V1
-- migration. PRODUCTION SAFETY: development/shadow only until the later
-- cutover task applies it (same as 003/004/005).

CREATE TABLE IF NOT EXISTS activity_submission_intents (
  submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Actor identity is SERVER-RESOLVED (from the authenticated Member); the
  -- client is never authoritative for it.
  member_id UUID NOT NULL REFERENCES members (member_id) ON DELETE RESTRICT,
  -- The single Challenge the participant attempted to log into.
  challenge_id UUID NOT NULL REFERENCES challenges (challenge_id) ON DELETE RESTRICT,
  -- Owning participation episode. NULL only for a rejected submission where
  -- no owning episode exists (or the rejection precedes episode resolution).
  participation_id UUID REFERENCES challenge_participations (participation_id) ON DELETE RESTRICT,
  -- Request/client idempotency identity. One intent per client_key.
  client_key TEXT NOT NULL,
  -- Submitted activity data snapshot (the intent payload, as the client
  -- supplied the measurement facts; scoring/points are never client data).
  activity_kind TEXT NOT NULL,
  canonical_key TEXT NOT NULL,
  activity_variant TEXT,
  value DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  occurred_day DATE NOT NULL,
  occurred_tz TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Evidence Eligibility (server-owned determination).
  eligibility_status TEXT NOT NULL,
  eligibility_reason TEXT,
  -- Acceptance Decision (automatic system authority).
  acceptance_status TEXT NOT NULL,
  acceptance_authority TEXT NOT NULL,
  decided_at TIMESTAMPTZ,
  -- Accepted result references (NULL until accepted). No fake event/record
  -- is ever created for a rejected submission.
  event_id UUID REFERENCES member_activity_events (event_id) ON DELETE RESTRICT,
  record_id UUID REFERENCES challenge_activity_records (record_id) ON DELETE RESTRICT,
  CONSTRAINT activity_submission_intents_client_key_unique UNIQUE (client_key),
  CONSTRAINT activity_submission_intents_kind_check CHECK (activity_kind IN ('fitness', 'wellness')),
  CONSTRAINT activity_submission_intents_key_check CHECK (char_length(canonical_key) BETWEEN 1 AND 200),
  CONSTRAINT activity_submission_intents_variant_check CHECK (
    activity_variant IS NULL OR char_length(activity_variant) BETWEEN 1 AND 120
  ),
  CONSTRAINT activity_submission_intents_value_check CHECK (value >= 0),
  CONSTRAINT activity_submission_intents_unit_check CHECK (char_length(unit) BETWEEN 1 AND 40),
  CONSTRAINT activity_submission_intents_client_key_check CHECK (char_length(client_key) BETWEEN 1 AND 300),
  CONSTRAINT activity_submission_intents_eligibility_status_check CHECK (
    eligibility_status IN ('eligible', 'ineligible')
  ),
  CONSTRAINT activity_submission_intents_acceptance_status_check CHECK (
    acceptance_status IN ('accepted', 'rejected')
  ),
  -- Stable non-human automatic authority identity. Accepted is NOT verified.
  CONSTRAINT activity_submission_intents_authority_check CHECK (
    acceptance_authority = 'automatic_system'
  ),
  -- Bounded machine-readable eligibility reason codes, aligned to the actual
  -- governed checks the engine performs. No codes for un-checked conditions.
  CONSTRAINT activity_submission_intents_reason_check CHECK (
    eligibility_reason IS NULL
    OR eligibility_reason IN (
      'GROUP_MEMBERSHIP_REQUIRED',
      'CHALLENGE_NOT_ACTIVE',
      'PARTICIPATION_NOT_ELIGIBLE',
      'OCCURRENCE_OUT_OF_WINDOW',
      'ACTIVITY_NOT_CONFIGURED',
      'MEASUREMENT_NOT_COMPATIBLE',
      'KNOWLEDGE_MISMATCH'
    )
  ),
  -- The current automatic ordinary rule couples eligibility and acceptance
  -- (eligible -> accepted, ineligible -> rejected). Stored separately so the
  -- two concepts stay identifiable, but the persisted state is always
  -- consistent and never a fake accepted/rejected event or application.
  CONSTRAINT activity_submission_intents_outcome_check CHECK (
    (
      eligibility_status = 'eligible'
      AND acceptance_status = 'accepted'
      AND eligibility_reason IS NULL
      AND event_id IS NOT NULL
      AND record_id IS NOT NULL
      AND participation_id IS NOT NULL
      AND decided_at IS NOT NULL
    )
    OR
    (
      eligibility_status = 'ineligible'
      AND acceptance_status = 'rejected'
      AND eligibility_reason IS NOT NULL
      AND event_id IS NULL
      AND record_id IS NULL
      AND decided_at IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS activity_submission_intents_member_idx
  ON activity_submission_intents (member_id);
CREATE INDEX IF NOT EXISTS activity_submission_intents_challenge_idx
  ON activity_submission_intents (challenge_id);
CREATE INDEX IF NOT EXISTS activity_submission_intents_event_idx
  ON activity_submission_intents (event_id);
CREATE INDEX IF NOT EXISTS activity_submission_intents_record_idx
  ON activity_submission_intents (record_id);

-- Submission intents are a durable decision trace: append-only, never
-- mutated, never deleted. A retry of an accepted/rejected intent replays the
-- same decision; it never rewrites history.
CREATE OR REPLACE FUNCTION activity_submission_intents_guard_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'activity_submission_intents are immutable decision trace: % is not permitted (submission=%)',
    TG_OP, COALESCE(OLD.submission_id, NEW.submission_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activity_submission_intents_no_mutation ON activity_submission_intents;
CREATE TRIGGER activity_submission_intents_no_mutation
  BEFORE UPDATE OR DELETE ON activity_submission_intents
  FOR EACH ROW EXECUTE FUNCTION activity_submission_intents_guard_mutation();
