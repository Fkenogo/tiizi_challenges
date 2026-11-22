-- CF-2 (S1 scope only): Challenge-scoped Activity Share publication state.
--
-- CF-01 v0.2 §8 direction: own tables, NEVER group_feed_*; references and
-- minimal state, not copies of evidence or names — display names and
-- Activity data are resolved at read time from canonical truth. This
-- migration stores only the explicit member Share decision and its
-- source references. It does not touch Group Feed storage or policy.
--
-- Like the GF-02 outbox (migration 025), these rows deliberately carry NO
-- foreign keys into canonical domain tables: a Feed projection row must
-- never be able to fail or block a source-truth write, and the source
-- tables stay truncatable independently of Feed state. Source integrity is
-- enforced by the publication authority (challengeFeedShares.ts), not by
-- database-level coupling.
--
-- Approved event family in this package: S1 'activity_share' only
-- (accepted participant Activity). A1–A6 automatic moments, S2 Streak
-- milestones, S3 Race results, Kudos and announcements are NOT
-- implemented here and must not be inferred from this schema.

CREATE TABLE challenge_feed_shares (
  share_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL,
  member_id UUID NOT NULL,
  -- S1 source identity: the accepted Activity event — the same identity the
  -- owner's Personal Activity History exposes — plus its governed Challenge
  -- application record (audit pin; never a copy of evidence values).
  activity_event_id UUID NOT NULL,
  activity_record_id UUID NOT NULL,
  event_family TEXT NOT NULL CHECK (event_family = 'activity_share'),
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The explicit member choice that produced the current active Share.
  -- Retries of the SAME choice carry the same key and converge without
  -- re-publishing; a NEW choice mints a new key. A delayed retry of an
  -- earlier acknowledged choice can never silently undo a later withdrawal
  -- (the full acknowledged-key history lives in
  -- challenge_feed_share_choices below).
  last_publish_key TEXT,
  -- Withdrawal by the sharer hides the Share (CF-01 §6.1): canonical
  -- Activity evidence, score, progress and results are never altered.
  withdrawn_at TIMESTAMPTZ,
  -- Operator suppression/takedown is a projection-only control reserved for
  -- the later CF packages; the read contract already respects it.
  suppressed_at TIMESTAMPTZ,
  suppression_reason_code TEXT CHECK (suppression_reason_code IS NULL OR suppression_reason_code IN (
    'source_invalidated', 'source_corrected', 'visibility_invalidated',
    'duplicate_projection', 'invalid_projection', 'system_safety'
  )),
  -- One Share row per member per source Activity, ever: withdrawal and
  -- re-Sharing revive the same auditable row.
  CONSTRAINT challenge_feed_shares_source_uq UNIQUE (member_id, activity_event_id),
  CONSTRAINT challenge_feed_shares_suppression_ck CHECK (
    (suppressed_at IS NULL AND suppression_reason_code IS NULL)
    OR (suppressed_at IS NOT NULL AND suppression_reason_code IS NOT NULL)
  )
);

-- CF-01 §6.1: at most one ACTIVE Share per member per source item.
CREATE UNIQUE INDEX challenge_feed_shares_active_uq
  ON challenge_feed_shares (member_id, activity_event_id)
  WHERE withdrawn_at IS NULL AND suppressed_at IS NULL;

CREATE INDEX challenge_feed_shares_challenge_order_idx
  ON challenge_feed_shares (challenge_id, published_at DESC, share_id DESC)
  WHERE withdrawn_at IS NULL AND suppressed_at IS NULL;

-- Every acknowledged publication request key, per Share row. Publication
-- replays are refused against this history: a request key that was EVER
-- acknowledged while the Share was active can never silently re-publish
-- the Share after a later withdrawal — only a genuinely fresh choice key
-- (minted by a new explicit confirm) revives it.
CREATE TABLE challenge_feed_share_choices (
  share_id UUID NOT NULL,
  client_key TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT challenge_feed_share_choices_pk PRIMARY KEY (share_id, client_key)
);
