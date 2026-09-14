-- PF-03: Challenge Definition Contract persistence.
--
-- Additive only: no existing column is altered, no table is dropped, no
-- production data is rewritten. Pre-PF-03 rows keep NULL definition pins
-- and their legacy behavior untouched: the new columns are nullable (or
-- defaulted) so history is never rewritten and existing engine reads keep
-- working.
--
-- challenge_activity_configs gains the governed per-requirement pins that
-- make one Challenge Activity requirement deterministic and historically
-- intelligible (see api/src/challengeDefinition.ts):
-- - activity_code: immutable Activity Code pin (NULL only pre-PF-03).
-- - required_components: pinned required Component machine identifiers
--   (empty when the Activity version declares none).
-- - component_relationship: 'ALL_REQUIRED' exactly when Components are
--   pinned, otherwise NULL (coherence enforced below).
-- - load_reporting_basis: explicit authorized basis for Weight
--   configurations only (NULL otherwise; coherence enforced below).
-- - duration_mode: CONTINUOUS | ACCUMULATED for Duration configurations
--   only (NULL otherwise; coherence enforced below).
-- - completion_occurrence: intelligible Challenge occurrence for
--   Completion configurations only (NULL otherwise; coherence below).
--
-- Challenge-level temporal conditions (at/before/after/within) and the
-- full normalized definition live in the version snapshot JSONB (the
-- immutable authority); no extra challenge-level table is created.
ALTER TABLE challenge_activity_configs
  ADD COLUMN IF NOT EXISTS activity_code TEXT,
  ADD COLUMN IF NOT EXISTS required_components TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS component_relationship TEXT,
  ADD COLUMN IF NOT EXISTS load_reporting_basis TEXT,
  ADD COLUMN IF NOT EXISTS duration_mode TEXT,
  ADD COLUMN IF NOT EXISTS completion_occurrence TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'challenge_activity_configs_pf03_code_check'
  ) THEN
    ALTER TABLE challenge_activity_configs
      ADD CONSTRAINT challenge_activity_configs_pf03_code_check CHECK (
        activity_code IS NULL
        OR activity_code ~ '^[A-Z]{3}-[A-Z]{3}-[0-9]{3}$'
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'challenge_activity_configs_pf03_relationship_check'
  ) THEN
    ALTER TABLE challenge_activity_configs
      ADD CONSTRAINT challenge_activity_configs_pf03_relationship_check CHECK (
        (component_relationship IS NULL AND required_components = '{}')
        OR (component_relationship = 'ALL_REQUIRED' AND required_components <> '{}')
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'challenge_activity_configs_pf03_basis_check'
  ) THEN
    ALTER TABLE challenge_activity_configs
      ADD CONSTRAINT challenge_activity_configs_pf03_basis_check CHECK (
        load_reporting_basis IS NULL
        OR (
          metric = 'weight'
          AND load_reporting_basis IN (
            'TOTAL_LOADED_IMPLEMENT',
            'PER_IMPLEMENT',
            'SINGLE_IMPLEMENT',
            'PER_SIDE',
            'MACHINE_DISPLAYED_LOAD'
          )
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'challenge_activity_configs_pf03_duration_check'
  ) THEN
    ALTER TABLE challenge_activity_configs
      ADD CONSTRAINT challenge_activity_configs_pf03_duration_check CHECK (
        duration_mode IS NULL
        OR (metric = 'duration' AND duration_mode IN ('CONTINUOUS', 'ACCUMULATED'))
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'challenge_activity_configs_pf03_occurrence_check'
  ) THEN
    ALTER TABLE challenge_activity_configs
      ADD CONSTRAINT challenge_activity_configs_pf03_occurrence_check CHECK (
        completion_occurrence IS NULL
        OR (metric = 'completion' AND char_length(completion_occurrence) BETWEEN 1 AND 500)
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS challenge_activity_configs_activity_code_idx
  ON challenge_activity_configs (activity_code);
