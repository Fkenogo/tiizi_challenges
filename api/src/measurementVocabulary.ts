/**
 * EBC-01 canonical Metric / Unit vocabulary (governed measurement contract).
 *
 * Source: Founder Working Baselines for the Metric & Unit model and the
 * initial canonical Activity baseline (Stage EK working baselines under
 * EKG-01). This module carries ONLY the small fixed vocabularies — six
 * canonical Metrics and their compatible Units — never the Activity
 * catalogue itself. Per-Activity compatibility (which Metrics/Units a
 * canonical Activity permits) lives server-side on the Knowledge item
 * (knowledge_items.primary_metrics / secondary_metrics / compatible_units)
 * and is declared through governed Knowledge administration.
 *
 * Governance rules enforced here:
 * - every governed Unit belongs to exactly one canonical Metric;
 * - `reps` and `repetitions` are accepted spellings of the same Unit;
 * - no conversion or equivalence is inferred (minutes != hours,
 *   kilometres != metres): same strictness as the C3A collective-unit
 *   invariant, extended to every Challenge type;
 * - valid(Activity) AND valid(Metric) AND valid(Unit) is NOT sufficient:
 *   callers must prove the exact (Activity, Metric, Unit) tuple against the
 *   Activity's governed contract (see knowledgeEligibility.ts).
 *
 * Pure module: no Db, no Firebase, no routes.
 */

export const CANONICAL_METRICS = [
  'completion',
  'repetitions',
  'duration',
  'distance',
  'weight',
  'quantity',
] as const;

export type CanonicalMetric = (typeof CANONICAL_METRICS)[number];

const METRIC_SET = new Set<string>(CANONICAL_METRICS);

export function isCanonicalMetric(value: unknown): value is CanonicalMetric {
  return typeof value === 'string' && METRIC_SET.has(value);
}

/**
 * Governed Unit -> Metric map. Each Unit belongs to exactly one Metric.
 * `reps`/`repetitions` are accepted spellings of the Repetitions Unit.
 */
const UNIT_TO_METRIC: Record<string, CanonicalMetric> = {
  completion: 'completion',
  reps: 'repetitions',
  repetitions: 'repetitions',
  seconds: 'duration',
  minutes: 'duration',
  hours: 'duration',
  metres: 'distance',
  kilometres: 'distance',
  grams: 'weight',
  kilograms: 'weight',
  steps: 'quantity',
  millilitres: 'quantity',
  litres: 'quantity',
  servings: 'quantity',
  pages: 'quantity',
  acts: 'quantity',
  flights: 'quantity',
};

export const GOVERNED_UNITS: string[] = Object.keys(UNIT_TO_METRIC).sort();

/** The canonical Metric a governed Unit expresses, or null when ungoverned. */
export function metricForUnit(unit: string): CanonicalMetric | null {
  return UNIT_TO_METRIC[unit] ?? null;
}

export function isGovernedUnit(unit: unknown): boolean {
  return typeof unit === 'string' && unit in UNIT_TO_METRIC;
}
