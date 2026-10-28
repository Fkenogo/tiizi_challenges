-- TIIZI-FER-P1B-001: member Interests and Goals (private relevance preferences).
--
-- Authority: Member Completion Founder Disposition 001 §5 (FD-MC-04b..e), §17.
-- - Member Interests are the governed 12 Focus Area concepts held as STABLE IDS
--   (never labels); Member Goals are the governed 9 Group Goal concepts (IDs).
-- - Interests 0..5, Goals 0..3. Empty is valid. Each side is independently
--   decided/skipped/cleared. No eligibility, access, membership or
--   participation effect of any kind (relevance only).
-- - Member-owned: one row per member; written only by that member's own
--   authenticated API call. Every change is append-only audited.
-- The allowed-ID lists are stable once published; adding or retiring concepts
-- is a governed vocabulary change and needs its own migration (KNW-04).

CREATE FUNCTION tiizi_text_array_is_set(items TEXT[]) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT cardinality(items) = cardinality(ARRAY(SELECT DISTINCT unnest(items)))
$$;

CREATE TABLE member_preferences (
  member_id UUID PRIMARY KEY REFERENCES members(member_id) ON DELETE RESTRICT,
  interest_ids TEXT[] NOT NULL DEFAULT '{}',
  goal_ids TEXT[] NOT NULL DEFAULT '{}',
  -- NULL = the member has not yet decided (saved or skipped) this side.
  -- Set on any save, including an explicit empty selection (a skip).
  interests_decided_at TIMESTAMPTZ,
  goals_decided_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT member_preferences_interest_ids_check CHECK (
    cardinality(interest_ids) <= 5
    AND tiizi_text_array_is_set(interest_ids)
    AND interest_ids <@ ARRAY[
      'strength', 'cardio_conditioning', 'mobility_flexibility', 'balance_stability',
      'power_speed_agility', 'sports_recreation', 'sleep_rest',
      'mind_emotional_wellbeing', 'nutrition_hydration', 'daily_living',
      'personal_growth', 'social_wellbeing'
    ]::text[]
  ),
  CONSTRAINT member_preferences_goal_ids_check CHECK (
    cardinality(goal_ids) <= 3
    AND tiizi_text_array_is_set(goal_ids)
    AND goal_ids <@ ARRAY[
      'manage_weight', 'build_strength', 'improve_endurance', 'improve_mobility',
      'improve_nutrition', 'improve_sleep', 'manage_stress', 'support_wellbeing',
      'build_consistency'
    ]::text[]
  )
);

-- Relevance reads (P2) intersect these arrays with Group metadata.
CREATE INDEX member_preferences_interest_ids_gin ON member_preferences USING GIN (interest_ids);
CREATE INDEX member_preferences_goal_ids_gin ON member_preferences USING GIN (goal_ids);

CREATE TABLE member_preference_events (
  event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE RESTRICT,
  actor_member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE RESTRICT,
  field TEXT NOT NULL,
  old_ids TEXT[] NOT NULL,
  new_ids TEXT[] NOT NULL,
  -- TRUE when the save only recorded the member's decision (e.g. a skip of an
  -- already-empty side) without changing the selection.
  decision_only BOOLEAN NOT NULL DEFAULT FALSE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  source TEXT NOT NULL DEFAULT 'member_self',
  CONSTRAINT member_preference_events_self_actor_check CHECK (actor_member_id = member_id),
  CONSTRAINT member_preference_events_field_check CHECK (field IN ('interests', 'goals')),
  CONSTRAINT member_preference_events_source_check CHECK (source = 'member_self'),
  CONSTRAINT member_preference_events_shape_check CHECK (
    decision_only OR old_ids IS DISTINCT FROM new_ids
  )
);

CREATE INDEX member_preference_events_member_idx
  ON member_preference_events (member_id, event_id);

CREATE FUNCTION tiizi_reject_member_preference_event_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'member preference events are append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER member_preference_events_append_only
  BEFORE UPDATE OR DELETE ON member_preference_events
  FOR EACH ROW EXECUTE FUNCTION tiizi_reject_member_preference_event_mutation();
