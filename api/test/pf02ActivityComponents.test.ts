/**
 * PF-02 Metric/Unit Compatibility + Activity Components — focused proofs.
 *
 * Proves the governed PF-02 model on the real stack (PGlite PostgreSQL
 * semantics: constraints, triggers, transactions) with the minimum
 * representative records: the PF-01 Push-Up exemplar (non-component),
 * the PF-01 Breathing Practice exemplar (multiple valid Metrics), and
 * Side-Plank / Single-Leg-Balance style component Activities
 * (ALL_REQUIRED) built through the real creation gate.
 *
 * 1. component identity scoped to parent Activity;
 * 2. duplicate component machine IDs rejected within same Activity;
 * 3. unsupported component relationship rejected;
 * 4. Side Plank / Single-Leg Balance style ALL_REQUIRED accepted;
 * 5. ordinary non-component Activity path unchanged;
 * 6. component values remain separately attributable;
 * 7. one satisfied + one unsatisfied required Component => not satisfied;
 * 8. all required Components satisfied => satisfied;
 * 9. exact Metric/Unit compatibility still enforced;
 * 10. configuration-sensitive eligibility differs between configurations;
 * 11. Published does not imply every configuration eligible;
 * 12. historical/version representation retains Component structure;
 * 13. Duration model neutral to continuous-vs-accumulated semantics;
 * 14. Weight semantics not invented or broadened.
 *
 * Out of scope (explicitly NOT built): PF-03 Challenge Definition and
 * snapshots, wizard, Verification/Recognition/Rewards, bulk catalogue
 * seeding, Load Reporting Convention, deployment.
 */

import { describe, expect, it } from 'vitest';
import {
  assessConfigurationEligibility,
  assertComponentCoverage,
  COMPONENT_RELATIONSHIP_ALL_REQUIRED,
  evaluateActivitySatisfaction,
  isComponentRequirementSatisfied,
  listActivityComponents,
  listVersionComponents,
  resolveActivityVersionPin,
  setActivityComponents,
  type ConfigurationEligibilityInput,
} from '../src/activityComponents.js';
import {
  assertActivityMeasurementCompatible,
  createDbKnowledgeEligibilityResolverByIdentity,
} from '../src/knowledgeEligibility.js';
import {
  createKnowledgeItem,
  getKnowledgeById,
  reviseKnowledgeItem,
  setKnowledgeLifecycle,
  setMeasurementCompatibility,
  snapshotItemForReadiness,
  type CreateKnowledgeInput,
} from '../src/knowledge.js';
import { GOVERNED_UNITS, metricForUnit } from '../src/measurementVocabulary.js';
import {
  BREATHING_PRACTICE_CONTRACT,
  breathingPracticeExemplarInput,
  pushUpExemplarInput,
  PUSH_UP_CONTRACT,
} from '../src/pf01Exemplars.js';
import { testDb } from './helpers.js';

function durationContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'fitness',
    name: 'PF-02 Test Side Hold',
    category: 'Strength',
    subcategory: 'Hold',
    difficulty: 'Intermediate',
    description: 'A governed static side-hold test movement.',
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

const LEFT_RIGHT = [
  { componentId: 'LEFT', displayName: 'Left side', relationship: 'ALL_REQUIRED' },
  { componentId: 'RIGHT', displayName: 'Right side', relationship: 'ALL_REQUIRED' },
];

const LEGS = [
  { componentId: 'LEFT LEG', displayName: 'Left leg', relationship: 'ALL_REQUIRED' },
  { componentId: 'RIGHT LEG', displayName: 'Right leg', relationship: 'ALL_REQUIRED' },
];

async function publishWithContract(
  db: ReturnType<typeof testDb>,
  id: string,
  contract: { primaryMetrics: string[]; secondaryMetrics: string[]; compatibleUnits: string[] },
) {
  await setMeasurementCompatibility(db, id, contract);
  await setKnowledgeLifecycle(db, id, 'published');
}

async function configInputFor(
  db: ReturnType<typeof testDb>,
  id: string,
  overrides: Partial<ConfigurationEligibilityInput> = {},
): Promise<ConfigurationEligibilityInput> {
  const item = await getKnowledgeById(db, id);
  if (!item) throw new Error('test item missing');
  return {
    lifecycle: item.lifecycle,
    kind: item.kind,
    declared: item.contentClasses,
    snapshot: snapshotItemForReadiness(item),
    primaryMetrics: item.primaryMetrics,
    secondaryMetrics: item.secondaryMetrics,
    compatibleUnits: item.compatibleUnits,
    components: await listActivityComponents(db, id),
    metric: 'duration',
    unit: 'seconds',
    ...overrides,
  };
}

describe('PF-02 component identity (proofs 1-4)', () => {
  it('1. scopes component machine identity to the parent Activity', async () => {
    const db = testDb();
    const first = await createKnowledgeItem(
      db,
      durationContent({ activityCode: 'FIT-TST-501', components: LEFT_RIGHT }) as CreateKnowledgeInput,
    );
    const second = await createKnowledgeItem(
      db,
      durationContent({
        activityCode: 'FIT-TST-502',
        name: 'PF-02 Test Other Hold',
        components: [{ componentId: 'LEFT', displayName: 'Other left', relationship: 'ALL_REQUIRED' }],
      }) as CreateKnowledgeInput,
    );
    // The same machine id recurs on a different Activity without conflict.
    expect(await listActivityComponents(db, first.id)).toHaveLength(2);
    expect(await listActivityComponents(db, second.id)).toHaveLength(1);
    expect((await listActivityComponents(db, first.id))[0].componentId).toBe('LEFT');
    // Components receive no independent Activity Code (structural: no code column).
    const columns = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'activity_components'`,
    );
    expect(columns.rows.map((row) => row.column_name)).not.toContain('activity_code');
  });

  it('2. rejects duplicate component machine IDs within the same Activity', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      durationContent({ activityCode: 'FIT-TST-503' }) as CreateKnowledgeInput,
    );
    await expect(
      setActivityComponents(db, created.id, [
        { componentId: 'LEFT', displayName: 'Left', relationship: 'ALL_REQUIRED' },
        { componentId: 'LEFT', displayName: 'Left again', relationship: 'ALL_REQUIRED' },
      ]),
    ).rejects.toMatchObject({ statusCode: 400, code: 'duplicate_component_id' });
    await expect(
      createKnowledgeItem(
        db,
        durationContent({ activityCode: 'FIT-TST-504', components: LEFT_RIGHT.concat(LEFT_RIGHT[0]) }),
      ),
    ).rejects.toMatchObject({ statusCode: 400, code: 'duplicate_component_id' });
    // Database backstop: the (item_id, component_id) primary key.
    await setActivityComponents(db, created.id, [LEFT_RIGHT[0]]);
    await expect(
      db.query(
        `INSERT INTO activity_components (item_id, component_id, display_name, relationship)
         VALUES ($1, 'LEFT', 'Left', 'ALL_REQUIRED')`,
        [created.id],
      ),
    ).rejects.toThrow(/duplicate|unique/i);
  });

  it('3. rejects unsupported component relationships (application + database)', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      durationContent({ activityCode: 'FIT-TST-505' }) as CreateKnowledgeInput,
    );
    for (const bad of ['ANY_ONE', 'ALL', 'SEQUENCE', '', null]) {
      await expect(
        setActivityComponents(db, created.id, [
          { componentId: 'LEFT', displayName: 'Left', relationship: bad },
        ]),
      ).rejects.toMatchObject({ statusCode: 400, code: 'unsupported_component_relationship' });
    }
    await expect(
      db.query(
        `INSERT INTO activity_components (item_id, component_id, display_name, relationship)
         VALUES ($1, 'LEFT', 'Left', 'ANY_ONE')`,
        [created.id],
      ),
    ).rejects.toThrow(/activity_components_relationship_check/);
    await expect(
      setActivityComponents(db, '00000000-0000-4000-8000-000000000000', LEFT_RIGHT),
    ).rejects.toMatchObject({ statusCode: 404, code: 'knowledge_not_found' });
  });

  it('4. accepts Side Plank / Single-Leg Balance style ALL_REQUIRED structures', async () => {
    const db = testDb();
    const sidePlank = await createKnowledgeItem(
      db,
      durationContent({ activityCode: 'FIT-TST-506', components: LEFT_RIGHT }) as CreateKnowledgeInput,
    );
    const balance = await createKnowledgeItem(
      db,
      durationContent({
        activityCode: 'FIT-TST-507',
        name: 'PF-02 Test Balance',
        category: 'Balance & Stability',
        components: LEGS,
      }) as CreateKnowledgeInput,
    );
    expect(await listActivityComponents(db, sidePlank.id)).toEqual([
      { componentId: 'LEFT', displayName: 'Left side', relationship: 'ALL_REQUIRED' },
      { componentId: 'RIGHT', displayName: 'Right side', relationship: 'ALL_REQUIRED' },
    ]);
    const legs = await listActivityComponents(db, balance.id);
    expect(legs.map((component) => component.componentId)).toEqual(['LEFT LEG', 'RIGHT LEG']);
    expect(legs.every((component) => component.relationship === COMPONENT_RELATIONSHIP_ALL_REQUIRED)).toBe(
      true,
    );
    // Squat-style ordinary Activities stay non-component: no rows, no relationship.
    const squat = await createKnowledgeItem(
      db,
      durationContent({ activityCode: 'FIT-TST-508', name: 'PF-02 Test Squat' }),
    );
    expect(await listActivityComponents(db, squat.id)).toEqual([]);
  });
});

describe('PF-02 non-component path (proof 5)', () => {
  it('5. leaves the ordinary non-component Activity path unchanged', async () => {
    const db = testDb();
    const pushUp = await createKnowledgeItem(db, pushUpExemplarInput());
    await publishWithContract(db, pushUp.id, PUSH_UP_CONTRACT);
    expect(await listActivityComponents(db, pushUp.id)).toEqual([]);
    const pin = await resolveActivityVersionPin(db, pushUp.id, 1);
    expect(pin?.components).toEqual([]);
    expect(pin?.activityCode).toBe('FIT-STR-001');
    // The PF-01 identity resolver still resolves the exemplar exactly.
    const byIdentity = createDbKnowledgeEligibilityResolverByIdentity(db, 'fitness');
    expect((await byIdentity('FIT-STR-001'))?.knowledgeId).toBe(pushUp.id);
    const reread = await getKnowledgeById(db, pushUp.id);
    expect(reread?.challengeEligible).toBe(true);
  });
});

describe('PF-02 component-aware measurement (proofs 6-8, 13)', () => {
  const requirement = { metric: 'duration', unit: 'seconds', targetValue: 60 };

  it('6. keeps component values separately attributable (never summed)', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      durationContent({ activityCode: 'FIT-TST-509', components: LEFT_RIGHT }) as CreateKnowledgeInput,
    );
    const components = await listActivityComponents(db, created.id);
    const outcome = evaluateActivitySatisfaction(components, requirement, [
      { componentId: 'LEFT', metric: 'duration', unit: 'seconds', value: 40 },
      { componentId: 'RIGHT', metric: 'duration', unit: 'seconds', value: 20 },
    ]);
    // Both reports survive as separate per-Component outcomes; the result
    // carries no combined total field.
    expect(outcome.perComponent).toEqual([
      { componentId: 'LEFT', satisfied: false },
      { componentId: 'RIGHT', satisfied: false },
    ]);
    expect('total' in outcome).toBe(false);
  });

  it('7. one satisfied + one unsatisfied required Component => Activity not satisfied', () => {
    const outcome = evaluateActivitySatisfaction(
      [
        { componentId: 'LEFT', displayName: 'Left', relationship: 'ALL_REQUIRED' },
        { componentId: 'RIGHT', displayName: 'Right', relationship: 'ALL_REQUIRED' },
      ],
      requirement,
      [
        { componentId: 'LEFT', metric: 'duration', unit: 'seconds', value: 60 },
        { componentId: 'RIGHT', metric: 'duration', unit: 'seconds', value: 20 },
      ],
    );
    // 40s LEFT + 20s RIGHT must not become generic 60s Activity truth, and
    // neither does 60s + 20s: every required Component must satisfy it.
    expect(outcome.satisfied).toBe(false);
    expect(outcome.perComponent).toEqual([
      { componentId: 'LEFT', satisfied: true },
      { componentId: 'RIGHT', satisfied: false },
    ]);
  });

  it('8. all required Components satisfied => Activity satisfied', () => {
    const outcome = evaluateActivitySatisfaction(
      [
        { componentId: 'LEFT LEG', displayName: 'Left leg', relationship: 'ALL_REQUIRED' },
        { componentId: 'RIGHT LEG', displayName: 'Right leg', relationship: 'ALL_REQUIRED' },
      ],
      requirement,
      [
        { componentId: 'LEFT LEG', metric: 'duration', unit: 'seconds', value: 60 },
        { componentId: 'RIGHT LEG', metric: 'duration', unit: 'seconds', value: 75 },
      ],
    );
    expect(outcome.satisfied).toBe(true);
    // A missing report fails closed: absence is not satisfaction.
    const missing = evaluateActivitySatisfaction(
      [{ componentId: 'LEFT', displayName: 'L', relationship: 'ALL_REQUIRED' }],
      requirement,
      [],
    );
    expect(missing.satisfied).toBe(false);
  });

  it('13. Duration stays neutral (no accumulation, no continuous-session semantics)', () => {
    // The identical threshold comparison serves Duration and Repetitions:
    // per-Component, no cross-Component math, no time-window logic.
    expect(
      isComponentRequirementSatisfied(
        { componentId: 'LEFT', metric: 'duration', unit: 'seconds', value: 60 },
        requirement,
      ),
    ).toBe(true);
    expect(
      isComponentRequirementSatisfied(
        { componentId: 'LEFT', metric: 'repetitions', unit: 'reps', value: 60 },
        { metric: 'repetitions', unit: 'reps', targetValue: 60 },
      ),
    ).toBe(true);
    // Metric/Unit mismatch never satisfies, whatever the value.
    expect(
      isComponentRequirementSatisfied(
        { componentId: 'LEFT', metric: 'duration', unit: 'minutes', value: 999 },
        requirement,
      ),
    ).toBe(false);
  });

  it('component-aware establishment rejects incomplete and unknown coverage', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      durationContent({ activityCode: 'FIT-TST-510', components: LEFT_RIGHT }) as CreateKnowledgeInput,
    );
    const components = await listActivityComponents(db, created.id);
    expect(() => assertComponentCoverage(components, ['LEFT', 'RIGHT'], 'activities[0]')).not.toThrow();
    expect(() => assertComponentCoverage(components, ['LEFT'], 'activities[0]')).toThrow(
      /missing required Components/,
    );
    expect(() => assertComponentCoverage(components, ['LEFT', 'MIDDLE'], 'activities[0]')).toThrow(
      /not a declared Component/,
    );
    expect(() => assertComponentCoverage([], ['LEFT'], 'activities[0]')).toThrow(/declares none/);
    expect(() => assertComponentCoverage([], [], 'activities[0]')).not.toThrow();
  });
});

describe('PF-02 exact compatibility + configuration eligibility (proofs 9-11)', () => {
  it('9. exact (Activity, Metric, Unit) compatibility still enforced', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      durationContent({ activityCode: 'FIT-TST-511', components: LEFT_RIGHT }) as CreateKnowledgeInput,
    );
    await publishWithContract(db, created.id, {
      primaryMetrics: ['duration'],
      secondaryMetrics: [],
      compatibleUnits: ['seconds', 'minutes'],
    });
    const eligibility = await createDbKnowledgeEligibilityResolverByIdentity(db, 'fitness')(
      'FIT-TST-511',
    );
    if (!eligibility) throw new Error('test eligibility missing');
    // Governed tuple proves; coherent-looking mismatches still fail.
    expect(() =>
      assertActivityMeasurementCompatible(
        eligibility,
        { canonical_key: 'FIT-TST-511', metric: 'duration', unit: 'seconds' },
        0,
      ),
    ).not.toThrow();
    expect(() =>
      assertActivityMeasurementCompatible(
        eligibility,
        { canonical_key: 'FIT-TST-511', metric: 'distance', unit: 'metres' },
        0,
      ),
    ).toThrow(/not permitted/);
    expect(() =>
      assertActivityMeasurementCompatible(
        eligibility,
        { canonical_key: 'FIT-TST-511', metric: 'duration', unit: 'reps' },
        0,
      ),
    ).toThrow(/not compatible/);
  });

  it('10. eligibility differs between configurations of the same Activity', async () => {
    const db = testDb();
    const breathing = await createKnowledgeItem(db, breathingPracticeExemplarInput());
    await publishWithContract(db, breathing.id, BREATHING_PRACTICE_CONTRACT);
    const base = await configInputFor(db, breathing.id);
    // Duration/minutes: eligible. Distance/metres: not permitted.
    expect(assessConfigurationEligibility({ ...base, metric: 'duration', unit: 'minutes' })).toEqual([]);
    const distance = assessConfigurationEligibility({ ...base, metric: 'distance', unit: 'metres' });
    expect(distance.map((issue) => issue.code)).toContain('metric_not_permitted');
    // Completion with a Duration unit: governed pieces, incoherent tuple.
    const mismatch = assessConfigurationEligibility({ ...base, metric: 'completion', unit: 'minutes' });
    expect(mismatch.map((issue) => issue.code)).toContain('unit_metric_mismatch');
  });

  it('11. Published does not imply every configuration eligible', async () => {
    const db = testDb();
    const pushUp = await createKnowledgeItem(db, pushUpExemplarInput());
    await publishWithContract(db, pushUp.id, PUSH_UP_CONTRACT);
    const reread = await getKnowledgeById(db, pushUp.id);
    // Activity-level gate passes...
    expect(reread?.lifecycle).toBe('published');
    expect(reread?.challengeEligible).toBe(true);
    const base = await configInputFor(db, pushUp.id);
    // ...while configurations are judged individually.
    expect(
      assessConfigurationEligibility({ ...base, metric: 'repetitions', unit: 'reps' }),
    ).toEqual([]);
    const unsupported = assessConfigurationEligibility({ ...base, metric: 'weight', unit: 'kilograms' });
    expect(unsupported.map((issue) => issue.code)).toContain('metric_not_permitted');
    // Draft siblings fail the activity level first (publication gate intact).
    const draft = await createKnowledgeItem(
      db,
      durationContent({ activityCode: 'FIT-TST-512' }),
    );
    const draftInput = await configInputFor(db, draft.id);
    expect(draftInput.lifecycle).toBe('draft');
    expect(assessConfigurationEligibility(draftInput).map((issue) => issue.code)).toContain(
      'not_published',
    );
  });

  it('component coverage is part of configuration eligibility', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      durationContent({ activityCode: 'FIT-TST-513', components: LEFT_RIGHT }) as CreateKnowledgeInput,
    );
    await publishWithContract(db, created.id, {
      primaryMetrics: ['duration'],
      secondaryMetrics: [],
      compatibleUnits: ['seconds'],
    });
    const base = await configInputFor(db, created.id);
    expect(
      assessConfigurationEligibility({ ...base, componentIds: ['LEFT', 'RIGHT'] }),
    ).toEqual([]);
    expect(
      assessConfigurationEligibility({ ...base, componentIds: ['LEFT'] }).map((issue) => issue.code),
    ).toContain('missing_required_components');
    expect(
      assessConfigurationEligibility({ ...base, componentIds: ['LEFT', 'MIDDLE'] }).map(
        (issue) => issue.code,
      ),
    ).toContain('unknown_component');
    // Naming Components for a non-component Activity rejects.
    const plain = await createKnowledgeItem(
      db,
      durationContent({ activityCode: 'FIT-TST-514' }),
    );
    await publishWithContract(db, plain.id, {
      primaryMetrics: ['duration'],
      secondaryMetrics: [],
      compatibleUnits: ['seconds'],
    });
    const plainInput = await configInputFor(db, plain.id);
    expect(
      assessConfigurationEligibility({ ...plainInput, componentIds: ['LEFT'] }).map(
        (issue) => issue.code,
      ),
    ).toContain('unexpected_components');
  });
});

describe('PF-02 historical truth (proof 12)', () => {
  it('12. version representation retains Component structure and stays append-only', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      durationContent({ activityCode: 'FIT-TST-515', components: LEFT_RIGHT }) as CreateKnowledgeInput,
    );
    await publishWithContract(db, created.id, {
      primaryMetrics: ['duration'],
      secondaryMetrics: [],
      compatibleUnits: ['seconds'],
    });
    const pin1 = await resolveActivityVersionPin(db, created.id, 1);
    expect(pin1?.activityCode).toBe('FIT-TST-515');
    expect(pin1?.version).toBe(1);
    expect(pin1?.components.map((component) => component.componentId)).toEqual(['LEFT', 'RIGHT']);
    expect(pin1?.components[0].relationship).toBe('ALL_REQUIRED');
    // A content revision pins the current Component set into the new version
    // alongside the contract current at revision time.
    await reviseKnowledgeItem(db, created.id, {
      ...(durationContent({ activityCode: 'FIT-TST-515' }) as Record<string, unknown>),
      description: 'A revised governed static side-hold test movement.',
    });
    const pin2 = await resolveActivityVersionPin(db, created.id, 2);
    expect(pin2?.components.map((component) => component.componentId)).toEqual(['LEFT', 'RIGHT']);
    expect(pin2?.primaryMetrics).toEqual(['duration']);
    expect(pin2?.compatibleUnits).toEqual(['seconds']);
    expect((await listVersionComponents(db, created.id, 1)).map((c) => c.componentId)).toEqual([
      'LEFT',
      'RIGHT',
    ]);
    // Unknown items/versions pin to null (never invented).
    expect(await resolveActivityVersionPin(db, created.id, 99)).toBeNull();
    expect(
      await resolveActivityVersionPin(db, '00000000-0000-4000-8000-000000000000', 1),
    ).toBeNull();
    // Version snapshots reject mutation (mirror of the versions/texts guard).
    await expect(
      db.query(`UPDATE knowledge_item_version_components SET display_name = 'X' WHERE item_id = $1`, [
        created.id,
      ]),
    ).rejects.toThrow(/append-only/);
    await expect(
      db.query(`DELETE FROM knowledge_item_version_components WHERE item_id = $1`, [created.id]),
    ).rejects.toThrow(/append-only/);
  });
});

describe('PF-02 weight boundary (proof 14)', () => {
  it('14. Weight stays governed without inventing load semantics', async () => {
    // No new Units entered the governed vocabulary for PF-02.
    expect(GOVERNED_UNITS).not.toContain('pounds');
    expect(metricForUnit('grams')).toBe('weight');
    expect(metricForUnit('kilograms')).toBe('weight');
    const db = testDb();
    // Grams and kilograms are distinct compatible Units: declaring one does
    // not authorize the other (no conversion inferred).
    const created = await createKnowledgeItem(
      db,
      durationContent({
        activityCode: 'FIT-TST-516',
        name: 'PF-02 Test Carry',
        contentClasses: ['U', 'Q'],
        measurementGuidance: 'Report the carried load in grams.',
        unitSemantics: 'One gram equals one gram of carried load.',
      }),
    );
    await publishWithContract(db, created.id, {
      primaryMetrics: ['weight'],
      secondaryMetrics: [],
      compatibleUnits: ['grams'],
    });
    const base = await configInputFor(db, created.id);
    expect(assessConfigurationEligibility({ ...base, metric: 'weight', unit: 'grams' })).toEqual([]);
    expect(
      assessConfigurationEligibility({ ...base, metric: 'weight', unit: 'kilograms' }).map(
        (issue) => issue.code,
      ),
    ).toContain('unit_not_compatible');
    // No cross-Metric computation exists: a repetitions report never
    // satisfies a weight requirement (and no reps x weight scoring).
    expect(
      isComponentRequirementSatisfied(
        { componentId: 'LEFT', metric: 'repetitions', unit: 'reps', value: 100 },
        { metric: 'weight', unit: 'grams', targetValue: 50 },
      ),
    ).toBe(false);
  });
});
