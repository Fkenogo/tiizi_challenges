/**
 * PF-05 pure Wizard mapping + human labels (zero runtime imports).
 *
 * definitionToRouteBody and the human-facing labels carry no semantics:
 * they reshape an already-validated normalized PF-03 definition into the
 * existing route transport shape and label governed enum values for
 * display. Server remains the authority. Kept import-free so build-time
 * guard suites can exercise this behavior without Firebase/auth modules.
 */

import type { V2NormalizedDefinition } from './v2ChallengeCreationApi.js';

/**
 * Deliberate mapping: normalized PF-03 definition → existing PF-03 route
 * transport shape (snake_case). Lossless: every pinned field travels.
 */
export function definitionToRouteBody(
  definition: V2NormalizedDefinition,
  groupId: string,
  opts?: { activate?: boolean; joinCreator?: boolean; idempotencyKey?: string },
): Record<string, unknown> {
  return {
    group_id: groupId,
    challenge_type: definition.challengeType,
    title: definition.title,
    description: definition.description,
    instructions: definition.instructions,
    start_date: definition.window.startDate,
    end_date: definition.window.endDate,
    timezone: definition.window.timezone,
    ...(definition.goalValue !== null ? { goal_value: definition.goalValue } : {}),
    ...(definition.goalUnit !== null ? { goal_unit: definition.goalUnit } : {}),
    ...(definition.requiredConsecutiveDays !== null
      ? { required_consecutive_days: definition.requiredConsecutiveDays }
      : {}),
    ...(definition.temporalConditions !== null
      ? { temporal_conditions: definition.temporalConditions }
      : {}),
    activities: definition.activities.map((activity) => ({
      activity_kind: activity.kind,
      canonical_key: activity.activityCode ?? activity.knowledgeId,
      version: activity.knowledgeVersion,
      ...(activity.activityVariant !== null ? { activity_variant: activity.activityVariant } : {}),
      metric: activity.metric,
      target_value: activity.targetValue,
      unit: activity.unit,
      ...(activity.requiredComponents.length > 0
        ? { component_ids: activity.requiredComponents }
        : {}),
      ...(activity.loadReportingBasis !== null ? { load_basis: activity.loadReportingBasis } : {}),
      ...(activity.durationMode !== null ? { duration_mode: activity.durationMode } : {}),
      ...(activity.completionOccurrence !== null
        ? { completion_occurrence: activity.completionOccurrence }
        : {}),
      position: activity.position,
    })),
    activate: opts?.activate ?? true,
    join_creator: opts?.joinCreator ?? false,
    ...(opts?.idempotencyKey !== undefined ? { idempotency_key: opts.idempotencyKey } : {}),
  };
}

/** Human-facing Load Reporting Basis labels (never raw enum text alone). */
export const LOAD_BASIS_LABELS: Record<string, string> = {
  TOTAL_LOADED_IMPLEMENT: 'Total loaded weight',
  PER_IMPLEMENT: 'Weight per implement',
  SINGLE_IMPLEMENT: 'Implement weight',
  PER_SIDE: 'Weight per side / hand',
  MACHINE_DISPLAYED_LOAD: 'Machine selected weight',
};

export function loadBasisLabel(basis: string): string {
  return LOAD_BASIS_LABELS[basis] ?? basis;
}

/** Human-facing Load Reporting Basis explanations. */
export const LOAD_BASIS_DESCRIPTIONS: Record<string, string> = {
  TOTAL_LOADED_IMPLEMENT: 'Total external load of one loaded implement, e.g. barbell total including bar and plates.',
  PER_IMPLEMENT: 'Weight of one matching implement, e.g. 20 kg means each dumbbell is 20 kg.',
  SINGLE_IMPLEMENT: 'Weight of the one external implement being used.',
  PER_SIDE: 'Load for one side or hand where matching per-side loads apply.',
  MACHINE_DISPLAYED_LOAD: 'Resistance shown by the machine. Not comparable across different machines.',
};

export const DURATION_MODE_LABELS: Record<string, string> = {
  CONTINUOUS: 'Continuous',
  ACCUMULATED: 'Accumulated',
};

export const DURATION_MODE_DESCRIPTIONS: Record<string, string> = {
  CONTINUOUS: 'Complete the full duration in one continuous effort.',
  ACCUMULATED: 'Build up the duration across accepted activity during the allowed Challenge period.',
};
