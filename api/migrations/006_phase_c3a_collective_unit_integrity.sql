-- Phase C3A: collective-unit configuration integrity (database defence).
--
-- Context: a collective Challenge pools raw activity values into one
-- unit-blind total compared against goal_unit (see
-- api/src/derivedTruth.ts applyAcceptedRecord). The domain invariant (Phase
-- C3A, api/src/challengeConfigs.ts assertCollectiveUnitHomogeneity) requires
-- EVERY configured collective activity unit to exactly equal goal_unit; no
-- conversion or equivalence is inferred.
--
-- Why a trigger here is clean (not brittle JSON logic):
-- - The immutable version snapshot (challenge_config_versions.snapshot) is
--   the authority for a version, and it is inserted BEFORE its activity rows
--   by insertConfigVersion — so a BEFORE INSERT row trigger can always read
--   the governing (challenge_type, goal_unit) for (challenge_id, version).
-- - Normalized activity rows carry one scalar `unit` each: the check is a
--   scalar equality against snapshot type_params.goal_unit, using only two
--   stable snapshot keys owned by this codebase (challenge_type,
--   type_params.goal_unit). No deep activity-array parsing is duplicated.
-- - Transitivity does the rest: every row must equal goal_unit, so mixed
--   activity units (minutes + repetitions) are rejected row by row without
--   ever comparing siblings.
-- - Versioning order is irrelevant: the trigger reads the row's OWN version
--   snapshot, not the mutable challenges mirror — so later-version inserts
--   are checked against their own version's terms regardless of when the
--   challenges.goal_unit mirror column is updated.
-- - No trigger on challenges.goal_unit updates is needed or wanted: old
--   version rows remain historically valid under their own version's goal,
--   and the challenges mirror only ever moves together with a new version
--   (whose rows are checked here).
-- - Competitive/streak rows pass through untouched (per-activity units are
--   never pooled).
--
-- Standard PostgreSQL only. Additive: one function + one trigger, no table
-- changes, no backfill. Existing valid rows are unaffected (triggers fire on
-- INSERT only).
--
-- PRODUCTION SAFETY: development/shadow only until the cutover task applies
-- the 003/004/005/006 chain. Do NOT apply to production outside that task.

CREATE OR REPLACE FUNCTION challenge_activity_configs_collective_unit_check()
RETURNS trigger AS $$
DECLARE
  v_challenge_type TEXT;
  v_goal_unit TEXT;
BEGIN
  SELECT snapshot->>'challenge_type', snapshot->'type_params'->>'goal_unit'
    INTO v_challenge_type, v_goal_unit
    FROM challenge_config_versions
   WHERE challenge_id = NEW.challenge_id AND version = NEW.version;
  IF v_challenge_type = 'collective'
    AND (v_goal_unit IS NULL OR NEW.unit <> v_goal_unit) THEN
    RAISE EXCEPTION
      'collective activity unit (%) must exactly equal goal_unit (%) (challenge=%, version=%)',
      NEW.unit, v_goal_unit, NEW.challenge_id, NEW.version;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS challenge_activity_configs_collective_unit_check
  ON challenge_activity_configs;
CREATE TRIGGER challenge_activity_configs_collective_unit_check
  BEFORE INSERT ON challenge_activity_configs
  FOR EACH ROW EXECUTE FUNCTION challenge_activity_configs_collective_unit_check();
