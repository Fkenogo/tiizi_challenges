-- PF-01: canonical V2 Activity Product Contract — identity, history, catalogue.
--
-- Additive only: no existing column is altered, no table is dropped, no
-- production data is rewritten. Pre-PF-01 rows (V1 evidence, grandfathered
-- catalogue) keep NULL activity codes and their legacy categories untouched:
-- this migration does NOT migrate V1 historical records.
--
-- 1. Governed immutable Tiizi Activity Code alongside the UUID identity.
--    - knowledge_id (UUID) remains the authoritative internal PK/FK identity.
--    - activity_code is the stable product/API/editorial identifier:
--      unique, immutable after creation, language-independent.
--    - Governed format: AAA-AAA-000 (three uppercase ASCII letters, dash,
--      three uppercase ASCII letters, dash, three digits), e.g. FIT-STR-001
--      (Push-Up), WEL-MND-003 (Breathing Practice). The middle segment is a
--      stable mnemonic captured at creation time — it is NOT a live
--      classification pointer: recategorising an Activity never changes its
--      code. Display names remain localizable content and never act as
--      identity (see api/src/knowledge.ts ACTIVITY_CODE_FORMAT).
--    - NULL is permitted ONLY for pre-PF-01 rows (quarantined legacy data).
--      New V2 product rows SHOULD carry a code (enforced application-side);
--      the column stays nullable so history is never rewritten.
--    - Immutability is enforced in the database (trigger below): once set, a
--      code can never be changed or cleared. NULL -> value is permitted so a
--      quarantined row may be adopted into the V2 product exactly once.
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS activity_code TEXT UNIQUE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_items_activity_code_check'
  ) THEN
    ALTER TABLE knowledge_items
      ADD CONSTRAINT knowledge_items_activity_code_check CHECK (
        activity_code IS NULL
        OR activity_code ~ '^[A-Z]{3}-[A-Z]{3}-[0-9]{3}$'
      );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION reject_knowledge_activity_code_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  IF OLD.activity_code IS NOT NULL AND NEW.activity_code IS DISTINCT FROM OLD.activity_code THEN
    RAISE EXCEPTION 'knowledge_items.activity_code is immutable (knowledge_id=%)', OLD.knowledge_id;
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS knowledge_items_activity_code_immutable ON knowledge_items;

CREATE TRIGGER knowledge_items_activity_code_immutable
  BEFORE UPDATE OF activity_code ON knowledge_items
  FOR EACH ROW EXECUTE FUNCTION reject_knowledge_activity_code_mutation();

CREATE INDEX IF NOT EXISTS knowledge_items_activity_code_idx
  ON knowledge_items (activity_code);

-- 2. Version-associated locale texts (historical intelligibility).
--
-- knowledge_item_texts remains the CURRENT locale overrides for the live
-- item. This table snapshots those overrides per content version at revision
-- time (application code copies current texts into the new version row), so
-- a historical Activity version resolves the exact member-facing text it
-- carried even after later edits. Rows are append-only like their parent
-- knowledge_item_versions rows.
CREATE TABLE IF NOT EXISTS knowledge_item_version_texts (
  item_id UUID NOT NULL,
  version INTEGER NOT NULL,
  locale TEXT NOT NULL,
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  CONSTRAINT knowledge_item_version_texts_pkey PRIMARY KEY (item_id, version, locale, field),
  CONSTRAINT knowledge_item_version_texts_version_fk FOREIGN KEY (item_id, version)
    REFERENCES knowledge_item_versions (item_id, version) ON DELETE CASCADE,
  CONSTRAINT knowledge_item_version_texts_version_check CHECK (version >= 1),
  CONSTRAINT knowledge_item_version_texts_locale_check CHECK (char_length(locale) BETWEEN 2 AND 12),
  CONSTRAINT knowledge_item_version_texts_field_check CHECK (char_length(field) BETWEEN 1 AND 64),
  CONSTRAINT knowledge_item_version_texts_value_check CHECK (char_length(value) BETWEEN 1 AND 5000)
);

CREATE OR REPLACE FUNCTION reject_knowledge_version_text_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  RAISE EXCEPTION 'knowledge_item_version_texts is append-only (item_id=%, version=%, locale=%, field=%)',
    OLD.item_id, OLD.version, OLD.locale, OLD.field;
  RETURN NULL;
END;
$func$;

DROP TRIGGER IF EXISTS knowledge_item_version_texts_immutable ON knowledge_item_version_texts;

CREATE TRIGGER knowledge_item_version_texts_immutable
  BEFORE UPDATE OR DELETE ON knowledge_item_version_texts
  FOR EACH ROW EXECUTE FUNCTION reject_knowledge_version_text_mutation();

CREATE INDEX IF NOT EXISTS knowledge_item_version_texts_item_version_idx
  ON knowledge_item_version_texts (item_id, version);
