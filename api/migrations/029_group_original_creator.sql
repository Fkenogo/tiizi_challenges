-- TIIZI-FER-P4A-001: original Group creator provenance.
--
-- Authority: FER-001-B P4a. The member who ESTABLISHED a Group is a canonical
-- fact distinct from the current Accountable Steward (groups.steward_member_id).
--
-- - Nullable. NULL means "not recorded" and is the ONLY honest value for any
--   Group whose establishing member is not independently proven.
-- - Written once, by the Group establishment authority, going forward.
-- - NO BACKFILL. Read-only assessment found no authoritative source that
--   independently proves the creator of an existing Group: the Steward is the
--   current owner (not provenance), the owner membership row is mirrored from
--   the Steward, and no Group-creation audit record exists. The creator is
--   never derived from steward_member_id, from the earliest membership, or from
--   any archived V1 record. Existing rows therefore stay NULL.
-- - Immutable once recorded under ordinary Group operations. A governed,
--   separately authorized provenance backfill may set a NULL value only inside
--   a session that declares tiizi.group_creator_backfill = 'on'.
-- - No effect on Steward authority, membership, ownership or permissions.

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS original_creator_member_id UUID REFERENCES members(member_id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION tiizi_group_original_creator_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.original_creator_member_id IS DISTINCT FROM OLD.original_creator_member_id THEN
    IF OLD.original_creator_member_id IS NOT NULL THEN
      RAISE EXCEPTION 'groups.original_creator_member_id is immutable once recorded'
        USING ERRCODE = 'check_violation';
    END IF;
    IF COALESCE(current_setting('tiizi.group_creator_backfill', true), '') <> 'on' THEN
      RAISE EXCEPTION 'groups.original_creator_member_id is set at establishment or by a governed provenance backfill only'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS groups_original_creator_guard ON groups;
CREATE TRIGGER groups_original_creator_guard
  BEFORE UPDATE OF original_creator_member_id ON groups
  FOR EACH ROW EXECUTE FUNCTION tiizi_group_original_creator_guard();
