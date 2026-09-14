/**
 * PF-04 Challenge Creation Composer Contract — focused proofs.
 *
 * Proves the Composer draft/state model (api/src/challengeComposer.ts):
 * Wizard-stage completeness (structural only), deterministic PF-03
 * mapping, preview through the single PF-03 authority, staleness
 * handling, serialization round-trip, and the absence of every
 * out-of-scope concern (Templates behavior, Verification/Recognition/
 * Rewards, V1 concepts, second validators).
 *
 * 1. empty Composer draft can exist without pretending to be valid.
 * 2. stage completeness reports missing draft fields.
 * 3. Composer mapping to PF-03 is deterministic.
 * 4. complete valid Composer previews successfully through PF-03.
 * 5. invalid Composer cannot bypass PF-03.
 * 6. Activity UUID/Code retained as identity.
 * 7. display name never becomes identity.
 * 8. observed Activity version retained.
 * 9. stale observed Activity version detected.
 * 10. no silent Activity version upgrade.
 * 11. exact Metric/Unit configuration retained.
 * 12. Components retained with ALL_REQUIRED.
 * 13. Weight basis retained.
 * 14. Duration mode retained.
 * 15. Completion occurrence retained.
 * 16. temporal conditions retained.
 * 17. Collective settled behavior is not exposed as configurable flags.
 * 18. Competitive ranking/end behavior is not configurable.
 * 19. Streak cadence/reset semantics are not configurable.
 * 20. unknown Composer fields reject fail-closed.
 * 21. no Verification fields.
 * 22. no Recognition fields.
 * 23. no Rewards fields.
 * 24. Composer serialization round-trips without semantic loss.
 * 25. future mode/context does not alter PF-03 semantic definition.
 *
 * Out of scope (explicitly NOT built): Wizard UI, Templates, Admin
 * management, persistence/migrations, deployment.
 */

import { describe, expect, it } from 'vitest';
import {
  assessComposerCompleteness,
  assessComposerStage,
  checkComposerFreshness,
  createEmptyComposer,
  describeComposerActivityOptions,
  fieldsForStage,
  getComposerStage,
  normalizeComposerDraft,
  parseComposerDraft,
  previewChallengeComposer,
  refreshComposerActivity,
  selectComposerActivity,
  serializeComposerDraft,
  toChallengeDefinitionInput,
  WIZARD_STAGES,
  type ChallengeComposerDraft,
} from '../src/challengeComposer.js';
import {
  createKnowledgeItem,
  reviseKnowledgeItem,
  setKnowledgeLifecycle,
  setLoadReportingBases,
  setMeasurementCompatibility,
  type CreateKnowledgeInput,
} from '../src/knowledge.js';
import {
  BREATHING_PRACTICE_CONTRACT,
  breathingPracticeExemplarInput,
  pushUpExemplarInput,
  PUSH_UP_CONTRACT,
} from '../src/pf01Exemplars.js';
import { testDb } from './helpers.js';

function holdContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'fitness',
    name: 'PF-04 Test Hold',
    category: 'Strength',
    subcategory: 'Hold',
    difficulty: 'Intermediate',
    description: 'A governed static hold for composer tests.',
    metricUnit: 'seconds',
    contentClasses: ['U', 'Q', 'T'],
    measurementGuidance: 'Report held seconds per side.',
    unitSemantics: 'One second equals one second of held position.',
    setup: 'Lie on one side with the forearm under the shoulder.',
    execution: 'Lift the hips and hold the straight-line position.',
    formCues: ['Keep a straight line'],
    adaptation: 'Drop the lower knee while keeping the trunk straight.',
    safetyNotes: ['Stop on sharp pain'],
    ...overrides,
  };
}

const SIDES = [
  { componentId: 'LEFT', displayName: 'Left side', relationship: 'ALL_REQUIRED' },
  { componentId: 'RIGHT', displayName: 'Right side', relationship: 'ALL_REQUIRED' },
];

async function publishDuration(db: ReturnType<typeof testDb>, code: string) {
  const created = await createKnowledgeItem(
    db,
    holdContent({ activityCode: code }) as CreateKnowledgeInput,
  );
  await setMeasurementCompatibility(db, created.id, {
    primaryMetrics: ['duration'],
    secondaryMetrics: [],
    compatibleUnits: ['seconds'],
  });
  await setKnowledgeLifecycle(db, created.id, 'published');
  return created;
}

async function publishPushUp(db: ReturnType<typeof testDb>) {
  const created = await createKnowledgeItem(db, pushUpExemplarInput());
  await setMeasurementCompatibility(db, created.id, PUSH_UP_CONTRACT);
  await setKnowledgeLifecycle(db, created.id, 'published');
  return created;
}

/** A structurally complete, PF-03-valid competitive draft. */
async function completeDraft(db: ReturnType<typeof testDb>): Promise<ChallengeComposerDraft> {
  await publishDuration(db, 'FIT-TST-921');
  let draft = createEmptyComposer();
  draft = { ...draft, challengeType: 'competitive', title: 'Composer check' };
  draft = await selectComposerActivity(db, draft, 'FIT-TST-921');
  draft = {
    ...draft,
    activities: [{
      ...draft.activities[0],
      metric: 'duration',
      unit: 'seconds',
      targetValue: 60,
      durationMode: 'CONTINUOUS',
    }],
    startDate: '2026-10-01',
    endDate: '2026-10-31',
  };
  return draft;
}

describe('PF-04 draft existence and stages (proofs 1-2)', () => {
  it('1. empty Composer draft can exist without pretending to be valid', () => {
    const draft = createEmptyComposer();
    expect(draft).toMatchObject({ draftKind: 'pf04-v1', mode: 'CHALLENGE', activities: [] });
    const completeness = assessComposerCompleteness(draft);
    expect(completeness.complete).toBe(false);
    expect(getComposerStage(draft)).toBe('TYPE');
    expect(completeness.issues.some((issue) => issue.code === 'MISSING_FIELD')).toBe(true);
    expect(completeness.issues.some((issue) => issue.code === 'STAGE_INCOMPLETE')).toBe(true);
  });

  it('2. stage completeness reports missing draft fields', () => {
    expect(WIZARD_STAGES).toEqual([
      'TYPE', 'BASICS', 'ACTIVITIES', 'MEASUREMENT', 'REQUIREMENT',
      'SCHEDULE', 'RULES', 'REVIEW', 'FINISH',
    ]);
    expect(fieldsForStage('MEASUREMENT')).toContain('activities[].metric');
    let draft = createEmptyComposer();
    expect(assessComposerStage(draft, 'TYPE')).toMatchObject({
      complete: false,
      missing: ['challengeType'],
    });
    draft = { ...draft, challengeType: 'streak' };
    expect(assessComposerStage(draft, 'TYPE').complete).toBe(true);
    expect(getComposerStage(draft)).toBe('BASICS');
    expect(assessComposerStage(draft, 'SCHEDULE').missing).toContain('startDate+endDate');
    // Streak day boundaries require an explicit timezone at SCHEDULE stage.
    expect(assessComposerStage(draft, 'SCHEDULE').missing).toContain('timezone');
    draft = {
      ...draft,
      title: 'Streak check',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      timezone: 'Africa/Nairobi',
      requiredConsecutiveDays: 30,
    };
    expect(assessComposerStage(draft, 'SCHEDULE').complete).toBe(true);
    expect(assessComposerStage(draft, 'RULES').complete).toBe(true);
    // Activities still missing further down the flow.
    expect(getComposerStage(draft)).toBe('ACTIVITIES');
  });
});

describe('PF-04 mapping and preview (proofs 3-5)', () => {
  it('3. Composer mapping to PF-03 is deterministic', async () => {
    const db = testDb();
    const draft = await completeDraft(db);
    const first = toChallengeDefinitionInput(draft);
    const second = toChallengeDefinitionInput(JSON.parse(JSON.stringify(draft)));
    expect(second).toEqual(first);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first).toMatchObject({
      challengeType: 'competitive',
      title: 'Composer check',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    });
    expect(first.activities[0]).toMatchObject({
      activity: 'FIT-TST-921',
      metric: 'duration',
      unit: 'seconds',
      targetValue: 60,
      durationMode: 'CONTINUOUS',
    });
  });

  it('4. complete valid Composer previews successfully through PF-03', async () => {
    const db = testDb();
    const draft = await completeDraft(db);
    expect(assessComposerCompleteness(draft).complete).toBe(true);
    expect(getComposerStage(draft)).toBe('REVIEW');
    const preview = await previewChallengeComposer(db, draft);
    expect(preview.ok).toBe(true);
    if (!preview.ok) throw new Error('preview should succeed');
    expect(preview.definition.definitionKind).toBe('pf03-v1');
    expect(preview.definition.title).toBe('Composer check');
    expect(preview.definition.activities[0].knowledgeVersion).toBe(2);
    // Preview writes nothing: no challenge rows exist.
    const count = await db.query<{ count: string }>(`SELECT COUNT(*) AS count FROM challenges`);
    expect(Number(count.rows[0].count)).toBe(0);
  });

  it('5. invalid Composer cannot bypass PF-03', async () => {
    const db = testDb();
    const draft = await completeDraft(db);
    // Governed tuple broken at the draft: PF-03 is the judge, not the Composer.
    const broken = {
      ...draft,
      activities: [{ ...draft.activities[0], unit: 'reps' }],
    };
    // Structurally complete (metric+unit present) yet semantically invalid.
    expect(assessComposerCompleteness(broken).complete).toBe(true);
    const preview = await previewChallengeComposer(db, broken);
    expect(preview.ok).toBe(false);
    if (preview.ok) throw new Error('preview should fail');
    expect(preview.issues).toHaveLength(1);
    expect(preview.issues[0].code).toBe('PF03_SEMANTIC');
    expect(preview.issues[0].message).toMatch(/unit_not_compatible/);
    // Incomplete drafts fail before PF-03 is even consulted.
    const early = await previewChallengeComposer(db, createEmptyComposer());
    expect(early.ok).toBe(false);
    if (early.ok) throw new Error('preview should fail');
    expect(early.issues.some((issue) => issue.code === 'MISSING_FIELD')).toBe(true);
    expect(early.issues.some((issue) => issue.code === 'PF03_SEMANTIC')).toBe(false);
  });
});

describe('PF-04 identity and versions (proofs 6-10)', () => {
  it('6. Activity UUID/Code retained as identity', async () => {
    const db = testDb();
    const created = await publishPushUp(db);
    const byCode = await selectComposerActivity(db, createEmptyComposer(), 'FIT-STR-001');
    expect(byCode.activities[0]).toMatchObject({
      activity: 'FIT-STR-001',
      kind: 'fitness',
    });
    const byUuid = await selectComposerActivity(db, createEmptyComposer(), created.id);
    expect(byUuid.activities[0]).toMatchObject({ activity: created.id, kind: 'fitness' });
    const breathing = await createKnowledgeItem(db, breathingPracticeExemplarInput());
    await setMeasurementCompatibility(db, breathing.id, BREATHING_PRACTICE_CONTRACT);
    await setKnowledgeLifecycle(db, breathing.id, 'published');
    const wellness = await selectComposerActivity(db, createEmptyComposer(), 'WEL-MND-003');
    expect(wellness.activities[0].kind).toBe('wellness');
  });

  it('7. display name never becomes identity', async () => {
    const db = testDb();
    await publishDuration(db, 'FIT-TST-922');
    await expect(selectComposerActivity(db, createEmptyComposer(), 'PF-04 Test Hold'))
      .rejects.toThrow(/never identity/);
    const options = await describeComposerActivityOptions(db, 'FIT-TST-922');
    expect(options.activityCode).toBe('FIT-TST-922');
  });

  it('8. observed Activity version retained', async () => {
    const db = testDb();
    // Creation v1 + contract v2: selection observes the current version.
    await publishDuration(db, 'FIT-TST-923');
    const draft = await selectComposerActivity(db, createEmptyComposer(), 'FIT-TST-923');
    expect(draft.activities[0].observedVersion).toBe(2);
    const mapped = toChallengeDefinitionInput({
      ...draft,
      challengeType: 'competitive',
      title: 'Observed version',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      activities: [{
        ...draft.activities[0],
        metric: 'duration',
        unit: 'seconds',
        targetValue: 60,
        durationMode: 'CONTINUOUS',
      }],
    });
    expect(mapped.activities).toHaveLength(1);
  });

  it('9. stale observed Activity version detected', async () => {
    const db = testDb();
    await publishDuration(db, 'FIT-TST-924');
    let draft = await selectComposerActivity(db, createEmptyComposer(), 'FIT-TST-924');
    // Canonical advance while the draft is open (contract v2 -> v3).
    const item = await db.query<{ knowledge_id: string }>(
      `SELECT knowledge_id FROM knowledge_items WHERE activity_code = 'FIT-TST-924'`,
    );
    const id = String(item.rows[0].knowledge_id);
    await setMeasurementCompatibility(db, id, {
      primaryMetrics: ['duration'],
      secondaryMetrics: [],
      compatibleUnits: ['seconds', 'minutes'],
    });
    const freshness = await checkComposerFreshness(db, draft);
    expect(freshness).toHaveLength(1);
    expect(freshness[0]).toMatchObject({
      activity: 'FIT-TST-924',
      observedVersion: 2,
      currentVersion: 3,
      stale: true,
    });
    // Preview identifies staleness with a Composer-level issue.
    draft = {
      ...draft,
      challengeType: 'competitive',
      title: 'Stale check',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      activities: [{
        ...draft.activities[0],
        metric: 'duration',
        unit: 'seconds',
        targetValue: 60,
        durationMode: 'CONTINUOUS',
      }],
    };
    const preview = await previewChallengeComposer(db, draft);
    expect(preview.ok).toBe(false);
    if (preview.ok) throw new Error('preview should fail');
    expect(preview.issues.some((issue) => issue.code === 'STALE_ACTIVITY')).toBe(true);
  });

  it('10. no silent Activity version upgrade', async () => {
    const db = testDb();
    await publishDuration(db, 'FIT-TST-925');
    let draft = await selectComposerActivity(db, createEmptyComposer(), 'FIT-TST-925');
    const item = await db.query<{ knowledge_id: string }>(
      `SELECT knowledge_id FROM knowledge_items WHERE activity_code = 'FIT-TST-925'`,
    );
    const id = String(item.rows[0].knowledge_id);
    await setMeasurementCompatibility(db, id, {
      primaryMetrics: ['duration'],
      secondaryMetrics: [],
      compatibleUnits: ['seconds', 'minutes'],
    });
    // Explicit refresh moves the observed version — and nothing else.
    const before = JSON.parse(JSON.stringify(draft));
    const { draft: refreshed, refreshed: didRefresh } = await refreshComposerActivity(db, draft, 0);
    expect(didRefresh).toBe(true);
    expect(refreshed.activities[0].observedVersion).toBe(3);
    expect({ ...refreshed.activities[0], observedVersion: before.activities[0].observedVersion })
      .toEqual(before.activities[0]);
    // A fresh draft needs no refresh.
    const { refreshed: again } = await refreshComposerActivity(db, refreshed, 0);
    expect(again).toBe(false);
    // Refresh does not confer validity: the stale contract still fails PF-03
    // until the configuration itself is reviewed (here seconds stays valid,
    // so preview succeeds only because the kept config is still governed).
    draft = {
      ...refreshed,
      challengeType: 'competitive',
      title: 'Refresh check',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      activities: [{
        ...refreshed.activities[0],
        metric: 'duration',
        unit: 'seconds',
        targetValue: 60,
        durationMode: 'CONTINUOUS',
      }],
    };
    const preview = await previewChallengeComposer(db, draft);
    expect(preview.ok).toBe(true);
  });
});

describe('PF-04 measurement retention (proofs 11-16)', () => {
  it('11. exact Metric/Unit configuration retained', async () => {
    const db = testDb();
    const draft = await completeDraft(db);
    const options = await describeComposerActivityOptions(db, 'FIT-TST-921');
    // Options derive from Knowledge (never hard-coded).
    expect(options.compatibleUnits).toEqual(['seconds']);
    expect(options.primaryMetrics).toEqual(['duration']);
    const preview = await previewChallengeComposer(db, draft);
    expect(preview.ok).toBe(true);
    if (!preview.ok) throw new Error('preview should succeed');
    expect(preview.definition.activities[0]).toMatchObject({
      metric: 'duration',
      unit: 'seconds',
      targetValue: 60,
    });
  });

  it('12. Components retained with ALL_REQUIRED', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      holdContent({ activityCode: 'FIT-TST-926', components: SIDES }) as CreateKnowledgeInput,
    );
    await setMeasurementCompatibility(db, created.id, {
      primaryMetrics: ['duration'],
      secondaryMetrics: [],
      compatibleUnits: ['seconds'],
    });
    await setKnowledgeLifecycle(db, created.id, 'published');
    const options = await describeComposerActivityOptions(db, 'FIT-TST-926');
    expect(options.components.map((c) => c.componentId)).toEqual(['LEFT', 'RIGHT']);
    let draft = await selectComposerActivity(db, createEmptyComposer(), 'FIT-TST-926');
    draft = {
      ...draft,
      challengeType: 'competitive',
      title: 'Component check',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      activities: [{
        ...draft.activities[0],
        metric: 'duration',
        unit: 'seconds',
        targetValue: 30,
        durationMode: 'CONTINUOUS',
        componentIds: ['LEFT', 'RIGHT'],
      }],
    };
    const preview = await previewChallengeComposer(db, draft);
    expect(preview.ok).toBe(true);
    if (!preview.ok) throw new Error('preview should succeed');
    expect(preview.definition.activities[0].componentRelationship).toBe('ALL_REQUIRED');
    expect(preview.definition.activities[0].componentTargets).toEqual([
      { componentId: 'LEFT', targetValue: 30 },
      { componentId: 'RIGHT', targetValue: 30 },
    ]);
  });

  it('13. Weight basis retained', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      holdContent({
        activityCode: 'FIT-TST-927',
        name: 'PF-04 Test Carry',
        contentClasses: ['U', 'Q'],
        measurementGuidance: 'Report the implement weight in kilograms.',
        unitSemantics: 'One kilogram equals one kilogram of external implement load.',
      }) as CreateKnowledgeInput,
    );
    await setMeasurementCompatibility(db, created.id, {
      primaryMetrics: ['weight'],
      secondaryMetrics: [],
      compatibleUnits: ['kilograms'],
    });
    await setLoadReportingBases(db, created.id, ['PER_IMPLEMENT']);
    await setKnowledgeLifecycle(db, created.id, 'published');
    const options = await describeComposerActivityOptions(db, 'FIT-TST-927');
    expect(options.supportedLoadBases).toEqual(['PER_IMPLEMENT']);
    let draft = await selectComposerActivity(db, createEmptyComposer(), 'FIT-TST-927');
    draft = {
      ...draft,
      challengeType: 'competitive',
      title: 'Weight check',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      activities: [{
        ...draft.activities[0],
        metric: 'weight',
        unit: 'kilograms',
        targetValue: 20,
        loadBasis: 'PER_IMPLEMENT',
      }],
    };
    const preview = await previewChallengeComposer(db, draft);
    expect(preview.ok).toBe(true);
    if (!preview.ok) throw new Error('preview should succeed');
    expect(preview.definition.activities[0].loadReportingBasis).toBe('PER_IMPLEMENT');
  });

  it('14. Duration mode retained', async () => {
    const db = testDb();
    const draft = await completeDraft(db);
    const preview = await previewChallengeComposer(db, draft);
    expect(preview.ok).toBe(true);
    if (!preview.ok) throw new Error('preview should succeed');
    expect(preview.definition.activities[0].durationMode).toBe('CONTINUOUS');
  });

  it('15. Completion occurrence retained', async () => {
    const db = testDb();
    const breathing = await createKnowledgeItem(db, breathingPracticeExemplarInput());
    await setMeasurementCompatibility(db, breathing.id, BREATHING_PRACTICE_CONTRACT);
    await setKnowledgeLifecycle(db, breathing.id, 'published');
    let draft = await selectComposerActivity(db, createEmptyComposer(), 'WEL-MND-003');
    draft = {
      ...draft,
      challengeType: 'competitive',
      title: 'Completion check',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      activities: [{
        ...draft.activities[0],
        metric: 'completion',
        unit: 'completion',
        targetValue: 1,
        completionOccurrence: 'Complete one full guided session',
      }],
    };
    const preview = await previewChallengeComposer(db, draft);
    expect(preview.ok).toBe(true);
    if (!preview.ok) throw new Error('preview should succeed');
    expect(preview.definition.activities[0].completionOccurrence).toBe(
      'Complete one full guided session',
    );
  });

  it('16. temporal conditions retained', async () => {
    const db = testDb();
    const draft = await completeDraft(db);
    const withTemporal = {
      ...draft,
      temporalConditions: { within: { start: '21:00', end: '22:30' } },
    };
    const preview = await previewChallengeComposer(db, withTemporal);
    expect(preview.ok).toBe(true);
    if (!preview.ok) throw new Error('preview should succeed');
    expect(preview.definition.temporalConditions).toEqual({
      at: null,
      before: null,
      after: null,
      within: { start: '21:00', end: '22:30' },
    });
  });
});

describe('PF-04 settled behavior is not configurable (proofs 17-19)', () => {
  it('17. Collective settled behavior is not exposed as configurable flags', async () => {
    const db = testDb();
    await publishDuration(db, 'FIT-TST-928');
    // Settled engine behavior (full crossing counts, >100% actuals, early
    // completion) has no Composer field: smuggled flags fail closed.
    const preview = await previewChallengeComposer(db, {
      ...createEmptyComposer(),
      challengeType: 'collective',
      title: 'Collective flags',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      goalValue: 3600,
      goalUnit: 'seconds',
      capAtGoal: true,
      earlyCompletion: false,
      activities: [],
    } as unknown as ChallengeComposerDraft);
    expect(preview.ok).toBe(false);
    if (preview.ok) throw new Error('preview should fail');
    expect(preview.issues[0].code).toBe('INVALID_DRAFT');
    expect(() => normalizeComposerDraft({
      ...createEmptyComposer(),
      challengeType: 'collective',
      title: 'Collective flags',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      goalValue: 3600,
      goalUnit: 'seconds',
      activities: [],
      capAtGoal: true,
    })).toThrow(/INVALID_DRAFT/);
  });

  it('18. Competitive ranking/end behavior is not configurable', () => {
    expect(() => normalizeComposerDraft({
      ...createEmptyComposer(),
      ranking: 'dense',
      activities: [],
    })).toThrow(/INVALID_DRAFT/);
    expect(() => normalizeComposerDraft({
      ...createEmptyComposer(),
      endOnFirstFinish: true,
      activities: [],
    })).toThrow(/INVALID_DRAFT/);
  });

  it('19. Streak cadence/reset semantics are not configurable', () => {
    expect(() => normalizeComposerDraft({
      ...createEmptyComposer(),
      cadence: 'WEEKLY',
      activities: [],
    })).toThrow(/INVALID_DRAFT/);
    expect(() => normalizeComposerDraft({
      ...createEmptyComposer(),
      resetOnMiss: false,
      activities: [],
    })).toThrow(/INVALID_DRAFT/);
    expect(() => normalizeComposerDraft({
      ...createEmptyComposer(),
      leaderboard: true,
      activities: [],
    })).toThrow(/INVALID_DRAFT/);
    expect(fieldsForStage('RULES')).toEqual(['goalValue', 'goalUnit', 'requiredConsecutiveDays']);
  });
});

describe('PF-04 boundaries and serialization (proofs 20-25)', () => {
  it('20. unknown Composer fields reject fail-closed', () => {
    expect(() => normalizeComposerDraft({
      ...createEmptyComposer(),
      reset_on_miss: false,
      activities: [],
    })).toThrow(/INVALID_DRAFT/);
    expect(() => normalizeComposerDraft({
      ...createEmptyComposer(),
      activities: [{ activity: 'FIT-STR-001', observedVersion: 1, kind: 'fitness', points: 10 }],
    })).toThrow(/INVALID_DRAFT/);
  });

  it('21. no Verification fields', () => {
    expect(() => normalizeComposerDraft({
      ...createEmptyComposer(),
      verification: { method: 'photo' },
      activities: [],
    })).toThrow(/INVALID_DRAFT/);
    expect(() => normalizeComposerDraft({
      ...createEmptyComposer(),
      verificationAuthority: 'ACT-03',
      activities: [],
    })).toThrow(/INVALID_DRAFT/);
  });

  it('22. no Recognition fields', () => {
    expect(() => normalizeComposerDraft({
      ...createEmptyComposer(),
      recognition: { badge: 'gold' },
      activities: [],
    })).toThrow(/INVALID_DRAFT/);
    expect(() => normalizeComposerDraft({
      ...createEmptyComposer(),
      motRecognition: true,
      activities: [],
    })).toThrow(/INVALID_DRAFT/);
  });

  it('23. no Rewards fields', () => {
    expect(() => normalizeComposerDraft({
      ...createEmptyComposer(),
      rewards: [{ amount: 100 }],
      activities: [],
    })).toThrow(/INVALID_DRAFT/);
    expect(() => normalizeComposerDraft({
      ...createEmptyComposer(),
      points: 10,
      activities: [],
    })).toThrow(/INVALID_DRAFT/);
    expect(() => normalizeComposerDraft({
      ...createEmptyComposer(),
      donation: { enabled: true },
      activities: [],
    })).toThrow(/INVALID_DRAFT/);
  });

  it('24. Composer serialization round-trips without semantic loss', async () => {
    const db = testDb();
    const draft = await completeDraft(db);
    const serialized = serializeComposerDraft(draft);
    const parsed = parseComposerDraft(serialized);
    expect(parsed).toEqual(draft);
    // Mapping after round-trip is identical (deterministic, lossless).
    expect(toChallengeDefinitionInput(parsed)).toEqual(toChallengeDefinitionInput(draft));
    const preview = await previewChallengeComposer(db, parsed);
    expect(preview.ok).toBe(true);
    expect(() => parseComposerDraft('not json{')).toThrow(/INVALID_DRAFT/);
  });

  it('25. future mode/context does not alter PF-03 semantic definition', async () => {
    const db = testDb();
    const draft = await completeDraft(db);
    const authoring = { ...draft, mode: 'TEMPLATE_AUTHORING' as const };
    // Same fields, same mapping, same preview verdict in both modes.
    expect(toChallengeDefinitionInput(authoring)).toEqual(toChallengeDefinitionInput(draft));
    const challengePreview = await previewChallengeComposer(db, draft);
    const authoringPreview = await previewChallengeComposer(db, authoring);
    expect(challengePreview.ok).toBe(true);
    expect(authoringPreview.ok).toBe(true);
    if (!challengePreview.ok || !authoringPreview.ok) {
      throw new Error('both mode previews should succeed');
    }
    expect(authoringPreview.definition).toEqual(challengePreview.definition);
    expect(authoringPreview.definition).not.toHaveProperty('mode');
  });
});
