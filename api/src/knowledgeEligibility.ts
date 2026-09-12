/**
 * EBC-01 establishment-grade Knowledge gate + (Activity, Metric, Unit)
 * compatibility (CORR-001: current-version readiness).
 *
 * Two boundaries, kept separate on purpose:
 *
 * - Runtime pins (`knowledgePins.ts`) stay published-only: historical
 *   Challenges — including ones built on grandfathered Knowledge — must
 *   keep resolving their pins for Activity application and historical
 *   reads. That seam is untouched.
 * - NEW V2 Challenge establishment additionally requires current-version
 *   establishment readiness AND a governed measurement tuple. That gate
 *   lives here.
 *
 * Readiness rule for NEW establishment (explicit, testable): a Knowledge
 * item may back a new Challenge activity only when its CURRENT version
 * satisfies the CURRENT KCS publication/readiness rules
 * (`isCurrentVersionEstablishmentReady`). `grandfathered` is historical
 * provenance, never the eligibility test: untouched pre-KCS grandfathered
 * items fail (content-thin); grandfathered items revised under the gate
 * pass while keeping `grandfathered = TRUE`.
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
  isCurrentVersionEstablishmentReady,
  type KcsClass,
  type KcsContentSnapshot,
} from './knowledge.js';
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

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

const KCS_CLASSES = new Set(['U', 'Q', 'T', 'P', 'C', 'M', 'S']);

function asDeclaredClasses(value: unknown): KcsClass[] {
  return asStringList(value).filter((entry) => KCS_CLASSES.has(entry)) as KcsClass[];
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
  name: unknown;
  description: unknown;
  category: unknown;
  metric_unit: unknown;
  measurement_guidance: unknown;
  unit_semantics: unknown;
  setup: unknown;
  execution: unknown;
  technique_reference: unknown;
  form_cues: unknown;
  common_mistakes: unknown;
  equipment: unknown;
  environment: unknown;
  adaptation: unknown;
  protocol_steps: unknown;
  session_framing: unknown;
  completion_meaning: unknown;
  avoidance_condition: unknown;
  semantic_definition: unknown;
  safety_notes: unknown;
  content_classes: unknown;
}

function asStepsList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  // Driver variance guard (mirrors knowledge.parseProtocolSteps): JSONB
  // arrives parsed, but a text-serialized row must still assess.
  if (typeof value === 'string' && value) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return [];
}

function snapshotFromRow(row: EligibilityRow): KcsContentSnapshot {
  return {
    name: asText(row.name),
    description: asText(row.description),
    category: asText(row.category),
    metricUnit: asText(row.metric_unit),
    measurementGuidance: asText(row.measurement_guidance),
    unitSemantics: asText(row.unit_semantics),
    setup: asText(row.setup),
    execution: asText(row.execution),
    techniqueReference: asText(row.technique_reference),
    formCues: asStringList(row.form_cues),
    commonMistakes: asStringList(row.common_mistakes),
    equipment: asText(row.equipment),
    environment: asText(row.environment),
    adaptation: asText(row.adaptation),
    protocolSteps: asStepsList(row.protocol_steps),
    sessionFraming: asText(row.session_framing),
    completionMeaning: asText(row.completion_meaning),
    avoidanceCondition: asText(row.avoidance_condition),
    semanticDefinition: asText(row.semantic_definition),
    safetyNotes: asStringList(row.safety_notes),
  };
}

/**
 * Database-backed establishment eligibility (CORR-001 current-version
 * readiness). Exact-name, published-only, readiness-gated, fail-closed:
 * unknown keys, drafts, retired items, content-thin items (grandfathered
 * or not) and ambiguous duplicates all resolve to null (the caller
 * rejects; eligibility is never invented). `grandfathered` is returned as
 * provenance only — it never decides eligibility.
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
              primary_metrics, secondary_metrics, compatible_units,
              name, description, category, metric_unit, measurement_guidance,
              unit_semantics, setup, execution, technique_reference,
              form_cues, common_mistakes, equipment, environment, adaptation,
              protocol_steps, session_framing, completion_meaning,
              avoidance_condition, semantic_definition, safety_notes,
              content_classes
       FROM knowledge_items
       WHERE kind = $1 AND name = $2 AND lifecycle = 'published'`,
      [kind, canonicalKey],
    );
    if (result.rows.length !== 1) return null;
    const row = result.rows[0];
    const ready = isCurrentVersionEstablishmentReady(
      String(row.lifecycle),
      row.kind as 'fitness' | 'wellness',
      asDeclaredClasses(row.content_classes),
      snapshotFromRow(row),
    );
    if (!ready) return null;
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
