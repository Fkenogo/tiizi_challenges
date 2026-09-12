/**
 * EBC-05 V2 Challenge establishment payload builder (pure, no network).
 *
 * Single place where the Founder Preview turns form state into the
 * governed POST /v1/challenges contract. Validation mirrors the
 * server-side authority shape (EBC-01 creation routes + measurement
 * vocabulary) so invalid payloads are rejected in the form — the server
 * remains the authority and its rejection always wins.
 */

import type { V2ChallengeType, V2CreateActivity, V2CreateChallengeInput } from '../../api/v2ChallengeApi';
import { permittedMetrics, type V2KnowledgeItem } from '../../api/v2KnowledgeContract';

export const GOVERNED_METRICS = [
  'completion',
  'repetitions',
  'duration',
  'distance',
  'weight',
  'quantity',
] as const;

/** Governed Unit -> Metric map (mirrors the server vocabulary). */
const UNIT_TO_METRIC: Record<string, string> = {
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

export function metricForUnit(unit: string): string | null {
  return UNIT_TO_METRIC[unit] ?? null;
}

export interface EstablishActivityDraft {
  knowledge: V2KnowledgeItem;
  activityKind: 'fitness' | 'wellness';
  metric: string;
  targetValue: string;
  unit: string;
}

export interface EstablishFormState {
  challengeType: V2ChallengeType;
  groupId: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  timezone: string;
  goalValue: string;
  goalUnit: string;
  requiredConsecutiveDays: string;
  activities: EstablishActivityDraft[];
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate one activity row against the item's governed contract. Returns
 * the first problem, or null when the row is sendable.
 */
export function validateActivityRow(
  row: EstablishActivityDraft,
  family: V2ChallengeType,
): string | null {
  if (!row.knowledge || row.knowledge.lifecycle !== 'published') {
    return 'Select a published Knowledge activity.';
  }
  const permitted = permittedMetrics(row.knowledge);
  if (!row.metric || !permitted.includes(row.metric)) {
    return `Metric must be one of ${permitted.length > 0 ? permitted.join(', ') : '(none permitted)'} for ${row.knowledge.name}.`;
  }
  const units = row.knowledge.compatibleUnits ?? [];
  if (!row.unit || !units.includes(row.unit)) {
    return `Unit must be one of ${units.length > 0 ? units.join(', ') : '(none compatible)'} for ${row.knowledge.name}.`;
  }
  if (metricForUnit(row.unit) !== row.metric) {
    return `Unit ${row.unit} does not express metric ${row.metric}.`;
  }
  const target = Number(row.targetValue);
  if (!Number.isFinite(target) || target <= 0) {
    return `Target for ${row.knowledge.name} must be a positive number.`;
  }
  if (family === 'streak' && !Number.isInteger(target)) {
    return `Daily target for ${row.knowledge.name} must be a whole number.`;
  }
  return null;
}

/** Validate the whole form. Returns the first problem, or null when sendable. */
export function validateEstablishForm(form: EstablishFormState): string | null {
  if (!form.groupId) return 'Choose the Group this Challenge belongs to.';
  if (!form.title.trim()) return 'Give the Challenge a title.';
  if (!DAY_RE.test(form.startDate)) return 'Start date must be YYYY-MM-DD.';
  if (!DAY_RE.test(form.endDate)) return 'End date must be YYYY-MM-DD.';
  if (form.endDate < form.startDate) return 'End date must be on or after the start date.';
  if (!form.timezone.trim()) return 'Choose the governing timezone.';
  try {
    Intl.DateTimeFormat(undefined, { timeZone: form.timezone.trim() });
  } catch {
    return 'Governing timezone must be a valid IANA name.';
  }
  if (form.activities.length === 0) return 'Add at least one Knowledge activity.';
  if (form.challengeType === 'collective') {
    const goal = Number(form.goalValue);
    if (!Number.isFinite(goal) || goal <= 0) return 'Goal must be a positive number.';
    if (!form.goalUnit.trim()) return 'Goal needs a unit.';
  }
  if (form.challengeType === 'streak') {
    const required = Number(form.requiredConsecutiveDays);
    if (!Number.isInteger(required) || required < 1) {
      return 'Required consecutive days must be a whole number of at least 1.';
    }
  }
  for (const row of form.activities) {
    const problem = validateActivityRow(row, form.challengeType);
    if (problem) return problem;
  }
  return null;
}

/**
 * Build the governed creation payload. Throws on invalid form (callers
 * validate first for a friendly message; the server re-validates).
 */
export function buildCreationPayload(form: EstablishFormState): V2CreateChallengeInput {
  const problem = validateEstablishForm(form);
  if (problem) throw new Error(problem);
  const activities: V2CreateActivity[] = form.activities.map((row) => ({
    activity_kind: row.activityKind,
    canonical_key: row.knowledge.name,
    metric: row.metric,
    target_value: Number(row.targetValue),
    unit: row.unit,
  }));
  const input: V2CreateChallengeInput = {
    group_id: form.groupId,
    challenge_type: form.challengeType,
    title: form.title.trim(),
    start_date: form.startDate,
    end_date: form.endDate,
    timezone: form.timezone.trim(),
    activities,
    activate: true,
    join_creator: true,
  };
  if (form.description.trim()) input.description = form.description.trim();
  // Collective alone carries a challenge-level goal; competitive races to
  // the per-activity targets and streaks to consecutive days (the server
  // rejects goal fields on those families).
  if (form.challengeType === 'collective') {
    input.goal_value = Number(form.goalValue);
    input.goal_unit = form.goalUnit.trim();
  }
  if (form.challengeType === 'streak') {
    input.required_consecutive_days = Number(form.requiredConsecutiveDays);
  }
  return input;
}
