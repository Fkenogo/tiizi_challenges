/**
 * PF-03 Challenge Definition Contract — focused proofs.
 *
 * Proves the authoritative server-side Challenge Definition validator
 * (api/src/challengeDefinition.ts) plus its persistence (migration 017)
 * on the real stack (PGlite PostgreSQL semantics). The validator is the
 * single contract Wizard Preview, Template validation and Challenge
 * establishment must eventually share; PF-03 does not build those UIs.
 *
 * 1. UUID/code/version pin resolves the exact Activity version.
 * 2. Mutable Activity name is never identity.
 * 3. Invalid Metric/Unit rejects.
 * 4. Component Activity requires all governed Components.
 * 5. Non-component Activity rejects unexpected Components.
 * 6. Component target applies per Component, not summed.
 * 7. Weight requires an explicit supported Load Reporting Basis.
 * 8. Unsupported Weight basis rejects.
 * 9. Non-Weight + load basis rejects.
 * 10. Duration supports CONTINUOUS and ACCUMULATED where applicable.
 * 11. Ambiguous required Duration mode fails where necessary.
 * 12. Completion requires an intelligible occurrence.
 * 13. Invalid/empty Completion occurrence rejects.
 * 14. Timezone required where day-boundary semantics require it.
 * 15. Streak rejects reset_on_miss=false.
 * 16. Streak daily semantics remain fixed.
 * 17. Competitive ranking configuration cannot select dense ranking.
 * 18. Competitive one-finisher-does-not-end invariant preserved.
 * 19. Collective early-goal completion invariant preserved.
 * 20. Established definition stays historically stable after Activity
 *     contract changes.
 * 21. Prohibited generic mutation rejects.
 * 22. Allowed bounded mutation preserves immutable history.
 * 23. Ended Challenge cannot be reopened through definition mutation.
 * 24. Run Again is not represented as reopening an existing Challenge.
 * 25. Verification/Recognition/Rewards fields are not introduced.
 *
 * Out of scope (explicitly NOT built): Wizard, Templates,
 * participant journeys, Run Again UX, Verification/Recognition/Rewards,
 * deployment, bulk catalogue seeding.
 */

import { describe, expect, it } from 'vitest';
import { evaluateActivitySatisfaction, setActivityComponents } from '../src/activityComponents.js';
import {
  buildDefinitionSnapshot,
  insertChallengeDefinitionVersion,
  normalizeTemporalConditions,
  validateChallengeDefinition,
  type ChallengeDefinitionInput,
} from '../src/challengeDefinition.js';
import {
  addChallengeConfigVersion,
  getChallengeConfig,
  getGoverningVersion,
  parseGoverningSnapshot,
} from '../src/challengeConfigs.js';
import { activateChallenge, endChallenge, validateNewChallenge } from '../src/challenges.js';
import { createDbKnowledgeEligibilityResolverByIdentity } from '../src/knowledgeEligibility.js';
import {
  createDbKnowledgeIdentityResolver,
  resolveKnowledgePinByIdentity,
} from '../src/knowledgePins.js';
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
import { seedGroup, seedMember, testDb } from './helpers.js';

function durationContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'fitness',
    name: 'PF-03 Test Hold',
    category: 'Strength',
    subcategory: 'Hold',
    difficulty: 'Intermediate',
    description: 'A governed static hold for definition tests.',
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

const DURATION_CONTRACT = {
  primaryMetrics: ['duration'],
  secondaryMetrics: [] as string[],
  compatibleUnits: ['seconds', 'minutes'],
};

const SIDES = [
  { componentId: 'LEFT', displayName: 'Left side', relationship: 'ALL_REQUIRED' },
  { componentId: 'RIGHT', displayName: 'Right side', relationship: 'ALL_REQUIRED' },
];

async function publishDuration(
  db: ReturnType<typeof testDb>,
  code: string,
  overrides: Record<string, unknown> = {},
) {
  const created = await createKnowledgeItem(
    db,
    durationContent({ activityCode: code, ...overrides }) as CreateKnowledgeInput,
  );
  await setMeasurementCompatibility(db, created.id, DURATION_CONTRACT);
  await setKnowledgeLifecycle(db, created.id, 'published');
  return created;
}

async function publishWeight(db: ReturnType<typeof testDb>, code: string) {
  const created = await createKnowledgeItem(
    db,
    durationContent({
      activityCode: code,
      name: 'PF-03 Test Carry',
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
  return created;
}

async function publishComponentHold(db: ReturnType<typeof testDb>, code: string) {
  const created = await createKnowledgeItem(
    db,
    durationContent({ activityCode: code, components: SIDES }) as CreateKnowledgeInput,
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

async function publishBreathing(db: ReturnType<typeof testDb>) {
  const created = await createKnowledgeItem(db, breathingPracticeExemplarInput());
  await setMeasurementCompatibility(db, created.id, BREATHING_PRACTICE_CONTRACT);
  await setKnowledgeLifecycle(db, created.id, 'published');
  return created;
}

function window_() {
  return { startDate: '2026-10-01', endDate: '2026-10-31' };
}

async function seedChallengeRow(
  db: ReturnType<typeof testDb>,
  challengeType: 'collective' | 'competitive' | 'streak',
) {  const memberId = await seedMember(db, `pf03-${challengeType}-${Math.random().toString(36).slice(2)}`);
  const groupId = await seedGroup(db, { name: `PF-03 ${challengeType}` });
  const base: Record<string, unknown> = {
    challenge_type: challengeType,
    title: `PF-03 ${challengeType}`,
    start_date: '2026-10-01',
    end_date: '2026-10-31',
  };
  if (challengeType === 'collective') {
    base.goal_value = 3600;
    base.goal_unit = 'seconds';
  }
  if (challengeType === 'streak') {
    base.required_consecutive_days = 30;
  }
  const result = await db.query<{ challenge_id: string }>(
    `INSERT INTO challenges (group_id, created_by_member_id, challenge_type, title, start_date, end_date,
       goal_value, goal_unit, required_consecutive_days)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING challenge_id`,
    [
      groupId,
      memberId,
      base.challenge_type,
      base.title,
      base.start_date,
      base.end_date,
      base.goal_value ?? null,
      base.goal_unit ?? null,
      base.required_consecutive_days ?? null,
    ],
  );
  return String(result.rows[0].challenge_id);
}

/**
 * Map-backed config resolvers pre-resolved OUTSIDE any transaction.
 * addChallengeConfigVersion enforces inside its transaction, so live-DB
 * resolvers must never be called from in-version code on PGlite (outer-DB
 * I/O inside a serialized transaction never resolves). Production maps
 * are built the same way (see challengeEstablishment pinnedResolvers).
 */
async function pinnedConfigResolvers(
  db: ReturnType<typeof testDb>,
  kind: 'fitness' | 'wellness',
  key: string,
) {
  const pin = await resolveKnowledgePinByIdentity(db, kind, key);
  const eligibility = await createDbKnowledgeEligibilityResolverByIdentity(db, kind)(key);
  if (!pin || !eligibility) throw new Error(`test fixture missing for ${key}`);
  return {
    resolveKnowledgePin: async (k: string) => (k === key ? pin : null),
    resolveKnowledgeEligibility: async (k: string) => (k === key ? eligibility : null),
  };
}

describe('PF-03 identity and pinning (proofs 1-2)', () => {
  it('1. UUID/code/version pin resolves the exact Activity version', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      durationContent({ activityCode: 'FIT-TST-701' }) as CreateKnowledgeInput,
    );
    await setMeasurementCompatibility(db, created.id, {
      primaryMetrics: ['duration'],
      secondaryMetrics: [],
      compatibleUnits: ['seconds'],
    });
    await reviseKnowledgeItem(db, created.id, {
      ...(durationContent({ activityCode: 'FIT-TST-701' }) as Record<string, unknown>),
      description: 'A revised governed static hold for definition tests.',
    });
    await setKnowledgeLifecycle(db, created.id, 'published');
    // By code, pinned to version 2 (the contract version).
    const byCode = await validateChallengeDefinition(db, {
      challengeType: 'competitive',
      title: 'Pin check',
      ...window_(),
      activities: [{
        activity: 'FIT-TST-701',
        version: 2,
        metric: 'duration',
        unit: 'seconds',
        targetValue: 60,
        durationMode: 'CONTINUOUS',
      }],
    } as ChallengeDefinitionInput);
    expect(byCode.activities[0].knowledgeId).toBe(created.id);
    expect(byCode.activities[0].activityCode).toBe('FIT-TST-701');
    expect(byCode.activities[0].knowledgeVersion).toBe(2);
    // By UUID, current version (3 after the content revision).
    const byUuid = await validateChallengeDefinition(db, {
      challengeType: 'competitive',
      title: 'Pin check uuid',
      ...window_(),
      activities: [{
        activity: created.id,
        metric: 'duration',
        unit: 'seconds',
        targetValue: 60,
        durationMode: 'ACCUMULATED',
      }],
    } as ChallengeDefinitionInput);
    expect(byUuid.activities[0].knowledgeVersion).toBe(3);
    // Unresolvable versions are never invented.
    await expect(validateChallengeDefinition(db, {
      challengeType: 'competitive',
      title: 'Pin check bad',
      ...window_(),
      activities: [{
        activity: 'FIT-TST-701',
        version: 99,
        metric: 'duration',
        unit: 'seconds',
        targetValue: 60,
        durationMode: 'CONTINUOUS',
      }],
    } as ChallengeDefinitionInput)).rejects.toThrow(/unresolvable_version/);
    await expect(validateChallengeDefinition(db, {
      challengeType: 'competitive',
      title: 'Pin check unknown',
      ...window_(),
      activities: [{
        activity: 'FIT-TST-999',
        metric: 'duration',
        unit: 'seconds',
        targetValue: 60,
        durationMode: 'CONTINUOUS',
      }],
    } as ChallengeDefinitionInput)).rejects.toThrow(/unknown_activity/);
  });

  it('2. mutable Activity name is never identity', async () => {
    const db = testDb();
    await publishDuration(db, 'FIT-TST-702', { name: 'Distinctive Hold Name' });
    await expect(validateChallengeDefinition(db, {
      challengeType: 'competitive',
      title: 'Name check',
      ...window_(),
      activities: [{
        activity: 'Distinctive Hold Name',
        metric: 'duration',
        unit: 'seconds',
        targetValue: 60,
        durationMode: 'CONTINUOUS',
      }],
    } as ChallengeDefinitionInput)).rejects.toThrow(/not_identity/);
  });
});

describe('PF-03 exact compatibility and components (proofs 3-6)', () => {
  it('3. invalid Metric/Unit rejects', async () => {
    const db = testDb();
    await publishDuration(db, 'FIT-TST-703');
    const base = {
      challengeType: 'competitive',
      title: 'Compat check',
      ...window_(),
    } as ChallengeDefinitionInput;
    await expect(validateChallengeDefinition(db, {
      ...base,
      activities: [{ activity: 'FIT-TST-703', metric: 'distance', unit: 'metres', targetValue: 5 }],
    } as ChallengeDefinitionInput)).rejects.toThrow(/metric_not_permitted/);
    await expect(validateChallengeDefinition(db, {
      ...base,
      activities: [{
        activity: 'FIT-TST-703', metric: 'duration', unit: 'reps', targetValue: 5,
        durationMode: 'CONTINUOUS',
      }],
    } as ChallengeDefinitionInput)).rejects.toThrow(/unit_not_compatible/);
  });

  it('4. component Activity requires all governed Components', async () => {
    const db = testDb();
    await publishComponentHold(db, 'FIT-TST-704');
    const base = {
      challengeType: 'competitive',
      title: 'Component check',
      ...window_(),
    } as ChallengeDefinitionInput;
    await expect(validateChallengeDefinition(db, {
      ...base,
      activities: [{
        activity: 'FIT-TST-704', metric: 'duration', unit: 'seconds', targetValue: 30,
        durationMode: 'CONTINUOUS', componentIds: ['LEFT'],
      }],
    } as ChallengeDefinitionInput)).rejects.toThrow(/missing_required_components/);
    await expect(validateChallengeDefinition(db, {
      ...base,
      activities: [{
        activity: 'FIT-TST-704', metric: 'duration', unit: 'seconds', targetValue: 30,
        durationMode: 'CONTINUOUS',
      }],
    } as ChallengeDefinitionInput)).rejects.toThrow(/missing_required_components/);
    const full = await validateChallengeDefinition(db, {
      ...base,
      activities: [{
        activity: 'FIT-TST-704', metric: 'duration', unit: 'seconds', targetValue: 30,
        durationMode: 'CONTINUOUS', componentIds: ['LEFT', 'RIGHT'],
      }],
    } as ChallengeDefinitionInput);
    expect(full.activities[0].requiredComponents).toEqual(['LEFT', 'RIGHT']);
    expect(full.activities[0].componentRelationship).toBe('ALL_REQUIRED');
  });

  it('5. non-component Activity rejects unexpected Components', async () => {
    const db = testDb();
    await publishPushUp(db);
    await expect(validateChallengeDefinition(db, {
      challengeType: 'competitive',
      title: 'No-component check',
      ...window_(),
      activities: [{
        activity: 'FIT-STR-001', metric: 'repetitions', unit: 'reps', targetValue: 50,
        componentIds: ['LEFT'],
      }],
    } as ChallengeDefinitionInput)).rejects.toThrow(/unknown_component|unexpected_components/);
  });

  it('6. Component target applies per Component, not summed', async () => {
    const db = testDb();
    await publishComponentHold(db, 'FIT-TST-705');
    const normalized = await validateChallengeDefinition(db, {
      challengeType: 'competitive',
      title: 'Per-component target',
      ...window_(),
      activities: [{
        activity: 'FIT-TST-705', metric: 'duration', unit: 'seconds', targetValue: 30,
        durationMode: 'CONTINUOUS', componentIds: ['LEFT', 'RIGHT'],
      }],
    } as ChallengeDefinitionInput);
    // The SAME target is applied to EACH required Component.
    expect(normalized.activities[0].componentTargets).toEqual([
      { componentId: 'LEFT', targetValue: 30 },
      { componentId: 'RIGHT', targetValue: 30 },
    ]);
    // No summed/total field exists anywhere in the normalized contract.
    expect(JSON.stringify(normalized)).not.toMatch(/total/i);
    // 40s Left + 20s Right against a 30s requirement: one satisfied, one
    // not — never 60s complete.
    const outcome = evaluateActivitySatisfaction(
      [
        { componentId: 'LEFT', displayName: 'Left', relationship: 'ALL_REQUIRED' },
        { componentId: 'RIGHT', displayName: 'Right', relationship: 'ALL_REQUIRED' },
      ],
      { metric: 'duration', unit: 'seconds', targetValue: 30 },
      [
        { componentId: 'LEFT', metric: 'duration', unit: 'seconds', value: 40 },
        { componentId: 'RIGHT', metric: 'duration', unit: 'seconds', value: 20 },
      ],
    );
    expect(outcome.satisfied).toBe(false);
  });
});

describe('PF-03 weight and load basis (proofs 7-9)', () => {
  it('7. Weight requires an explicit supported Load Reporting Basis', async () => {
    const db = testDb();
    await publishWeight(db, 'FIT-TST-706');
    const base = {
      challengeType: 'competitive',
      title: 'Weight basis check',
      ...window_(),
    } as ChallengeDefinitionInput;
    await expect(validateChallengeDefinition(db, {
      ...base,
      activities: [{ activity: 'FIT-TST-706', metric: 'weight', unit: 'kilograms', targetValue: 20 }],
    } as ChallengeDefinitionInput)).rejects.toThrow(/missing_load_basis/);
    const withBasis = await validateChallengeDefinition(db, {
      ...base,
      activities: [{
        activity: 'FIT-TST-706', metric: 'weight', unit: 'kilograms', targetValue: 20,
        loadBasis: 'PER_IMPLEMENT',
      }],
    } as ChallengeDefinitionInput);
    expect(withBasis.activities[0].loadReportingBasis).toBe('PER_IMPLEMENT');
  });

  it('8. unsupported Weight basis rejects', async () => {
    const db = testDb();
    await publishWeight(db, 'FIT-TST-707');
    const base = {
      challengeType: 'competitive',
      title: 'Weight support check',
      ...window_(),
    } as ChallengeDefinitionInput;
    await expect(validateChallengeDefinition(db, {
      ...base,
      activities: [{
        activity: 'FIT-TST-707', metric: 'weight', unit: 'kilograms', targetValue: 20,
        loadBasis: 'MACHINE_DISPLAYED_LOAD',
      }],
    } as ChallengeDefinitionInput)).rejects.toThrow(/unsupported_load_basis/);
    await expect(validateChallengeDefinition(db, {
      ...base,
      activities: [{
        activity: 'FIT-TST-707', metric: 'weight', unit: 'kilograms', targetValue: 20,
        loadBasis: 'PER_MOON',
      }],
    } as ChallengeDefinitionInput)).rejects.toThrow(/unknown_load_basis/);
  });

  it('9. non-Weight + load basis rejects', async () => {
    const db = testDb();
    await publishPushUp(db);
    await expect(validateChallengeDefinition(db, {
      challengeType: 'competitive',
      title: 'Stray basis check',
      ...window_(),
      activities: [{
        activity: 'FIT-STR-001', metric: 'repetitions', unit: 'reps', targetValue: 50,
        loadBasis: 'PER_IMPLEMENT',
      }],
    } as ChallengeDefinitionInput)).rejects.toThrow(/unexpected_load_basis/);
  });
});

describe('PF-03 duration and completion (proofs 10-13)', () => {
  it('10. Duration supports CONTINUOUS and ACCUMULATED where applicable', async () => {
    const db = testDb();
    await publishDuration(db, 'FIT-TST-708');
    for (const mode of ['CONTINUOUS', 'ACCUMULATED'] as const) {
      const normalized = await validateChallengeDefinition(db, {
        challengeType: 'competitive',
        title: `Duration ${mode}`,
        ...window_(),
        activities: [{
          activity: 'FIT-TST-708', metric: 'duration', unit: 'minutes', targetValue: 30,
          durationMode: mode,
        }],
      } as ChallengeDefinitionInput);
      expect(normalized.activities[0].durationMode).toBe(mode);
      expect(normalized.activities[0].targetValue).toBe(30);
    }
  });

  it('11. ambiguous required Duration mode fails where necessary', async () => {
    const db = testDb();
    await publishDuration(db, 'FIT-TST-709');
    await expect(validateChallengeDefinition(db, {
      challengeType: 'competitive',
      title: 'Ambiguous duration',
      ...window_(),
      activities: [{ activity: 'FIT-TST-709', metric: 'duration', unit: 'minutes', targetValue: 30 }],
    } as ChallengeDefinitionInput)).rejects.toThrow(/ambiguous_duration/);
    await expect(validateChallengeDefinition(db, {
      challengeType: 'competitive',
      title: 'Inferred duration',
      ...window_(),
      activities: [{
        activity: 'FIT-TST-709', metric: 'duration', unit: 'minutes', targetValue: 30,
        durationMode: 'STEADY',
      }],
    } as ChallengeDefinitionInput)).rejects.toThrow(/ambiguous_duration/);
  });

  it('12. Completion requires an intelligible occurrence', async () => {
    const db = testDb();
    await publishBreathing(db);
    await expect(validateChallengeDefinition(db, {
      challengeType: 'competitive',
      title: 'Occurrence check',
      ...window_(),
      activities: [{ activity: 'WEL-MND-003', metric: 'completion', unit: 'completion', targetValue: 1 }],
    } as ChallengeDefinitionInput)).rejects.toThrow(/missing_occurrence/);
    const withOccurrence = await validateChallengeDefinition(db, {
      challengeType: 'competitive',
      title: 'Occurrence present',
      ...window_(),
      activities: [{
        activity: 'WEL-MND-003', metric: 'completion', unit: 'completion', targetValue: 1,
        completionOccurrence: 'Complete one full guided breathing session',
      }],
    } as ChallengeDefinitionInput);
    expect(withOccurrence.activities[0].completionOccurrence).toBe(
      'Complete one full guided breathing session',
    );
  });

  it('13. invalid/empty Completion occurrence rejects', async () => {
    const db = testDb();
    await publishBreathing(db);
    const base = {
      challengeType: 'competitive',
      title: 'Bad occurrence',
      ...window_(),
    } as ChallengeDefinitionInput;
    for (const bad of ['', '   ', 'Done', 'done', ' DONE ']) {
      await expect(validateChallengeDefinition(db, {
        ...base,
        activities: [{
          activity: 'WEL-MND-003', metric: 'completion', unit: 'completion', targetValue: 1,
          completionOccurrence: bad,
        }],
      } as ChallengeDefinitionInput)).rejects.toThrow(/occurrence/);
    }
  });
});

describe('PF-03 temporal, streak and type rules (proofs 14-19)', () => {
  it('14. timezone required where day-boundary semantics require it', async () => {
    const db = testDb();
    await publishDuration(db, 'FIT-TST-710');
    const streakBase = {
      challengeType: 'streak',
      title: 'Timezone check',
      ...window_(),
      requiredConsecutiveDays: 30,
    } as ChallengeDefinitionInput;
    await expect(validateChallengeDefinition(db, {
      ...streakBase,
      activities: [{
        activity: 'FIT-TST-710', metric: 'duration', unit: 'seconds', targetValue: 60,
        durationMode: 'CONTINUOUS',
      }],
    } as ChallengeDefinitionInput)).rejects.toThrow(/missing_timezone/);
    await expect(validateChallengeDefinition(db, {
      ...streakBase,
      timezone: 'Not/AZone',
      activities: [{
        activity: 'FIT-TST-710', metric: 'duration', unit: 'seconds', targetValue: 60,
        durationMode: 'CONTINUOUS',
      }],
    } as ChallengeDefinitionInput)).rejects.toThrow(/timezone/);
    const withZone = await validateChallengeDefinition(db, {
      ...streakBase,
      timezone: 'Africa/Nairobi',
      activities: [{
        activity: 'FIT-TST-710', metric: 'duration', unit: 'seconds', targetValue: 60,
        durationMode: 'CONTINUOUS',
      }],
    } as ChallengeDefinitionInput);
    expect(withZone.window.timezone).toBe('Africa/Nairobi');
  });

  it('15. Streak rejects reset_on_miss=false', async () => {
    const db = testDb();
    await publishDuration(db, 'FIT-TST-711');
    const activity = {
      activity: 'FIT-TST-711', metric: 'duration', unit: 'seconds', targetValue: 60,
      durationMode: 'CONTINUOUS',
    };
    await expect(validateChallengeDefinition(db, {
      challengeType: 'streak',
      title: 'No grace',
      ...window_(),
      timezone: 'Africa/Nairobi',
      requiredConsecutiveDays: 30,
      resetOnMiss: false,
      activities: [activity],
    } as unknown as ChallengeDefinitionInput)).rejects.toThrow(/reset_on_miss/);
    // The legacy V2 establishment path rejects it too (contradiction removed).
    expect(() => validateNewChallenge({
      group_id: '00000000-0000-4000-8000-000000000001',
      created_by_member_id: '00000000-0000-4000-8000-000000000002',
      challenge_type: 'streak',
      title: 'Legacy path check',
      start_date: '2026-10-01',
      end_date: '2026-10-31',
      required_consecutive_days: 30,
      reset_on_miss: false,
      activities: [{
        canonical_key: 'FIT-TST-711',
        metric: 'duration',
        target_value: 60,
        unit: 'seconds',
      }],
    })).toThrow(/reset_on_miss/);
  });

  it('16. Streak daily semantics remain fixed', async () => {
    const db = testDb();
    await publishDuration(db, 'FIT-TST-712');
    const normalized = await validateChallengeDefinition(db, {
      challengeType: 'streak',
      title: 'Daily fixed',
      ...window_(),
      timezone: 'Africa/Nairobi',
      requiredConsecutiveDays: 30,
      activities: [{
        activity: 'FIT-TST-712', metric: 'duration', unit: 'seconds', targetValue: 60,
        durationMode: 'CONTINUOUS',
      }],
    } as ChallengeDefinitionInput);
    expect(normalized.cadence).toBe('DAILY');
    expect(normalized.resetOnMiss).toBe(true);
    expect(normalized.requiredConsecutiveDays).toBe(30);
  });

  it('17. Competitive ranking configuration cannot select dense ranking', async () => {
    const db = testDb();
    await publishPushUp(db);
    await expect(validateChallengeDefinition(db, {
      challengeType: 'competitive',
      title: 'Ranking check',
      ...window_(),
      ranking: 'dense',
      activities: [{ activity: 'FIT-STR-001', metric: 'repetitions', unit: 'reps', targetValue: 50 }],
    } as unknown as ChallengeDefinitionInput)).rejects.toThrow(/not_configurable/);
  });

  it('18. Competitive one-finisher-does-not-end invariant preserved', async () => {
    const db = testDb();
    await publishPushUp(db);
    await expect(validateChallengeDefinition(db, {
      challengeType: 'competitive',
      title: 'Finish check',
      ...window_(),
      endOnFirstFinish: true,
      activities: [{ activity: 'FIT-STR-001', metric: 'repetitions', unit: 'reps', targetValue: 50 }],
    } as unknown as ChallengeDefinitionInput)).rejects.toThrow(/not_configurable/);
    const normalized = await validateChallengeDefinition(db, {
      challengeType: 'competitive',
      title: 'Finish check clean',
      ...window_(),
      activities: [{ activity: 'FIT-STR-001', metric: 'repetitions', unit: 'reps', targetValue: 50 }],
    } as ChallengeDefinitionInput);
    // No early-ending selector exists anywhere in the normalized contract.
    expect(JSON.stringify(normalized)).not.toMatch(/endOnFirstFinish|earlyEnd|finishEnds/i);
  });

  it('19. Collective early-goal completion invariant preserved', async () => {
    const db = testDb();
    await publishDuration(db, 'FIT-TST-713');
    const normalized = await validateChallengeDefinition(db, {
      challengeType: 'collective',
      title: 'Collective goal',
      ...window_(),
      goalValue: 3600,
      goalUnit: 'seconds',
      activities: [{
        activity: 'FIT-TST-713', metric: 'duration', unit: 'seconds', targetValue: 60,
        durationMode: 'ACCUMULATED',
      }],
    } as ChallengeDefinitionInput);
    expect(normalized.goalValue).toBe(3600);
    expect(normalized.goalUnit).toBe('seconds');
    // No capping flag: actuals past 100% are engine truth, not config.
    expect(JSON.stringify(normalized)).not.toMatch(/capAtGoal|cap_at_goal|maxPercent/i);
    // Unit homogeneity still enforced at definition time (C3A).
    await expect(validateChallengeDefinition(db, {
      challengeType: 'collective',
      title: 'Collective mismatch',
      ...window_(),
      goalValue: 3600,
      goalUnit: 'seconds',
      activities: [{
        activity: 'FIT-TST-713', metric: 'duration', unit: 'minutes', targetValue: 60,
        durationMode: 'ACCUMULATED',
      }],
    } as ChallengeDefinitionInput)).rejects.toThrow(/collective_unit_mismatch/);
  });
});

describe('PF-03 history, mutation and boundaries (proofs 20-25)', () => {
  it('20. established definition stays historically stable after Activity contract changes', async () => {
    const db = testDb();
    await publishDuration(db, 'FIT-TST-714');
    const normalized = await validateChallengeDefinition(db, {
      challengeType: 'competitive',
      title: 'Stability check',
      ...window_(),
      activities: [{
        activity: 'FIT-TST-714', metric: 'duration', unit: 'seconds', targetValue: 60,
        durationMode: 'CONTINUOUS',
      }],
    } as ChallengeDefinitionInput);
    const challengeId = await seedChallengeRow(db, 'competitive');
    const pinnedVersion = normalized.activities[0].knowledgeVersion;
    await db.transaction(async (tx) => {
      await insertChallengeDefinitionVersion(tx, challengeId, 1, normalized);
    });
    // Later canonical changes: new units + new Components + new version.
    const item = normalized.activities[0];
    await setMeasurementCompatibility(db, item.knowledgeId, {
      primaryMetrics: ['duration'],
      secondaryMetrics: [],
      compatibleUnits: ['seconds', 'minutes'],
    });
    await setActivityComponents(db, item.knowledgeId, SIDES);
    // The established definition still pins the old contract exactly.
    const reread = await getChallengeConfig(db, challengeId, 1);
    expect(reread.activities[0].knowledge_version).toBe(pinnedVersion);
    expect(reread.activities[0].unit).toBe('seconds');
    expect(reread.activities[0].required_components).toEqual([]);
    expect(reread.activities[0].component_relationship).toBeNull();
    expect(reread.activities[0].duration_mode).toBe('CONTINUOUS');
    const governing = await getGoverningVersion(db, challengeId, 1);
    expect(governing.snapshot.activities[0].knowledge_version).toBe(pinnedVersion);
    expect(governing.snapshot.activities[0].required_components).toEqual([]);
    expect(governing.snapshot.definition_kind).toBe('pf03-v1');
    // And the raw persisted snapshot parses as governing truth (fail-closed loader).
    const rawRow = await db.query<{ snapshot: unknown }>(
      `SELECT snapshot FROM challenge_config_versions WHERE challenge_id = $1 AND version = 1`,
      [challengeId],
    );
    expect(parseGoverningSnapshot(rawRow.rows[0].snapshot).definition_kind).toBe('pf03-v1');
  });

  it('21. prohibited generic mutation rejects', async () => {
    const db = testDb();
    await publishPushUp(db);
    const { establishChallengeV2 } = await import('../src/challengeEstablishment.js');
    const memberId = await seedMember(db, 'pf03-mut-member');
    const groupId = await seedGroup(db, { name: 'PF-03 mutation' });
    const pushUp = { canonical_key: 'FIT-STR-001', metric: 'repetitions', target_value: 50, unit: 'reps' };
    const liveResolvers = {
      resolveGroupAuthority: async () => ({ status: 'active' }),
      resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
      resolveKnowledgePin: createDbKnowledgeIdentityResolver(db, 'fitness'),
      resolveKnowledgeEligibility: createDbKnowledgeEligibilityResolverByIdentity(db, 'fitness'),
    };
    const established = await establishChallengeV2(db, {
      group_id: groupId,
      created_by_member_id: memberId,
      challenge_type: 'competitive',
      title: 'Mutation guard check',
      start_date: '2026-10-01',
      end_date: '2026-10-31',
      activities: [pushUp],
      activate: false,
      joinCreator: false,
    }, liveResolvers);
    const challengeId = established.challenge.challenge_id;
    // In-version enforcement uses pre-resolved maps (live-DB resolvers must
    // never be called from inside the version transaction).
    const pinned = await pinnedConfigResolvers(db, 'fitness', 'FIT-STR-001');
    // reset_on_miss=false can never enter a new version.
    await expect(addChallengeConfigVersion(db, challengeId, {
      activities: [pushUp],
      reset_on_miss: false,
    }, pinned)).rejects.toThrow(/reset_on_miss/);
    // Finalized terminal truth is frozen (simulate finalization marker;
    // full finalization is proven by the EBC-04 suite).
    await endChallenge(db, challengeId);
    await db.query(`UPDATE challenges SET finalized_at = now() WHERE challenge_id = $1`, [challengeId]);
    await expect(addChallengeConfigVersion(db, challengeId, {
      activities: [pushUp],
    }, pinned)).rejects.toThrow(/frozen|historically complete/);
  });

  it('22. allowed bounded mutation preserves immutable history', async () => {
    const db = testDb();
    await publishDuration(db, 'FIT-TST-715');
    const normalized = await validateChallengeDefinition(db, {
      challengeType: 'competitive',
      title: 'Bounded mutation',
      ...window_(),
      activities: [{
        activity: 'FIT-TST-715', metric: 'duration', unit: 'seconds', targetValue: 60,
        durationMode: 'CONTINUOUS',
      }],
    } as ChallengeDefinitionInput);
    const challengeId = await seedChallengeRow(db, 'competitive');
    await db.transaction(async (tx) => {
      await insertChallengeDefinitionVersion(tx, challengeId, 1, normalized);
    });
    await db.query(`UPDATE challenges SET current_config_version = 1 WHERE challenge_id = $1`, [challengeId]);
    const pinned = await pinnedConfigResolvers(db, 'fitness', 'FIT-TST-715');
    // Bounded version append (new target): v1 stays byte-identical.
    const before = await getChallengeConfig(db, challengeId, 1);
    await addChallengeConfigVersion(db, challengeId, {
      activities: [{
        canonical_key: 'FIT-TST-715',
        metric: 'duration',
        target_value: 90,
        unit: 'seconds',
      }],
    }, pinned);
    const afterV1 = await getChallengeConfig(db, challengeId, 1);
    expect(afterV1.activities[0].target_value).toBe(60);
    expect(afterV1.activities[0].duration_mode).toBe('CONTINUOUS');
    expect(JSON.stringify(afterV1.version.snapshot)).toBe(JSON.stringify(before.version.snapshot));
    const v2 = await getChallengeConfig(db, challengeId, 2);
    expect(v2.activities[0].target_value).toBe(90);
  });

  it('23. ended Challenge cannot be reopened through definition mutation', async () => {
    const db = testDb();
    await publishPushUp(db);
    const challengeId = await seedChallengeRow(db, 'competitive');
    const normalized = await validateChallengeDefinition(db, {
      challengeType: 'competitive',
      title: 'Terminal check',
      ...window_(),
      activities: [{ activity: 'FIT-STR-001', metric: 'repetitions', unit: 'reps', targetValue: 50 }],
    } as ChallengeDefinitionInput);
    await db.transaction(async (tx) => {
      await insertChallengeDefinitionVersion(tx, challengeId, 1, normalized);
    });
    await endChallenge(db, challengeId);
    const pinned = await pinnedConfigResolvers(db, 'fitness', 'FIT-STR-001');
    await expect(addChallengeConfigVersion(db, challengeId, {
      activities: [{
        canonical_key: 'FIT-STR-001',
        metric: 'repetitions',
        target_value: 60,
        unit: 'reps',
      }],
    }, pinned)).rejects.toThrow(/historically complete/);
    await expect(activateChallenge(db, challengeId)).rejects.toThrow(/reopened/);
  });

  it('24. Run Again is not represented as reopening an existing Challenge', async () => {
    const db = testDb();
    await publishPushUp(db);
    const normalized = await validateChallengeDefinition(db, {
      challengeType: 'competitive',
      title: 'Run again check',
      ...window_(),
      activities: [{ activity: 'FIT-STR-001', metric: 'repetitions', unit: 'reps', targetValue: 50 }],
    } as ChallengeDefinitionInput);
    // The same definition establishes two DISTINCT challenges (Run Again =
    // new Challenge); neither reopens the other and versions restart at 1.
    const first = await seedChallengeRow(db, 'competitive');
    const second = await seedChallengeRow(db, 'competitive');
    expect(first).not.toBe(second);
    await db.transaction(async (tx) => {
      await insertChallengeDefinitionVersion(tx, first, 1, normalized);
    });
    await db.transaction(async (tx) => {
      await insertChallengeDefinitionVersion(tx, second, 1, normalized);
    });
    const rereadFirst = await getChallengeConfig(db, first, 1);
    const rereadSecond = await getChallengeConfig(db, second, 1);
    expect(rereadFirst.activities[0].knowledge_version)
      .toBe(rereadSecond.activities[0].knowledge_version);
    await endChallenge(db, first);
    expect((await getChallengeConfig(db, second, 1)).activities[0].target_value).toBe(50);
  });

  it('25. Verification/Recognition/Rewards fields are not introduced', async () => {
    const db = testDb();
    await publishPushUp(db);
    const normalized = await validateChallengeDefinition(db, {
      challengeType: 'competitive',
      title: 'No deferred fields',
      ...window_(),
      activities: [{ activity: 'FIT-STR-001', metric: 'repetitions', unit: 'reps', targetValue: 50 }],
    } as ChallengeDefinitionInput);
    const snapshot = buildDefinitionSnapshot(normalized);
    const json = JSON.stringify({ normalized, snapshot });
    expect(json).not.toMatch(/verif|recogn|reward|act-?03|act-?04|mot-?01|custody|entitlement/i);
    // ...and such fields are rejected as definition input (no silent heap).
    await expect(validateChallengeDefinition(db, {
      challengeType: 'competitive',
      title: 'Deferred smuggle',
      ...window_(),
      verification: { method: 'photo' },
      activities: [{ activity: 'FIT-STR-001', metric: 'repetitions', unit: 'reps', targetValue: 50 }],
    } as unknown as ChallengeDefinitionInput)).rejects.toThrow(/not_configurable/);
  });
});

describe('PF-03 temporal conditions (bounded)', () => {
  it('at/before/after/within accepted; rules-engine shapes rejected', async () => {
    const db = testDb();
    await publishDuration(db, 'FIT-TST-716');
    const activity = {
      activity: 'FIT-TST-716', metric: 'duration', unit: 'seconds', targetValue: 60,
      durationMode: 'CONTINUOUS',
    };
    const base = {
      challengeType: 'competitive',
      title: 'Temporal check',
      ...window_(),
    } as ChallengeDefinitionInput;
    const withWindow = await validateChallengeDefinition(db, {
      ...base,
      temporalConditions: { within: { start: '21:00', end: '22:30' } },
      activities: [activity],
    } as ChallengeDefinitionInput);
    expect(withWindow.temporalConditions).toEqual({
      at: null,
      before: null,
      after: null,
      within: { start: '21:00', end: '22:30' },
    });
    // Persisted snapshots carry the conditions as governing truth.
    const persisted = buildDefinitionSnapshot(withWindow);
    expect(persisted.temporal_conditions).toEqual({
      at: null,
      before: null,
      after: null,
      within: { start: '21:00', end: '22:30' },
    });
    expect(parseGoverningSnapshot(JSON.parse(JSON.stringify(persisted))).temporal_conditions)
      .toEqual({ at: null, before: null, after: null, within: { start: '21:00', end: '22:30' } });
    for (const bad of [
      { cron: '0 22 * * *' },
      { at: '25:00' },
      { within: { start: '22:30', end: '21:00' } },
      {},
    ]) {
      await expect(validateChallengeDefinition(db, {
        ...base,
        temporalConditions: bad,
        activities: [activity],
      } as ChallengeDefinitionInput)).rejects.toThrow(/temporalConditions|not authorized|after start|at least one/);
    }
    expect(normalizeTemporalConditions(undefined)).toBeNull();
  });
});
