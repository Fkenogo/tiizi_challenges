-- TIIZI-GROUP-PG-AUTHORITY-TRANSITION-001
-- PostgreSQL becomes the sole V2 authority for Group and Membership truth.
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS require_admin_approval BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS allow_member_challenges BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS steward_member_id UUID REFERENCES members(member_id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS invite_code TEXT;

ALTER TABLE group_memberships
  ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by_member_id UUID REFERENCES members(member_id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by_member_id UUID REFERENCES members(member_id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS groups_invite_code_normalized_unique
  ON groups (upper(btrim(invite_code))) WHERE invite_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS groups_discovery_idx
  ON groups (status, is_private, created_at DESC, group_id);
CREATE INDEX IF NOT EXISTS group_memberships_group_status_idx
  ON group_memberships (group_id, status, joined_at);
CREATE INDEX IF NOT EXISTS group_memberships_member_status_idx
  ON group_memberships (member_id, status, group_id);
CREATE INDEX IF NOT EXISTS group_memberships_reviewer_idx
  ON group_memberships (approved_by_member_id, rejected_by_member_id)
  WHERE approved_by_member_id IS NOT NULL OR rejected_by_member_id IS NOT NULL;

ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_invite_code_normalized_check;
ALTER TABLE groups ADD CONSTRAINT groups_invite_code_normalized_check
  CHECK (invite_code IS NULL OR (invite_code = upper(btrim(invite_code)) AND char_length(invite_code) BETWEEN 1 AND 64));
ALTER TABLE group_memberships DROP CONSTRAINT IF EXISTS group_memberships_lifecycle_check;
ALTER TABLE group_memberships ADD CONSTRAINT group_memberships_lifecycle_check CHECK (
  (status <> 'pending' OR requested_at IS NOT NULL OR created_at IS NOT NULL)
  AND (status <> 'left' OR left_at IS NOT NULL OR updated_at IS NOT NULL)
  AND (approved_by_member_id IS NULL OR approved_at IS NOT NULL)
  AND (rejected_by_member_id IS NULL OR rejected_at IS NOT NULL)
  AND NOT (approved_at IS NOT NULL AND rejected_at IS NOT NULL)
);

CREATE OR REPLACE FUNCTION tiizi_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('tiizi.group_reconciliation', true) = 'on' AND NEW.updated_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS groups_touch_updated_at ON groups;
CREATE TRIGGER groups_touch_updated_at BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION tiizi_touch_updated_at();
DROP TRIGGER IF EXISTS group_memberships_touch_updated_at ON group_memberships;
CREATE TRIGGER group_memberships_touch_updated_at BEFORE UPDATE ON group_memberships
  FOR EACH ROW EXECUTE FUNCTION tiizi_touch_updated_at();

-- Steward is represented by the Group's member UUID and must also be the
-- unique active owner relation. Deferred checks permit atomic create/update.
CREATE UNIQUE INDEX IF NOT EXISTS group_memberships_one_owner_idx
  ON group_memberships(group_id) WHERE role = 'owner' AND status IN ('active','joined');

ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_steward_membership_fk;
ALTER TABLE groups ADD CONSTRAINT groups_steward_membership_fk
  FOREIGN KEY (group_id, steward_member_id)
  REFERENCES group_memberships(group_id, member_id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE FUNCTION tiizi_check_group_steward()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_group UUID; target_member UUID; steward UUID; owner_count INTEGER;
BEGIN
  target_group := CASE WHEN TG_TABLE_NAME = 'groups' THEN NEW.group_id ELSE COALESCE(NEW.group_id, OLD.group_id) END;
  SELECT steward_member_id INTO steward FROM groups WHERE group_id=target_group;
  IF steward IS NULL THEN RETURN NULL; END IF;
  SELECT count(*) INTO owner_count FROM group_memberships
    WHERE group_id=target_group AND member_id=steward AND role='owner' AND status IN ('active','joined');
  IF owner_count <> 1 THEN RAISE EXCEPTION 'Group % must have its steward as one active owner membership', target_group; END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS groups_steward_invariant ON groups;
CREATE CONSTRAINT TRIGGER groups_steward_invariant AFTER INSERT OR UPDATE OF steward_member_id ON groups
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION tiizi_check_group_steward();
DROP TRIGGER IF EXISTS memberships_steward_invariant ON group_memberships;
CREATE CONSTRAINT TRIGGER memberships_steward_invariant AFTER INSERT OR UPDATE OR DELETE ON group_memberships
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION tiizi_check_group_steward();
