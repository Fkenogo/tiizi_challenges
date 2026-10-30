-- TIIZI-FER-P4A-001: original Group creator provenance.
--
-- Authority: FER-001-B P4a. The member who ESTABLISHED a Group is a canonical
-- fact distinct from the current Accountable Steward (groups.steward_member_id).
--
-- - Nullable. NULL means "not recorded" and is the ONLY honest value for any
--   Group whose establishing member is not independently proven.
-- - Written once, by the Group establishment authority, going forward.
-- - NO BACKFILL IN THIS MIGRATION. Read-only assessment of existing evidence:
--   * groups.steward_member_id is the CURRENT owner, not provenance;
--   * there is no Group-creation audit record, and archived V1 is excluded;
--   * the one establishment artefact is the owner membership row that the
--     PostgreSQL establishment authority writes in the creating transaction,
--     self-approved (approved_by_member_id = member_id) with approved_at =
--     joined_at = groups.created_at. It is a CANDIDATE signature, not adopted
--     here: it is written for the member who becomes owner/Steward, exists only
--     for Groups created through that path (the removed 019/020 import cannot
--     be told apart), its behaviour under a future Steward handover (STEW-1) is
--     not yet defined, and an owner-row backfill would derive the creator from
--     the Steward unless separately ruled to be independent proof.
--   The creator is never derived from steward_member_id, from the earliest
--   membership, or from any archived V1 record. Existing rows therefore stay
--   NULL until a Programme/Founder ruling authorizes a governed backfill (the
--   session setting below exists for exactly that, and for nothing else).
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
