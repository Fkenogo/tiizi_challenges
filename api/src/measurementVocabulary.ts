/**
 * EBC-01 canonical Metric / Unit vocabulary (governed measurement contract).
 *
 * AUTHORITY: this module encodes — it does not author — the approved
 * canonical values from the Founder Working Baselines:
 * - `docs/governance/knowledge/working-baselines/TIIZI-V2-METRIC-AND-UNIT-MODEL-FOUNDER-WORKING-BASELINE.md`
 *   §2 (six canonical Metrics), §3 (compatible Units per Metric),
 *   §5 (normalization basis is semantic-only: no conversion inferred),
 *   §§6–8 (Primary vs Secondary Metric roles; canonical spelling `reps`
 *   with accepted alias `repetitions`), and
 * - `docs/governance/knowledge/working-baselines/TIIZI-V2-INITIAL-CANONICAL-ACTIVITY-BASELINE-FOUNDER-WORKING-BASELINE.md`
 *   (per-Activity compatible Metrics/Units — the catalogue itself, which
 *   this module deliberately does NOT carry).
 *
 * This module therefore carries ONLY the small fixed vocabularies — six
 * canonical Metrics and their compatible Units — for runtime validation.
 * Per-Activity compatibility (which Metrics/Units a canonical Activity
 * permits) is canonical Knowledge, lives server-side on the Knowledge
 * item (knowledge_items.primary_metrics / secondary_metrics /
 * compatible_units), and is declared through governed Knowledge
 * administration. Any drift between this encoding and the baselines is a
 * defect in this file, caught by the vocabulary drift-guard test
 * (ebc01KnowledgeCompatibility: governed vocabulary table).
 *
 * Governance rules enforced here:
 * - every governed Unit belongs to exactly one canonical Metric;
 * - `reps` (canonical) and `repetitions` (accepted alias) are spellings of
 *   the same Unit;
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
