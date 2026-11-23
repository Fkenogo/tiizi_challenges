-- CF-2 S1 replay-safety correction: monotonic per-Share generation counter.
--
-- Time- and count-bounded pruning of challenge_feed_share_choices keeps
-- storage bounded, but pruning alone cannot prevent an older acknowledged
-- choice key from silently reviving a withdrawn Share once its key is pruned.
-- Tracking a monotonic share_generation on challenge_feed_shares (incremented
-- on every withdrawal and every revival) ensures any stale request from an
-- earlier generation is permanently refused regardless of key pruning.

ALTER TABLE challenge_feed_shares
  ADD COLUMN share_generation INTEGER NOT NULL DEFAULT 1
  CHECK (share_generation >= 1);
