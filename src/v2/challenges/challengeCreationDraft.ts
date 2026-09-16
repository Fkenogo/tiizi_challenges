/**
 * S2b — V2 Challenge Creation: the visible six-step experience mapped onto
 * the governed PF-04 Composer draft.
 *
 * This module is pure and React-free so the mapping is directly testable.
 * It carries NO semantic validation: "is this step filled in enough to move
 * on?" is deliberately a UX completeness question (client draft gating), and
 * final validity belongs ONLY to the server seam
 * (POST /v1/challenge-definitions/preview → PF-03) and establishment
 * (POST /v1/challenges). Duplicating PF-03 rules here would create a second
 * authority — it does not exist in this file.
 *
 * Human-facing terminology (Together / Race / Streak) maps to the canonical
 * internal values (collective / competitive / streak); internal values never
 * appear in member-facing copy.
 */
import type {
  ActivityOptionsResponse,
  ChallengeComposerDraft,
  ComposerActivityDraft,
  ComposerChallengeType,
  ComposerPreviewIssue,
  EstablishChallengeActivityBody,
  EstablishChallengeBody,
} from '../../api/challengeCreationApi';

/** The adopted six-step human-facing structure. */
export const VISIBLE_STEPS = [
  'HOW_IT_WORKS',
  'WHO_IS_HOSTING',
  'WHAT_ARE_WE_DOING',
  'WHAT_COUNTS',
  'WHEN_DOES_IT_RUN',
  'REVIEW_AND_CREATE',
] as const;

export type VisibleStep = (typeof VISIBLE_STEPS)[number];

export const VISIBLE_STEP_META: Record<VisibleStep, { eyebrow: string; title: string }> = {
  HOW_IT_WORKS: { eyebrow: 'How it works', title: 'Choose how this Challenge works' },
  WHO_IS_HOSTING: { eyebrow: 'Who is hosting', title: 'Who is hosting this Challenge?' },
  WHAT_ARE_WE_DOING: { eyebrow: 'What are we doing', title: 'What activities count toward this Challenge?' },
  WHAT_COUNTS: { eyebrow: 'What counts', title: 'Set goals and how they are measured' },
  WHEN_DOES_IT_RUN: { eyebrow: 'When does it run', title: 'When does this Challenge take place?' },
  REVIEW_AND_CREATE: { eyebrow: 'Review & Create', title: 'This is the Challenge you are creating' },
};

export interface ChallengeTypeOption {
  value: ComposerChallengeType;
  label: string;
  sub: string;
  blurb: string;
  badge: string;
}

/**
 * Member-facing Challenge types. Descriptions follow the adopted experience
 * reference; internal canonical values stay collective/competitive/streak.
 */
export const CHALLENGE_TYPE_OPTIONS: readonly ChallengeTypeOption[] = [
  {
    value: 'collective',
    label: 'Together',
    sub: 'Everyone adds to one shared goal',
    blurb: 'Everyone contributes toward one shared goal.',
    badge: 'Shared goal',
  },
  {
    value: 'competitive',
    label: 'Race',
    sub: 'Finishing order matters',
    blurb: 'Participants work toward the target and finishing order matters.',
    badge: 'Finishing places',
  },
  {
    value: 'streak',
    label: 'Streak',
    sub: 'Every day counts',
    blurb: 'Complete the required activity or activities each Challenge day.',
    badge: 'Daily habit',
  },
];

export function challengeTypeOption(type: ComposerChallengeType | null): ChallengeTypeOption | null {
  return CHALLENGE_TYPE_OPTIONS.find((option) => option.value === type) ?? null;
}

export function challengeTypeLabel(type: ComposerChallengeType | null): string {
  return challengeTypeOption(type)?.label ?? 'Challenge';
}

/** Only Streak carries multiple daily requirements in S2b. */
export function allowsMultipleActivities(type: ComposerChallengeType | null): boolean {
  return type === 'streak';
}

const METRIC_LABELS: Record<string, string> = {
  completion: 'Completion',
  repetitions: 'Repetitions',
  duration: 'Time',
  distance: 'Distance',
  weight: 'Weight',
  quantity: 'Quantity',
};

export function metricLabel(metric: string | null | undefined): string {
  if (!metric) return 'Measurement';
  return METRIC_LABELS[metric] ?? 'Measurement';
}

const UNIT_LABELS: Record<string, string> = {
  completion: 'completion',
  reps: 'repetitions',
  repetitions: 'repetitions',
  seconds: 'seconds',
  minutes: 'minutes',
  hours: 'hours',
  metres: 'metres',
  kilometres: 'kilometres',
  grams: 'grams',
  kilograms: 'kilograms',
  steps: 'steps',
  millilitres: 'millilitres',
  litres: 'litres',
  servings: 'servings',
  pages: 'pages',
  acts: 'acts',
  flights: 'flights',
};

export function unitLabel(unit: string | null | undefined): string {
  if (!unit) return '';
  return UNIT_LABELS[unit] ?? unit;
}

const LOAD_BASIS_LABELS: Record<string, string> = {
  TOTAL_LOADED_IMPLEMENT: 'Total loaded weight',
  PER_IMPLEMENT: 'Per implement',
  SINGLE_IMPLEMENT: 'Single implement',
  PER_SIDE: 'Per side',
  MACHINE_DISPLAYED_LOAD: 'As shown on the machine',
};

export function loadBasisLabel(basis: string | null | undefined): string {
  if (!basis) return 'How the weight is reported';
  return LOAD_BASIS_LABELS[basis] ?? 'How the weight is reported';
}

/** Friendly timezone labels — raw IANA identifiers stay in the data only. */
export const TIMEZONE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'Africa/Nairobi', label: 'Nairobi time (UTC+3)' },
  { value: 'Europe/London', label: 'London time (UTC+0/+1)' },
  { value: 'America/New_York', label: 'New York time (UTC-5/-4)' },
  { value: 'Asia/Tokyo', label: 'Tokyo time (UTC+9)' },
  { value: 'UTC', label: 'UTC' },
];

export function timezoneLabel(timezone: string | null | undefined): string {
  if (!timezone) return 'Challenge time';
  const known = TIMEZONE_OPTIONS.find((option) => option.value === timezone);
  if (known) return known.label;
  // Unknown-but-valid IANA identifier: keep it honest without inventing a label.
  return timezone;
}

export const DURATION_OPTIONS = [7, 14, 21, 30] as const;

export function statusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'establishment':
      return 'Getting ready';
    case 'active':
      return 'Running';
    case 'ended':
      return 'Finished';
    default:
      return 'Challenge';
  }
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Deterministic YYYY-MM-DD → "1 Jun 2026" (no timezone shifting). */
export function formatDay(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [year, month, day] = iso.split('-');
  const monthIndex = Number(month) - 1;
  if (monthIndex < 0 || monthIndex > 11) return iso;
  return `${Number(day)} ${MONTHS[monthIndex]} ${year}`;
}

export function formatDayRange(startDate: string, endDate: string): string {
  return `${formatDay(startDate)} – ${formatDay(endDate)}`;
}

export interface WizardActivity {
  /** Canonical Knowledge UUID — identity only, never displayed raw. */
  activity: string;
  /** Display name (resolved from the catalogue; never used as identity). */
  name: string;
  kind: 'fitness' | 'wellness';
  observedVersion: number;
  options: ActivityOptionsResponse;
  metric: string;
  unit: string;
  /** Kept as a string so the numeric input stays editable. */
  targetValue: string;
  durationMode: string;
  completionOccurrence: string;
  loadBasis: string;
}

export interface WizardState {
  challengeType: ComposerChallengeType | null;
  groupId: string | null;
  groupName: string | null;
  title: string;
  description: string;
  activities: WizardActivity[];
  startDate: string;
  durationDays: number;
  timezone: string;
  creatorJoins: boolean;
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function toDayIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIso(now: Date = new Date()): string {
  return toDayIso(now);
}

/** Inclusive window: a 14-day Challenge starting 1 Jun ends 14 Jun. */
export function deriveEndDate(startDate: string, durationDays: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isInteger(durationDays) || durationDays < 1) {
    return startDate;
  }
  const [year, month, day] = startDate.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + durationDays - 1);
  return toDayIso(end);
}

/** True when the window starts today or earlier → safe to activate now. */
export function shouldActivateOnCreate(state: WizardState, now: Date = new Date()): boolean {
  return state.startDate <= todayIso(now);
}

export function createInitialWizardState(now: Date = new Date()): WizardState {
  return {
    challengeType: null,
    groupId: null,
    groupName: null,
    title: '',
    description: '',
    activities: [],
    startDate: todayIso(now),
    durationDays: 14,
    timezone: 'Africa/Nairobi',
    creatorJoins: false,
  };
}

function numeric(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** All required Component ids — ALL_REQUIRED means every declared part. */
export function requiredComponentIds(options: ActivityOptionsResponse): string[] {
  return options.components.map((component) => component.componentId);
}

export interface StepAssessment {
  step: VisibleStep;
  complete: boolean;
  missing: string[];
}

/**
 * Client UX completeness only. This never claims a Challenge is valid —
 * semantic validity is decided server-side by PF-03.
 */
export function assessVisibleStep(state: WizardState, step: VisibleStep): StepAssessment {
  const missing: string[] = [];
  switch (step) {
    case 'HOW_IT_WORKS':
      if (!state.challengeType) missing.push('challengeType');
      break;
    case 'WHO_IS_HOSTING':
      if (!state.groupId) missing.push('group');
      if (!state.title.trim()) missing.push('title');
      break;
    case 'WHAT_ARE_WE_DOING':
      if (state.activities.length === 0) missing.push('activities');
      break;
    case 'WHAT_COUNTS': {
      if (state.activities.length === 0) {
        missing.push('activities');
        break;
      }
      state.activities.forEach((activity, index) => {
        const where = `activities[${index}]`;
        if (activity.metric.trim().length === 0) missing.push(`${where}.metric`);
        if (activity.unit.trim().length === 0) missing.push(`${where}.unit`);
        const target = numeric(activity.targetValue);
        if (target === null || target < 0) {
          missing.push(`${where}.targetValue`);
        } else if (activity.metric !== 'completion' && target <= 0) {
          missing.push(`${where}.targetValue`);
        }
        if (activity.metric === 'duration' && activity.durationMode.trim().length === 0) {
          missing.push(`${where}.durationMode`);
        }
        if (activity.metric === 'completion' && activity.completionOccurrence.trim().length === 0) {
          missing.push(`${where}.completionOccurrence`);
        }
        if (activity.metric === 'weight' && activity.loadBasis.trim().length === 0) {
          missing.push(`${where}.loadBasis`);
        }
      });
      break;
    }
    case 'WHEN_DOES_IT_RUN': {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(state.startDate)) missing.push('startDate');
      if (!Number.isInteger(state.durationDays) || state.durationDays < 1) missing.push('durationDays');
      if (!state.timezone.trim()) missing.push('timezone');
      break;
    }
    case 'REVIEW_AND_CREATE':
      for (const stepId of VISIBLE_STEPS) {
        if (stepId === 'REVIEW_AND_CREATE') continue;
        if (!assessVisibleStep(state, stepId).complete) missing.push(stepId);
      }
      break;
    default:
      break;
  }
  return { step, complete: missing.length === 0, missing };
}

/** Earliest incomplete visible step, else REVIEW_AND_CREATE. */
export function firstIncompleteStep(state: WizardState): VisibleStep {
  for (const step of VISIBLE_STEPS) {
    if (step === 'REVIEW_AND_CREATE') break;
    if (!assessVisibleStep(state, step).complete) return step;
  }
  return 'REVIEW_AND_CREATE';
}

export function isWizardComplete(state: WizardState): boolean {
  return assessVisibleStep(state, 'REVIEW_AND_CREATE').complete;
}

/**
 * One deliberate mapping: visible Wizard state → PF-04 Composer draft.
 * Carries no semantic rules; it restates what the member configured.
 */
export function toComposerDraft(state: WizardState): ChallengeComposerDraft {
  const activities: ComposerActivityDraft[] = state.activities.map((activity, index) => {
    const target = numeric(activity.targetValue) ?? 0;
    const componentIds = requiredComponentIds(activity.options);
    return {
      activity: activity.activity,
      observedVersion: activity.observedVersion,
      kind: activity.kind,
      metric: activity.metric,
      unit: activity.unit,
      targetValue: target,
      ...(componentIds.length > 0 ? { componentIds } : {}),
      ...(activity.metric === 'weight' && activity.loadBasis
        ? { loadBasis: activity.loadBasis }
        : {}),
      ...(activity.metric === 'duration' && activity.durationMode
        ? { durationMode: activity.durationMode }
        : {}),
      ...(activity.metric === 'completion' && activity.completionOccurrence.trim()
        ? { completionOccurrence: activity.completionOccurrence.trim() }
        : {}),
      position: index,
    };
  });

  const draft: ChallengeComposerDraft = {
    draftKind: 'pf04-v1',
    mode: 'CHALLENGE',
    ...(state.challengeType ? { challengeType: state.challengeType } : {}),
    ...(state.title.trim() ? { title: state.title.trim() } : {}),
    ...(state.description.trim() ? { description: state.description.trim() } : {}),
    activities,
    startDate: state.startDate,
    endDate: deriveEndDate(state.startDate, state.durationDays),
    timezone: state.timezone,
  };

  if (state.challengeType === 'collective' && state.activities.length > 0) {
    const primary = state.activities[0];
    const goal = numeric(primary.targetValue);
    if (goal !== null) {
      draft.goalValue = goal;
      draft.goalUnit = primary.unit;
    }
  }
  if (state.challengeType === 'streak') {
    draft.requiredConsecutiveDays = state.durationDays;
  }
  return draft;
}

export interface EstablishOptions {
  activate: boolean;
  joinCreator: boolean;
  idempotencyKey?: string;
}

/** Visible Wizard state → governed establishment body (POST /v1/challenges). */
export function toEstablishmentBody(
  state: WizardState,
  options: EstablishOptions,
): EstablishChallengeBody {
  if (!state.challengeType) {
    throw new Error('challenge-creation: a Challenge type is required before establishment');
  }
  if (!state.groupId) {
    throw new Error('challenge-creation: a host Group is required before establishment');
  }
  const activities: EstablishChallengeActivityBody[] = state.activities.map((activity, index) => {
    const target = numeric(activity.targetValue) ?? 0;
    const componentIds = requiredComponentIds(activity.options);
    return {
      activity_kind: activity.kind,
      canonical_key: activity.activity,
      version: activity.observedVersion,
      metric: activity.metric,
      target_value: target,
      unit: activity.unit,
      ...(componentIds.length > 0 ? { component_ids: componentIds } : {}),
      ...(activity.metric === 'weight' && activity.loadBasis
        ? { load_basis: activity.loadBasis }
        : {}),
      ...(activity.metric === 'duration' && activity.durationMode
        ? { duration_mode: activity.durationMode }
        : {}),
      ...(activity.metric === 'completion' && activity.completionOccurrence.trim()
        ? { completion_occurrence: activity.completionOccurrence.trim() }
        : {}),
      position: index,
    };
  });

  const body: EstablishChallengeBody = {
    group_id: state.groupId,
    challenge_type: state.challengeType,
    title: state.title.trim(),
    ...(state.description.trim() ? { description: state.description.trim() } : {}),
    start_date: state.startDate,
    end_date: deriveEndDate(state.startDate, state.durationDays),
    timezone: state.timezone,
    activities,
    activate: options.activate,
    join_creator: options.joinCreator,
    ...(options.idempotencyKey ? { idempotency_key: options.idempotencyKey } : {}),
  };

  if (state.challengeType === 'collective' && state.activities.length > 0) {
    const primary = state.activities[0];
    const goal = numeric(primary.targetValue);
    if (goal !== null) {
      body.goal_value = goal;
      body.goal_unit = primary.unit;
    }
  }
  if (state.challengeType === 'streak') {
    body.required_consecutive_days = state.durationDays;
  }
  return body;
}

function activityPhrase(activity: WizardActivity): string {
  const target = numeric(activity.targetValue);
  const amount = target === null ? '' : `${target} `;
  const unit = unitLabel(activity.unit);
  const measurement = unit ? `${amount}${unit}` : `${amount}${metricLabel(activity.metric)}`.trim();
  return `${measurement} of ${activity.name}`.replace(/\s+/g, ' ').trim();
}

/** Natural-language summary shown live and on the Review step. */
export function summarize(state: WizardState): string {
  if (!state.challengeType || state.activities.length === 0) {
    return 'Choose a Challenge type and activities to see your Challenge summary here.';
  }
  const group = state.groupName ?? 'your group';
  const duration = `${state.durationDays} days`;
  const timezone = timezoneLabel(state.timezone);
  if (state.challengeType === 'collective') {
    return `Everyone in ${group} contributes together toward a shared goal of ${activityPhrase(
      state.activities[0],
    )}, over ${duration} (${timezone}).`;
  }
  if (state.challengeType === 'competitive') {
    return `People in ${group} each work toward ${activityPhrase(
      state.activities[0],
    )} within the ${duration} window (${timezone}). Finishers are ranked in order, and ties share a place.`;
  }
  const requirements = state.activities.map(activityPhrase).join(' and ');
  return `Complete ${requirements} each Challenge day, before the day ends in ${timezone}, for ${duration}.`;
}

/** "What counts" explanation per type (member-facing). */
export function whatCountsExplanation(type: ComposerChallengeType | null, timezone: string): string[] {
  const lines = ['Only the activities you choose count toward this Challenge.'];
  if (type === 'collective') {
    lines.push('The shared goal stays open — the group total can go past it, and it counts everything added together.');
  } else if (type === 'competitive') {
    lines.push('Everyone who reaches the target is ranked in order, and tied members share a place.');
  } else if (type === 'streak') {
    lines.push(`Every daily requirement must be complete before the day ends in ${timezoneLabel(timezone)}.`);
  }
  return lines;
}

const STAGE_TO_STEP: Record<string, VisibleStep> = {
  TYPE: 'HOW_IT_WORKS',
  BASICS: 'WHO_IS_HOSTING',
  ACTIVITIES: 'WHAT_ARE_WE_DOING',
  MEASUREMENT: 'WHAT_COUNTS',
  REQUIREMENT: 'WHAT_COUNTS',
  RULES: 'WHAT_COUNTS',
  SCHEDULE: 'WHEN_DOES_IT_RUN',
  REVIEW: 'REVIEW_AND_CREATE',
  FINISH: 'REVIEW_AND_CREATE',
};

/** Strip internal machine tokens before showing a message to a Member. */
export function humanizePreviewMessage(message: string): string {
  return message
    .replace(/^(challenge-definition|challenge-composer|challenge-configs|knowledge-eligibility):\s*/i, '')
    .replace(/\[[a-z0-9_[\]]+\]\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stepForIssue(issue: ComposerPreviewIssue): VisibleStep {
  if (issue.stage && STAGE_TO_STEP[issue.stage]) return STAGE_TO_STEP[issue.stage];
  const text = `${issue.field ?? ''} ${issue.message}`.toLowerCase();
  if (/activities\[|metric|unit|component|load|duration|occurrence|target/.test(text)) {
    if (/not_published|unknown_activity|not_identity|stale_activity_version|duplicate_activity/.test(text)) {
      return 'WHAT_ARE_WE_DOING';
    }
    return 'WHAT_COUNTS';
  }
  if (/goal|required_consecutive_days|streak|reset_on_miss/.test(text)) return 'WHAT_COUNTS';
  if (/timezone|window|start_date|end_date|startdate|enddate/.test(text)) return 'WHEN_DOES_IT_RUN';
  if (/title|description|instructions/.test(text)) return 'WHO_IS_HOSTING';
  if (/challenge_type|challengetype/.test(text)) return 'HOW_IT_WORKS';
  return 'REVIEW_AND_CREATE';
}

export interface MappedPreviewIssue {
  step: VisibleStep;
  field?: string;
  code: string;
  /** Member-facing message (internal codes removed). */
  friendly: string;
  /** Original message preserved for debugging. */
  raw: string;
}

/** Locate each server issue on the visible step it concerns. */
export function mapPreviewIssues(issues: ComposerPreviewIssue[]): MappedPreviewIssue[] {
  return issues.map((issue) => ({
    step: stepForIssue(issue),
    field: issue.field,
    code: issue.code,
    friendly: humanizePreviewMessage(issue.message),
    raw: issue.message,
  }));
}

/**
 * Member-facing copy for governed establishment/API denials. Internal codes
 * and governance terminology never reach the Member; unknown codes fall back
 * to a plain retry message.
 */
const CREATION_DENIAL_COPY: Record<string, string> = {
  no_group_membership:
    'You need to be an active member of this Group to create a Challenge in it.',
  group_membership_inactive:
    'You need to be an active member of this Group to create a Challenge in it.',
  challenge_creation_forbidden:
    'This Group keeps Challenge creation to its stewards. Ask a steward to create it.',
  group_inactive: 'This Group is not active, so it cannot host a new Challenge right now.',
  unknown_group: 'This Group is no longer available. Pick another Group to host your Challenge.',
  group_authority_unavailable:
    'We could not confirm your Group membership just now. Please try again.',
  knowledge_not_eligible:
    'The selected Activity is no longer available for new Challenges. Choose an Activity again.',
  incompatible_measurement:
    'That measurement is not valid for the selected Activity. Review “What counts”.',
  invalid_challenge_definition:
    'Some Challenge details are not valid yet. Review the highlighted step and try again.',
  invalid_challenge: 'Some Challenge details are not valid yet. Review your setup and try again.',
  idempotency_conflict:
    'This Challenge was already created with different details. Close and start again.',
  creation_authority_unavailable:
    'Challenge creation is temporarily unavailable. Please try again shortly.',
  api_unreachable: 'The Tiizi service is unreachable. Check your connection and try again.',
};

export function creationErrorMessage(code: string | null | undefined): string {
  if (code && CREATION_DENIAL_COPY[code]) return CREATION_DENIAL_COPY[code];
  return 'We could not create the Challenge. Please try again.';
}

/** Stable idempotency key for one creation attempt. */
export function createEstablishmentKey(): string {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return `v2-create-${cryptoObj.randomUUID()}`;
  }
  return `v2-create-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
