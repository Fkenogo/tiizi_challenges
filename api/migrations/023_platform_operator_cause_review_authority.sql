-- Narrow Platform Operator capability for deciding Challenge Social Causes.
-- Grants are provisioned out-of-band by governed operations tooling; there
-- is intentionally no self-service or member-facing role assignment route.
CREATE TABLE IF NOT EXISTS platform_operator_cause_reviewers (
  member_id UUID PRIMARY KEY REFERENCES members(member_id) ON DELETE RESTRICT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  grant_reference TEXT NOT NULL CHECK (char_length(btrim(grant_reference)) BETWEEN 8 AND 240),
  revoked_at TIMESTAMPTZ,
  revoked_reference TEXT,
  CHECK ((revoked_at IS NULL AND revoked_reference IS NULL)
      OR (revoked_at IS NOT NULL AND revoked_reference IS NOT NULL
          AND char_length(btrim(revoked_reference)) BETWEEN 8 AND 240))
);
