-- GF-02: PostgreSQL-native, subordinate Group Feed publication authority.
-- These rows record only allow-listed source transition identity. They do
-- not duplicate Challenge/Product Truth or member-facing card content.

CREATE TABLE group_feed_outbox (
  outbox_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type = 'challenge'),
  source_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'challenge_established', 'challenge_started', 'together_goal_achieved',
    'challenge_ended', 'challenge_finalized'
  )),
  source_transition_version INTEGER NOT NULL CHECK (source_transition_version >= 1),
  contract_version INTEGER NOT NULL CHECK (contract_version = 1),
  source_transition_at TIMESTAMPTZ NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'projected', 'blocked', 'suppressed', 'expired'
  )),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_until TIMESTAMPTZ,
  last_error_code TEXT CHECK (last_error_code IS NULL OR char_length(last_error_code) <= 64),
  last_error_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  CONSTRAINT group_feed_outbox_source_transition_uq UNIQUE
    (source_type, source_id, event_type, source_transition_version),
  CONSTRAINT group_feed_outbox_id_group_uq UNIQUE (outbox_id, group_id),
  CONSTRAINT group_feed_outbox_claim_state_ck CHECK (
    (status = 'processing' AND claimed_until IS NOT NULL)
    OR (status <> 'processing' AND claimed_until IS NULL)
  ),
  CONSTRAINT group_feed_outbox_expiry_state_ck CHECK (
    (status = 'expired' AND expired_at IS NOT NULL)
    OR (status <> 'expired' AND expired_at IS NULL)
  )
);

CREATE INDEX group_feed_outbox_due_idx
  ON group_feed_outbox (next_attempt_at, created_at, outbox_id)
  WHERE status IN ('pending', 'processing');

CREATE TABLE group_feed_projection (
  feed_event_id UUID PRIMARY KEY,
  group_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type = 'challenge'),
  source_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'challenge_established', 'challenge_started', 'together_goal_achieved',
    'challenge_ended', 'challenge_finalized'
  )),
  source_transition_version INTEGER NOT NULL CHECK (source_transition_version >= 1),
  contract_version INTEGER NOT NULL CHECK (contract_version = 1),
  source_transition_at TIMESTAMPTZ NOT NULL,
  projected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  suppressed_at TIMESTAMPTZ,
  suppression_reason_code TEXT CHECK (suppression_reason_code IS NULL OR suppression_reason_code IN (
    'source_invalidated', 'source_corrected', 'visibility_invalidated',
    'duplicate_projection', 'invalid_projection', 'system_safety'
  )),
  CONSTRAINT group_feed_projection_group_event_uq UNIQUE (feed_event_id, group_id),
  CONSTRAINT group_feed_projection_transition_uq UNIQUE
    (source_type, source_id, event_type, source_transition_version),
  CONSTRAINT group_feed_projection_outbox_fk FOREIGN KEY (feed_event_id, group_id)
    REFERENCES group_feed_outbox (outbox_id, group_id) ON DELETE RESTRICT,
  CONSTRAINT group_feed_projection_suppression_ck CHECK (
    (suppressed_at IS NULL AND suppression_reason_code IS NULL)
    OR (suppressed_at IS NOT NULL AND suppression_reason_code IS NOT NULL)
  )
);

CREATE INDEX group_feed_projection_group_order_idx
  ON group_feed_projection (group_id, source_transition_at DESC, feed_event_id DESC)
  WHERE suppressed_at IS NULL;
CREATE INDEX group_feed_projection_expiry_idx
  ON group_feed_projection (source_transition_at, feed_event_id);

-- Actions retain only a system actor kind and fixed reason code. There is no
-- human actor reference or privileged invocation pathway in GF-02.
CREATE TABLE group_feed_projection_actions (
  action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_event_id UUID NOT NULL,
  group_id UUID NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('suppressed', 'restored', 'purged')),
  reason_code TEXT NOT NULL CHECK (reason_code IN (
    'source_invalidated', 'source_corrected', 'visibility_invalidated',
    'duplicate_projection', 'invalid_projection', 'system_safety', 'retention_90_days'
  )),
  actor_kind TEXT NOT NULL DEFAULT 'system' CHECK (actor_kind = 'system'),
  acted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT group_feed_projection_actions_outbox_fk FOREIGN KEY (feed_event_id, group_id)
    REFERENCES group_feed_outbox (outbox_id, group_id) ON DELETE RESTRICT
);

CREATE INDEX group_feed_projection_actions_event_idx
  ON group_feed_projection_actions (feed_event_id, acted_at);
