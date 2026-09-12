-- EBC-04: Ending / Finalization / Rebuild / Stable History
-- (Engine Baseline Closure slice 4).
--
-- Distinguishes ENDING (ordinary activity acceptance stops) from
-- FINALIZATION (authoritative terminal derived state is computed once and
-- frozen as historical truth):
--
--   status = 'ended' + finalized_at IS NULL  → ended, not yet finalized;
--   status = 'ended' + finalized_at NOT NULL → finalized (historical).
--
-- No new lifecycle status is introduced: the existing terminal 'ended'
-- state keeps gating ordinary acceptance, and finalized_at marks the
-- frozen terminal result. The frozen result itself lives in two new
-- append-only tables (challenge-level + per-participation terminal truth)
-- guarded immutable, so ended/finalized history never depends on the
-- mutable live projection rows.
--
-- Additive only: one nullable mirror column, two new tables, guard
-- strengthening. No existing column is altered, no table is dropped, no
-- production data is rewritten. Pre-EBC-04 rows (including already-ended
-- Challenges) keep finalized_at NULL: they remain legacy/unfinalized until
-- explicitly processed — no historical finalization timestamps or results
-- are invented or backfilled here.
--
-- Standard PostgreSQL only. No Firebase/Firestore identifiers. No V1
-- migration. PRODUCTION SAFETY: development/shadow only until the later
-- cutover task applies it (same as 003/004/005/009/010/011).

-- 1. Finalization marker mirror. NULL = not finalized (active Challenges
-- and ended-but-unfinalized legacy rows). Set exactly once, only while the
-- Challenge is ended; write-once afterwards (guard below).
ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'challenges_finalized_check'
  ) THEN
    ALTER TABLE challenges
      ADD CONSTRAINT challenges_finalized_check CHECK (
        finalized_at IS NULL
        OR status = 'ended'
      );
  END IF;
END
$$;

-- 2. The lifecycle guard additionally pins finalization: finalized_at moves
-- NULL -> timestamp exactly once and only on an ended Challenge; it never
-- moves again and never clears. Status transitions are unchanged (ended
-- stays terminal; there is no reopen path).
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
  IF OLD.finalized_at IS NOT NULL AND OLD.finalized_at IS DISTINCT FROM NEW.finalized_at THEN
    RAISE EXCEPTION 'challenges: finalized_at is write-once (finalized history cannot be reopened)';
  END IF;
  IF NEW.finalized_at IS NOT NULL AND NEW.status <> 'ended' THEN
    RAISE EXCEPTION 'challenges: only an ended challenge can carry finalized_at';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Frozen challenge-level terminal result. One row per finalized
-- Challenge: identity/version references, finalization attribution, and the
-- type-specific terminal payload (collective aggregate, completion counts).
-- Per-participant terminal truth lives in challenge_participation_finals.
CREATE TABLE IF NOT EXISTS challenge_finalizations (
  challenge_id UUID PRIMARY KEY REFERENCES challenges (challenge_id) ON DELETE RESTRICT,
  challenge_type TEXT NOT NULL,
  -- Governing config version + timezone evaluated at finalization.
  config_version INTEGER NOT NULL,
  timezone TEXT NOT NULL,
  finalized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Provenance of the frozen computation (never re-interpreted later).
  finalization_version TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  scoring_version TEXT NOT NULL,
  -- Type-specific terminal payload (collective total/goal; completions).
  result JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT challenge_finalizations_type_check CHECK (
    challenge_type IN ('collective', 'competitive', 'streak')
  ),
  CONSTRAINT challenge_finalizations_version_check CHECK (config_version >= 1),
  CONSTRAINT challenge_finalizations_timezone_check CHECK (
    char_length(timezone) BETWEEN 1 AND 100
  ),
  CONSTRAINT challenge_finalizations_finalization_version_check CHECK (
    char_length(finalization_version) BETWEEN 1 AND 60
  ),
  CONSTRAINT challenge_finalizations_engine_check CHECK (engine_version = 'v2'),
  CONSTRAINT challenge_finalizations_scoring_version_check CHECK (
    char_length(scoring_version) BETWEEN 1 AND 60
  )
);

-- 4. Frozen per-participation terminal result. One row per finalized
-- episode: outcome attribution (completed or not, completion time),
-- type-specific terminal counters, and the frozen competitive finishing
-- position (NULL for non-completers and for non-competitive families —
-- streaks never carry rank).
CREATE TABLE IF NOT EXISTS challenge_participation_finals (
  participation_id UUID PRIMARY KEY
    REFERENCES challenge_participations (participation_id) ON DELETE RESTRICT,
  challenge_id UUID NOT NULL REFERENCES challenges (challenge_id) ON DELETE RESTRICT,
  member_id UUID NOT NULL REFERENCES members (member_id) ON DELETE RESTRICT,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  -- Streak terminal truth (0/NULL-equivalents for other families).
  days_completed INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  final_streak INTEGER NOT NULL DEFAULT 0,
  -- Competitive frozen finishing position (standard competition ranking;
  -- NULL when the episode did not complete or the family is not competitive).
  final_position INTEGER,
  finalized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT challenge_participation_finals_completed_at_check CHECK (
    (completed AND completed_at IS NOT NULL)
    OR (NOT completed AND completed_at IS NULL)
  ),
  CONSTRAINT challenge_participation_finals_streak_check CHECK (
    days_completed >= 0 AND best_streak >= 0 AND final_streak >= 0
  ),
  CONSTRAINT challenge_participation_finals_position_check CHECK (
    final_position IS NULL OR final_position >= 1
  )
);

CREATE INDEX IF NOT EXISTS challenge_participation_finals_challenge_idx
  ON challenge_participation_finals (challenge_id);

-- 5. Finalized history is immutable: no UPDATE, no DELETE on either final
-- table. A later correction authority (ACT-04, deferred) would arrive as a
-- new governed mechanism — never as a silent mutation here.
CREATE OR REPLACE FUNCTION challenge_finalizations_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'challenge_finalizations are frozen history: % is not permitted (challenge=%)',
    TG_OP, COALESCE(OLD.challenge_id, NEW.challenge_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS challenge_finalizations_no_mutation ON challenge_finalizations;
CREATE TRIGGER challenge_finalizations_no_mutation
  BEFORE UPDATE OR DELETE ON challenge_finalizations
  FOR EACH ROW EXECUTE FUNCTION challenge_finalizations_immutable();

CREATE OR REPLACE FUNCTION challenge_participation_finals_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'challenge_participation_finals are frozen history: % is not permitted (participation=%)',
    TG_OP, COALESCE(OLD.participation_id, NEW.participation_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS challenge_participation_finals_no_mutation ON challenge_participation_finals;
CREATE TRIGGER challenge_participation_finals_no_mutation
  BEFORE UPDATE OR DELETE ON challenge_participation_finals
  FOR EACH ROW EXECUTE FUNCTION challenge_participation_finals_immutable();
