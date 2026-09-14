/**
 * PF-05 Wizard client draft model.
 *
 * The single client-side draft shape mirrors PF-04 ChallengeComposerDraft
 * field-for-field: ChallengeComposerDraft is the ONLY draft model (no
 * second Wizard-state schema exists). Per-stage required-field sets below
 * mirror the server STAGE_FIELDS contract and are asserted equal by the
 * PF-05 guard suite — they drive UX gating (Continue disabled) only.
 * Stage-completeness AUTHORITY stays server-side (preview/establishment);
 * these helpers never decide semantic validity.
 */

export type ComposerMode = 'CHALLENGE' | 'TEMPLATE_AUTHORING';

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

export const WIZARD_STAGE_ORDER: WizardStage[] = [
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

/**
 * UX mirror of the server STAGE_FIELDS contract (api/src/challengeComposer.ts).
 * Guard suite asserts deep equality — drift fails the build-time guard.
 */
export const STAGE_FIELDS: Record<WizardStage, string[]> = {
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

export interface ComposerActivityDraft {
  /** Immutable identity: Activity UUID or Activity Code. Never a display name. */
  activity: string;
  observedVersion: number;
  kind: 'fitness' | 'wellness';
  displayName?: string;
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

export interface ComposerDraft {
  draftKind: 'pf04-v1';
  mode: ComposerMode;
  challengeType?: 'collective' | 'competitive' | 'streak';
  title?: string;
  description?: string;
  instructions?: string;
  activities: ComposerActivityDraft[];
  startDate?: string;
  endDate?: string;
  timezone?: string;
  temporalConditions?: {
    at?: string;
    before?: string;
    after?: string;
    within?: { start: string; end: string };
  };
  goalValue?: number;
  goalUnit?: string;
  requiredConsecutiveDays?: number;
}

export function createEmptyDraft(): ComposerDraft {
  return { draftKind: 'pf04-v1', mode: 'CHALLENGE', activities: [] };
}

/**
 * UX-only stage presence check (mirrors server assessComposerStage field
 * coverage; authority remains the server preview). Returns missing field
 * paths for gating Continue.
 */
export function missingForStage(draft: ComposerDraft, stage: WizardStage): string[] {
  const missing: string[] = [];
  switch (stage) {
    case 'TYPE':
      if (draft.challengeType === undefined) missing.push('challengeType');
      break;
    case 'BASICS':
      if (!draft.title || draft.title.trim().length === 0) missing.push('title');
      break;
    case 'ACTIVITIES':
      if (
        draft.activities.length === 0
        || draft.activities.some(
          (a) => !a.activity || !Number.isInteger(a.observedVersion) || !a.kind,
        )
      ) {
        missing.push('activities[].activity');
      }
      break;
    case 'MEASUREMENT':
      if (
        draft.activities.length === 0
        || draft.activities.some((a) => !a.metric || !a.unit)
      ) {
        missing.push('activities[].metric+unit');
      }
      break;
    case 'REQUIREMENT':
      if (
        draft.activities.length === 0
        || draft.activities.some((a) => typeof a.targetValue !== 'number' || !Number.isFinite(a.targetValue))
      ) {
        missing.push('activities[].targetValue');
      }
      break;
    case 'SCHEDULE': {
      const days = !!draft.startDate
        && /^\d{4}-\d{2}-\d{2}$/.test(draft.startDate)
        && !!draft.endDate
        && /^\d{4}-\d{2}-\d{2}$/.test(draft.endDate)
        && draft.endDate >= draft.startDate;
      if (!days) missing.push('startDate+endDate');
      if (draft.challengeType === 'streak' && !draft.timezone) missing.push('timezone');
      break;
    }
    case 'RULES':
      if (draft.challengeType === 'collective') {
        if (!(typeof draft.goalValue === 'number' && draft.goalValue > 0)) {
          missing.push('goalValue');
        }
        if (!draft.goalUnit) missing.push('goalUnit');
      } else if (draft.challengeType === 'streak') {
        if (!(Number.isInteger(draft.requiredConsecutiveDays) && (draft.requiredConsecutiveDays ?? 0) >= 1)) {
          missing.push('requiredConsecutiveDays');
        }
      } else if (draft.challengeType !== 'competitive') {
        missing.push('challengeType');
      }
      break;
    case 'REVIEW':
    case 'FINISH':
      break;
  }
  return missing;
}

/** Earliest stage with missing fields (UX gating; server preview decides validity). */
export function currentStage(draft: ComposerDraft): WizardStage {
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
    if (missingForStage(draft, stage).length > 0) return stage;
  }
  return 'REVIEW';
}

export function serializeDraft(draft: ComposerDraft): string {
  return JSON.stringify(draft);
}

export function parseDraft(serialized: string): ComposerDraft {
  return JSON.parse(serialized) as ComposerDraft;
}
