/**
 * PF-04 Challenge Creation Composer Contract — the editable draft/state
 * model consumed by the future PF-05 V2 Challenge Creation Wizard.
 *
 * Product chain: Canonical Activity Catalogue → Challenge Creation
 * Composer (THIS module) → PF-03 Challenge Definition validator →
 * normalized Challenge Definition → Preview → Establish Challenge.
 *
 * PF-03 REMAINS THE SEMANTIC AUTHORITY. The Composer may be incomplete
 * while a user moves through the Wizard; stage assessment answers only
 * "does the draft contain enough information to move forward?" — never
 * "is this a valid Challenge?". Final semantic validity belongs only to
 * validateChallengeDefinition. There is no second validator here.
 *
 * Product direction (governing, not implemented here):
 * - the V2 Challenge Creation Wizard is the core Challenge creation
 *   system; Templates are NOT a separate creation system;
 * - PF-06 will generate Templates THROUGH THE SAME Wizard
 *   (TEMPLATE_AUTHORING mode) and manage them from the Admin panel;
 * - for members, a Template only pre-populates this same Composer draft
 *   ("Use a Template" shortcut → review/adjust → Preview → Establish);
 * - Templates never bypass PF-03 and never establish Challenges directly;
 * - there is never a second Template configuration form.
 *
 * V1 quarantine (CreateChallengeWizard inspected as UX evidence only):
 * nothing is carried forward — no fuzzy/name Activity matching, no
 * synthetic Wellness IDs, no implicit Metric/Unit, no split Fitness vs
 * Wellness creation semantics, no points, no frequency defaults, no
 * donation fields, no reset-on-miss option, no direct Firebase Challenge
 * creation, no fake preview routes, no old Template authorities, no V1
 * data migration. No V1 imports exist in this module.
 *
 * This is a bounded domain package: pure domain + `Db` reads for
 * Knowledge-derived truth. No routes, no UI, no persistence, no Firebase.
 */

import {
  resolveActivityVersionPin,
} from './activityComponents.js';
import {
  validateChallengeDefinition,
  type ChallengeDefinitionInput,
  type NormalizedChallengeDefinition,
} from './challengeDefinition.js';
import type { Db } from './db.js';
import {
  getKnowledgeByCode,
  getKnowledgeById,
  isActivityCode,
  isUuid,
} from './knowledge.js';

/** Future Wizard context. Affects the eventual FINISH action only —
 *  never Challenge semantics (both modes share every field and the same
 *  PF-03 validator). PF-05 implements CHALLENGE; PF-06 adds
 *  TEMPLATE_AUTHORING through the same Wizard. */
export type ComposerMode = 'CHALLENGE' | 'TEMPLATE_AUTHORING';

const COMPOSER_MODES: readonly string[] = ['CHALLENGE', 'TEMPLATE_AUTHORING'];

/** Conceptual V2 Wizard stages (product-flow contract, not UI pages). */
export type WizardStage =
  | 'TYPE'
  | 'BASICS'
  | 'ACTIVITIES'
  | 'MEASUREMENT'
  | 'REQUIREMENT'
  | 'SCHEDULE'
  | 'RULES'
  | 'REVIEW'
  | 'FINISH';

export const WIZARD_STAGES: readonly WizardStage[] = [
  'TYPE',
  'BASICS',
  'ACTIVITIES',
  'MEASUREMENT',
  'REQUIREMENT',
  'SCHEDULE',
  'RULES',
  'REVIEW',
  'FINISH',
];

/** Composer fields owned by each stage (dot paths into the draft). */
const STAGE_FIELDS: Record<WizardStage, readonly string[]> = {
  TYPE: ['challengeType'],
  BASICS: ['title', 'description', 'instructions'],
  ACTIVITIES: ['activities[].activity', 'activities[].observedVersion', 'activities[].kind'],
  MEASUREMENT: [
    'activities[].metric',
    'activities[].unit',
    'activities[].componentIds',
    'activities[].loadBasis',
  ],
  REQUIREMENT: [
    'activities[].targetValue',
    'activities[].durationMode',
    'activities[].completionOccurrence',
  ],
  SCHEDULE: ['startDate', 'endDate', 'timezone', 'temporalConditions'],
  RULES: ['goalValue', 'goalUnit', 'requiredConsecutiveDays'],
  REVIEW: [],
  FINISH: [],
};

export function fieldsForStage(stage: WizardStage): string[] {
  const fields = STAGE_FIELDS[stage];
  if (!fields) fail(`unknown Wizard stage '${String(stage)}'`);
  return [...fields];
}

export type ComposerIssueCode =
  | 'MISSING_FIELD'
  | 'STALE_ACTIVITY'
  | 'STAGE_INCOMPLETE'
  | 'PF03_SEMANTIC'
  | 'INVALID_DRAFT';

export interface ComposerIssue {
  code: ComposerIssueCode;
  field?: string;
  stage?: WizardStage;
  activityIndex?: number;
  message: string;
}

export interface ComposerActivity {
  /** Immutable identity ONLY: Activity UUID or Activity Code. Never a name. */
  activity: string;
  /** Canonical version observed when selected (staleness is detected, never auto-fixed). */
  observedVersion: number;
  /** Fitness / Wellness domain derived from Knowledge at selection. */
  kind: 'fitness' | 'wellness';
  metric?: string;
  unit?: string;
  targetValue?: number;
  componentIds?: string[];
  loadBasis?: string;
  durationMode?: string;
  completionOccurrence?: string;
  activityVariant?: string | null;
  position?: number;
}

export interface ComposerTemporalConditions {
  at?: string;
  before?: string;
  after?: string;
  within?: { start: string; end: string };
}

export interface ChallengeComposerDraft {
  draftKind: 'pf04-v1';
  mode: ComposerMode;
  challengeType?: 'collective' | 'competitive' | 'streak';
  title?: string;
  description?: string;
  instructions?: string;
  activities: ComposerActivity[];
  startDate?: string;
  endDate?: string;
  timezone?: string;
  temporalConditions?: ComposerTemporalConditions;
  goalValue?: number;
  goalUnit?: string;
  requiredConsecutiveDays?: number;
}

function fail(message: string): never {
  throw new Error(`challenge-composer: ${message}`);
}

const DRAFT_KEYS = new Set([
  'draftKind',
  'mode',
  'challengeType',
  'title',
  'description',
  'instructions',
  'activities',
  'startDate',
  'endDate',
  'timezone',
  'temporalConditions',
  'goalValue',
  'goalUnit',
  'requiredConsecutiveDays',
]);

const ACTIVITY_KEYS = new Set([
  'activity',
  'observedVersion',
  'kind',
  'metric',
  'unit',
  'targetValue',
  'componentIds',
  'loadBasis',
  'durationMode',
  'completionOccurrence',
  'activityVariant',
  'position',
]);

/**
 * Strict draft normalization: unknown fields reject fail-closed (no
 * Verification/Recognition/Rewards/points/frequency/donation/rules-engine
 * keys can smuggle in — they are simply not members of the contract).
 * Scalar shapes are checked lightly (types only); semantics belong to PF-03.
 */
export function normalizeComposerDraft(raw: unknown): ChallengeComposerDraft {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    fail('[INVALID_DRAFT] Composer draft must be an object');
  }
  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!DRAFT_KEYS.has(key)) {
      fail(`[INVALID_DRAFT] unknown Composer field '${key}' is rejected `
        + `(the Composer carries no Verification/Recognition/Rewards/rules-engine/V1 fields)`);
    }
  }
  if (record.draftKind !== undefined && record.draftKind !== 'pf04-v1') {
    fail(`[INVALID_DRAFT] draftKind must be 'pf04-v1' when present`);
  }
  const mode = record.mode === undefined ? 'CHALLENGE' : record.mode;
  if (typeof mode !== 'string' || !COMPOSER_MODES.includes(mode)) {
    fail(`[INVALID_DRAFT] mode must be CHALLENGE|TEMPLATE_AUTHORING`);
  }
  if (record.challengeType !== undefined
    && record.challengeType !== 'collective'
    && record.challengeType !== 'competitive'
    && record.challengeType !== 'streak') {
    fail(`[INVALID_DRAFT] challengeType must be collective|competitive|streak when present`);
  }
  if (!Array.isArray(record.activities)) {
    fail(`[INVALID_DRAFT] activities must be an array`);
  }
  const activities = (record.activities as unknown[]).map((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      fail(`[INVALID_DRAFT] activities[${index}] must be an object`);
    }
    const activity = entry as Record<string, unknown>;
    for (const key of Object.keys(activity)) {
      if (!ACTIVITY_KEYS.has(key)) {
        fail(`[INVALID_DRAFT] activities[${index}] unknown field '${key}' is rejected`);
      }
    }
    if (typeof activity.activity !== 'string' || activity.activity.length === 0) {
      fail(`[INVALID_DRAFT] activities[${index}].activity must be a non-empty identity string`);
    }
    if (activity.observedVersion !== undefined
      && (!Number.isInteger(activity.observedVersion) || (activity.observedVersion as number) < 1)) {
      fail(`[INVALID_DRAFT] activities[${index}].observedVersion must be an integer >= 1 when present`);
    }
    if (activity.kind !== undefined && activity.kind !== 'fitness' && activity.kind !== 'wellness') {
      fail(`[INVALID_DRAFT] activities[${index}].kind must be fitness|wellness when present`);
    }
    return {
      activity: activity.activity as string,
      ...(activity.observedVersion !== undefined
        ? { observedVersion: activity.observedVersion as number }
        : {}),
      ...(activity.kind !== undefined
        ? { kind: activity.kind as 'fitness' | 'wellness' }
        : {}),
      ...(activity.metric !== undefined ? { metric: activity.metric as string } : {}),
      ...(activity.unit !== undefined ? { unit: activity.unit as string } : {}),
      ...(activity.targetValue !== undefined ? { targetValue: activity.targetValue as number } : {}),
      ...(activity.componentIds !== undefined
        ? { componentIds: activity.componentIds as string[] }
        : {}),
      ...(activity.loadBasis !== undefined ? { loadBasis: activity.loadBasis as string } : {}),
      ...(activity.durationMode !== undefined
        ? { durationMode: activity.durationMode as string }
        : {}),
      ...(activity.completionOccurrence !== undefined
        ? { completionOccurrence: activity.completionOccurrence as string }
        : {}),
      ...(activity.activityVariant !== undefined
        ? { activityVariant: activity.activityVariant as string | null }
        : {}),
      ...(activity.position !== undefined ? { position: activity.position as number } : {}),
    } as ComposerActivity;
  });
  return {
    draftKind: 'pf04-v1',
    mode: mode as ComposerMode,
    ...(record.challengeType !== undefined
      ? { challengeType: record.challengeType as ChallengeComposerDraft['challengeType'] }
      : {}),
    ...(record.title !== undefined ? { title: record.title as string } : {}),
    ...(record.description !== undefined ? { description: record.description as string } : {}),
    ...(record.instructions !== undefined ? { instructions: record.instructions as string } : {}),
    activities,
    ...(record.startDate !== undefined ? { startDate: record.startDate as string } : {}),
    ...(record.endDate !== undefined ? { endDate: record.endDate as string } : {}),
    ...(record.timezone !== undefined ? { timezone: record.timezone as string } : {}),
    ...(record.temporalConditions !== undefined
      ? { temporalConditions: record.temporalConditions as ComposerTemporalConditions }
      : {}),
    ...(record.goalValue !== undefined ? { goalValue: record.goalValue as number } : {}),
    ...(record.goalUnit !== undefined ? { goalUnit: record.goalUnit as string } : {}),
    ...(record.requiredConsecutiveDays !== undefined
      ? { requiredConsecutiveDays: record.requiredConsecutiveDays as number }
      : {}),
  };
}

/** An empty Composer draft exists without pretending to be valid. */
export function createEmptyComposer(mode: ComposerMode = 'CHALLENGE'): ChallengeComposerDraft {
  if (!COMPOSER_MODES.includes(mode)) fail(`mode must be CHALLENGE|TEMPLATE_AUTHORING`);
  return { draftKind: 'pf04-v1', mode, activities: [] };
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface StageAssessment {
  stage: WizardStage;
  complete: boolean;
  missing: string[];
}

/**
 * Structural stage assessment: "does the draft contain enough information
 * to move forward?" — never "is this a valid Challenge?" (PF-03 alone
 * answers that at preview/establishment). No database reads.
 */
export function assessComposerStage(draft: ChallengeComposerDraft, stage: WizardStage): StageAssessment {
  const normalized = normalizeComposerDraft(draft);
  if (!STAGE_FIELDS[stage]) fail(`unknown Wizard stage '${String(stage)}'`);
  const missing: string[] = [];
  const need = (field: string, present: boolean): void => {
    if (!present) missing.push(field);
  };
  switch (stage) {
    case 'TYPE':
      need('challengeType', normalized.challengeType !== undefined);
      break;
    case 'BASICS':
      need('title', typeof normalized.title === 'string' && normalized.title.trim().length > 0);
      break;
    case 'ACTIVITIES':
      need('activities[].activity', normalized.activities.length > 0
        && normalized.activities.every((a) => a.activity.length > 0
          && Number.isInteger(a.observedVersion)
          && (a.kind === 'fitness' || a.kind === 'wellness')));
      break;
    case 'MEASUREMENT':
      need(
        'activities[].metric+unit',
        normalized.activities.length > 0
        && normalized.activities.every((a) => typeof a.metric === 'string'
          && a.metric.length > 0
          && typeof a.unit === 'string'
          && a.unit.length > 0),
      );
      break;
    case 'REQUIREMENT':
      need(
        'activities[].targetValue',
        normalized.activities.length > 0
        && normalized.activities.every((a) => typeof a.targetValue === 'number'
          && Number.isFinite(a.targetValue)),
      );
      break;
    case 'SCHEDULE': {
      const days = normalized.startDate !== undefined
        && DAY_RE.test(normalized.startDate)
        && normalized.endDate !== undefined
        && DAY_RE.test(normalized.endDate)
        && (normalized.endDate as string) >= (normalized.startDate as string);
      need('startDate+endDate', days);
      // Day-boundary semantics require an explicit timezone for streak;
      // other types carry the EBC-03 UTC convention forward.
      need('timezone', normalized.challengeType !== 'streak'
        || (typeof normalized.timezone === 'string' && normalized.timezone.length > 0));
      break;
    }
    case 'RULES': {
      if (normalized.challengeType === 'collective') {
        need('goalValue', typeof normalized.goalValue === 'number' && normalized.goalValue > 0);
        need('goalUnit', typeof normalized.goalUnit === 'string'
          && (normalized.goalUnit as string).length > 0);
      } else if (normalized.challengeType === 'streak') {
        need('requiredConsecutiveDays', Number.isInteger(normalized.requiredConsecutiveDays)
          && (normalized.requiredConsecutiveDays as number) >= 1);
      } else if (normalized.challengeType === 'competitive') {
        // Settled engine semantics carry no configurable rule: nothing required.
      } else {
        need('challengeType', false);
      }
      break;
    }
    case 'REVIEW':
    case 'FINISH':
      break;
  }
  return { stage, complete: missing.length === 0, missing };
}

/** Earliest incomplete stage from TYPE..RULES, else REVIEW (ready to preview). */
export function getComposerStage(draft: ChallengeComposerDraft): WizardStage {
  const order: WizardStage[] = [
    'TYPE',
    'BASICS',
    'ACTIVITIES',
    'MEASUREMENT',
    'REQUIREMENT',
    'SCHEDULE',
    'RULES',
  ];
  for (const stage of order) {
    if (!assessComposerStage(draft, stage).complete) return stage;
  }
  return 'REVIEW';
}

export interface CompletenessAssessment {
  complete: boolean;
  stage: WizardStage;
  missingByStage: Partial<Record<WizardStage, string[]>>;
  issues: ComposerIssue[];
}

/** Draft completeness across every stage (structural only; see assessComposerStage). */
export function assessComposerCompleteness(draft: ChallengeComposerDraft): CompletenessAssessment {
  const normalized = normalizeComposerDraft(draft);
  const missingByStage: Partial<Record<WizardStage, string[]>> = {};
  const issues: ComposerIssue[] = [];
  for (const stage of [
    'TYPE',
    'BASICS',
    'ACTIVITIES',
    'MEASUREMENT',
    'REQUIREMENT',
    'SCHEDULE',
    'RULES',
  ] as const) {
    const assessment = assessComposerStage(normalized, stage);
    if (!assessment.complete) {
      missingByStage[stage] = assessment.missing;
      for (const field of assessment.missing) {
        issues.push({
          code: 'MISSING_FIELD',
          field,
          stage,
          message: `composer: stage ${stage} is missing ${field}`,
        });
      }
      issues.push({
        code: 'STAGE_INCOMPLETE',
        stage,
        message: `composer: stage ${stage} is incomplete`,
      });
    }
  }
  return {
    complete: issues.length === 0,
    stage: getComposerStage(normalized),
    missingByStage,
    issues,
  };
}

export interface ActivityOptions {
  knowledgeId: string;
  activityCode: string | null;
  kind: 'fitness' | 'wellness';
  currentVersion: number;
  primaryMetrics: string[];
  secondaryMetrics: string[];
  compatibleUnits: string[];
  components: Array<{ componentId: string; displayName: string; relationship: string }>;
  supportedLoadBases: string[];
}

async function resolveComposerIdentity(db: Db, identity: string): Promise<string> {
  if (typeof identity === 'string' && isUuid(identity)) return identity;
  if (isActivityCode(identity)) {
    const byCode = await getKnowledgeByCode(db, identity);
    if (!byCode) fail(`no canonical Activity for code '${identity}' (identity is never invented)`);
    return byCode.id;
  }
  fail(`activity must be an Activity UUID or immutable Activity Code (display names are never identity)`);
}

/**
 * The Wizard's valid configuration choices for one Activity, derived from
 * canonical Knowledge (never hard-coded): Metrics, Units, Components and
 * supported Load Reporting Bases of the CURRENT version.
 */
export async function describeComposerActivityOptions(
  db: Db,
  identity: string,
): Promise<ActivityOptions> {
  const knowledgeId = await resolveComposerIdentity(db, identity);
  const item = await getKnowledgeById(db, knowledgeId);
  if (!item) fail(`no canonical Activity for identity (pins are never invented)`);
  if (item.lifecycle !== 'published') {
    fail(`Activity '${item.activityCode ?? knowledgeId}' is not published (selection offers current V2 Activities only)`);
  }
  const pin = await resolveActivityVersionPin(db, knowledgeId, item.knowledgeVersion);
  if (!pin) fail(`current Activity version does not resolve (pins are never invented)`);
  return {
    knowledgeId,
    activityCode: pin.activityCode,
    kind: item.kind,
    currentVersion: item.knowledgeVersion,
    primaryMetrics: pin.primaryMetrics,
    secondaryMetrics: pin.secondaryMetrics,
    compatibleUnits: pin.compatibleUnits,
    components: pin.components,
    supportedLoadBases: pin.supportedLoadBases,
  };
}

/**
 * Select a canonical current V2 Activity into the draft: retains UUID/Code
 * identity, observes the CURRENT version, derives the domain from
 * Knowledge. Returns a NEW draft (drafts are immutable values).
 */
export async function selectComposerActivity(
  db: Db,
  draft: ChallengeComposerDraft,
  identity: string,
): Promise<ChallengeComposerDraft> {
  const normalized = normalizeComposerDraft(draft);
  const options = await describeComposerActivityOptions(db, identity);
  return {
    ...normalized,
    activities: [
      ...normalized.activities,
      { activity: identity, observedVersion: options.currentVersion, kind: options.kind },
    ],
  };
}

export interface FreshnessEntry {
  index: number;
  activity: string;
  observedVersion: number;
  currentVersion: number | null;
  stale: boolean;
}

/**
 * Detect observed versions superseded while the draft was open. No silent
 * upgrade happens anywhere: stale entries must be explicitly refreshed
 * (refreshComposerActivity) and re-previewed.
 */
export async function checkComposerFreshness(
  db: Db,
  draft: ChallengeComposerDraft,
): Promise<FreshnessEntry[]> {
  const normalized = normalizeComposerDraft(draft);
  const entries: FreshnessEntry[] = [];
  for (const [index, entry] of normalized.activities.entries()) {
    let current: number | null = null;
    try {
      const knowledgeId = await resolveComposerIdentity(db, entry.activity);
      const item = await getKnowledgeById(db, knowledgeId);
      current = item ? item.knowledgeVersion : null;
    } catch {
      current = null;
    }
    entries.push({
      index,
      activity: entry.activity,
      observedVersion: entry.observedVersion,
      currentVersion: current,
      stale: current === null || current !== entry.observedVersion,
    });
  }
  return entries;
}

/**
 * Explicitly refresh one draft activity to the current canonical version.
 * Configuration is preserved as-is; validity is NOT preserved — preview
 * must revalidate (a refreshed draft can still fail PF-03, which is the
 * correct fail-closed behavior, never a silent semantic upgrade).
 */
export async function refreshComposerActivity(
  db: Db,
  draft: ChallengeComposerDraft,
  index: number,
): Promise<{ draft: ChallengeComposerDraft; refreshed: boolean }> {
  const normalized = normalizeComposerDraft(draft);
  const entry = normalized.activities[index];
  if (!entry) fail(`no Composer activity at index ${index}`);
  const knowledgeId = await resolveComposerIdentity(db, entry.activity);
  const item = await getKnowledgeById(db, knowledgeId);
  if (!item) fail(`no canonical Activity for identity (pins are never invented)`);
  if (item.knowledgeVersion === entry.observedVersion) {
    return { draft: normalized, refreshed: false };
  }
  const activities = normalized.activities.map((candidate, position) => (
    position === index ? { ...candidate, observedVersion: item.knowledgeVersion } : candidate
  ));
  return { draft: { ...normalized, activities }, refreshed: true };
}

/**
 * ONE deliberate mapping: ChallengeComposerDraft → ChallengeDefinitionInput.
 * Deterministic (same draft always maps identically; JSON key order fixed
 * by construction). Carries NO semantic rules — PF-03 decides validity.
 * Structurally incomplete drafts reject with MISSING_FIELD (fail-closed).
 */
export function toChallengeDefinitionInput(draft: ChallengeComposerDraft): ChallengeDefinitionInput {
  const normalized = normalizeComposerDraft(draft);
  const require = (field: string, present: boolean): void => {
    if (!present) {
      fail(`[MISSING_FIELD] Composer draft cannot map to a PF-03 definition without ${field}`);
    }
  };
  require('challengeType', normalized.challengeType !== undefined);
  require('title', typeof normalized.title === 'string' && normalized.title.trim().length > 0);
  require(
    'window',
    normalized.startDate !== undefined
    && DAY_RE.test(normalized.startDate)
    && normalized.endDate !== undefined
    && DAY_RE.test(normalized.endDate)
    && (normalized.endDate as string) >= (normalized.startDate as string),
  );
  require('activities', normalized.activities.length > 0);
  if (normalized.challengeType === 'collective') {
    require('goalValue', typeof normalized.goalValue === 'number');
    require('goalUnit', typeof normalized.goalUnit === 'string');
  }
  if (normalized.challengeType === 'streak') {
    require('requiredConsecutiveDays', normalized.requiredConsecutiveDays !== undefined);
  }
  return {
    challengeType: normalized.challengeType as 'collective' | 'competitive' | 'streak',
    title: normalized.title as string,
    ...(normalized.description !== undefined ? { description: normalized.description } : {}),
    ...(normalized.instructions !== undefined ? { instructions: normalized.instructions } : {}),
    startDate: normalized.startDate as string,
    endDate: normalized.endDate as string,
    ...(normalized.timezone !== undefined ? { timezone: normalized.timezone } : {}),
    ...(normalized.goalValue !== undefined ? { goalValue: normalized.goalValue } : {}),
    ...(normalized.goalUnit !== undefined ? { goalUnit: normalized.goalUnit } : {}),
    ...(normalized.requiredConsecutiveDays !== undefined
      ? { requiredConsecutiveDays: normalized.requiredConsecutiveDays }
      : {}),
    ...(normalized.temporalConditions !== undefined
      ? { temporalConditions: normalized.temporalConditions as Record<string, unknown> }
      : {}),
    activities: normalized.activities.map((activity) => {
      require(`activities[].metric`, typeof activity.metric === 'string');
      require(`activities[].unit`, typeof activity.unit === 'string');
      require(`activities[].targetValue`, typeof activity.targetValue === 'number');
      return {
        activity: activity.activity,
        metric: activity.metric as string,
        unit: activity.unit as string,
        targetValue: activity.targetValue as number,
        ...(activity.componentIds !== undefined ? { componentIds: activity.componentIds } : {}),
        ...(activity.loadBasis !== undefined ? { loadBasis: activity.loadBasis } : {}),
        ...(activity.durationMode !== undefined ? { durationMode: activity.durationMode } : {}),
        ...(activity.completionOccurrence !== undefined
          ? { completionOccurrence: activity.completionOccurrence }
          : {}),
        ...(activity.activityVariant !== undefined
          ? { activityVariant: activity.activityVariant }
          : {}),
        ...(activity.position !== undefined ? { position: activity.position } : {}),
      };
    }),
  };
}

export type ComposerPreview =
  | { ok: true; definition: NormalizedChallengeDefinition }
  | { ok: false; issues: ComposerIssue[] };

/**
 * Preview flow: Composer Draft → mapping → validateChallengeDefinition →
 * normalized PF-03 definition OR structured failure. Reads Knowledge only;
 * writes nothing (this becomes the PF-05 Review-stage basis). Stale
 * observed versions fail here with STALE_ACTIVITY before PF-03 even runs;
 * PF-03 semantic failures arrive as PF03_SEMANTIC issues (the validator's
 * message preserved verbatim — never reinterpreted by a second system).
 */
export async function previewChallengeComposer(
  db: Db,
  draft: ChallengeComposerDraft,
): Promise<ComposerPreview> {
  let normalized: ChallengeComposerDraft;
  try {
    normalized = normalizeComposerDraft(draft);
  } catch (error) {
    return {
      ok: false,
      issues: [{ code: 'INVALID_DRAFT', message: (error as Error).message }],
    };
  }
  const completeness = assessComposerCompleteness(normalized);
  if (!completeness.complete) {
    return { ok: false, issues: completeness.issues };
  }
  const freshness = await checkComposerFreshness(db, normalized);
  const stale = freshness.filter((entry) => entry.stale);
  if (stale.length > 0) {
    return {
      ok: false,
      issues: stale.map((entry) => ({
        code: 'STALE_ACTIVITY' as const,
        activityIndex: entry.index,
        field: 'activities[].observedVersion',
        message: `composer: activity '${entry.activity}' observed v${entry.observedVersion} `
          + `but current is ${entry.currentVersion === null ? 'unresolvable' : `v${entry.currentVersion}`} `
          + `(explicit refresh required; silent upgrade is never performed)`,
      })),
    };
  }
  let input: ChallengeDefinitionInput;
  try {
    input = toChallengeDefinitionInput(normalized);
  } catch (error) {
    return {
      ok: false,
      issues: [{ code: 'MISSING_FIELD', message: (error as Error).message }],
    };
  }
  try {
    const definition = await validateChallengeDefinition(db, input);
    return { ok: true, definition };
  } catch (error) {
    return {
      ok: false,
      issues: [{ code: 'PF03_SEMANTIC', message: (error as Error).message }],
    };
  }
}

/** Serialization for PF-06 Template compatibility (Template → draft). */
export function serializeComposerDraft(draft: ChallengeComposerDraft): string {
  return JSON.stringify(normalizeComposerDraft(draft));
}

/** Parse a serialized draft (or a future Template configuration) back. */
export function parseComposerDraft(serialized: string): ChallengeComposerDraft {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    fail(`[INVALID_DRAFT] Composer draft is not valid JSON`);
  }
  return normalizeComposerDraft(parsed);
}
