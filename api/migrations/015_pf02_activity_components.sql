-- PF-02: canonical Activity Components + versioned component structure.
--
-- Additive only: no existing column is altered, no table is dropped, no
-- production data is rewritten. PF-01 exemplar rows keep working untouched:
-- an Activity without component rows is an ordinary non-component Activity
-- and every existing PF-01 code path behaves exactly as before.
--
-- 1. activity_components — current governed Component set of one Activity.
--    - A Component belongs to exactly one canonical Activity
--      (item_id -> knowledge_items, ON DELETE CASCADE).
--    - component_id is the stable subordinate machine identifier. It is
--      scoped to its parent Activity (PRIMARY KEY (item_id, component_id)):
--      the same machine id may recur on a different Activity, but never
--      twice on the same one. Components receive NO independent Activity
--      Code (there is deliberately no activity_code column here).
--    - relationship is constrained to the single PF-02-authorized value
--      'ALL_REQUIRED'. No generic composite/workflow relationship model is
--      created; any other value rejects at the database.
--    - Internal choreography/chapters/device types are not Components:
--      rows here are created only through governed Knowledge
--      administration (application code), never inferred.
CREATE TABLE IF NOT EXISTS activity_components (
  item_id UUID NOT NULL REFERENCES knowledge_items (knowledge_id) ON DELETE CASCADE,
  component_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'ALL_REQUIRED',
  position INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT activity_components_pkey PRIMARY KEY (item_id, component_id),
  CONSTRAINT activity_components_id_check CHECK (char_length(component_id) BETWEEN 1 AND 64),
  CONSTRAINT activity_components_name_check CHECK (char_length(display_name) BETWEEN 1 AND 120),
  CONSTRAINT activity_components_relationship_check CHECK (relationship = 'ALL_REQUIRED')
);

CREATE INDEX IF NOT EXISTS activity_components_item_idx
  ON activity_components (item_id);

-- 2. knowledge_item_version_components — per-version Component snapshot.
--
-- Mirrors the knowledge_item_versions / knowledge_item_version_texts
-- pattern: application code snapshots the current Component set into the
-- new version row at creation and at each content revision, so a
-- historical Activity version resolves the exact required Component
-- identifiers and relationship it carried even after later edits. Rows
-- are append-only like their parent version rows (trigger below rejects
-- UPDATE and DELETE).
CREATE TABLE IF NOT EXISTS knowledge_item_version_components (
  item_id UUID NOT NULL,
  version INTEGER NOT NULL,
  component_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  CONSTRAINT knowledge_item_version_components_pkey PRIMARY KEY (item_id, version, component_id),
  CONSTRAINT knowledge_item_version_components_version_fk FOREIGN KEY (item_id, version)
    REFERENCES knowledge_item_versions (item_id, version) ON DELETE CASCADE,
  CONSTRAINT knowledge_item_version_components_relationship_check CHECK (relationship = 'ALL_REQUIRED')
);

CREATE INDEX IF NOT EXISTS knowledge_item_version_components_item_version_idx
  ON knowledge_item_version_components (item_id, version);

CREATE OR REPLACE FUNCTION reject_knowledge_version_component_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  RAISE EXCEPTION 'knowledge_item_version_components is append-only (item_id=%, version=%, component_id=%)',
    OLD.item_id, OLD.version, OLD.component_id;
  RETURN NULL;
END;
$func$;

DROP TRIGGER IF EXISTS knowledge_item_version_components_immutable ON knowledge_item_version_components;

CREATE TRIGGER knowledge_item_version_components_immutable
  BEFORE UPDATE OR DELETE ON knowledge_item_version_components
  FOR EACH ROW EXECUTE FUNCTION reject_knowledge_version_component_mutation();
