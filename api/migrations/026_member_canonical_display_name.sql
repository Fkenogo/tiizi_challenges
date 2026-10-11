-- MC-1 correction 001: minimum canonical member display-name storage.
-- Nullable on purpose: pre-existing members have no canonical name until the
-- governed one-time completion gate. No default, no backfill (never derived
-- from email, Firebase UID, V1 data or any client cache), no history table.
-- The 1..120 length is a technical storage-safety bound, not Product Truth.
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS display_name TEXT;

ALTER TABLE members DROP CONSTRAINT IF EXISTS members_display_name_check;
ALTER TABLE members ADD CONSTRAINT members_display_name_check
  CHECK (display_name IS NULL
      OR (display_name = btrim(display_name) AND char_length(display_name) BETWEEN 1 AND 120));
