-- PF-02-CORR-001: contract version integrity + Load Reporting Basis.
--
-- Additive only: no existing column is altered, no table is dropped, no
-- production data is rewritten. Existing rows (including the PF-01
-- exemplars) gain an empty Load Reporting Basis set, which declares no
-- load semantics — Weight configurations on those Activities stay
-- constrained until governed bases are declared through Knowledge
-- administration (each declaration advances the version history).
--
-- 1. load_reporting_bases — the governed Load Reporting Bases an Activity
--    supports for its Weight configurations. A per-Activity SUPPORT set,
--    not a global assignment: different governed Weight configurations
--    select their explicit basis from this set at configuration time
--    (see api/src/activityComponents.ts). Empty means no load semantics
--    declared. Values are locked to the five authorized bases; anything
--    else rejects at the database. Coherence with the declared Metrics
--    (non-empty bases require Weight among the declared Metrics) is
--    enforced application-side with machine-readable errors, mirroring
--    the measurement-contract coherence rule.
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS load_reporting_bases TEXT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_items_load_bases_check'
  ) THEN
    ALTER TABLE knowledge_items
      ADD CONSTRAINT knowledge_items_load_bases_check CHECK (
        load_reporting_bases <@ ARRAY[
          'TOTAL_LOADED_IMPLEMENT',
          'PER_IMPLEMENT',
          'SINGLE_IMPLEMENT',
          'PER_SIDE',
          'MACHINE_DISPLAYED_LOAD'
        ]
      );
  END IF;
END
$$;

-- 2. The same supported-basis set on the version history, so a historical
--    Activity version resolves the exact Load Reporting Bases that
--    governed it (a historical "20 kg + PER_IMPLEMENT" stays
--    interpretable). Application code snapshots the current set into every
--    new version row; version rows remain append-only.
ALTER TABLE knowledge_item_versions
  ADD COLUMN IF NOT EXISTS load_reporting_bases TEXT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_item_version_load_bases_check'
  ) THEN
    ALTER TABLE knowledge_item_versions
      ADD CONSTRAINT knowledge_item_version_load_bases_check CHECK (
        load_reporting_bases <@ ARRAY[
          'TOTAL_LOADED_IMPLEMENT',
          'PER_IMPLEMENT',
          'SINGLE_IMPLEMENT',
          'PER_SIDE',
          'MACHINE_DISPLAYED_LOAD'
        ]
      );
  END IF;
END
$$;
