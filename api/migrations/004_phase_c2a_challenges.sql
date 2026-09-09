-- Phase C2A: clean V2 Challenge + Participation domain foundation.
--
-- Context: C1 established Member Activity Evidence (member_activity_events).
-- C2A adds the Challenge domain that C2B application
-- (challenge_activity_records) and Derived Truth will build on. C2A does NOT
-- implement application records, scoring execution, derived truth,
-- leaderboards, recognition, or any V1 migration.
--
-- Authority: Stage F Product Definition (draft, consolidating
-- founder-approved baselines) + challenge-data-model + wellness framework.
-- Challenge belongs to exactly one Group for life (non-transferable);
-- Participation requires affirmative joining; withdrawal and authorized
-- removal are distinguishable and preserve history; lifecycle is
-- establishment -> active -> ended with no same-identity reopening;
-- extension (active-only, identity-preserving) differs from run-again
-- (new identity).
--
-- Reproducibility invariant: the exact Challenge activity/configuration
-- version under which Evidence is accepted/scored must be identifiable.
-- Governing configuration therefore lives in immutable version snapshots
-- (challenge_config_versions + challenge_activity_configs); mutable current
-- columns on challenges may change ONLY together with a version bump
-- (enforced by the guard trigger below). Descriptive fields (title,
-- description, instructions) are non-governing and freely mutable.
--
-- Standard PostgreSQL only. No Firebase/Firestore identifiers as domain
-- keys: all identities are Tiizi UUIDs. groups/members already exist in
-- PostgreSQL (Phase A/B); challenges reference them directly — no new
-- Group migration in this task.
--
-- TRANSITIONAL GROUP INVARIANT (explicit): the FK challenges.group_id ->
-- groups makes the PG Group UUID the referential anchor, but Group
-- operational authority still lives in Firestore (the PG row is a shadow
-- refreshed only on import runs, and deleted Firestore groups leave stale
-- rows behind). A stale shadow row alone must therefore never grant
-- authority to establish a Challenge: the creation seam requires an
-- injected current-authority group check, which the later Group-authority
-- migration removes. The FK stays; only the validation provenance moves.

CREATE TABLE IF NOT EXISTS challenges (
  challenge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups (group_id) ON DELETE RESTRICT,
  created_by_member_id UUID NOT NULL REFERENCES members (member_id) ON DELETE RESTRICT,
  challenge_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'establishment',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  current_config_version INTEGER NOT NULL DEFAULT 1,
  -- Collective-only governing params (NULL for other types).
  goal_value DOUBLE PRECISION,
  goal_unit TEXT,
  -- Streak-only governing params.
  required_consecutive_days INTEGER,
  reset_on_miss BOOLEAN NOT NULL DEFAULT TRUE,
  activated_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT challenges_type_check CHECK (challenge_type IN ('collective', 'competitive', 'streak')),
  CONSTRAINT challenges_status_check CHECK (status IN ('establishment', 'active', 'ended')),
  CONSTRAINT challenges_title_check CHECK (char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT challenges_period_check CHECK (end_date >= start_date),
  CONSTRAINT challenges_version_check CHECK (current_config_version >= 1),
  CONSTRAINT challenges_collective_params_check CHECK (
    (challenge_type = 'collective' AND goal_value IS NOT NULL AND goal_value > 0
      AND goal_unit IS NOT NULL AND char_length(goal_unit) BETWEEN 1 AND 40
      AND required_consecutive_days IS NULL)
    OR (challenge_type <> 'collective' AND goal_value IS NULL AND goal_unit IS NULL)
  ),
  CONSTRAINT challenges_streak_params_check CHECK (
    (challenge_type = 'streak' AND required_consecutive_days IS NOT NULL
      AND required_consecutive_days >= 1)
    OR (challenge_type <> 'streak' AND required_consecutive_days IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS challenges_group_idx ON challenges (group_id);
CREATE INDEX IF NOT EXISTS challenges_status_idx ON challenges (status);
CREATE INDEX IF NOT EXISTS challenges_type_idx ON challenges (challenge_type);

-- Challenge lifecycle + governing-config guard.
-- - Identity/governance columns (group_id, challenge_type, created_by,
--   created_at) are immutable.
-- - Status may move establishment -> active -> ended, or
--   establishment -> ended. Ended is terminal; active never returns to
--   establishment.
-- - Governing evaluation columns (period, type params) may change ONLY in
--   the same UPDATE that bumps current_config_version (i.e. via a versioned
--   config change, never silently).
-- - DELETE is never permitted: ended Challenges are historical records.
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
      OR OLD.reset_on_miss IS DISTINCT FROM NEW.reset_on_miss)
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

DROP TRIGGER IF EXISTS challenges_no_bad_mutation ON challenges;
CREATE TRIGGER challenges_no_bad_mutation
  BEFORE UPDATE OR DELETE ON challenges
  FOR EACH ROW EXECUTE FUNCTION challenges_guard_mutation();

-- Immutable governing-configuration snapshots. Version 1 is written
-- atomically with the challenge row; later versions arrive only through
-- versioned config changes. Rows are append-only.
CREATE TABLE IF NOT EXISTS challenge_config_versions (
  challenge_id UUID NOT NULL REFERENCES challenges (challenge_id) ON DELETE RESTRICT,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT challenge_config_versions_pkey PRIMARY KEY (challenge_id, version),
  CONSTRAINT challenge_config_versions_version_check CHECK (version >= 1)
);

CREATE OR REPLACE FUNCTION challenge_config_versions_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'challenge_config_versions are append-only (challenge=%, version=%)',
    COALESCE(OLD.challenge_id, NEW.challenge_id), COALESCE(OLD.version, NEW.version);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS challenge_config_versions_no_mutation ON challenge_config_versions;
CREATE TRIGGER challenge_config_versions_no_mutation
  BEFORE UPDATE OR DELETE ON challenge_config_versions
  FOR EACH ROW EXECUTE FUNCTION challenge_config_versions_immutable();

-- Normalized per-activity configuration rows. The version snapshot is the
-- authority; these rows are its queryable projection (C2B joins here).
-- activity_config_id is the stable handle a future
-- challenge_activity_record references to identify the exact
-- activity/configuration version.
CREATE TABLE IF NOT EXISTS challenge_activity_configs (
  activity_config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL,
  version INTEGER NOT NULL,
  canonical_key TEXT NOT NULL,
  activity_variant TEXT,
  knowledge_id UUID NOT NULL REFERENCES knowledge_items (knowledge_id) ON DELETE RESTRICT,
  knowledge_version INTEGER NOT NULL,
  target_value DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL,
  position INTEGER NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT challenge_activity_configs_version_fk
    FOREIGN KEY (challenge_id, version)
    REFERENCES challenge_config_versions (challenge_id, version) ON DELETE RESTRICT,
  CONSTRAINT challenge_activity_configs_key_check CHECK (char_length(canonical_key) BETWEEN 1 AND 200),
  CONSTRAINT challenge_activity_configs_variant_check CHECK (activity_variant IS NULL OR char_length(activity_variant) BETWEEN 1 AND 120),
  CONSTRAINT challenge_activity_configs_knowledge_version_check CHECK (knowledge_version >= 1),
  CONSTRAINT challenge_activity_configs_target_check CHECK (target_value >= 0),
  CONSTRAINT challenge_activity_configs_unit_check CHECK (char_length(unit) BETWEEN 1 AND 40),
  CONSTRAINT challenge_activity_configs_position_check CHECK (position >= 0)
);

-- One row per (challenge, version, activity, variant): NULL variant means
-- the config accepts any variant of the canonical activity at C2B time.
CREATE UNIQUE INDEX IF NOT EXISTS challenge_activity_configs_unique_idx
  ON challenge_activity_configs (challenge_id, version, canonical_key, COALESCE(activity_variant, ''));
CREATE INDEX IF NOT EXISTS challenge_activity_configs_challenge_idx
  ON challenge_activity_configs (challenge_id, version);
CREATE INDEX IF NOT EXISTS challenge_activity_configs_knowledge_idx
  ON challenge_activity_configs (knowledge_id);

CREATE OR REPLACE FUNCTION challenge_activity_configs_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'challenge_activity_configs are append-only (config=%)',
    COALESCE(OLD.activity_config_id, NEW.activity_config_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS challenge_activity_configs_no_mutation ON challenge_activity_configs;
CREATE TRIGGER challenge_activity_configs_no_mutation
  BEFORE UPDATE OR DELETE ON challenge_activity_configs
  FOR EACH ROW EXECUTE FUNCTION challenge_activity_configs_immutable();

-- Explicit Challenge Participation, modeled as EPISODES. One row per
-- (challenge, member, join): an episode runs joined_at -> exited_at.
-- No authoritative rule bars re-entry after exit (Stage F ends *active*
-- participation on exit and preserves history; it never imposes permanent
-- exclusion), so the model permits a later episode while making simultaneous
-- active episodes impossible (partial unique index below). MVP UI need not
-- expose rejoining, and no reinstatement policy is invented here.
-- States: active (may log) | withdrawn (voluntary exit) | removed
-- (authorized removal; actor recorded). Completion is a Derived Truth
-- outcome (C2B), never a participation state. C2B evaluates eligibility at
-- occurred_at per episode interval; exited episodes stay historical.
CREATE TABLE IF NOT EXISTS challenge_participations (
  participation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges (challenge_id) ON DELETE RESTRICT,
  member_id UUID NOT NULL REFERENCES members (member_id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_config_version INTEGER NOT NULL,
  exited_at TIMESTAMPTZ,
  exit_reason TEXT,
  exited_by_member_id UUID REFERENCES members (member_id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT challenge_participations_status_check CHECK (status IN ('active', 'withdrawn', 'removed')),
  CONSTRAINT challenge_participations_joined_version_check CHECK (joined_config_version >= 1),
  CONSTRAINT challenge_participations_exit_check CHECK (
    (status = 'active' AND exited_at IS NULL AND exit_reason IS NULL)
    OR (status IN ('withdrawn', 'removed') AND exited_at IS NOT NULL
        AND exit_reason IN ('withdrawn', 'removed'))
  )
);

-- One ACTIVE episode per (challenge, member). Closed episodes never block a
-- later episode; simultaneous active episodes are impossible by constraint.
CREATE UNIQUE INDEX IF NOT EXISTS challenge_participations_one_active_idx
  ON challenge_participations (challenge_id, member_id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS challenge_participations_challenge_idx ON challenge_participations (challenge_id);
CREATE INDEX IF NOT EXISTS challenge_participations_member_idx ON challenge_participations (member_id);

-- Participation guard: identity immutable; only active -> exited transitions;
-- exit columns paired with exited status; history is never rewritten.
CREATE OR REPLACE FUNCTION challenge_participations_guard_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'challenge_participations are historical records: DELETE is not permitted';
  END IF;
  IF OLD.challenge_id IS DISTINCT FROM NEW.challenge_id
     OR OLD.member_id IS DISTINCT FROM NEW.member_id
     OR OLD.joined_at IS DISTINCT FROM NEW.joined_at
     OR OLD.joined_config_version IS DISTINCT FROM NEW.joined_config_version THEN
    RAISE EXCEPTION 'challenge_participations: identity/join attribution is immutable';
  END IF;
  IF NOT (
    (OLD.status = 'active' AND NEW.status IN ('active', 'withdrawn', 'removed'))
    OR (OLD.status IN ('withdrawn', 'removed') AND NEW.status = OLD.status)
  ) THEN
    RAISE EXCEPTION 'challenge_participations: illegal transition % -> % (exits are terminal, no reactivation)',
      OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS challenge_participations_no_bad_mutation ON challenge_participations;
CREATE TRIGGER challenge_participations_no_bad_mutation
  BEFORE UPDATE OR DELETE ON challenge_participations
  FOR EACH ROW EXECUTE FUNCTION challenge_participations_guard_mutation();
