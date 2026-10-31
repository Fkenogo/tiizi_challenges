import type { TemplateValidationIssue, TemplateValidationResponse } from '../../../api/operatorTemplatesApi';

/**
 * TIIZI-FER-P5T-2-S4 — presentation of the SERVER's Template validation.
 *
 * Nothing here decides validity. The server (`.../validate`) is the only
 * validation authority; this module only places the issues it returned on the
 * editor step where the author can fix them, and decides when a result may no
 * longer be trusted as describing what is on screen.
 */

export type EditorStepId = 'type' | 'name' | 'activities' | 'counts' | 'template';
export type IssueStep = EditorStepId | 'general';

/** A server result tied to the exact saved draft (token) it was computed for. */
export interface ValidationRecord {
  templateId: string;
  version: number;
  /** The draft revision token the server held when it was validated. */
  token: string;
  /** When the server answered (ms since epoch); the result describes the draft as of this moment. */
  checkedAt: number;
  ok: boolean;
  issues: TemplateValidationIssue[];
}

export function toValidationRecord(templateId: string, version: number, token: string, response: TemplateValidationResponse, checkedAt: number): ValidationRecord {
  return { templateId, version, token, checkedAt, ok: response.ok === true && response.issues.length === 0, issues: response.issues };
}

const FIELD_STEP: Record<string, EditorStepId> = {
  challengeType: 'type',
  title: 'name', description: 'name', coverId: 'name',
  summary: 'template', focusTags: 'template', durationDays: 'template', durationPresetDays: 'template',
  requiredConsecutiveDays: 'template', startDate: 'template', endDate: 'template', timezone: 'template',
  activity: 'activities', observedVersion: 'activities', activityVariant: 'activities',
  metric: 'counts', unit: 'counts', targetValue: 'counts', durationMode: 'counts', completionOccurrence: 'counts',
  loadBasis: 'counts', componentIds: 'counts', goalValue: 'counts', goalUnit: 'counts',
};

const STAGE_STEP: Record<string, EditorStepId> = {
  TYPE: 'type', BASICS: 'name', ACTIVITIES: 'activities', MEASUREMENT: 'counts', REQUIREMENT: 'counts', RULES: 'counts', SCHEDULE: 'template',
};

const CODE_STEP: Record<string, EditorStepId> = {
  STALE_ACTIVITY: 'activities',
  ACTIVITY_NOT_ELIGIBLE: 'activities',
  INCOMPATIBLE_MEASUREMENT: 'counts',
  DURATION_MISMATCH: 'template',
};

/** The last path segment of `activities[].metric`, `activities[2].unit`, `title`, … */
function leaf(field: string): string {
  const parts = field.split('.');
  // `activities[].metric+unit` names two fields of one step; the first decides the step.
  return parts[parts.length - 1].replace(/\[\d*\]$/, '').split('+')[0];
}

/** Which editor step an issue belongs to. Unrecognised issues are `general`, never dropped. */
export function stepForIssue(issue: TemplateValidationIssue): IssueStep {
  if (issue.field) {
    const root = issue.field.replace(/\[\d*\].*$/, '').replace(/\..*$/, '');
    if (root === 'activities' && /^activities(\[\d*\])?$/.test(issue.field)) return 'activities';
    const byField = FIELD_STEP[leaf(issue.field)];
    if (byField) return byField;
  }
  return CODE_STEP[issue.code] ?? (issue.stage ? STAGE_STEP[issue.stage] : undefined) ?? 'general';
}

/** `STAGE_INCOMPLETE` only restates missing fields of the same stage; hide it when those are listed. */
export function displayedIssues(issues: TemplateValidationIssue[]): TemplateValidationIssue[] {
  const stagesWithFields = new Set(issues.filter((i) => i.code === 'MISSING_FIELD' && i.stage).map((i) => i.stage));
  return issues.filter((i) => !(i.code === 'STAGE_INCOMPLETE' && i.stage && stagesWithFields.has(i.stage)));
}

export function groupIssuesByStep(issues: TemplateValidationIssue[]): Record<IssueStep, TemplateValidationIssue[]> {
  const grouped: Record<IssueStep, TemplateValidationIssue[]> = { type: [], name: [], activities: [], counts: [], template: [], general: [] };
  for (const issue of displayedIssues(issues)) grouped[stepForIssue(issue)].push(issue);
  return grouped;
}

export interface FreshnessInput {
  /** The token of the draft as the editor knows it on the server. Null before the first save. */
  currentToken: string | null;
  templateId: string | null;
  version: number | null;
  /** Local edits that are not saved. */
  dirty: boolean;
  /** A concurrent edit/conflict is being reconciled. */
  conflict: boolean;
}

/** A result is stale unless it describes the saved draft the editor is on, with no local edits or conflict. */
export function isValidationStale(record: ValidationRecord, input: FreshnessInput): boolean {
  if (input.dirty || input.conflict) return true;
  if (input.currentToken === null || input.templateId === null || input.version === null) return true;
  return record.templateId !== input.templateId || record.version !== input.version || record.token !== input.currentToken;
}

export type ValidationFailureKind = 'signin' | 'revoked' | 'missing' | 'immutable' | 'unavailable' | 'failed';

export interface ValidationFailure { kind: ValidationFailureKind; message: string }

interface ErrorLike { status?: number; code?: string }

/** Distinct, honest states for a failed validation call. */
export function classifyValidationFailure(error: unknown): ValidationFailure {
  const e = (error ?? {}) as ErrorLike;
  if (e.status === 401) return { kind: 'signin', message: 'Your session ended. Sign in again, then check the draft again.' };
  if (e.status === 403) return { kind: 'revoked', message: 'You do not have Template authoring access, so the draft cannot be checked.' };
  if (e.status === 404) return { kind: 'missing', message: 'This Template draft no longer exists.' };
  if (e.status === 409) return { kind: 'immutable', message: 'This version can no longer be checked because it is no longer an open draft.' };
  if (e.status === 503 || e.code === 'api_unreachable') return { kind: 'unavailable', message: 'Tiizi is unreachable. The draft is saved; try checking again.' };
  return { kind: 'failed', message: 'The check could not be completed. The draft is saved; try again.' };
}

export const STEP_LABELS: Record<IssueStep, string> = {
  type: 'Challenge type', name: 'Name & appearance', activities: 'Activities', counts: 'What counts', template: 'Template details', general: 'Other checks',
};
