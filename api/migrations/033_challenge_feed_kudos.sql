-- CF-3 (S1 scope) — single-type Kudos on Challenge Feed Activity Shares.
--
-- CF-01 v0.2 §6.2 (Founder-approved before pilot): one Kudos type only; one
-- active Kudos per member per Feed item; toggle off supported; the
-- aggregate count is visible to viewers with the giver seeing their own
-- active/inactive state; NO public list of givers; never affects ranking,
-- recommendation, status, progress, results or Recognition.
--
-- Like the Share tables (migration 032), Kudos rows deliberately carry NO
-- foreign keys into canonical domain tables and no member names: references
-- only, resolved at read time, so engagement can never fail or block a
-- source-truth write.

CREATE TABLE challenge_feed_kudos (
  kudos_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID NOT NULL,
  member_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One active Kudos per member per Feed entry (CF-01 §6.2).
  CONSTRAINT challenge_feed_kudos_member_uq UNIQUE (share_id, member_id)
);

CREATE INDEX challenge_feed_kudos_share_idx ON challenge_feed_kudos (share_id);

-- Serves the per-member sliding-window rate check (CF-01 §6.2 abuse
-- protection) and future per-member maintenance.
CREATE INDEX challenge_feed_kudos_member_recent_idx
  ON challenge_feed_kudos (member_id, created_at);
