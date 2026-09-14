/**
 * PF-02-CORR-001 — contract version integrity + Load Reporting Basis.
 *
 * A. A materially changed canonical Activity product contract receives a
 *    new immutable historical version identity before new Challenge
 *    establishment can use it: the live contract can never diverge from
 *    the snapshot identified by current_version.
 *    1. Component change advances immutable contract history.
 *    2. Measurement compatibility change advances immutable history.
 *    3. Old version resolves old Components.
 *    4. New version resolves new Components.
 *    5. Old version resolves old Metric/Unit contract.
 *    6. New version resolves new Metric/Unit contract.
 *    7. current_version always identifies the current canonical contract.
 *    8. Failure during mutation leaves no partially advanced state.
 *    9. Append-only historical rows remain immutable.
 *
 * B. Settled Founder/Product Load Reporting Convention
 *    (docs/governance/knowledge/Activity Content & Catalogue Definition/
 *    08-LOAD-REPORTING-CONVENTION.md).
 *    5. Authorized bases accepted (all five).
 *    6. Unknown basis rejected.
 *    7. Weight without basis is configuration-ineligible.
 *    8. Non-Weight does not require a basis (and rejects a stray one).
 *    9/10. PER_IMPLEMENT / PER_SIDE never imply totalization.
 *    11. MACHINE_DISPLAYED_LOAD carries no cross-machine equivalence.
 *    12. Basis appears in the historical/version pin.
 *    13. Duplicate/undeclared/malformed Component reports fail closed.
 *    14. Existing non-component PF-01 path remains green (see full suite;
 *        pinned here for the CORR surface).
 */

import { describe, expect, it } from 'vitest';
import {
  assessConfigurationEligibility,
  evaluateActivitySatisfaction,
  isLoadReportingBasis,
  listActivityComponents,
  LOAD_REPORTING_BASES,
  normalizeLoadReportingBases,
  resolveActivityVersionPin,
  setActivityComponents,
  type ConfigurationEligibilityInput,
} from '../src/activityComponents.js';
import {
  createKnowledgeItem,
  getKnowledgeById,
  setKnowledgeLifecycle,
  setLoadReportingBases,
  setMeasurementCompatibility,
  snapshotItemForReadiness,
  type CreateKnowledgeInput,
} from '../src/knowledge.js';
import {
  pushUpExemplarInput,
  PUSH_UP_CONTRACT,
} from '../src/pf01Exemplars.js';
import { testDb } from './helpers.js';

function holdContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'fitness',
    name: 'PF-02-CORR Test Hold',
    category: 'Strength',
    subcategory: 'Hold',
    difficulty: 'Intermediate',
    description: 'A governed static hold for contract-history tests.',
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

const WIDE_SIDES = [
  { componentId: 'LEFT', displayName: 'Left side', relationship: 'ALL_REQUIRED' },
  { componentId: 'RIGHT', displayName: 'Right side', relationship: 'ALL_REQUIRED' },
  { componentId: 'CENTER', displayName: 'Center hold', relationship: 'ALL_REQUIRED' },
];

async function liveContract(db: ReturnType<typeof testDb>, id: string) {
  const item = await getKnowledgeById(db, id);
  if (!item) throw new Error('test item missing');
  return {
    version: item.knowledgeVersion,
    primaryMetrics: item.primaryMetrics,
    secondaryMetrics: item.secondaryMetrics,
    compatibleUnits: item.compatibleUnits,
    loadReportingBases: item.loadReportingBases,
  };
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
    supportedLoadBases: item.loadReportingBases,
    components: await listActivityComponents(db, id),
    metric: 'duration',
    unit: 'seconds',
    ...overrides,
  };
}

describe('PF-02-CORR-001 contract version integrity (proofs 1-9)', () => {
  it('1+2. Component and compatibility changes each advance immutable history', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      holdContent({ activityCode: 'FIT-TST-601' }),
    );
    expect((await liveContract(db, created.id)).version).toBe(1);
    await setMeasurementCompatibility(db, created.id, {
      primaryMetrics: ['duration'],
      secondaryMetrics: [],
      compatibleUnits: ['seconds'],
    });
    expect((await liveContract(db, created.id)).version).toBe(2);
    await setActivityComponents(db, created.id, SIDES);
    expect((await liveContract(db, created.id)).version).toBe(3);
    await setLoadReportingBases(db, created.id, []);
    // Clearing to the same empty set is still an administered mutation:
    // history stays append-only and explicit.
    expect((await liveContract(db, created.id)).version).toBe(4);
  });

  it('3+4+5+6. old versions resolve old contracts, new versions resolve new ones', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      holdContent({ activityCode: 'FIT-TST-602', components: SIDES }),
    );
    await setMeasurementCompatibility(db, created.id, {
      primaryMetrics: ['duration'],
      secondaryMetrics: [],
      compatibleUnits: ['seconds'],
    });
    // v2: sides + duration/seconds.
    await setActivityComponents(db, created.id, WIDE_SIDES);
    // v3: center added.
    await setMeasurementCompatibility(db, created.id, {
      primaryMetrics: ['duration'],
      secondaryMetrics: [],
      compatibleUnits: ['seconds', 'minutes'],
    });
    // v4: minutes admitted.
    const pin2 = (await resolveActivityVersionPin(db, created.id, 2))!;
    const pin3 = (await resolveActivityVersionPin(db, created.id, 3))!;
    const pin4 = (await resolveActivityVersionPin(db, created.id, 4))!;
    expect(pin2.components.map((component) => component.componentId)).toEqual(['LEFT', 'RIGHT']);
    expect(pin2.compatibleUnits).toEqual(['seconds']);
    expect(pin3.components.map((component) => component.componentId)).toEqual([
      'CENTER',
      'LEFT',
      'RIGHT',
    ]);
    expect(pin3.compatibleUnits).toEqual(['seconds']);
    expect(pin4.components.map((component) => component.componentId)).toEqual([
      'CENTER',
      'LEFT',
      'RIGHT',
    ]);
    expect(pin4.compatibleUnits).toEqual(['minutes', 'seconds']);
  });

  it('7. current_version always identifies the current canonical contract', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      holdContent({ activityCode: 'FIT-TST-603', components: SIDES }),
    );
    await setMeasurementCompatibility(db, created.id, {
      primaryMetrics: ['duration'],
      secondaryMetrics: [],
      compatibleUnits: ['seconds', 'minutes'],
    });
    await setLoadReportingBases(db, created.id, []);
    const live = await liveContract(db, created.id);
    const pin = (await resolveActivityVersionPin(db, created.id, live.version))!;
    expect(pin.primaryMetrics).toEqual(live.primaryMetrics);
    expect(pin.secondaryMetrics).toEqual(live.secondaryMetrics);
    expect(pin.compatibleUnits).toEqual(live.compatibleUnits);
    expect(pin.supportedLoadBases).toEqual(live.loadReportingBases);
    // No version number describes two contracts: every minted version is
    // reachable and distinct.
    expect((await resolveActivityVersionPin(db, created.id, 1))?.compatibleUnits).toEqual([]);
    expect((await resolveActivityVersionPin(db, created.id, 2))?.compatibleUnits).toEqual([
      'minutes',
      'seconds',
    ]);
  });

  it('8. failure during mutation leaves no partially advanced state', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      holdContent({ activityCode: 'FIT-TST-604', components: SIDES }),
    );
    await setMeasurementCompatibility(db, created.id, {
      primaryMetrics: ['duration'],
      secondaryMetrics: [],
      compatibleUnits: ['seconds'],
    });
    const before = await liveContract(db, created.id);
    // Duplicate Component ids reject before any write.
    await expect(setActivityComponents(db, created.id, [...SIDES, SIDES[0]])).rejects.toMatchObject(
      { statusCode: 400, code: 'duplicate_component_id' },
    );
    // Unsupported relationships reject before any write.
    await expect(
      setActivityComponents(db, created.id, [
        { componentId: 'LEFT', displayName: 'L', relationship: 'ANY_ONE' },
      ]),
    ).rejects.toMatchObject({ statusCode: 400, code: 'unsupported_component_relationship' });
    // Incoherent contracts reject before any write.
    await expect(
      setMeasurementCompatibility(db, created.id, {
        primaryMetrics: ['duration'],
        secondaryMetrics: [],
        compatibleUnits: ['reps'],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    // Unknown bases reject before any write.
    await expect(setLoadReportingBases(db, created.id, ['PER_MOON'])).rejects.toMatchObject({
      statusCode: 400,
      code: 'unknown_load_basis',
    });
    // Bases without a Weight contract reject before any write.
    await expect(setLoadReportingBases(db, created.id, ['PER_SIDE'])).rejects.toMatchObject({
      statusCode: 400,
      code: 'load_basis_without_weight',
    });
    expect(await liveContract(db, created.id)).toEqual(before);
    expect((await resolveActivityVersionPin(db, created.id, before.version))?.compatibleUnits).toEqual(
      ['seconds'],
    );
  });

  it('9. append-only historical rows remain immutable', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      holdContent({ activityCode: 'FIT-TST-605', components: SIDES }),
    );
    await setMeasurementCompatibility(db, created.id, {
      primaryMetrics: ['duration'],
      secondaryMetrics: [],
      compatibleUnits: ['seconds'],
    });
    await expect(
      db.query(`UPDATE knowledge_item_versions SET description = 'X' WHERE item_id = $1`, [
        created.id,
      ]),
    ).rejects.toThrow(/append-only/);
    await expect(
      db.query(`DELETE FROM knowledge_item_versions WHERE item_id = $1`, [created.id]),
    ).rejects.toThrow(/append-only/);
    await expect(
      db.query(`UPDATE activity_components SET display_name = 'X' WHERE item_id = $1`, [
        created.id,
      ]),
    ).resolves.toBeDefined();
  });
});

describe('PF-02-CORR-001 Load Reporting Convention (proofs 5-12)', () => {
  it('5+6. all five authorized bases accepted; unknown bases rejected', () => {
    expect(LOAD_REPORTING_BASES).toEqual([
      'TOTAL_LOADED_IMPLEMENT',
      'PER_IMPLEMENT',
      'SINGLE_IMPLEMENT',
      'PER_SIDE',
      'MACHINE_DISPLAYED_LOAD',
    ]);
    for (const basis of LOAD_REPORTING_BASES) {
      expect(isLoadReportingBasis(basis)).toBe(true);
    }
    expect(isLoadReportingBasis('PER_HAND')).toBe(false);
    expect(isLoadReportingBasis('total')).toBe(false);
    expect(isLoadReportingBasis(undefined)).toBe(false);
    expect(normalizeLoadReportingBases(['PER_SIDE', 'PER_IMPLEMENT', 'PER_SIDE'])).toEqual([
      'PER_IMPLEMENT',
      'PER_SIDE',
    ]);
    expect(() => normalizeLoadReportingBases(['PER_MOON'])).toThrow(
      /not an authorized Load Reporting Basis/,
    );
    try {
      normalizeLoadReportingBases(['PER_MOON']);
      expect.unreachable('unknown basis must reject');
    } catch (error) {
      expect(error).toMatchObject({ statusCode: 400, code: 'unknown_load_basis' });
    }
    expect(() => normalizeLoadReportingBases('PER_SIDE')).toThrow(/must be an array/);
  });

  it('6b. bases are never inferred or auto-assigned', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      holdContent({ activityCode: 'FIT-TST-606', name: 'PF-02-CORR Test Dumbbell Press' }),
    );
    await setMeasurementCompatibility(db, created.id, {
      primaryMetrics: ['weight'],
      secondaryMetrics: [],
      compatibleUnits: ['kilograms'],
    });
    // An implement-evocative name assigns nothing by itself.
    expect((await getKnowledgeById(db, created.id))?.loadReportingBases).toEqual([]);
    // The database vocabulary guard rejects anything outside the five.
    await expect(
      db.query(`UPDATE knowledge_items SET load_reporting_bases = $2 WHERE knowledge_id = $1`, [
        created.id,
        ['PER_MOON'],
      ]),
    ).rejects.toThrow(/load_reporting_bases|load_bases_check/);
  });

  it('7+8. Weight without basis fails closed; non-Weight never requires one', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      holdContent({
        activityCode: 'FIT-TST-607',
        measurementGuidance: 'Report the implement weight in kilograms.',
        unitSemantics: 'One kilogram equals one kilogram of external implement load.',
      }),
    );
    await setMeasurementCompatibility(db, created.id, {
      primaryMetrics: ['weight'],
      secondaryMetrics: [],
      compatibleUnits: ['kilograms'],
    });
    await setKnowledgeLifecycle(db, created.id, 'published');
    const undeclared = await configInputFor(db, created.id);
    expect(
      assessConfigurationEligibility({ ...undeclared, metric: 'weight', unit: 'kilograms' }).map(
        (issue) => issue.code,
      ),
    ).toContain('missing_load_basis');
    await setLoadReportingBases(db, created.id, ['PER_IMPLEMENT']);
    const base = await configInputFor(db, created.id);
    expect(
      assessConfigurationEligibility({
        ...base,
        metric: 'weight',
        unit: 'kilograms',
        loadBasis: 'PER_IMPLEMENT',
      }),
    ).toEqual([]);
    // Non-Weight configurations carry no basis requirement...
    const hold = await createKnowledgeItem(db, holdContent({ activityCode: 'FIT-TST-608' }));
    await setMeasurementCompatibility(db, hold.id, {
      primaryMetrics: ['duration'],
      secondaryMetrics: [],
      compatibleUnits: ['seconds'],
    });
    await setKnowledgeLifecycle(db, hold.id, 'published');
    const nonWeight = await configInputFor(db, hold.id);
    expect(
      assessConfigurationEligibility({ ...nonWeight, metric: 'duration', unit: 'seconds' }),
    ).toEqual([]);
    // ...and a stray basis on a non-Weight configuration rejects.
    expect(
      assessConfigurationEligibility({
        ...nonWeight,
        metric: 'duration',
        unit: 'seconds',
        loadBasis: 'PER_SIDE',
      }).map((issue) => issue.code),
    ).toContain('unexpected_load_basis');
  });

  it('7b. Weight requires explicit reporting meaning', async () => {
    const db = testDb();
    const thin = await createKnowledgeItem(
      db,
      holdContent({
        activityCode: 'FIT-TST-609',
        measurementGuidance: 'Weigh it.',
        unitSemantics: '',
      }),
    );
    await setMeasurementCompatibility(db, thin.id, {
      primaryMetrics: ['weight'],
      secondaryMetrics: [],
      compatibleUnits: ['kilograms'],
    });
    await setLoadReportingBases(db, thin.id, ['SINGLE_IMPLEMENT']);
    // Empty unit semantics cannot publish (Q readiness), and independently
    // the Weight configuration fails closed on reporting meaning: both the
    // publication gate and the config requirement hold at once.
    await expect(setKnowledgeLifecycle(db, thin.id, 'published')).rejects.toMatchObject({
      statusCode: 422,
    });
    const input = await configInputFor(db, thin.id);
    expect(
      assessConfigurationEligibility({
        ...input,
        metric: 'weight',
        unit: 'kilograms',
        loadBasis: 'SINGLE_IMPLEMENT',
      }).map((issue) => issue.code),
    ).toEqual(expect.arrayContaining(['not_published', 'missing_weight_reporting_meaning']));
  });

  it('9+10. PER_IMPLEMENT and PER_SIDE never imply totalization', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      holdContent({ activityCode: 'FIT-TST-610', components: SIDES }),
    );
    const components = await listActivityComponents(db, created.id);
    const requirement = { metric: 'weight', unit: 'kilograms', targetValue: 20 };
    // 20 kg/side on both sides satisfies each side's 20 kg requirement;
    // nothing in the evaluation produces a 40 kg total.
    const both = evaluateActivitySatisfaction(components, requirement, [
      { componentId: 'LEFT', metric: 'weight', unit: 'kilograms', value: 20 },
      { componentId: 'RIGHT', metric: 'weight', unit: 'kilograms', value: 20 },
    ]);
    expect(both.satisfied).toBe(true);
    expect(both.perComponent).toHaveLength(2);
    // One side at 20, the other at 0: no silent combination rescues it.
    const single = evaluateActivitySatisfaction(components, requirement, [
      { componentId: 'LEFT', metric: 'weight', unit: 'kilograms', value: 20 },
      { componentId: 'RIGHT', metric: 'weight', unit: 'kilograms', value: 0 },
    ]);
    expect(single.satisfied).toBe(false);
  });

  it('11. MACHINE_DISPLAYED_LOAD carries no cross-machine equivalence', async () => {
    // The basis is an opaque governed label: the vocabulary exposes no
    // conversion, normalization or equivalence mapping of any kind.
    expect(LOAD_REPORTING_BASES).toHaveLength(5);
    expect(isLoadReportingBasis('MACHINE_DISPLAYED_LOAD')).toBe(true);
    const db = testDb();
    const first = await createKnowledgeItem(
      db,
      holdContent({
        activityCode: 'FIT-TST-611',
        measurementGuidance: 'Report the machine displayed load in kilograms.',
        unitSemantics: 'The resistance value shown by this machine only.',
      }),
    );
    await setMeasurementCompatibility(db, first.id, {
      primaryMetrics: ['weight'],
      secondaryMetrics: [],
      compatibleUnits: ['kilograms'],
    });
    await setLoadReportingBases(db, first.id, ['MACHINE_DISPLAYED_LOAD']);
    await setKnowledgeLifecycle(db, first.id, 'published');
    const input = await configInputFor(db, first.id);
    // Eligible on its own machine context; the pin records the basis as a
    // plain label with no equivalence attached.
    expect(
      assessConfigurationEligibility({
        ...input,
        metric: 'weight',
        unit: 'kilograms',
        loadBasis: 'MACHINE_DISPLAYED_LOAD',
      }),
    ).toEqual([]);
    const pin = await resolveActivityVersionPin(
      db,
      first.id,
      (await getKnowledgeById(db, first.id))!.knowledgeVersion,
    );
    expect(pin?.supportedLoadBases).toEqual(['MACHINE_DISPLAYED_LOAD']);
  });

  it('12. basis appears in the historical/version pin across changes', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      holdContent({
        activityCode: 'FIT-TST-612',
        measurementGuidance: 'Report the implement weight in kilograms.',
        unitSemantics: 'One kilogram equals one kilogram of external implement load.',
      }),
    );
    await setMeasurementCompatibility(db, created.id, {
      primaryMetrics: ['weight'],
      secondaryMetrics: [],
      compatibleUnits: ['kilograms'],
    });
    await setLoadReportingBases(db, created.id, ['PER_IMPLEMENT']);
    const withBasis = (await getKnowledgeById(db, created.id))!.knowledgeVersion;
    await setLoadReportingBases(db, created.id, ['PER_IMPLEMENT', 'PER_SIDE']);
    const widened = (await getKnowledgeById(db, created.id))!.knowledgeVersion;
    expect(widened).toBe(withBasis + 1);
    // "20 kg + PER_IMPLEMENT" stays historically understandable.
    expect((await resolveActivityVersionPin(db, created.id, withBasis))?.supportedLoadBases).toEqual([
      'PER_IMPLEMENT',
    ]);
    expect((await resolveActivityVersionPin(db, created.id, widened))?.supportedLoadBases).toEqual([
      'PER_IMPLEMENT',
      'PER_SIDE',
    ]);
  });
});

describe('PF-02-CORR-001 evaluation hardening (proof 13) + PF-01 path (proof 14)', () => {
  it('13. duplicate/undeclared/malformed Component reports fail closed', () => {
    const components = [
      { componentId: 'LEFT', displayName: 'Left', relationship: 'ALL_REQUIRED' as const },
      { componentId: 'RIGHT', displayName: 'Right', relationship: 'ALL_REQUIRED' as const },
    ];
    const requirement = { metric: 'duration', unit: 'seconds', targetValue: 30 };
    const good = [
      { componentId: 'LEFT', metric: 'duration', unit: 'seconds', value: 30 },
      { componentId: 'RIGHT', metric: 'duration', unit: 'seconds', value: 30 },
    ];
    expect(evaluateActivitySatisfaction(components, requirement, good).satisfied).toBe(true);
    expect(() =>
      evaluateActivitySatisfaction(components, requirement, [...good, good[0]]),
    ).toThrow(/duplicate_component_report/);
    expect(() =>
      evaluateActivitySatisfaction(components, requirement, [
        ...good,
        { componentId: 'MIDDLE', metric: 'duration', unit: 'seconds', value: 30 },
      ]),
    ).toThrow(/undeclared_component_report/);
    expect(() =>
      evaluateActivitySatisfaction(components, requirement, [
        { componentId: 'LEFT', metric: 'duration', unit: 'seconds', value: Number.NaN },
        good[1],
      ]),
    ).toThrow(/malformed_component_report/);
    expect(() =>
      evaluateActivitySatisfaction(components, requirement, [
        { componentId: '', metric: 'duration', unit: 'seconds', value: 30 },
        good[1],
      ]),
    ).toThrow(/malformed_component_report/);
  });

  it('14. existing non-component PF-01 path remains green', async () => {
    const db = testDb();
    const pushUp = await createKnowledgeItem(db, pushUpExemplarInput());
    await setMeasurementCompatibility(db, pushUp.id, PUSH_UP_CONTRACT);
    await setKnowledgeLifecycle(db, pushUp.id, 'published');
    const reread = (await getKnowledgeById(db, pushUp.id))!;
    expect(reread.challengeEligible).toBe(true);
    expect(reread.loadReportingBases).toEqual([]);
    const { listActivityComponents } = await import('../src/activityComponents.js');
    expect(await listActivityComponents(db, pushUp.id)).toEqual([]);
    const pin = await resolveActivityVersionPin(db, pushUp.id, reread.knowledgeVersion);
    expect(pin?.components).toEqual([]);
    expect(pin?.supportedLoadBases).toEqual([]);
    expect(pin?.primaryMetrics).toEqual(['repetitions']);
  });
});
