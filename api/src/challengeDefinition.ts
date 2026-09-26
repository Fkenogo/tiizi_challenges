/**
 * PF-03 Challenge Definition Contract — one authoritative server-side
 * Challenge Definition validator.
 *
 * Product chain: Canonical Activity Knowledge → governed
 * Activity/Metric/Unit/Component compatibility (PF-02) → Challenge
 * Definition (THIS module) → Template / Challenge Creation Wizard →
 * Challenge establishment → Challenge Engine → Derived Truth.
 *
 * This module owns the Challenge Definition layer only: it validates a
 * definition input against the pinned canonical Activity version and
 * returns one normalized Challenge Definition with explicit fields, so
 * Wizard Preview, Template validation and Challenge establishment never
 * develop separate semantic validators. PF-03 does not build those UIs;
 * it establishes the validator (plus the persistence in migration 017).
 *
 * Settled semantics encoded here (never invented):
 * - challenge types: collective | competitive | streak (no new types);
 * - identity by UUID / immutable Activity Code / CURRENT pinned Knowledge
 *   version — display names are never identity; supplied versions must
 *   equal current (stale versions reject; history stays read-only);
 * - PF-02 exact (Activity, Metric, Unit) compatibility, no Cartesian
 *   inference, six governed Metrics unchanged;
 * - Components: required ids pinned, ALL_REQUIRED only, per-Component
 *   targets (never summed), no separate Activities for Components;
 * - Weight: exactly one explicit authorized Load Reporting Basis from
 *   the Activity version's supported set; absent basis fails closed;
 *   non-Weight + basis rejects;
 * - Duration: CONTINUOUS | ACCUMULATED required exactly where Duration
 *   is the configured Metric (never inferred, never silently defaulted);
 * - Completion: intelligible occurrence required (never a bare "Done");
 * - Streak: DAILY cadence fixed, ALL daily requirements Done, missed day
 *   resets Current Streak, reset_on_miss=false is not a valid V2 option;
 * - Competitive: standard competition ranking (1,1,3 / 1,2,2,4 /
 *   1,2,3,3,5); dense ranking has no selector; one finisher never ends;
 * - Collective: goal crossing with actuals past 100%; reaching goal may
 *   complete early (engine behavior, no config flag);
 * - Group Membership authority stays outside the definition and is checked
 *   live by the PostgreSQL-backed V2 establishment path;
 * - Verification (ACT-03), Correction (ACT-04), Recognition (MOT-01) and
 *   Rewards are deferred: no such fields exist here;
 * - Run Again = new Challenge (no reopening primitive exists).
 *
 * Provider-neutral: pure domain + `Db`. No Firebase, no routes.
 */

import type { Db } from './db.js';
import {
  assessConfigurationEligibility,
  type ConfigurationEligibilityInput,
} from './activityComponents.js';
import {
  getKnowledgeByCode,
  getKnowledgeById,
  isActivityCode,
  isUuid,
  snapshotItemForReadiness,
} from './knowledge.js';
import { resolveActivityVersionPin } from './activityComponents.js';
import { isCanonicalMetric, type CanonicalMetric } from './measurementVocabulary.js';
import {
  assertValidTimezone,
  getChallengeConfig,
  type ActivityConfigRow,
} from './challengeConfigs.js';

export type ChallengeDefinitionType = 'collective' | 'competitive' | 'streak';

export type DurationMode = 'CONTINUOUS' | 'ACCUMULATED';

const DURATION_MODES: readonly string[] = ['CONTINUOUS', 'ACCUMULATED'];

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function fail(message: string): never {
  throw new Error(`challenge-definition: ${message}`);
}

function asTrimmed(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > max) return null;
  return trimmed;
}

/** Bounded Challenge-level temporal conditions: at/before/after/within only. */
export interface TemporalConditionsInput {
  at?: unknown;
  before?: unknown;
  after?: unknown;
  within?: unknown;
}

export interface TemporalConditions {
  at: string | null;
  before: string | null;
  after: string | null;
  within: { start: string; end: string } | null;
}

function asTime(value: unknown, field: string): string {
  if (typeof value !== 'string' || !TIME_RE.test(value)) {
    fail(`[${field}] temporalConditions.${field} must be HH:MM (00:00-23:59) when present`);
  }
  return value;
}

/**
 * Validate bounded temporal conditions. Unknown keys reject (no general
 * rules engine); an explicitly empty object rejects (meaning must be
 * explicit); within requires start < end.
 */
export function normalizeTemporalConditions(value: unknown): TemporalConditions | null {
  if (value === undefined) return null;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail('[invalid_temporal_conditions] temporalConditions must be an object when present');
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== 'at' && key !== 'before' && key !== 'after' && key !== 'within') {
      fail(`[invalid_temporal_conditions] temporalConditions key '${key}' is not authorized (at|before|after|within only)`);
    }
  }
  const at = record.at === undefined ? null : asTime(record.at, 'at');
  const before = record.before === undefined ? null : asTime(record.before, 'before');
  const after = record.after === undefined ? null : asTime(record.after, 'after');
  let within: { start: string; end: string } | null = null;
  if (record.within !== undefined) {
    const w = record.within;
    if (typeof w !== 'object' || w === null || Array.isArray(w)) {
      fail('[invalid_temporal_conditions] temporalConditions.within must be an object when present');
    }
    const wr = w as Record<string, unknown>;
    for (const key of Object.keys(wr)) {
      if (key !== 'start' && key !== 'end') {
        fail(`[invalid_temporal_conditions] temporalConditions.within key '${key}' is not authorized (start|end only)`);
      }
    }
    const start = asTime(wr.start, 'within.start');
    const end = asTime(wr.end, 'within.end');
    if (end <= start) fail('[invalid_temporal_conditions] temporalConditions.within requires end after start');
    within = { start, end };
  }
  if (at === null && before === null && after === null && within === null) {
    fail('[invalid_temporal_conditions] temporalConditions must carry at least one condition when present');
  }
  return { at, before, after, within };
}

export interface DefinitionActivityInput {
  /** Immutable identity ONLY: Activity UUID or Activity Code. Never a name. */
  activity: unknown;
  /** Pinned Knowledge version (defaults to current). Must resolve. */
  version?: unknown;
  metric: unknown;
  unit: unknown;
  targetValue: unknown;
  /** Required Component ids (required exactly when the version declares any). */
  componentIds?: unknown;
  /** Required exactly for Weight; rejected otherwise. */
  loadBasis?: unknown;
  /** Required exactly for Duration (CONTINUOUS|ACCUMULATED); rejected otherwise. */
  durationMode?: unknown;
  /** Required exactly for Completion (intelligible occurrence); rejected otherwise. */
  completionOccurrence?: unknown;
  position?: unknown;
  activityVariant?: unknown;
}

export interface ChallengeDefinitionInput {
  challengeType: unknown;
  title: unknown;
  description?: unknown;
  instructions?: unknown;
  startDate: unknown;
  endDate: unknown;
  /** IANA timezone. Required for streak (day boundaries); UTC default otherwise. */
  timezone?: unknown;
  goalValue?: unknown;
  goalUnit?: unknown;
  requiredConsecutiveDays?: unknown;
  /** Only true is a valid V2 option; false rejects. */
  resetOnMiss?: unknown;
  temporalConditions?: unknown;
  activities: DefinitionActivityInput[];
}

export interface NormalizedComponentTarget {
  componentId: string;
  targetValue: number;
}

export interface NormalizedDefinitionActivity {
  /** Identity as given (UUID or Code). */
  canonicalKey: string;
  knowledgeId: string;
  activityCode: string | null;
  knowledgeVersion: number;
  /** Fitness or Wellness domain of the pinned Activity version. */
  kind: 'fitness' | 'wellness';
  metric: CanonicalMetric;
  unit: string;
  /** Challenge-owned target (never stored in Activity Knowledge). */
  targetValue: number;
  /** Pinned required Component ids ([] when the version declares none). */
  requiredComponents: string[];
  componentRelationship: 'ALL_REQUIRED' | null;
  /** Per-Component targets: the SAME target applied to EACH required
   * Component (never summed — 40s Left + 20s Right is not 60s). */
  componentTargets: NormalizedComponentTarget[];
  loadReportingBasis: string | null;
  durationMode: DurationMode | null;
  completionOccurrence: string | null;
  position: number;
  activityVariant: string | null;
  /** Pinned contract summary for historical intelligibility. */
  contract: {
    primaryMetrics: string[];
    secondaryMetrics: string[];
    compatibleUnits: string[];
    supportedLoadBases: string[];
  };
}

export interface NormalizedChallengeDefinition {
  definitionKind: 'pf03-v1';
  challengeType: ChallengeDefinitionType;
  title: string;
  description: string;
  instructions: string;
  window: { startDate: string; endDate: string; timezone: string };
  temporalConditions: TemporalConditions | null;
  /** Collective only. */
  goalValue: number | null;
  goalUnit: string | null;
  /** Streak only: fixed DAILY cadence + settled daily rules. */
  requiredConsecutiveDays: number | null;
  resetOnMiss: boolean;
  cadence: 'DAILY' | null;
  activities: NormalizedDefinitionActivity[];
}

const ACTIVITY_INPUT_KEYS = new Set([
  'activity',
  'version',
  'metric',
  'unit',
  'targetValue',
  'componentIds',
  'loadBasis',
  'durationMode',
  'completionOccurrence',
  'position',
  'activityVariant',
]);

const DEFINITION_INPUT_KEYS = new Set([
  'challengeType',
  'title',
  'description',
  'instructions',
  'startDate',
  'endDate',
  'timezone',
  'goalValue',
  'goalUnit',
  'requiredConsecutiveDays',
  'resetOnMiss',
  'temporalConditions',
  'activities',
]);

function rejectUnknownKeys(record: Record<string, unknown>, allowed: Set<string>, where: string): void {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      fail(`[${where}_not_configurable] '${key}' is not a governed Challenge Definition field `
        + `(settled semantics carry no such selector; contradictory flags are rejected, never stored)`);
    }
  }
}

function asDay(value: unknown, field: string): string {
  if (typeof value !== 'string' || !DAY_RE.test(value)) {
    fail(`[${field}] ${field} must be YYYY-MM-DD`);
  }
  return value;
}

async function normalizeActivity(
  db: Db,
  raw: DefinitionActivityInput,
  index: number,
): Promise<NormalizedDefinitionActivity> {
  const where = `activities[${index}]`;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    fail(`[${where}] activity definition must be an object`);
  }
  rejectUnknownKeys(raw as unknown as Record<string, unknown>, ACTIVITY_INPUT_KEYS, `${where}`);
  // 1. Identity: UUID or immutable Code. A display name is never identity.
  const identity = raw.activity;
  let knowledgeId: string;
  if (typeof identity === 'string' && isUuid(identity)) {
    knowledgeId = identity;
  } else if (isActivityCode(identity)) {
    const byCode = await getKnowledgeByCode(db, identity);
    if (!byCode) fail(`[${where}_unknown_activity] no canonical Activity for code '${identity}' (pins are never invented)`);
    knowledgeId = byCode.id;
  } else {
    fail(`[${where}_not_identity] activity must be an Activity UUID or immutable Activity Code (mutable display names are never identity)`);
  }
  const item = await getKnowledgeById(db, knowledgeId);
  if (!item) fail(`[${where}_unknown_activity] no canonical Activity for identity (pins are never invented)`);
  if (item.lifecycle !== 'published') {
    fail(`[${where}_not_published] Activity '${item.activityCode ?? knowledgeId}' is not published (Published != Challenge Eligible; drafts never establish)`);
  }
  // PF-03-CORR-001 current-version gate: NEW Challenge Definitions pin the
  // CURRENT canonical Activity version only. An omitted version pins
  // current; a supplied version MUST equal current, otherwise the request
  // is stale (the preview/template was built against a superseded
  // contract and must be reviewed — never silently upgraded). Historical
  // versions remain resolvable for established snapshots, reads, replay
  // and audit (resolveActivityVersionPin / getGoverningVersion), but they
  // are not selectable for new creation. Eligibility/readiness is therefore
  // always evaluated coherently from the same current contract.
  const currentVersion = item.knowledgeVersion;
  if (raw.version !== undefined && raw.version !== currentVersion) {
    fail(`[${where}_stale_activity_version] version ${String(raw.version)} is not current `
      + `(current version is ${currentVersion}): new Challenges pin the current Activity version; `
      + `revalidate the definition against v${currentVersion} (silent upgrade is never performed)`);
  }
  const version = currentVersion;
  const pin = await resolveActivityVersionPin(db, knowledgeId, version);
  if (!pin) {
    fail(`[${where}_unresolvable_version] Activity version ${version} does not resolve (historical versions are never invented)`);
  }
  // 3. Exact Metric/Unit compatibility against the PINNED contract.
  if (!isCanonicalMetric(raw.metric)) {
    fail(`[${where}_unknown_metric] metric must be a governed Metric (completion|repetitions|duration|distance|weight|quantity)`);
  }
  const metric = raw.metric;
  if (typeof raw.unit !== 'string' || raw.unit.length === 0) {
    fail(`[${where}_invalid_unit] unit is required`);
  }
  // Target: explicit and Challenge-owned (never Knowledge). Numeric
  // Metrics require a meaningful positive target (zero is not a
  // Challenge); Completion keeps engine-compatible >= 0 with the
  // occurrence as the participant-facing requirement.
  if (typeof raw.targetValue !== 'number' || !Number.isFinite(raw.targetValue) || raw.targetValue < 0) {
    fail(`[${where}_invalid_target] targetValue must be a finite number >= 0 (the target belongs to the Challenge Definition, never to Activity Knowledge)`);
  }
  if (metric !== 'completion' && (raw.targetValue as number) <= 0) {
    fail(`[${where}_meaningless_target] targetValue must be > 0 for ${metric} (a zero target is not a Challenge; no zero-target exception exists)`);
  }
  const eligibilityInput: ConfigurationEligibilityInput = {
    lifecycle: item.lifecycle,
    kind: item.kind,
    declared: item.contentClasses,
    snapshot: snapshotItemForReadiness(item),
    primaryMetrics: pin.primaryMetrics,
    secondaryMetrics: pin.secondaryMetrics,
    compatibleUnits: pin.compatibleUnits,
    supportedLoadBases: pin.supportedLoadBases,
    components: pin.components,
    metric,
    unit: raw.unit,
    componentIds: raw.componentIds,
    loadBasis: raw.loadBasis,
  };
  const issues = assessConfigurationEligibility(eligibilityInput);
  if (issues.length > 0) {
    fail(`[${where}_${issues[0].code}] ${issues[0].reason}`);
  }
  // 4. Duration mode: required exactly where Duration is configured.
  let durationMode: DurationMode | null = null;
  if (metric === 'duration') {
    if (raw.durationMode !== 'CONTINUOUS' && raw.durationMode !== 'ACCUMULATED') {
      fail(`[${where}_ambiguous_duration] Duration requires an explicit durationMode (CONTINUOUS|ACCUMULATED): `
        + `30 continuous minutes and 30 accumulated minutes are not the same Challenge, and the mode is never inferred from the Activity`);
    }
    durationMode = raw.durationMode;
  } else if (raw.durationMode !== undefined) {
    fail(`[${where}_unexpected_duration_mode] durationMode applies to Duration configurations only`);
  }
  // 5. Completion occurrence: intelligible, never a bare "Done".
  let completionOccurrence: string | null = null;
  if (metric === 'completion') {
    const occurrence = asTrimmed(raw.completionOccurrence, 500);
    if (!occurrence) {
      fail(`[${where}_missing_occurrence] Completion requires an intelligible completionOccurrence: `
        + `what exactly must the participant complete for this Challenge occurrence? (generic undefined "Done" is not allowed; `
        + `use the Activity completionMeaning plus Challenge-specific occurrence)`);
    }
    if (occurrence.toLowerCase() === 'done') {
      fail(`[${where}_generic_occurrence] completionOccurrence 'Done' is not intelligible: state what the participant must complete`);
    }
    completionOccurrence = occurrence;
  } else if (raw.completionOccurrence !== undefined) {
    fail(`[${where}_unexpected_occurrence] completionOccurrence applies to Completion configurations only`);
  }
  const requiredComponents = pin.components.map((component) => component.componentId);
  const targetValue = raw.targetValue as number;
  let position = index;
  if (raw.position !== undefined) {
    if (!Number.isInteger(raw.position) || (raw.position as number) < 0) {
      fail(`[${where}_invalid_position] position must be an integer >= 0 when present`);
    }
    position = raw.position as number;
  }
  let activityVariant: string | null = null;
  if (raw.activityVariant !== undefined && raw.activityVariant !== null) {
    const variant = asTrimmed(raw.activityVariant, 120);
    if (!variant) fail(`[${where}_invalid_variant] activityVariant must be 1..120 chars when present`);
    activityVariant = variant;
  }
  return {
    canonicalKey: String(identity),
    knowledgeId,
    activityCode: pin.activityCode,
    knowledgeVersion: version,
    kind: item.kind,
    metric,
    unit: raw.unit,
    targetValue,
    requiredComponents,
    componentRelationship: requiredComponents.length > 0 ? 'ALL_REQUIRED' : null,
    componentTargets: requiredComponents.map((componentId) => ({ componentId, targetValue })),
    loadReportingBasis: metric === 'weight' ? String(raw.loadBasis) : null,
    durationMode,
    completionOccurrence,
    position,
    activityVariant,
    contract: {
      primaryMetrics: pin.primaryMetrics,
      secondaryMetrics: pin.secondaryMetrics,
      compatibleUnits: pin.compatibleUnits,
      supportedLoadBases: pin.supportedLoadBases,
    },
  };
}

/**
 * Validate one Challenge Definition and return its normalized contract.
 * Pure validation (reads Knowledge only; writes nothing). Throws
 * fail-closed `challenge-definition` errors; invalid input never yields a
 * partial definition.
 */
export async function validateChallengeDefinition(
  db: Db,
  raw: ChallengeDefinitionInput,
): Promise<NormalizedChallengeDefinition> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    fail('[invalid_definition] Challenge Definition must be an object');
  }
  rejectUnknownKeys(raw as unknown as Record<string, unknown>, DEFINITION_INPUT_KEYS, 'definition');
  const challengeType = raw.challengeType;
  if (challengeType !== 'collective' && challengeType !== 'competitive' && challengeType !== 'streak') {
    fail('[invalid_type] challengeType must be collective|competitive|streak (no new types)');
  }
  const title = asTrimmed(raw.title, 200);
  if (!title) fail('[invalid_title] title is required (1..200 chars)');
  const description = raw.description === undefined ? '' : asTrimmed(raw.description, 2000) ?? '';
  if (raw.description !== undefined && asTrimmed(raw.description, 2000) === null) {
    fail('[invalid_description] description must be at most 2000 chars');
  }
  const instructions = raw.instructions === undefined ? '' : asTrimmed(raw.instructions, 2000) ?? '';
  if (raw.instructions !== undefined && asTrimmed(raw.instructions, 2000) === null) {
    fail('[invalid_instructions] instructions must be at most 2000 chars');
  }
  const startDate = asDay(raw.startDate, 'startDate');
  const endDate = asDay(raw.endDate, 'endDate');
  if (endDate < startDate) fail('[invalid_window] endDate must be on or after startDate');
  // Timezone: required where day-boundary semantics require it (streak);
  // otherwise the EBC-03 UTC convention carries forward.
  let timezone = 'UTC';
  if (challengeType === 'streak') {
    if (raw.timezone === undefined) {
      fail('[missing_timezone] streak definitions require an explicit timezone (the Challenge timezone governs day boundaries; it is never inferred from a device)');
    }
    timezone = assertValidTimezone(raw.timezone);
  } else if (raw.timezone !== undefined) {
    timezone = assertValidTimezone(raw.timezone);
  }
  let goalValue: number | null = null;
  let goalUnit: string | null = null;
  let requiredConsecutiveDays: number | null = null;
  let resetOnMiss = true;
  let cadence: 'DAILY' | null = null;
  if (challengeType === 'collective') {
    if (typeof raw.goalValue !== 'number' || !Number.isFinite(raw.goalValue) || raw.goalValue <= 0) {
      fail('[invalid_goal] collective definitions require goalValue > 0');
    }
    const unit = asTrimmed(raw.goalUnit, 40);
    if (!unit) fail('[invalid_goal] collective definitions require goalUnit (1..40 chars)');
    if (raw.requiredConsecutiveDays !== undefined) {
      fail('[streak_only] requiredConsecutiveDays belongs to streak definitions only');
    }
    goalValue = raw.goalValue;
    goalUnit = unit;
  } else if (challengeType === 'streak') {
    if (!Number.isInteger(raw.requiredConsecutiveDays) || (raw.requiredConsecutiveDays as number) < 1) {
      fail('[invalid_streak] streak definitions require requiredConsecutiveDays (integer >= 1)');
    }
    if (raw.goalValue !== undefined || raw.goalUnit !== undefined) {
      fail('[collective_only] goalValue/goalUnit belong to collective definitions only');
    }
    if (raw.resetOnMiss !== undefined && raw.resetOnMiss !== true) {
      fail('[reset_on_miss_not_optional] reset_on_miss=false is not a valid V2 option (a missed day resets Current Streak; no ordinary grace period)');
    }
    requiredConsecutiveDays = raw.requiredConsecutiveDays as number;
    cadence = 'DAILY';
  } else {
    if (raw.goalValue !== undefined || raw.goalUnit !== undefined) {
      fail('[collective_only] goalValue/goalUnit belong to collective definitions only');
    }
    if (raw.requiredConsecutiveDays !== undefined) {
      fail('[streak_only] requiredConsecutiveDays belongs to streak definitions only');
    }
    if (raw.resetOnMiss !== undefined) {
      fail('[streak_only] resetOnMiss belongs to streak definitions only');
    }
  }
  if (!Array.isArray(raw.activities) || raw.activities.length === 0) {
    fail('[invalid_activities] at least one activity requirement is required');
  }
  if (raw.activities.length > 50) fail('[invalid_activities] at most 50 activity requirements per definition');
  const temporalConditions = normalizeTemporalConditions(raw.temporalConditions);
  const activities: NormalizedDefinitionActivity[] = [];
  const seen = new Set<string>();
  for (const [index, entry] of raw.activities.entries()) {
    const normalized = await normalizeActivity(db, entry, index);
    const identity = `${normalized.canonicalKey}::${normalized.activityVariant ?? ''}`;
    if (seen.has(identity)) fail(`[duplicate_activity] duplicate activity requirement for '${identity}'`);
    seen.add(identity);
    activities.push(normalized);
  }
  // Collective homogeneity (C3A): every activity unit equals the goal unit.
  if (challengeType === 'collective') {
    for (const [index, activity] of activities.entries()) {
      if (activity.unit !== goalUnit) {
        fail(`[collective_unit_mismatch] activities[${index}] unit '${activity.unit}' `
          + `must exactly equal goal_unit '${goalUnit}' (no unit conversion is inferred)`);
      }
    }
  }
  return {
    definitionKind: 'pf03-v1',
    challengeType,
    title,
    description,
    instructions,
    window: { startDate, endDate, timezone },
    temporalConditions,
    goalValue,
    goalUnit,
    requiredConsecutiveDays,
    resetOnMiss,
    cadence,
    activities,
  };
}

/**
 * Build the immutable version snapshot for one normalized definition.
 * The snapshot keeps the established top-level shape engines consume
 * (challenge_type, period, timezone, type_params, activities) and adds
 * the PF-03 definition authority: definition_kind marker, Challenge-level
 * temporal_conditions, the full normalized definition, and the per-activity
 * pins. JSON-stable key order, mirroring buildConfigSnapshot.
 */
export function buildDefinitionSnapshot(
  normalized: NormalizedChallengeDefinition,
): Record<string, unknown> {
  return {
    challenge_type: normalized.challengeType,
    period: { start_date: normalized.window.startDate, end_date: normalized.window.endDate },
    timezone: normalized.window.timezone,
    type_params: {
      goal_value: normalized.goalValue,
      goal_unit: normalized.goalUnit,
      required_consecutive_days: normalized.requiredConsecutiveDays,
      reset_on_miss: normalized.resetOnMiss,
    },
    definition_kind: normalized.definitionKind,
    temporal_conditions: normalized.temporalConditions,
    definition: JSON.parse(JSON.stringify(normalized)) as Record<string, unknown>,
    activities: normalized.activities.map((activity) => ({
      canonical_key: activity.canonicalKey,
      activity_variant: activity.activityVariant,
      knowledge_id: activity.knowledgeId,
      knowledge_version: activity.knowledgeVersion,
      metric: activity.metric,
      target_value: activity.targetValue,
      unit: activity.unit,
      position: activity.position,
      conditions: {},
      activity_code: activity.activityCode,
      required_components: activity.requiredComponents,
      component_relationship: activity.componentRelationship,
      load_reporting_basis: activity.loadReportingBasis,
      duration_mode: activity.durationMode,
      completion_occurrence: activity.completionOccurrence,
    })),
  };
}

/**
 * Persist one immutable definition version + its activity rows with the
 * PF-03 pins. Caller owns the transaction and the
 * challenges.current_config_version bump (mirrors insertConfigVersion;
 * the single source of truth stays the version tables — no duplicate).
 * Later Activity Knowledge changes cannot rewrite these rows
 * (append-only triggers); history stays put.
 */
export async function insertChallengeDefinitionVersion(
  tx: Db,
  challengeId: string,
  version: number,
  normalized: NormalizedChallengeDefinition,
): Promise<{ snapshot: Record<string, unknown>; activities: ActivityConfigRow[] }> {
  const snapshot = buildDefinitionSnapshot(normalized);
  await tx.query(
    `INSERT INTO challenge_config_versions (challenge_id, version, snapshot)
     VALUES ($1, $2, $3)`,
    [challengeId, version, JSON.stringify(snapshot)],
  );
  for (const activity of normalized.activities) {
    await tx.query(
      `INSERT INTO challenge_activity_configs
         (challenge_id, version, canonical_key, activity_variant,
          knowledge_id, knowledge_version, metric, target_value, unit, position, conditions,
          activity_code, required_components, component_relationship,
          load_reporting_basis, duration_mode, completion_occurrence)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        challengeId, version, activity.canonicalKey, activity.activityVariant,
        activity.knowledgeId, activity.knowledgeVersion, activity.metric,
        activity.targetValue, activity.unit, activity.position, JSON.stringify({}),
        activity.activityCode, activity.requiredComponents, activity.componentRelationship,
        activity.loadReportingBasis, activity.durationMode, activity.completionOccurrence,
      ],
    );
  }
  const reread = await getChallengeConfig(tx, challengeId, version);
  return { snapshot, activities: reread.activities };
}
