import { describe, expect, it } from 'vitest';
import {
  classifyValidationFailure, groupIssuesByStep, isValidationStale, stepForIssue, toValidationRecord, type FreshnessInput,
} from './templateValidationModel';

const record = toValidationRecord('t', 1, 'tok-a', { ok: false, issues: [{ code: 'MISSING_FIELD', field: 'title', message: 'm' }] }, 1000);
const fresh: FreshnessInput = { currentToken: 'tok-a', templateId: 't', version: 1, dirty: false, conflict: false };

describe('issue → editor step mapping (placement only, never validity)', () => {
  const step = (issue: Parameters<typeof stepForIssue>[0]) => stepForIssue(issue);
  it('maps the server fields to the step that edits them', () => {
    expect(step({ code: 'MISSING_FIELD', field: 'title', message: '' })).toBe('name');
    expect(step({ code: 'MISSING_FIELD', field: 'challengeType', message: '' })).toBe('type');
    expect(step({ code: 'MISSING_FIELD', field: 'summary', message: '' })).toBe('template');
    expect(step({ code: 'MISSING_FIELD', field: 'durationDays', message: '' })).toBe('template');
    expect(step({ code: 'DURATION_MISMATCH', field: 'requiredConsecutiveDays', message: '' })).toBe('template');
    expect(step({ code: 'STALE_ACTIVITY', activityIndex: 0, field: 'activities[].observedVersion', message: '' })).toBe('activities');
    expect(step({ code: 'ACTIVITY_NOT_ELIGIBLE', activityIndex: 1, field: 'activities[].activity', message: '' })).toBe('activities');
    expect(step({ code: 'MISSING_FIELD', field: 'activities[0].metric', message: '' })).toBe('counts');
    expect(step({ code: 'MISSING_FIELD', field: 'goalValue', message: '' })).toBe('counts');
  });
  it('falls back to the issue code, then to "general" — nothing is dropped', () => {
    expect(step({ code: 'INCOMPATIBLE_MEASUREMENT', activityIndex: 0, message: 'x' })).toBe('counts');
    expect(step({ code: 'PF03_SEMANTIC', message: 'x' })).toBe('general');
    expect(step({ code: 'SOMETHING_NEW', field: 'unknownField', message: 'x' })).toBe('general');
    const grouped = groupIssuesByStep([
      { code: 'MISSING_FIELD', field: 'title', message: 'a' }, { code: 'PF03_SEMANTIC', message: 'b' }, { code: 'MISSING_FIELD', field: 'summary', message: 'c' },
    ]);
    expect(grouped.name).toHaveLength(1);
    expect(grouped.template).toHaveLength(1);
    expect(grouped.general).toHaveLength(1);
    expect(Object.values(grouped).flat()).toHaveLength(3);
  });
});

describe('server issue shapes from the composer (R1 S1)', () => {
  it('places combined fields and stage-only issues, and folds STAGE_INCOMPLETE into its fields', () => {
    expect(stepForIssue({ code: 'MISSING_FIELD', field: 'activities[].metric+unit', stage: 'MEASUREMENT', message: '' })).toBe('counts');
    expect(stepForIssue({ code: 'STAGE_INCOMPLETE', stage: 'ACTIVITIES', message: '' })).toBe('activities');
    expect(stepForIssue({ code: 'STAGE_INCOMPLETE', stage: 'REQUIREMENT', message: '' })).toBe('counts');
    const grouped = groupIssuesByStep([
      { code: 'MISSING_FIELD', field: 'activities[].metric+unit', stage: 'MEASUREMENT', message: 'a' },
      { code: 'STAGE_INCOMPLETE', stage: 'MEASUREMENT', message: 'b' },
      { code: 'STAGE_INCOMPLETE', stage: 'RULES', message: 'c' },
    ]);
    expect(grouped.counts.map((i) => i.message)).toEqual(['a', 'c']);
    expect(grouped.general).toHaveLength(0);
  });
});

describe('validation freshness', () => {
  it('is fresh only for the saved draft the result was computed for', () => {
    expect(isValidationStale(record, fresh)).toBe(false);
  });
  it('is stale after a local edit, a conflict, a different server token, version or template, or before any save', () => {
    expect(isValidationStale(record, { ...fresh, dirty: true })).toBe(true);
    expect(isValidationStale(record, { ...fresh, conflict: true })).toBe(true);
    expect(isValidationStale(record, { ...fresh, currentToken: 'tok-b' })).toBe(true);
    expect(isValidationStale(record, { ...fresh, version: 2 })).toBe(true);
    expect(isValidationStale(record, { ...fresh, templateId: 'u' })).toBe(true);
    expect(isValidationStale(record, { ...fresh, currentToken: null })).toBe(true);
  });
  it('treats ok:true with issues as not ok (the server list is authoritative)', () => {
    expect(toValidationRecord('t', 1, 'x', { ok: true, issues: [] }, 1).ok).toBe(true);
    expect(toValidationRecord('t', 1, 'x', { ok: true, issues: [{ code: 'A', message: 'm' }] }, 1).ok).toBe(false);
  });
});

describe('validation failures stay distinct', () => {
  it('classifies 401, 403, 404, 409, unreachable and the rest', () => {
    const kind = (e: unknown) => classifyValidationFailure(e).kind;
    expect(kind({ status: 401 })).toBe('signin');
    expect(kind({ status: 403 })).toBe('revoked');
    expect(kind({ status: 404 })).toBe('missing');
    expect(kind({ status: 409 })).toBe('immutable');
    expect(kind({ status: 503 })).toBe('unavailable');
    expect(kind({ code: 'api_unreachable' })).toBe('unavailable');
    expect(kind({ status: 500 })).toBe('failed');
    expect(kind(new Error('x'))).toBe('failed');
  });
});
