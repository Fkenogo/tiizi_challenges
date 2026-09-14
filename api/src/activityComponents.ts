/**
 * PF-02 canonical Activity Components + configuration-sensitive eligibility.
 *
 * AUTHORITY: encodes — never authors — the Founder/Product package
 * `docs/governance/knowledge/Activity Content & Catalogue Definition/`:
 * - canonical Activity Components are a required product concept; the only
 *   relationship authorized in PF-02 is ALL_REQUIRED (Side Plank LEFT+RIGHT;
 *   Single-Leg Balance LEFT LEG+RIGHT LEG; Squat remains non-component);
 * - a Component belongs to one canonical Activity, carries a stable
 *   subordinate machine identifier, and receives NO independent Activity
 *   Code;
 * - measurement stays attributable per Component (component values are never
 *   silently summed); canonical Activity satisfaction requires every
 *   required Component to satisfy the configured requirement;
 * - eligibility is configuration-sensitive (Activity / Metric / Unit /
 *   applicable product-constraint configuration) while Published !=
 *   Challenge Eligible and the PF-01 publication gate stay intact;
 * - exact (Activity, Metric, Unit) compatibility is preserved: no Cartesian
 *   combinations, six governed Metrics unchanged;
 * - Duration stays neutral: this module contains no accumulation and no
 *   continuous-session semantics. Continuous-vs-accumulated is PF-03
 *   Challenge Definition business; PF-02 evaluates each Component report
 *   against the configured requirement with the same threshold comparison
 *   for every Metric.
 * - Weight boundary (PF-02-CORR-001 settled Founder/Product Load Reporting
 *   Convention): Weight stays a governed Metric with the governed
 *   grams/kilograms vocabulary. Every Challenge-eligible Weight
 *   configuration carries one explicit basis from the five authorized
 *   Load Reporting Bases (TOTAL_LOADED_IMPLEMENT, PER_IMPLEMENT,
 *   SINGLE_IMPLEMENT, PER_SIDE, MACHINE_DISPLAYED_LOAD); the Activity
 *   declares the bases it supports (versioned with its contract) and the
 *   configuration selects one explicitly. No total/per-side semantics are
 *   decided beyond the basis label, Weight is never auto-authorized, no
 *   unit conversion beyond governed g/kg vocabulary (which itself infers
 *   none), no reps x weight scoring, no body-weight or system-load
 *   arithmetic, no unequal-paired-load scalars.
 *
 * Deliberately NOT built: generic composite/workflow abstractions, PF-03
 * Challenge Definition and snapshots, wizard, Verification/Recognition/
 * Rewards, bulk catalogue seeding.
 *
 * Provider-neutral: pure domain + `Db`. No Firebase, no routes.
 */

import type { Db } from './db.js';
import {
  advanceProductContractVersion,
  assessChallengeEligibility,
  KnowledgeError,
  type ChallengeEligibilityAssessmentInput,
  type ChallengeEligibilityIssue,
} from './knowledge.js';
import { isCanonicalMetric, metricForUnit } from './measurementVocabulary.js';

/** The only Component relationship authorized in PF-02. */
export const COMPONENT_RELATIONSHIP_ALL_REQUIRED = 'ALL_REQUIRED' as const;

/**
 * PF-02-CORR-001 settled Founder/Product Load Reporting Convention:
 * the initial authorized vocabulary ONLY. Weight remains one governed
 * Metric; every Challenge-eligible Weight configuration carries one
 * explicit basis from this set. No other value is authorized, and no
 * mapping between bases exists (each basis is opaque: PER_IMPLEMENT
 * never totalizes, PER_SIDE never converts to a total,
 * MACHINE_DISPLAYED_LOAD claims no cross-machine equivalence).
 */
export const LOAD_REPORTING_BASES = [
  'TOTAL_LOADED_IMPLEMENT',
  'PER_IMPLEMENT',
  'SINGLE_IMPLEMENT',
  'PER_SIDE',
  'MACHINE_DISPLAYED_LOAD',
] as const;

export type LoadReportingBasis = (typeof LOAD_REPORTING_BASES)[number];

const LOAD_BASIS_SET = new Set<string>(LOAD_REPORTING_BASES);

export function isLoadReportingBasis(value: unknown): value is LoadReportingBasis {
  return typeof value === 'string' && LOAD_BASIS_SET.has(value);
}

/**
 * Validate a governed Load Reporting Basis set. `undefined` means "none
 * declared". Unknown bases reject with 400 unknown_load_basis; values
 * normalize deterministically (dedupe + sort), mirroring the Metric/Unit
 * contract normalization. Bases are never inferred from Activity names
 * and never auto-assigned: only explicitly declared values persist.
 */
export function normalizeLoadReportingBases(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new KnowledgeError(400, 'invalid_knowledge', 'loadReportingBases must be an array');
  }
  const out: string[] = [];
  for (const entry of value) {
    if (!isLoadReportingBasis(entry)) {
      throw new KnowledgeError(
        400,
        'unknown_load_basis',
        `loadReportingBases entry '${String(entry)}' is not an authorized Load Reporting Basis `
        + `(${LOAD_REPORTING_BASES.join('|')})`,
      );
    }
    if (!out.includes(entry)) out.push(entry);
  }
  return out.sort();
}

export type ComponentRelationship = typeof COMPONENT_RELATIONSHIP_ALL_REQUIRED;

export interface ActivityComponentSpec {
  componentId: string;
  displayName: string;
  relationship: ComponentRelationship;
}

function asTrimmed(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > max) return null;
  return trimmed;
}

/**
 * Validate governed Component specs. `undefined` means "no Components"
 * (ordinary non-component Activity — the PF-01 path, unchanged).
 * Throws KnowledgeError 400 `invalid_knowledge` for malformed entries,
 * `unsupported_component_relationship` for any relationship other than
 * ALL_REQUIRED, and `duplicate_component_id` for a repeated machine id on
 * the same Activity. Machine ids are scoped to the parent Activity: the
 * database primary key is (item_id, component_id).
 */
export function normalizeComponentSpecs(value: unknown): ActivityComponentSpec[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new KnowledgeError(400, 'invalid_knowledge', 'components must be an array');
  }
  const seen = new Set<string>();
  return value.map((entry, index) => {
    const record = (typeof entry === 'object' && entry !== null
      ? entry as Record<string, unknown>
      : null);
    if (!record) {
      throw new KnowledgeError(400, 'invalid_knowledge', `components[${index}] must be an object`);
    }
    const componentId = asTrimmed(record.componentId, 64);
    if (!componentId) {
      throw new KnowledgeError(
        400,
        'invalid_knowledge',
        `components[${index}].componentId must be 1..64 chars (stable subordinate machine identifier)`,
      );
    }
    const displayName = asTrimmed(record.displayName, 120);
    if (!displayName) {
      throw new KnowledgeError(
        400,
        'invalid_knowledge',
        `components[${index}].displayName must be 1..120 chars`,
      );
    }
    if (record.relationship !== COMPONENT_RELATIONSHIP_ALL_REQUIRED) {
      throw new KnowledgeError(
        400,
        'unsupported_component_relationship',
        `components[${index}].relationship '${String(record.relationship)}' is not authorized: `
        + `the only PF-02 Component relationship is ALL_REQUIRED`,
      );
    }
    if (seen.has(componentId)) {
      throw new KnowledgeError(
        400,
        'duplicate_component_id',
        `components[${index}].componentId '${componentId}' is declared twice for the same Activity `
        + `(machine identifiers are unique within one canonical Activity)`,
      );
    }
    seen.add(componentId);
    return { componentId, displayName, relationship: COMPONENT_RELATIONSHIP_ALL_REQUIRED };
  });
}

interface ComponentRow {
  component_id: string;
  display_name: string;
  relationship: string;
}

function mapComponentRow(row: ComponentRow): ActivityComponentSpec {
  return {
    componentId: String(row.component_id),
    displayName: String(row.display_name),
    relationship: COMPONENT_RELATIONSHIP_ALL_REQUIRED,
  };
}

/**
 * Governed Component administration: replaces the current Component set of
 * one Knowledge item.
 *
 * PF-02-CORR-001 contract version integrity: replacing the Component set
 * is a semantic product-contract mutation, so it atomically advances
 * current_version and mints a complete snapshot (see
 * advanceProductContractVersion) instead of leaving the current version
 * stale. Unknown items reject with 404 knowledge_not_found.
 */
export async function setActivityComponents(
  db: Db,
  itemId: string,
  specs: unknown,
): Promise<ActivityComponentSpec[]> {
  const normalized = normalizeComponentSpecs(specs);
  try {
    await db.transaction(async (tx) =>
      advanceProductContractVersion(tx, itemId, { components: normalized }),
    );
  } catch (error) {
    throw mapComponentConflict(error);
  }
  return normalized;
}

/**
 * Maps a duplicate (item_id, component_id) insert to 409
 * knowledge_conflict. Same driver-variance handling as the PF-01 Activity
 * Code conflict mapper; anything else rethrows untouched.
 */
function mapComponentConflict(error: unknown): unknown {
  const code = (error as { code?: unknown }).code;
  const message = error instanceof Error ? error.message : String(error);
  if (code === '23505' || /duplicate key|UNIQUE constraint|unique constraint/i.test(message)) {
    return new KnowledgeError(
      409,
      'knowledge_conflict',
      'Component machine identifier is already in use on this Activity',
    );
  }
  return error;
}

/** Current governed Component set of one Activity (empty for non-component Activities). */
export async function listActivityComponents(db: Db, itemId: string): Promise<ActivityComponentSpec[]> {
  const result = await db.query<ComponentRow>(
    `SELECT component_id, display_name, relationship FROM activity_components
     WHERE item_id = $1 ORDER BY position, component_id`,
    [itemId],
  );
  return result.rows.map(mapComponentRow);
}

/**
 * Snapshots the current Component set into one version row. Called by
 * creation (version 1) and content revision (version N+1) inside their
 * transactions — the version row itself must already exist (the FK to
 * knowledge_item_versions enforces this). Version snapshots are
 * append-only (database trigger rejects UPDATE/DELETE).
 */
export async function snapshotVersionComponents(db: Db, itemId: string, version: number): Promise<void> {
  await db.query(
    `INSERT INTO knowledge_item_version_components (item_id, version, component_id, display_name, relationship)
     SELECT $1, $2, component_id, display_name, relationship FROM activity_components WHERE item_id = $1`,
    [itemId, version],
  );
}

/** Versioned Component rows of one historical Activity version. */
export async function listVersionComponents(
  db: Db,
  itemId: string,
  version: number,
): Promise<ActivityComponentSpec[]> {
  const result = await db.query<ComponentRow>(
    `SELECT component_id, display_name, relationship FROM knowledge_item_version_components
     WHERE item_id = $1 AND version = $2 ORDER BY component_id`,
    [itemId, version],
  );
  return result.rows.map(mapComponentRow);
}

export interface ActivityVersionPin {
  knowledgeId: string;
  activityCode: string | null;
  version: number;
  primaryMetrics: string[];
  secondaryMetrics: string[];
  compatibleUnits: string[];
  components: ActivityComponentSpec[];
  /**
   * PF-02-CORR-001: Load Reporting Bases supported by this version, so a
   * historical Weight value stays interpretable (e.g. 20 kg +
   * PER_IMPLEMENT remains "20 kg per implement").
   */
  supportedLoadBases: string[];
}

/**
 * PF-02 pinnable version structure: everything a historical Challenge
 * needs to pin without consulting live state — Activity identity
 * (UUID + immutable code), version, governed Metric/Unit contract, and the
 * required Component identifiers with their relationship. Metric/Unit
 * selection itself is PF-03 Challenge snapshot business; this resolver
 * makes the PF-02 structures versionable and pinnable. Unknown
 * items/versions resolve to null (pins are never invented).
 */
export async function resolveActivityVersionPin(
  db: Db,
  itemId: string,
  version: number,
): Promise<ActivityVersionPin | null> {
  if (typeof itemId !== 'string' || !Number.isInteger(version) || version < 1) return null;
  const item = await db.query<{
    knowledge_id: string;
    activity_code: string | null;
  }>(
    'SELECT knowledge_id, activity_code FROM knowledge_items WHERE knowledge_id = $1',
    [itemId],
  );
  if (item.rows.length !== 1) return null;
  const contract = await db.query<{
    primary_metrics: unknown;
    secondary_metrics: unknown;
    compatible_units: unknown;
    load_reporting_bases: unknown;
  }>(
    `SELECT primary_metrics, secondary_metrics, compatible_units, load_reporting_bases
     FROM knowledge_item_versions WHERE item_id = $1 AND version = $2`,
    [itemId, version],
  );
  if (contract.rows.length !== 1) return null;
  const asList = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);
  return {
    knowledgeId: String(item.rows[0].knowledge_id),
    activityCode: item.rows[0].activity_code ?? null,
    version,
    primaryMetrics: asList(contract.rows[0].primary_metrics),
    secondaryMetrics: asList(contract.rows[0].secondary_metrics),
    compatibleUnits: asList(contract.rows[0].compatible_units),
    supportedLoadBases: asList(contract.rows[0].load_reporting_bases),
    components: await listVersionComponents(db, itemId, version),
  };
}

function eligibilityFail(message: string): never {
  throw new Error(`knowledge-eligibility: ${message}`);
}

/**
 * Component-aware establishment check over one configured activity.
 * For component Activities every required Component must be addressed by
 * the configuration (ALL_REQUIRED is the only relationship, so "required"
 * means every declared Component); unknown Component ids reject; a
 * configuration naming Components for a non-component Activity rejects.
 * Pure exact-coverage check — no measurement combination, no summation.
 */
export function assertComponentCoverage(
  components: ActivityComponentSpec[],
  componentIds: string[],
  where: string,
): void {
  if (components.length === 0 && componentIds.length > 0) {
    eligibilityFail(
      `${where} names Components (${componentIds.join(', ')}) but this Activity declares none`,
    );
  }
  const declared = new Set(components.map((component) => component.componentId));
  for (const id of componentIds) {
    if (!declared.has(id)) {
      eligibilityFail(`${where} component '${id}' is not a declared Component of this Activity`);
    }
  }
  const missing = components
    .map((component) => component.componentId)
    .filter((id) => !componentIds.includes(id));
  if (missing.length > 0) {
    eligibilityFail(
      `${where} is missing required Components (${missing.join(', ')}) `
      + `(relationship ALL_REQUIRED: every required Component must satisfy the configured requirement)`,
    );
  }
}

export interface ComponentReport {
  componentId: string;
  metric: string;
  unit: string;
  value: number;
}

export interface ComponentRequirement {
  metric: string;
  unit: string;
  targetValue: number;
}

export interface ComponentSatisfaction {
  componentId: string;
  satisfied: boolean;
}

/**
 * Per-Component requirement check: one Component report satisfies the
 * configured requirement when it carries the configured Metric/Unit and
 * meets the target. The SAME comparison serves every Metric (Duration
 * reports are evaluated exactly like Repetitions reports) — no
 * accumulation across Components, no continuous-session logic, no
 * cross-Metric computation (in particular no reps x weight scoring).
 * Reports stay attributable per Component: callers keep the per-Component
 * inputs and this evaluator returns per-Component outcomes alongside the
 * Activity outcome. 40s LEFT + 20s RIGHT against a 60s requirement is one
 * satisfied and one unsatisfied Component — never a generic 60s truth.
 */
export function isComponentRequirementSatisfied(
  report: ComponentReport,
  requirement: ComponentRequirement,
): boolean {
  return (
    report.metric === requirement.metric
    && report.unit === requirement.unit
    && Number.isFinite(report.value)
    && report.value >= requirement.targetValue
  );
}

/**
 * Canonical Activity satisfaction under ALL_REQUIRED: the Activity is
 * satisfied only when every required Component is satisfied. Reports for
 * undeclared Components are ignored here (the establishment gate in
 * assertComponentCoverage rejects them fail-closed before evaluation).
 *
 * PF-02-CORR-001 hardening: as an authoritative domain evaluation path
 * this function fails closed instead of guessing. Duplicate reports for
 * one Component, reports for undeclared Components, and malformed
 * reports (missing identifiers, non-string Metric/Unit, non-finite
 * values) throw `knowledge-eligibility` errors rather than producing
 * ambiguous truth — a previously valid establishment coverage never
 * excuses ambiguous evaluation input.
 */
export function evaluateActivitySatisfaction(
  components: ActivityComponentSpec[],
  requirement: ComponentRequirement,
  reports: ComponentReport[],
): { satisfied: boolean; perComponent: ComponentSatisfaction[] } {
  const declared = new Set(components.map((component) => component.componentId));
  const byComponent = new Map<string, ComponentReport>();
  for (const [index, report] of reports.entries()) {
    const where = `reports[${index}]`;
    if (
      !report
      || typeof report.componentId !== 'string'
      || report.componentId.length === 0
      || typeof report.metric !== 'string'
      || typeof report.unit !== 'string'
      || typeof report.value !== 'number'
      || !Number.isFinite(report.value)
    ) {
      eligibilityFail(`${where} is malformed (Component report requires a componentId, string metric/unit and a finite value) [malformed_component_report]`);
    }
    if (!declared.has(report.componentId)) {
      eligibilityFail(`${where} component '${report.componentId}' is not a declared Component of this Activity [undeclared_component_report]`);
    }
    if (byComponent.has(report.componentId)) {
      eligibilityFail(`${where} duplicates the report for Component '${report.componentId}' (one report per Component; values are never combined) [duplicate_component_report]`);
    }
    byComponent.set(report.componentId, report);
  }
  const perComponent = components.map((component) => {
    const report = byComponent.get(component.componentId);
    return {
      componentId: component.componentId,
      satisfied: report !== undefined && isComponentRequirementSatisfied(report, requirement),
    };
  });
  return { satisfied: perComponent.every((entry) => entry.satisfied), perComponent };
}

export interface ConfigurationEligibilityInput extends ChallengeEligibilityAssessmentInput {
  /** Configured Metric for this Activity configuration. */
  metric: unknown;
  /** Configured Unit for this Activity configuration. */
  unit: unknown;
  /** Current governed Component set of the Activity (empty when non-component). */
  components: ActivityComponentSpec[];
  /** Component ids addressed by this configuration (undefined = none named). */
  componentIds?: unknown;
  /**
   * PF-02-CORR-001: Load Reporting Bases the Activity supports (its
   * versioned contract set). Only consulted for Weight configurations.
   */
  supportedLoadBases: string[];
  /**
   * PF-02-CORR-001: explicit Load Reporting Basis carried by this
   * configuration. Required for Weight, rejected on non-Weight.
   */
  loadBasis?: unknown;
}

/**
 * PF-02 configuration-sensitive eligibility: the PF-01 activity-level
 * assessment (published + KCS-ready + coherent governed contract) PLUS the
 * exact configured (Metric, Unit) tuple PLUS required-Component coverage
 * PLUS the Load Reporting Basis for Weight configurations.
 * Returns every blocking issue; empty means this CONFIGURATION is
 * eligible. A published Activity therefore stays distinguishable from its
 * configurations: Published does not imply every configuration eligible,
 * and different configurations of the same Activity can differ.
 * Never throws for content reasons (invalid configuration fails closed
 * via the returned issues).
 */
export function assessConfigurationEligibility(
  input: ConfigurationEligibilityInput,
): ChallengeEligibilityIssue[] {
  const issues: ChallengeEligibilityIssue[] = assessChallengeEligibility({
    lifecycle: input.lifecycle,
    kind: input.kind,
    declared: input.declared,
    snapshot: input.snapshot,
    primaryMetrics: input.primaryMetrics,
    secondaryMetrics: input.secondaryMetrics,
    compatibleUnits: input.compatibleUnits,
  });
  const permitted = new Set([...input.primaryMetrics, ...input.secondaryMetrics]);
  if (!isCanonicalMetric(input.metric)) {
    issues.push({
      code: 'unknown_metric',
      reason: `metric '${String(input.metric)}' is not a governed Metric `
        + `(completion|repetitions|duration|distance|weight|quantity)`,
    });
    return issues;
  }
  const metric = input.metric;
  if (!permitted.has(metric)) {
    issues.push({
      code: 'metric_not_permitted',
      reason: `metric '${metric}' is not permitted for this Activity `
        + `(permitted: ${[...permitted].sort().join(', ') || 'none'})`,
    });
  }
  if (typeof input.unit !== 'string' || !input.compatibleUnits.includes(input.unit)) {
    issues.push({
      code: 'unit_not_compatible',
      reason: `unit '${String(input.unit)}' is not compatible with this Activity `
        + `(compatible: ${[...input.compatibleUnits].sort().join(', ') || 'none'})`,
    });
  } else {
    const unitMetric = metricForUnit(input.unit);
    if (unitMetric !== metric) {
      issues.push({
        code: 'unit_metric_mismatch',
        reason: `unit '${input.unit}' expresses Metric '${unitMetric ?? 'ungoverned'}', `
          + `not the configured metric '${metric}' (the (Activity, Metric, Unit) tuple must be governed as a whole)`,
      });
    }
  }
  const components = Array.isArray(input.components) ? input.components : [];
  let configuredIds: string[] = [];
  if (input.componentIds !== undefined) {
    if (!Array.isArray(input.componentIds) || input.componentIds.some((id) => typeof id !== 'string')) {
      issues.push({
        code: 'invalid_components',
        reason: 'componentIds must be an array of Component machine identifiers when present',
      });
      return issues;
    }
    configuredIds = [...input.componentIds];
  }
  const declared = new Set(components.map((component) => component.componentId));
  for (const id of configuredIds) {
    if (!declared.has(id)) {
      issues.push({
        code: 'unknown_component',
        reason: `component '${id}' is not a declared Component of this Activity`,
      });
    }
  }
  if (components.length === 0 && configuredIds.length > 0) {
    issues.push({
      code: 'unexpected_components',
      reason: `configuration names Components (${configuredIds.join(', ')}) but this Activity declares none`,
    });
  }
  const missing = components
    .map((component) => component.componentId)
    .filter((id) => !configuredIds.includes(id));
  if (missing.length > 0) {
    issues.push({
      code: 'missing_required_components',
      reason: `configuration is missing required Components (${missing.join(', ')}) `
        + `(relationship ALL_REQUIRED: every required Component must satisfy the configured requirement)`,
    });
  }
  // PF-02-CORR-001 Load Reporting Convention eligibility. A Weight
  // configuration is eligible only with an explicit authorized basis the
  // Activity supports, plus explicit reporting meaning (measurement
  // guidance and unit semantics); anything else fails closed. Non-Weight
  // configurations never require a basis — carrying one rejects, so a
  // stray basis cannot silently attach to an innocent configuration.
  const supportedBases = Array.isArray(input.supportedLoadBases)
    ? input.supportedLoadBases.filter((basis) => typeof basis === 'string')
    : [];
  if (metric === 'weight') {
    if (input.loadBasis === undefined) {
      issues.push({
        code: 'missing_load_basis',
        reason: 'Weight configurations require one explicit authorized Load Reporting Basis '
          + `(${LOAD_REPORTING_BASES.join('|')})`,
      });
    } else if (!isLoadReportingBasis(input.loadBasis)) {
      issues.push({
        code: 'unknown_load_basis',
        reason: `Load Reporting Basis '${String(input.loadBasis)}' is not authorized `
          + `(${LOAD_REPORTING_BASES.join('|')})`,
      });
    } else if (!supportedBases.includes(input.loadBasis)) {
      issues.push({
        code: 'unsupported_load_basis',
        reason: `Load Reporting Basis '${input.loadBasis}' is not supported by this Activity `
          + `(supported: ${[...supportedBases].sort().join(', ') || 'none'})`,
      });
    }
    if (input.snapshot.measurementGuidance.trim().length === 0
      || input.snapshot.unitSemantics.trim().length === 0) {
      issues.push({
        code: 'missing_weight_reporting_meaning',
        reason: 'Weight configurations require explicit reporting meaning '
          + '(measurement guidance and unit semantics must both be present)',
      });
    }
  } else if (input.loadBasis !== undefined) {
    issues.push({
      code: 'unexpected_load_basis',
      reason: `Load Reporting Basis '${String(input.loadBasis)}' does not apply to non-Weight configurations`,
    });
  }
  return issues;
}
