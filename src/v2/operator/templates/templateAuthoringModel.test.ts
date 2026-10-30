import { describe, expect, it } from 'vitest';
import {
  applyReconciliation, bodyFromContent, canonicalBody, classifySaveFailure, createEmptyAuthoringState, hydrateAuthoringState,
  reconcile, refreshActivityVersion, sideFor, toTemplateBody, unresolvedItems, validateAuthoring, activityStaleness,
  PROHIBITED_COMPOSER_FIELDS, wireActivity, type TemplateAuthoringState,
} from './templateAuthoringModel';
import { ApiError } from '../../../api/apiError';
import { activityConfig, contentOf, lookupWith, optionsFor } from './testing/fixtures';

const wireOf = (activity: Parameters<typeof wireActivity>[0]) => wireActivity(activity, 0);
const body = (over = {}, activities = [activityConfig('act-1')]) => bodyFromContent(contentOf(over, activities));

describe('toTemplateBody', () => {
  it('never sends derived or prohibited instance fields', async () => {
    const { state } = await hydrateAuthoringState(body(), lookupWith());
    const sent = JSON.stringify(toTemplateBody({ ...state, challengeType: 'streak' }));
    for (const field of [...PROHIBITED_COMPOSER_FIELDS, 'goalValue', 'goalUnit', 'requiredConsecutiveDays', 'groupId', 'supportTiizi']) {
      expect(sent).not.toContain(`"${field}"`);
    }
    expect(JSON.parse(sent).composer.mode).toBe('TEMPLATE_AUTHORING');
  });

  it('round-trips a server draft unchanged, preserving the hidden sortOrder', async () => {
    const original = body();
    const { state } = await hydrateAuthoringState(original, lookupWith());
    expect(state.sortOrder).toBe(7);
    expect(canonicalBody(toTemplateBody(state))).toBe(canonicalBody(original));
  });

  it('treats the server derived goal as non-content', () => {
    const withGoal = contentOf();
    withGoal.composer.goalValue = 100; withGoal.composer.goalUnit = 'reps';
    expect(canonicalBody(bodyFromContent(withGoal))).toBe(canonicalBody(bodyFromContent(contentOf())));
  });

  it('serializes blank optional text as absent and empty presets as null', () => {
    const wire = toTemplateBody({ ...createEmptyAuthoringState(), summary: '   ', title: ' ' });
    expect(wire.summary).toBeNull();
    expect(wire.durationPresetDays).toBeNull();
    expect(wire.composer.title).toBeUndefined();
  });
});

describe('validateAuthoring (early feedback, mirrors the server limits)', () => {
  const base = createEmptyAuthoringState();
  const fields = (state: TemplateAuthoringState) => validateAuthoring(state).map((i) => i.field);
  it('accepts incomplete drafts', () => expect(validateAuthoring(base)).toEqual([]));
  it('flags each hard limit', () => {
    expect(fields({ ...base, summary: 'x'.repeat(281) })).toContain('summary');
    expect(fields({ ...base, focusTags: ['Strength', 'Sleep & Rest', 'Daily Living', 'Personal Growth', 'Social Wellbeing', 'Mind & Emotional Wellbeing'] })).toContain('focusTags');
    expect(fields({ ...base, focusTags: ['Made up'] })).toContain('focusTags');
    expect(fields({ ...base, durationDays: '0' })).toContain('durationDays');
    expect(fields({ ...base, durationDays: '3661' })).toContain('durationDays');
    expect(fields({ ...base, durationDays: '2.5' })).toContain('durationDays');
    expect(fields({ ...base, durationPresetDays: [1, 2, 3, 4, 5, 6, 7, 8, 9] })).toContain('durationPresetDays');
    expect(fields({ ...base, durationPresetDays: [7, 7] })).toContain('durationPresetDays');
    expect(fields({ ...base, coverId: 'nope' })).toContain('coverId');
    expect(fields({ ...base, sortOrder: 1001 })).toContain('sortOrder');
  });
  it('accepts the boundary values', () => {
    expect(validateAuthoring({ ...base, summary: 'x'.repeat(280), durationDays: '3660', sortOrder: -1000, durationPresetDays: [1, 2, 3, 4, 5, 6, 7, 3660] })).toEqual([]);
  });
});

describe('hydration and Activity versions', () => {
  it('flags a stored version behind the governed current one without changing it', async () => {
    const { state } = await hydrateAuthoringState(body({}, [activityConfig('act-1', { observedVersion: 2 })]), lookupWith({ 'act-1': 5 }));
    const activity = state.activities[0];
    expect(activity.observedVersion).toBe(2);
    expect(activityStaleness(activity)).toEqual({ stale: true, stored: 2, current: 5 });
    expect(toTemplateBody(state).composer.activities[0].observedVersion).toBe(2);
  });

  it('keeps saved settings and reports a load problem when governed details are unavailable', async () => {
    const { state, problems } = await hydrateAuthoringState(body(), lookupWith({}, ['act-1']));
    expect(problems['act-1']).toMatch(/could not be loaded/);
    expect(state.activities[0].targetValue).toBe('100');
    expect(activityStaleness(state.activities[0]).stale).toBe(false);
    expect(toTemplateBody(state).composer.activities[0]).toMatchObject({ metric: 'repetitions', unit: 'reps', targetValue: 100, observedVersion: 3 });
  });

  it('refresh preserves compatible settings and bumps only the version', async () => {
    const { state } = await hydrateAuthoringState(body({}, [activityConfig('act-1', { observedVersion: 2 })]), lookupWith({ 'act-1': 5 }));
    const { activity, dropped } = refreshActivityVersion(state.activities[0], 'competitive');
    expect(dropped).toEqual([]);
    expect(activity).toMatchObject({ observedVersion: 5, metric: 'repetitions', unit: 'reps', targetValue: '100' });
  });

  it('refresh flags settings the new version cannot retain', async () => {
    const { state } = await hydrateAuthoringState(body({}, [activityConfig('act-1', { observedVersion: 2, metric: 'distance', unit: 'metres', targetValue: 5 })]), lookupWith({ 'act-1': 5 }));
    const { activity, dropped } = refreshActivityVersion(state.activities[0], 'competitive');
    expect(dropped.join(' ')).toMatch(/Distance|no longer offered/);
    expect(activity.metric).toBe('repetitions');
    expect(activity.observedVersion).toBe(5);
  });
});

describe('Component sets and kind are never changed silently (R1 M3)', () => {
  const withComponents = (ids: string[], version: number) => ({
    options: async (id: string) => ({ ...optionsFor(id, version), components: ids.map((componentId) => ({ componentId, displayName: componentId, relationship: 'required' })) }),
    item: lookupWith().item,
  });

  it('keeps the stored Component set and version for a stale Activity, so a loaded draft is not dirty', async () => {
    const server = body({}, [activityConfig('act-1', { observedVersion: 2, componentIds: ['OLD'] })]);
    const { state } = await hydrateAuthoringState(server, withComponents(['NEW'], 5));
    const sent = toTemplateBody(state).composer.activities[0];
    expect(sent).toMatchObject({ observedVersion: 2, componentIds: ['OLD'] });
    expect(canonicalBody(toTemplateBody(state))).toBe(canonicalBody(server));
  });

  it('keeps a stored subset of Components unchanged', async () => {
    const server = body({}, [activityConfig('act-1', { componentIds: ['LEFT'] })]);
    const { state } = await hydrateAuthoringState(server, withComponents(['LEFT', 'RIGHT'], 3));
    expect(canonicalBody(toTemplateBody(state))).toBe(canonicalBody(server));
  });

  it('changes the Component set only on explicit refresh, and says so', async () => {
    const { state } = await hydrateAuthoringState(body({}, [activityConfig('act-1', { observedVersion: 2, componentIds: ['OLD'] })]), withComponents(['NEW'], 5));
    const { activity, dropped } = refreshActivityVersion(state.activities[0], 'competitive');
    expect(dropped.join(' ')).toMatch(/required parts changed from OLD to NEW/);
    expect(wireOf(activity)).toMatchObject({ observedVersion: 5, componentIds: ['NEW'] });
  });

  it('does not invent a kind the stored draft did not carry, and round-trips as clean', async () => {
    const { kind: _kind, ...noKind } = activityConfig('act-1');
    const server = body({}, [noKind]);
    const { state } = await hydrateAuthoringState(server, lookupWith());
    expect('kind' in toTemplateBody(state).composer.activities[0]).toBe(false);
    expect(canonicalBody(toTemplateBody(state))).toBe(canonicalBody(server));
  });

  it('does not send a guessed kind when the governed options could not be loaded', async () => {
    const { kind: _kind, ...noKind } = activityConfig('act-1');
    const { state } = await hydrateAuthoringState(body({}, [noKind]), lookupWith({}, ['act-1']));
    expect('kind' in toTemplateBody(state).composer.activities[0]).toBe(false);
  });
});

describe('reconciliation', () => {
  const states = async (b: ReturnType<typeof body>) => (await hydrateAuthoringState(b, lookupWith())).state;

  it('pre-resolves one-sided changes and requires a decision for real conflicts', () => {
    const base = body();
    const mine = body({ summary: 'Mine' });
    const theirs = body({ summary: 'Theirs', focusTags: ['Strength', 'Daily Living'] });
    const items = reconcile(base, mine, theirs);
    const byKey = Object.fromEntries(items.map((i) => [i.key, i]));
    expect(byKey['field:summary'].auto).toBeNull();
    expect(byKey['field:focusTags'].auto).toBe('theirs');
    expect(unresolvedItems(items, {}).map((i) => i.key)).toEqual(['field:summary']);
    expect(unresolvedItems(items, { 'field:summary': 'mine' })).toEqual([]);
  });

  it('identifies added, removed and modified Activities', () => {
    const base = body({}, [activityConfig('act-1'), activityConfig('act-2', { position: 1 })]);
    const mine = body({}, [activityConfig('act-1', { targetValue: 150 }), activityConfig('act-3', { position: 1 })]);
    const theirs = body({}, [activityConfig('act-1', { targetValue: 200 }), activityConfig('act-2', { position: 1 })]);
    const items = reconcile(base, mine, theirs);
    const activity = Object.fromEntries(items.filter((i) => i.kind === 'activity').map((i) => [i.key, i]));
    expect(activity['activity:act-1']).toMatchObject({ change: 'modified', auto: null });
    // act-2: the author removed it and the server left it alone, so the author's removal stands.
    expect(activity['activity:act-2']).toMatchObject({ change: 'removed', auto: 'mine' });
    expect(activity['activity:act-3']).toMatchObject({ change: 'added', auto: 'mine' });
  });

  it('refuses to apply while anything is unresolved', async () => {
    const mine = body({ summary: 'Mine' }); const theirs = body({ summary: 'Theirs' });
    const items = reconcile(body(), mine, theirs);
    await expect(async () => applyReconciliation(items, {}, await states(mine), await states(theirs))).rejects.toThrow(/unresolved/);
  });

  it('builds the combined draft from the choices', async () => {
    const base = body({}, [activityConfig('act-1'), activityConfig('act-2', { position: 1 })]);
    const mine = body({ summary: 'Mine', title: undefined }, [activityConfig('act-1', { targetValue: 150 }), activityConfig('act-3', { position: 1 })]);
    const theirs = body({ summary: 'Theirs' }, [activityConfig('act-1', { targetValue: 200 }), activityConfig('act-2', { position: 1 })]);
    const items = reconcile(base, mine, theirs);
    const choices = { 'field:summary': 'mine', 'activity:act-1': 'theirs' } as const;
    const merged = applyReconciliation(items, { ...choices }, await states(mine), await states(theirs));
    expect(merged.summary).toBe('Mine');
    expect(merged.activities.map((a) => [a.activity, a.targetValue])).toEqual([['act-1', '200'], ['act-3', '100']]);
    expect(items.every((item) => sideFor(item, { ...choices }) !== null)).toBe(true);
  });
});

describe('classifySaveFailure keeps 400/401/403/409/428 distinct', () => {
  it.each([
    [new ApiError(400, 'invalid_template_request', 'summary too long'), 'invalid'],
    [new ApiError(401, 'missing_token', 'x'), 'signin'],
    [new ApiError(403, 'template_author_required', 'x'), 'revoked'],
    [new ApiError(409, 'template_version_immutable', 'x'), 'immutable'],
    [new ApiError(428, 'if_match_required', 'x'), 'precondition'],
    [new ApiError(404, 'template_not_found', 'x'), 'missing'],
    [new ApiError(503, 'api_unreachable', 'x'), 'unavailable'],
    [new ApiError(500, 'internal_error', 'x'), 'failed'],
  ])('%#', (error, kind) => expect(classifySaveFailure(error).kind).toBe(kind));

  it('reads the current server draft from a template_draft_changed conflict', () => {
    const current = { revisionToken: 'b'.repeat(64), content: contentOf(), lastEditedByMemberId: 'm', lastEditedAt: '2026-10-30T09:00:00Z' };
    const result = classifySaveFailure(new ApiError(409, 'template_draft_changed', 'changed', { current }));
    expect(result).toEqual({ kind: 'conflict', current });
  });

  it('does not treat a malformed 409 as a conflict it can reconcile', () => {
    expect(classifySaveFailure(new ApiError(409, 'template_draft_changed', 'changed')).kind).toBe('failed');
  });
});

describe('fixtures sanity', () => { it('options helper', () => expect(optionsFor('x').currentVersion).toBe(3)); });
