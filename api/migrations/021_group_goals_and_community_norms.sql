-- V2 Group outcome goals and member-facing community norm selections.
-- Defaults preserve every existing Group and keep these fields separate from
-- Activity identity, Focus Areas, and governed Challenge settings.
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS goal_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS custom_goal TEXT,
  ADD COLUMN IF NOT EXISTS community_norm_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS custom_community_norm TEXT;

CREATE INDEX IF NOT EXISTS groups_goal_ids_gin_idx ON groups USING GIN (goal_ids);
