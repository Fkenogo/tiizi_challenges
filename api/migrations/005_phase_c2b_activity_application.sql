-- Phase C2B: clean V2 Challenge activity application + Derived Truth.
--
-- Context: C1 established Member Activity Evidence (member_activity_events,
-- append-only, no Challenge ownership, no scoring). C2A established the
-- Challenge foundation (challenges + immutable challenge_config_versions +
-- challenge_activity_configs + episode-based challenge_participations).
-- C2B adds the first clean V2 activity runtime:
--
--   member_activity_events
--     -> challenge_activity_records   (THIS migration: exactly one accepted
--                                        Challenge application per Evidence)
--     -> engine application input     (existing provider-neutral engines)
--     -> Derived Truth                (THIS migration: server-owned,
--                                        recomputable outcome state)
--
-- Config-version-at-acceptance rule (founder-confirmable, see
-- api/src/challengeActivityApplication.ts): the governing configuration is
-- the challenge's CURRENT config version at acceptance time. The record
-- stores (challenge_id, config_version, activity_config_id) so the exact
-- immutable terms under which the Evidence was accepted and scored stay
-- identifiable forever. No effective-date ranges are invented: versions
-- carry only created_at, and challenges.current_config_version is the
-- schema's explicit current-governing pointer.
--
-- One Evidence -> one Challenge application: UNIQUE(event_id). A member who
-- wants the same real-world activity to count in two Challenges performs
-- two intentional logging actions (Stage F G.2: no automatic
-- cross-challenge attribution).
--
-- Derived Truth is server-owned and recomputable: it is derived ONLY from
-- accepted challenge_activity_records plus immutable configs. Clients never
-- author it (no route writes these tables). Corrections arrive as NEW
-- Evidence rows (C1 supersede chain, ACT-03/ACT-04 deferred); recomputation
-- replays effective (committed) records, so no historical application row
-- is ever mutated.
--
-- Standard PostgreSQL only. No Firebase/Firestore identifiers as domain
-- keys. No V1 migration: no workouts/wellnessLogs/challengeMembers columns
-- are referenced or copied.
--
-- PRODUCTION SAFETY: this migration is development/shadow only until the
-- later cutover task applies it. Do NOT apply 003/004/005 to production
-- outside that task.

-- ─── Challenge activity records (accepted applications) ─────────────────

CREATE TABLE IF NOT EXISTS challenge_activity_records (
  record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Exactly one application per Evidence event (no cross-challenge reuse).
  event_id UUID NOT NULL UNIQUE
    REFERENCES member_activity_events (event_id) ON DELETE RESTRICT,
  -- The single participation episode that owns the Evidence time
  -- ([joined_at, exited_at) contains event occurred_at; enforced below).
  participation_id UUID NOT NULL
    REFERENCES challenge_participations (participation_id) ON DELETE RESTRICT,
  challenge_id UUID NOT NULL
    REFERENCES challenges (challenge_id) ON DELETE RESTRICT,
  -- Stable application anchor: the exact configured activity within the
  -- exact governing version (C2A challenge_activity_configs).
  activity_config_id UUID NOT NULL
    REFERENCES challenge_activity_configs (activity_config_id) ON DELETE RESTRICT,
  -- Immutable governing version under which the Evidence was ACCEPTED
  -- and SCORED (current at acceptance; see header).
  config_version INTEGER NOT NULL,
  -- Acceptance (ledger) time. Ordering for replay: accepted_at, record_id.
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Accepted measurement snapshot (reproduces scoring without re-reading
  -- the event; the event row remains the Evidence authority).
  value DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL,
  occurred_day DATE NOT NULL,
  -- Server-owned scoring attribution (client points never accepted).
  points_awarded INTEGER NOT NULL,
  scoring_target_value DOUBLE PRECISION NOT NULL,
  scoring_method TEXT NOT NULL,
  scoring_version TEXT NOT NULL,
  engine_version TEXT NOT NULL DEFAULT 'v2',
  -- True when this accepted record triggered completion (first crossing).
  -- Later records never rewrite an earlier completion (immutability).
  completion_triggered BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT challenge_activity_records_version_check CHECK (config_version >= 1),
  CONSTRAINT challenge_activity_records_value_check CHECK (value >= 0),
  CONSTRAINT challenge_activity_records_unit_check CHECK (char_length(unit) BETWEEN 1 AND 40),
  CONSTRAINT challenge_activity_records_points_check CHECK (points_awarded >= 0),
  CONSTRAINT challenge_activity_records_scoring_target_check CHECK (scoring_target_value >= 0),
  CONSTRAINT challenge_activity_records_scoring_method_check CHECK (char_length(scoring_method) BETWEEN 1 AND 60),
  CONSTRAINT challenge_activity_records_scoring_version_check CHECK (char_length(scoring_version) BETWEEN 1 AND 60),
  CONSTRAINT challenge_activity_records_engine_check CHECK (engine_version = 'v2')
);

CREATE INDEX IF NOT EXISTS challenge_activity_records_challenge_idx
  ON challenge_activity_records (challenge_id);
CREATE INDEX IF NOT EXISTS challenge_activity_records_participation_idx
  ON challenge_activity_records (participation_id);
CREATE INDEX IF NOT EXISTS challenge_activity_records_activity_config_idx
  ON challenge_activity_records (activity_config_id);
CREATE INDEX IF NOT EXISTS challenge_activity_records_accepted_idx
  ON challenge_activity_records (challenge_id, accepted_at, record_id);

-- Accepted applications are immutable history: no UPDATE, no DELETE.
-- (Collective completion and derived updates live in the derived tables;
-- this table only ever grows.)
CREATE OR REPLACE FUNCTION challenge_activity_records_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'challenge_activity_records are accepted history: % is not permitted (record=%)',
    TG_OP, COALESCE(OLD.record_id, NEW.record_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS challenge_activity_records_no_mutation ON challenge_activity_records;
CREATE TRIGGER challenge_activity_records_no_mutation
  BEFORE UPDATE OR DELETE ON challenge_activity_records
  FOR EACH ROW EXECUTE FUNCTION challenge_activity_records_immutable();

-- Cross-entity consistency at insert time (fail closed):
-- 1. event/member matches participation/member;
-- 2. participation belongs to the record's challenge;
-- 3. activity_config belongs to the record's (challenge, config_version);
-- 4. event occurred_at falls inside the participation episode
--    [joined_at, exited_at) — never silently attached to the wrong episode.
CREATE OR REPLACE FUNCTION challenge_activity_records_check_consistency()
RETURNS trigger AS $$
DECLARE
  v_event_member UUID;
  v_event_at TIMESTAMPTZ;
  v_part_member UUID;
  v_part_challenge UUID;
  v_part_joined TIMESTAMPTZ;
  v_part_exited TIMESTAMPTZ;
  v_cfg_challenge UUID;
  v_cfg_version INTEGER;
BEGIN
  SELECT member_id, occurred_at INTO v_event_member, v_event_at
    FROM member_activity_events WHERE event_id = NEW.event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'challenge_activity_records: unknown event %', NEW.event_id;
  END IF;
  SELECT member_id, challenge_id, joined_at, exited_at
    INTO v_part_member, v_part_challenge, v_part_joined, v_part_exited
    FROM challenge_participations WHERE participation_id = NEW.participation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'challenge_activity_records: unknown participation %', NEW.participation_id;
  END IF;
  IF v_event_member IS DISTINCT FROM v_part_member THEN
    RAISE EXCEPTION 'challenge_activity_records: event member % does not match participation member %',
      v_event_member, v_part_member;
  END IF;
  IF v_part_challenge IS DISTINCT FROM NEW.challenge_id THEN
    RAISE EXCEPTION 'challenge_activity_records: participation belongs to challenge %, not %',
      v_part_challenge, NEW.challenge_id;
  END IF;
  SELECT challenge_id, version INTO v_cfg_challenge, v_cfg_version
    FROM challenge_activity_configs WHERE activity_config_id = NEW.activity_config_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'challenge_activity_records: unknown activity_config %', NEW.activity_config_id;
  END IF;
  IF v_cfg_challenge IS DISTINCT FROM NEW.challenge_id
     OR v_cfg_version IS DISTINCT FROM NEW.config_version THEN
    RAISE EXCEPTION 'challenge_activity_records: activity_config belongs to (challenge %, version %), not (challenge %, version %)',
      v_cfg_challenge, v_cfg_version, NEW.challenge_id, NEW.config_version;
  END IF;
  IF NOT (v_event_at >= v_part_joined
          AND (v_part_exited IS NULL OR v_event_at < v_part_exited)) THEN
    RAISE EXCEPTION 'challenge_activity_records: event time % is outside participation episode [%, %)',
      v_event_at, v_part_joined, v_part_exited;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS challenge_activity_records_consistency ON challenge_activity_records;
CREATE TRIGGER challenge_activity_records_consistency
  BEFORE INSERT ON challenge_activity_records
  FOR EACH ROW EXECUTE FUNCTION challenge_activity_records_check_consistency();

-- ─── Participation-derived truth (per-episode outcome state) ─────────────
--
-- One row per participation episode. Server-owned: written ONLY by the
-- transactional logging seam (and full rebuilds by the recompute seam).
-- Recomputable from accepted records + immutable configs; never Evidence,
-- never identity. Completion is first-write-wins (completed_at never moves
-- once set; later records cannot rewrite it).

CREATE TABLE IF NOT EXISTS challenge_participation_derived (
  participation_id UUID PRIMARY KEY
    REFERENCES challenge_participations (participation_id) ON DELETE RESTRICT,
  challenge_id UUID NOT NULL REFERENCES challenges (challenge_id) ON DELETE RESTRICT,
  member_id UUID NOT NULL REFERENCES members (member_id) ON DELETE RESTRICT,
  -- Volume counters (all families).
  logs_accepted INTEGER NOT NULL DEFAULT 0,
  distinct_days INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  -- Engine-reported rate (approved engine output, persisted verbatim).
  completion_rate INTEGER NOT NULL DEFAULT 0,
  -- Per-activity cumulative values, keyed by STABLE canonical activity
  -- identity (canonical_key + variant), NOT by per-version activity_config_id:
  -- versions mint new config rows, so per-row keys would silently reset
  -- cumulative progress on any config change (even a pure extension, whose
  -- history is preserved). The record's activity_config_id stays the pinned
  -- application anchor; these keys stay comparable across versions.
  -- (competitive completion + collective per-member contribution).
  cumulative_values JSONB NOT NULL DEFAULT '{}',
  cumulative_total DOUBLE PRECISION NOT NULL DEFAULT 0,
  -- Streak state (meaningful for streak challenges; defaults otherwise).
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  last_completed_day DATE,
  -- Days with accepted logs: { "YYYY-MM-DD": {"complete": bool, "activities": [...] } }.
  -- Streak "complete" requires ALL governing-version requirements Done.
  day_states JSONB NOT NULL DEFAULT '{}',
  -- Streak truthful counters: completed Challenge days (all-requirements
  -- met) over the full configured period (late joining never redefines it).
  days_completed INTEGER NOT NULL DEFAULT 0,
  -- Completion outcome (first-write-wins).
  completion_status TEXT NOT NULL DEFAULT 'in_progress',
  completed_at TIMESTAMPTZ,
  engine_version TEXT NOT NULL DEFAULT 'v2',
  scoring_version TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT challenge_participation_derived_counters_check CHECK (
    logs_accepted >= 0 AND distinct_days >= 0 AND total_points >= 0
    AND days_completed >= 0 AND current_streak >= 0 AND best_streak >= 0
  ),
  CONSTRAINT challenge_participation_derived_rate_check CHECK (
    completion_rate >= 0 AND completion_rate <= 100
  ),
  CONSTRAINT challenge_participation_derived_total_check CHECK (cumulative_total >= 0),
  CONSTRAINT challenge_participation_derived_completion_check CHECK (
    completion_status IN ('in_progress', 'completed')
  ),
  CONSTRAINT challenge_participation_derived_completed_at_check CHECK (
    (completion_status = 'completed' AND completed_at IS NOT NULL)
    OR (completion_status = 'in_progress' AND completed_at IS NULL)
  ),
  CONSTRAINT challenge_participation_derived_engine_check CHECK (engine_version = 'v2'),
  CONSTRAINT challenge_participation_derived_scoring_version_check CHECK (
    char_length(scoring_version) BETWEEN 1 AND 60
  )
);

CREATE INDEX IF NOT EXISTS challenge_participation_derived_challenge_idx
  ON challenge_participation_derived (challenge_id);
CREATE INDEX IF NOT EXISTS challenge_participation_derived_member_idx
  ON challenge_participation_derived (member_id);

-- Derived state is recomputed, never client-edited: rows are created by the
-- seam and updated by the seam; DELETE would destroy recomputable history.
CREATE OR REPLACE FUNCTION challenge_participation_derived_no_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'challenge_participation_derived is recomputable outcome state: DELETE is not permitted (participation=%)',
    OLD.participation_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS challenge_participation_derived_no_delete ON challenge_participation_derived;
CREATE TRIGGER challenge_participation_derived_no_delete
  BEFORE DELETE ON challenge_participation_derived
  FOR EACH ROW EXECUTE FUNCTION challenge_participation_derived_no_delete();

-- ─── Challenge-level derived truth (collective pool + aggregates) ────────
--
-- One row per challenge. collective_total is the exact sum of accepted
-- record values (full crossing contribution retained; overshoot truthful).
-- completions_count counts completed participations (all families).

CREATE TABLE IF NOT EXISTS challenge_derived_state (
  challenge_id UUID PRIMARY KEY REFERENCES challenges (challenge_id) ON DELETE RESTRICT,
  challenge_type TEXT NOT NULL,
  -- Collective pool: exact sum of accepted values (never truncated).
  collective_total DOUBLE PRECISION NOT NULL DEFAULT 0,
  collective_goal_reached BOOLEAN NOT NULL DEFAULT FALSE,
  goal_completed_at TIMESTAMPTZ,
  completions_count INTEGER NOT NULL DEFAULT 0,
  engine_version TEXT NOT NULL DEFAULT 'v2',
  scoring_version TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT challenge_derived_state_type_check CHECK (
    challenge_type IN ('collective', 'competitive', 'streak')
  ),
  CONSTRAINT challenge_derived_state_total_check CHECK (collective_total >= 0),
  CONSTRAINT challenge_derived_state_goal_check CHECK (
    (collective_goal_reached AND goal_completed_at IS NOT NULL)
    OR (NOT collective_goal_reached AND goal_completed_at IS NULL)
  ),
  CONSTRAINT challenge_derived_state_completions_check CHECK (completions_count >= 0),
  CONSTRAINT challenge_derived_state_engine_check CHECK (engine_version = 'v2'),
  CONSTRAINT challenge_derived_state_scoring_version_check CHECK (
    char_length(scoring_version) BETWEEN 1 AND 60
  )
);

CREATE OR REPLACE FUNCTION challenge_derived_state_no_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'challenge_derived_state is recomputable outcome state: DELETE is not permitted (challenge=%)',
    OLD.challenge_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS challenge_derived_state_no_delete ON challenge_derived_state;
CREATE TRIGGER challenge_derived_state_no_delete
  BEFORE DELETE ON challenge_derived_state
  FOR EACH ROW EXECUTE FUNCTION challenge_derived_state_no_delete();
