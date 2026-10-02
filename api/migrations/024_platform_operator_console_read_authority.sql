-- Bounded, read-only Platform Operator Console access.
--
-- The existing platform_operator_cause_reviewers roster remains the sole
-- authority for Social Cause decisions. This separate revocable roster grants
-- only read access to the Operator Console projections. It grants no writes.
-- Production receives no rows from this schema migration and fails closed.
CREATE TABLE IF NOT EXISTS platform_operator_console_readers (
  member_id UUID PRIMARY KEY REFERENCES members(member_id) ON DELETE RESTRICT,
  grant_reference TEXT NOT NULL CHECK (char_length(grant_reference) BETWEEN 1 AND 300),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  revoked_reference TEXT,
  CHECK ((revoked_at IS NULL AND revoked_reference IS NULL)
      OR (revoked_at IS NOT NULL AND char_length(btrim(revoked_reference)) > 0))
);
