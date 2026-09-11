-- PKG-2A Knowledge Publication Readiness (Stage F KCS contract).
--
-- Schema changes are additive: new columns/tables for KCS content classes,
-- publication readiness evidence, and locale-keyed member-facing text. No
-- existing column is altered and no table is dropped.
-- One bounded compatibility data update marks pre-existing published records
-- grandfathered (see below). No canonical Knowledge content is rewritten;
-- no records are demoted or deleted.
--
-- Compatibility rule (explicit, bounded): rows already published when this
-- migration runs are marked grandfathered = TRUE — they were published
-- under pre-KCS rules and stay readable/usable without revalidation.
-- Published state is never auto-demoted. The KCS gate applies to
-- draft → published transitions of non-grandfathered items only.
-- The knowledge importer marks rows it creates (legacy Firestore carries)
-- grandfathered = TRUE for the same reason (see knowledgeImport.ts).

-- KCS content-class letters. Effective classes for an item are the declared
-- set plus automatic S for fitness kinds (physical by default, per KCS §3.7);
-- enforced in application code (knowledge.ts), bounded here by CHECK.
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS content_classes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS default_locale TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS grandfathered BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS measurement_guidance TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS unit_semantics TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS setup TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS execution TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS technique_reference TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS form_cues TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS common_mistakes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS equipment TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS adaptation TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS protocol_steps JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS session_framing TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS completion_meaning TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS avoidance_condition TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS semantic_definition TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS safety_notes TEXT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_items_classes_check'
  ) THEN
    ALTER TABLE knowledge_items
      ADD CONSTRAINT knowledge_items_classes_check CHECK (
        content_classes <@ ARRAY['U', 'Q', 'T', 'P', 'C', 'M', 'S']
      );
  END IF;
END
$$;

-- Version history mirrors content columns so historical versions preserve
-- governed content. Governance columns (classes/locale/grandfathered) are
-- current-state item attributes and are intentionally not versioned:
-- historical intelligibility is carried by content + challenge snapshots.
ALTER TABLE knowledge_item_versions
  ADD COLUMN IF NOT EXISTS measurement_guidance TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS unit_semantics TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS setup TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS execution TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS technique_reference TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS form_cues TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS common_mistakes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS equipment TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS adaptation TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS protocol_steps JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS session_framing TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS completion_meaning TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS avoidance_condition TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS semantic_definition TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS safety_notes TEXT[] NOT NULL DEFAULT '{}';

-- Locale-keyed member-facing text. Canonical identity is never duplicated
-- per locale: translations attach to the same knowledge_id. The default
-- locale content lives in the base columns; this table carries overrides.
CREATE TABLE IF NOT EXISTS knowledge_item_texts (
  item_id UUID NOT NULL REFERENCES knowledge_items (knowledge_id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_item_texts_pkey PRIMARY KEY (item_id, locale, field),
  CONSTRAINT knowledge_item_texts_locale_check CHECK (char_length(locale) BETWEEN 2 AND 12),
  CONSTRAINT knowledge_item_texts_field_check CHECK (char_length(field) BETWEEN 1 AND 64),
  CONSTRAINT knowledge_item_texts_value_check CHECK (char_length(value) BETWEEN 1 AND 5000)
);

CREATE INDEX IF NOT EXISTS knowledge_item_texts_item_idx
  ON knowledge_item_texts (item_id);

-- One-time compat marking for the pre-KCS published catalogue.
UPDATE knowledge_items SET grandfathered = TRUE WHERE lifecycle = 'published';
