-- EBC-01: Group/Challenge authority + Knowledge compatibility
-- (Engine Baseline Closure slice 1).
--
-- Additive only: new columns/tables for the governed measurement contract,
-- the per-activity governing metric, and the establishment retry contract.
-- No existing column is altered, no table is dropped, no production data is
-- rewritten. Pre-EBC-01 challenge_activity_configs rows predate the governed
-- metric and stay NULL (the append-only guard forbids rewriting history);
-- NULL honestly marks pre-metric configuration and historical snapshots
-- remain parseable. All NEW configuration versions carry their metric.
--
-- Knowledge compatibility defaults to empty (nothing permitted): legacy and
-- grandfathered records gain no governed measurement contract through this
-- migration. Compatibility is declared afterwards through governed Knowledge
-- administration, so no catalogue is authored or repaired here.

-- 1. Governed measurement compatibility on canonical Knowledge.
-- primary_metrics / secondary_metrics: subsets of the six canonical Metrics
-- (completion, repetitions, duration, distance, weight, quantity).
-- compatible_units: subsets of the governed Unit vocabulary; each unit
-- belongs to exactly one Metric (enforced application-side).
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS primary_metrics TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS secondary_metrics TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS compatible_units TEXT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_items_primary_metrics_check'
  ) THEN
    ALTER TABLE knowledge_items
      ADD CONSTRAINT knowledge_items_primary_metrics_check CHECK (
        primary_metrics <@ ARRAY['completion', 'repetitions', 'duration', 'distance', 'weight', 'quantity']
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_items_secondary_metrics_check'
  ) THEN
    ALTER TABLE knowledge_items
      ADD CONSTRAINT knowledge_items_secondary_metrics_check CHECK (
        secondary_metrics <@ ARRAY['completion', 'repetitions', 'duration', 'distance', 'weight', 'quantity']
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_items_compatible_units_check'
  ) THEN
    ALTER TABLE knowledge_items
      ADD CONSTRAINT knowledge_items_compatible_units_check CHECK (
        compatible_units <@ ARRAY[
          'completion',
          'reps', 'repetitions',
          'seconds', 'minutes', 'hours',
          'metres', 'kilometres',
          'grams', 'kilograms',
          'steps', 'millilitres', 'litres', 'servings', 'pages', 'acts', 'flights'
        ]
      );
  END IF;
END
$$;

-- 2. Versioned contract mirror: a historical version row shows which
-- compatibility contract governed it at revision time. Compatibility itself
-- remains current-state item governance (like content classes): setting it
-- does not mint a Knowledge version, but revisions capture it.
ALTER TABLE knowledge_item_versions
  ADD COLUMN IF NOT EXISTS primary_metrics TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS secondary_metrics TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS compatible_units TEXT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_item_versions_primary_metrics_check'
  ) THEN
    ALTER TABLE knowledge_item_versions
      ADD CONSTRAINT knowledge_item_versions_primary_metrics_check CHECK (
        primary_metrics <@ ARRAY['completion', 'repetitions', 'duration', 'distance', 'weight', 'quantity']
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_item_versions_secondary_metrics_check'
  ) THEN
    ALTER TABLE knowledge_item_versions
      ADD CONSTRAINT knowledge_item_versions_secondary_metrics_check CHECK (
        secondary_metrics <@ ARRAY['completion', 'repetitions', 'duration', 'distance', 'weight', 'quantity']
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_item_versions_compatible_units_check'
  ) THEN
    ALTER TABLE knowledge_item_versions
      ADD CONSTRAINT knowledge_item_versions_compatible_units_check CHECK (
        compatible_units <@ ARRAY[
          'completion',
          'reps', 'repetitions',
          'seconds', 'minutes', 'hours',
          'metres', 'kilometres',
          'grams', 'kilograms',
          'steps', 'millilitres', 'litres', 'servings', 'pages', 'acts', 'flights'
        ]
      );
  END IF;
END
$$;

-- 3. Governing metric per configured Challenge activity. Nullable for the
-- historical reason above; the domain requires it on every NEW version.
ALTER TABLE challenge_activity_configs
  ADD COLUMN IF NOT EXISTS metric TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'challenge_activity_configs_metric_check'
  ) THEN
    ALTER TABLE challenge_activity_configs
      ADD CONSTRAINT challenge_activity_configs_metric_check CHECK (
        metric IS NULL
        OR metric IN ('completion', 'repetitions', 'duration', 'distance', 'weight', 'quantity')
      );
  END IF;
END
$$;

-- 4. Establishment idempotency keys: the bounded retry contract for governed
-- Challenge establishment. The key row commits in the SAME PostgreSQL
-- transaction as the Challenge/config/activation/participation it guards, so
-- a retry with the same key can never mint a duplicate Challenge. A reused
-- key with a different request payload is rejected (no silent aliasing).
-- creator_participation_id records the exact establishment outcome so an
-- idempotent replay returns the same result shape as the first attempt.
CREATE TABLE IF NOT EXISTS challenge_establishment_keys (
  idempotency_key TEXT PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES challenges (challenge_id) ON DELETE RESTRICT,
  created_by_member_id UUID NOT NULL REFERENCES members (member_id) ON DELETE RESTRICT,
  request_hash TEXT NOT NULL,
  creator_participation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT challenge_establishment_keys_key_check CHECK (char_length(idempotency_key) BETWEEN 1 AND 100),
  CONSTRAINT challenge_establishment_keys_hash_check CHECK (char_length(request_hash) BETWEEN 1 AND 128)
);

CREATE INDEX IF NOT EXISTS challenge_establishment_keys_challenge_idx
  ON challenge_establishment_keys (challenge_id);
