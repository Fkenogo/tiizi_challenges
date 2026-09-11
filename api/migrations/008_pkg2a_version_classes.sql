-- PKG-2A-CORR: preserve the content-class set in version history.
--
-- Changing content classes creates a new Knowledge version (every revise
-- versions). Without this column, a historical version row cannot show which
-- class set governed it at publication time. Additive only.
ALTER TABLE knowledge_item_versions
  ADD COLUMN IF NOT EXISTS content_classes TEXT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_item_versions_classes_check'
  ) THEN
    ALTER TABLE knowledge_item_versions
      ADD CONSTRAINT knowledge_item_versions_classes_check CHECK (
        content_classes <@ ARRAY['U', 'Q', 'T', 'P', 'C', 'M', 'S']
      );
  END IF;
END
$$;
