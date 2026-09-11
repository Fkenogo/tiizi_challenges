/**
 * EBC-01 establishment-grade Knowledge gate + (Activity, Metric, Unit)
 * compatibility.
 *
 * Two boundaries, kept separate on purpose:
 *
 * - Runtime pins (`knowledgePins.ts`) stay published-only: historical
 *   Challenges established before EBC-01 — including ones built on
 *   grandfathered Knowledge — must keep resolving their pins for Activity
 *   application and historical reads. That seam is untouched.
 * - NEW V2 Challenge establishment additionally requires the V2
 *   publication/readiness rule AND a governed measurement tuple. That gate
 *   lives here.
 *
 * V2 publication/readiness rule for NEW establishment (explicit, testable):
 * a Knowledge item may back a new Challenge activity only when it is
 * currently `published` AND NOT `grandfathered`. Grandfathered items were
 * published under pre-KCS rules; their exemption covers readability and
 * historical pins, never new establishment. Non-grandfathered published
 * items earned publication through the KCS gate (enforced on every
 * publish transition and content revision in knowledge.ts).
 *
 * Compatibility rule (explicit, testable): for the resolved item with
 * governed contract (primary ∪ secondary Metrics, compatible Units), the
 * configured tuple must satisfy ALL of:
 * 1. metric is a canonical Metric in the item's permitted set;
 * 2. unit is in the item's compatible Units;
 * 3. the unit's governed Metric IS the configured metric
 *    (valid(Activity) + valid(Metric) + valid(Unit) is NOT sufficient).
 *
 * Provider-neutral: pure domain + `Db`. No Firebase, no routes.
 */

import type { Db } from './db.js';
import {
  isCanonicalMetric,
  metricForUnit,
} from './measurementVocabulary.js';

export interface KnowledgeEligibility {
  knowledgeId: string;
  version: number;
  kind: 'fitness' | 'wellness';
  lifecycle: string;
  grandfathered: boolean;
  primaryMetrics: string[];
  secondaryMetrics: string[];
  compatibleUnits: string[];
}

export type KnowledgeEligibilityResolver = (
  canonicalKey: string,
) => Promise<KnowledgeEligibility | null>;

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry));
}

interface EligibilityRow {
  knowledge_id: string;
  current_version: number;
  kind: string;
  lifecycle: string;
  grandfathered: boolean | null;
  primary_metrics: unknown;
  secondary_metrics: unknown;
  compatible_units: unknown;
}

/**
 * Database-backed establishment eligibility. Exact-name, published-only,
 * non-grandfathered-only, fail-closed: unknown keys, drafts, retired items,
 * grandfathered items and ambiguous duplicates all resolve to null (the
 * caller rejects; eligibility is never invented).
 */
export function createDbKnowledgeEligibilityResolver(
  db: Db,
  kind: 'fitness' | 'wellness',
): KnowledgeEligibilityResolver {
  return async (canonicalKey: string) => {
    if (kind !== 'fitness' && kind !== 'wellness') return null;
    if (!canonicalKey) return null;
    const result = await db.query<EligibilityRow>(
      `SELECT knowledge_id, current_version, kind, lifecycle, grandfathered,
              primary_metrics, secondary_metrics, compatible_units
       FROM knowledge_items
       WHERE kind = $1 AND name = $2
         AND lifecycle = 'published' AND grandfathered = FALSE`,
      [kind, canonicalKey],
    );
    if (result.rows.length !== 1) return null;
    const row = result.rows[0];
    return {
      knowledgeId: String(row.knowledge_id),
      version: Number(row.current_version),
      kind: row.kind as 'fitness' | 'wellness',
      lifecycle: String(row.lifecycle),
      grandfathered: row.grandfathered === true,
      primaryMetrics: asStringList(row.primary_metrics),
      secondaryMetrics: asStringList(row.secondary_metrics),
      compatibleUnits: asStringList(row.compatible_units),
    };
  };
}

function fail(message: string): never {
  throw new Error(`knowledge-eligibility: ${message}`);
}

export interface ConfiguredActivityTerms {
  canonical_key: string;
  metric?: string | null;
  unit: string;
}

/**
 * Prove the exact (Activity, Metric, Unit) tuple against the resolved
 * governed contract. Rejects missing metrics, ungoverned metrics/units,
 * metrics the Activity does not permit, units the Activity does not permit,
 * and coherent-looking mismatches (e.g. a permitted Metric paired with a
 * Unit that belongs to a different Metric).
 */
export function assertActivityMeasurementCompatible(
  eligibility: KnowledgeEligibility,
  activity: ConfiguredActivityTerms,
  index: number,
): void {
  const where = `activities[${index}] ('${activity.canonical_key}')`;
  if (!isCanonicalMetric(activity.metric)) {
    fail(`${where} metric must be a canonical Metric (completion|repetitions|duration|distance|weight|quantity)`);
  }
  const metric = activity.metric;
  const permitted = new Set([...eligibility.primaryMetrics, ...eligibility.secondaryMetrics]);
  if (!permitted.has(metric)) {
    fail(
      `${where} metric '${metric}' is not permitted for this Activity `
      + `(permitted: ${[...permitted].sort().join(', ') || 'none'})`,
    );
  }
  if (!eligibility.compatibleUnits.includes(activity.unit)) {
    fail(
      `${where} unit '${activity.unit}' is not compatible with this Activity `
      + `(compatible: ${[...eligibility.compatibleUnits].sort().join(', ') || 'none'})`,
    );
  }
  const unitMetric = metricForUnit(activity.unit);
  if (unitMetric !== metric) {
    fail(
      `${where} unit '${activity.unit}' expresses Metric '${unitMetric ?? 'ungoverned'}', `
      + `not the configured metric '${metric}' (the (Activity, Metric, Unit) tuple must be governed as a whole)`,
    );
  }
}
