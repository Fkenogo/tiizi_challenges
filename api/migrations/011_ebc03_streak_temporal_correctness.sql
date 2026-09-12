-- EBC-03: Streak temporal correctness — governing Challenge timezone.
-- (Engine Baseline Closure slice 3).
--
-- One governing timezone per Challenge defines the Challenge day for Streak
-- temporal evaluation (Stage F FR-V2-119). The timezone lives on the
-- governing configuration: the challenges mirror carries the current value
-- and every immutable config snapshot pins the value that governed its
-- version, so historical accepted records keep replaying under the terms
-- that accepted them.
--
-- Additive only: one new mirror column (default UTC, so pre-EBC-03 rows
-- stay interpretable without backfill) plus the reason-code extension for
-- the late-logging rejection below. No existing column is altered, no table
-- is dropped, no production data is rewritten. Pre-EBC-03 V2 rows keep
-- timezone 'UTC' as legacy; their stored occurred_day values are never
-- re-derived, so replay parity is preserved.
--
-- Standard PostgreSQL only. No Firebase/Firestore identifiers. No V1
-- migration. PRODUCTION SAFETY: development/shadow only until the later
-- cutover task applies it (same as 003/004/005/009/010).

-- 1. Governing timezone mirror. IANA identifier (e.g. 'Africa/Nairobi').
-- Validity itself is enforced application-side (fail closed); the CHECK
-- below only bounds the shape so corrupt values cannot hide.
ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'challenges_timezone_check'
  ) THEN
    ALTER TABLE challenges
      ADD CONSTRAINT challenges_timezone_check CHECK (
        char_length(timezone) BETWEEN 1 AND 100
      );
  END IF;
END
$$;

-- 2. The governing-config guard must treat timezone like the other
-- governing evaluation columns: it may change ONLY together with a config
-- version bump (i.e. via a versioned config change, never silently).
CREATE OR REPLACE FUNCTION challenges_guard_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'challenges are historical records: DELETE is not permitted';
  END IF;
  IF OLD.group_id IS DISTINCT FROM NEW.group_id
     OR OLD.challenge_type IS DISTINCT FROM NEW.challenge_type
     OR OLD.created_by_member_id IS DISTINCT FROM NEW.created_by_member_id
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'challenges: identity columns (group_id, challenge_type, created_by, created_at) are immutable';
  END IF;
  IF NOT (
    (OLD.status = 'establishment' AND NEW.status IN ('establishment', 'active', 'ended'))
    OR (OLD.status = 'active' AND NEW.status IN ('active', 'ended'))
    OR (OLD.status = 'ended' AND NEW.status = 'ended')
  ) THEN
    RAISE EXCEPTION 'challenges: illegal lifecycle transition % -> % (ended is terminal)', OLD.status, NEW.status;
  END IF;
  IF (OLD.start_date IS DISTINCT FROM NEW.start_date
      OR OLD.end_date IS DISTINCT FROM NEW.end_date
      OR OLD.goal_value IS DISTINCT FROM NEW.goal_value
      OR OLD.goal_unit IS DISTINCT FROM NEW.goal_unit
      OR OLD.required_consecutive_days IS DISTINCT FROM NEW.required_consecutive_days
      OR OLD.reset_on_miss IS DISTINCT FROM NEW.reset_on_miss
      OR OLD.timezone IS DISTINCT FROM NEW.timezone)
     AND OLD.current_config_version = NEW.current_config_version THEN
    RAISE EXCEPTION 'challenges: governing configuration may change only with a config version bump';
  END IF;
  IF OLD.activated_at IS NOT NULL AND OLD.activated_at IS DISTINCT FROM NEW.activated_at THEN
    RAISE EXCEPTION 'challenges: activated_at is write-once';
  END IF;
  IF OLD.ended_at IS NOT NULL AND OLD.ended_at IS DISTINCT FROM NEW.ended_at THEN
    RAISE EXCEPTION 'challenges: ended_at is write-once';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Late-logging rejection reason (EBC-03 §5): a Streak submission for a
-- Challenge day that has already closed in the governing timezone is
-- ineligible. The durable rejected Submission Intent carries this reason;
-- no Evidence, application, or Derived effect is created.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activity_submission_intents_reason_check'
  ) THEN
    ALTER TABLE activity_submission_intents
      DROP CONSTRAINT activity_submission_intents_reason_check;
  END IF;
  ALTER TABLE activity_submission_intents
    ADD CONSTRAINT activity_submission_intents_reason_check CHECK (
      eligibility_reason IS NULL
      OR eligibility_reason IN (
        'GROUP_MEMBERSHIP_REQUIRED',
        'CHALLENGE_NOT_ACTIVE',
        'PARTICIPATION_NOT_ELIGIBLE',
        'OCCURRENCE_OUT_OF_WINDOW',
        'ACTIVITY_NOT_CONFIGURED',
        'MEASUREMENT_NOT_COMPATIBLE',
        'KNOWLEDGE_MISMATCH',
        'STREAK_DAY_CLOSED'
      )
    );
END
$$;
