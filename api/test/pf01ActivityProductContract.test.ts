/**
 * PF-01 canonical V2 Activity Product Contract — focused proofs.
 *
 * Proves the twenty Founder-required behaviors on the real stack (PGlite
 * PostgreSQL semantics: constraints, triggers, transactions):
 *
 * Identity / taxonomy
 *  1. UUID and Activity Code uniqueness.
 *  2. Activity Code immutability (application gate + database trigger).
 *  3. Display-name change does not change identity.
 *  4. V2 resolution works by immutable identity/code.
 *  5. Exact-name resolution is not required by new contracts.
 *  6. Approved Fitness taxonomy accepted.
 *  7. Approved Wellness taxonomy accepted.
 *  8. Legacy-only taxonomy rejected from the new V2 path (quarantined).
 *
 * Publication vs Challenge eligibility
 *  9. Draft Activity not Runtime-Catalogue-visible.
 * 10. Published Activity is visible.
 * 11. Published but non-Challenge-eligible Activity is distinguishable.
 * 12. Valid Activity/Metric/Unit tuple is eligible.
 * 13. Invalid tuple fails.
 *
 * Versioning / history
 * 14. Content revision preserves historical version.
 * 15. Localized historical text remains resolvable.
 * 16. Compatibility history remains resolvable.
 *
 * Exemplars / establishment / quarantine
 * 17. Push-Up passes applicable KCS readiness.
 * 18. Breathing Practice passes applicable KCS readiness.
 * 19. Challenge establishment can pin the exemplar by immutable identity.
 * 20. No V1 challenge/activity history migration introduced.
 *
 * Out of scope (explicitly NOT built): full 118-Activity catalogue,
 * catalogue browsing UI, Admin CMS, templates, wizard, group/member/
 * participant journeys, feeds/social, recognition, rewards, deployment.
 */

import { describe, expect, it } from 'vitest';
import {
  assessChallengeEligibility,
  assessPublicationReadiness,
  createKnowledgeItem,
  getKnowledgeByCode,
  getKnowledgeById,
  getKnowledgeVersion,
  getLocalizedKnowledgeVersion,
  isActivityCode,
  listKnowledgeVersionTexts,
  listPublishedKnowledge,
  parseActivityCode,
  reviseKnowledgeItem,
  setKnowledgeLifecycle,
  setKnowledgeText,
  setMeasurementCompatibility,
  snapshotForReadiness,
  validateKnowledgeContent,
  V2_FITNESS_CATEGORIES,
  V2_WELLNESS_CATEGORIES,
  type CreateKnowledgeInput,
} from '../src/knowledge.js';
import {
  assertActivityMeasurementCompatible,
  createDbKnowledgeEligibilityResolver,
  createDbKnowledgeEligibilityResolverByIdentity,
} from '../src/knowledgeEligibility.js';
import {
  createDbKnowledgeIdentityResolver,
  resolveKnowledgePinByIdentity,
  resolveKnowledgePinByName,
} from '../src/knowledgePins.js';
import {
  BREATHING_PRACTICE_ACTIVITY_CODE,
  BREATHING_PRACTICE_CONTRACT,
  PUSH_UP_ACTIVITY_CODE,
  PUSH_UP_CONTRACT,
  breathingPracticeExemplarInput,
  pushUpExemplarInput,
} from '../src/pf01Exemplars.js';
import { testDb } from './helpers.js';

function fitnessContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'fitness',
    name: 'PF-01 Test Press',
    category: 'Strength',
    subcategory: 'Push',
    difficulty: 'Intermediate',
    description: 'A governed test pressing movement.',
    metricUnit: 'reps',
    contentClasses: ['U', 'Q', 'T'],
    measurementGuidance: 'Count full controlled repetitions.',
    unitSemantics: 'One rep equals one complete down-and-up cycle.',
    setup: 'Start in a supported plank.',
    execution: 'Lower with control, then press to extension.',
    formCues: ['Keep a straight line'],
    adaptation: 'Use an incline while keeping the trunk straight.',
    safetyNotes: ['Stop on sharp pain'],
    ...overrides,
  };
}

function wellnessContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'wellness',
    name: 'PF-01 Test Rest',
    category: 'Sleep & Rest',
    difficulty: 'beginner',
    description: 'A governed test rest protocol.',
    metricUnit: 'minutes',
    contentClasses: ['U', 'Q', 'P', 'C'],
    measurementGuidance: 'Report whole minutes of practice.',
    unitSemantics: 'One minute equals sixty seconds of practice.',
    protocolSteps: ['Lie down.', 'Breathe slowly.', 'Rise gently.'],
    sessionFraming: 'A short quiet rest session.',
    completionMeaning: 'Complete when every step has been followed.',
    ...overrides,
  };
}

describe('PF-01 identity (proofs 1-5)', () => {
  it('1. enforces UUID and Activity Code uniqueness', async () => {
    const db = testDb();
    const first = await createKnowledgeItem(
      db,
      fitnessContent({ activityCode: 'FIT-TST-001', name: 'Alpha' }) as CreateKnowledgeInput,
    );
    const second = await createKnowledgeItem(
      db,
      fitnessContent({ activityCode: 'FIT-TST-002', name: 'Beta' }) as CreateKnowledgeInput,
    );
    expect(first.id).not.toBe(second.id);
    expect(first.activityCode).toBe('FIT-TST-001');
    await expect(
      createKnowledgeItem(
        db,
        fitnessContent({ activityCode: 'FIT-TST-001', name: 'Gamma' }) as CreateKnowledgeInput,
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'knowledge_conflict' });
  });

  it('1b. rejects malformed Activity Codes fail-closed', async () => {
    const db = testDb();
    for (const bad of ['push-up', 'FIT-STR-1', 'fit-str-001', 'FIT-STR-0001', 'FIT STR 001', 42]) {
      await expect(
        createKnowledgeItem(
          db,
          fitnessContent({ activityCode: bad }) as CreateKnowledgeInput,
        ),
      ).rejects.toMatchObject({ statusCode: 400, code: 'invalid_knowledge' });
    }
    expect(isActivityCode('FIT-STR-001')).toBe(true);
    expect(isActivityCode('Push-Up')).toBe(false);
    expect(parseActivityCode(undefined)).toBeNull();
  });

  it('2. keeps the Activity Code immutable (gate + trigger)', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      fitnessContent({ activityCode: 'FIT-TST-011' }) as CreateKnowledgeInput,
    );
    const changed = {
      ...(fitnessContent({ activityCode: 'FIT-TST-011' }) as Record<string, unknown>),
      activityCode: 'FIT-TST-012',
      name: 'PF-01 Test Press',
    };
    await expect(reviseKnowledgeItem(db, created.id, changed)).rejects.toMatchObject({
      statusCode: 400,
      code: 'immutable_activity_code',
    });
    await expect(
      db.query(`UPDATE knowledge_items SET activity_code = 'FIT-TST-013' WHERE knowledge_id = $1`, [
        created.id,
      ]),
    ).rejects.toThrow(/immutable/);
    const reread = await getKnowledgeById(db, created.id);
    expect(reread?.activityCode).toBe('FIT-TST-011');
  });

  it('3. display-name change does not change identity', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      fitnessContent({ activityCode: 'FIT-TST-021' }) as CreateKnowledgeInput,
    );
    const revised = await reviseKnowledgeItem(db, created.id, {
      ...(fitnessContent({ activityCode: 'FIT-TST-021' }) as Record<string, unknown>),
      name: 'Renamed Press',
    });
    expect(revised.id).toBe(created.id);
    expect(revised.activityCode).toBe('FIT-TST-021');
    expect(revised.name).toBe('Renamed Press');
  });

  it('4. resolves V2 records by immutable identity/code', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      fitnessContent({ activityCode: 'FIT-TST-031' }) as CreateKnowledgeInput,
    );
    expect((await getKnowledgeById(db, created.id))?.activityCode).toBe('FIT-TST-031');
    expect((await getKnowledgeByCode(db, 'FIT-TST-031'))?.id).toBe(created.id);
    expect(await getKnowledgeByCode(db, 'FIT-TST-999')).toBeNull();
    expect(await getKnowledgeByCode(db, 'not-a-code')).toBeNull();
  });

  it('5. new contracts never require exact-name resolution', async () => {
    const db = testDb();
    const first = await createKnowledgeItem(
      db,
      fitnessContent({ activityCode: 'FIT-TST-041', name: 'Shared Name' }) as CreateKnowledgeInput,
    );
    const second = await createKnowledgeItem(
      db,
      fitnessContent({ activityCode: 'FIT-TST-042', name: 'Shared Name' }) as CreateKnowledgeInput,
    );
    await setKnowledgeLifecycle(db, first.id, 'published');
    await setKnowledgeLifecycle(db, second.id, 'published');
    // Legacy exact-name seam is ambiguous under duplicate display names...
    expect(await resolveKnowledgePinByName(db, 'fitness', 'Shared Name')).toBeNull();
    expect(await createDbKnowledgeEligibilityResolver(db, 'fitness')('Shared Name')).toBeNull();
    // ...while immutable identity resolves each record exactly.
    const byIdentity = createDbKnowledgeEligibilityResolverByIdentity(db, 'fitness');
    expect((await byIdentity('FIT-TST-041'))?.knowledgeId).toBe(first.id);
    expect((await byIdentity('FIT-TST-042'))?.knowledgeId).toBe(second.id);
    expect((await byIdentity(first.id))?.knowledgeId).toBe(first.id);
    expect(await byIdentity('Shared Name')).toBeNull();
    expect((await resolveKnowledgePinByIdentity(db, 'fitness', 'FIT-TST-041'))?.knowledge_id).toBe(
      first.id,
    );
  });
});

describe('PF-01 taxonomy (proofs 6-8)', () => {
  it('6. accepts every approved Fitness category', async () => {
    const db = testDb();
    expect(V2_FITNESS_CATEGORIES).toHaveLength(6);
    let seq = 101;
    for (const category of V2_FITNESS_CATEGORIES) {
      const created = await createKnowledgeItem(
        db,
        fitnessContent({
          activityCode: `FIT-TST-${seq++}`,
          category,
        }) as CreateKnowledgeInput,
      );
      expect(created.category).toBe(category);
    }
  });

  it('7. accepts every approved Wellness category', async () => {
    const db = testDb();
    expect(V2_WELLNESS_CATEGORIES).toHaveLength(6);
    let seq = 201;
    for (const category of V2_WELLNESS_CATEGORIES) {
      const created = await createKnowledgeItem(
        db,
        wellnessContent({
          activityCode: `WEL-TST-${seq++}`,
          category,
        }) as CreateKnowledgeInput,
      );
      expect(created.category).toBe(category);
    }
  });

  it('8. rejects legacy-only taxonomy from the V2 path (quarantined)', async () => {
    const db = testDb();
    await expect(
      createKnowledgeItem(
        db,
        fitnessContent({ activityCode: 'FIT-TST-301', category: 'Core' }) as CreateKnowledgeInput,
      ),
    ).rejects.toMatchObject({ statusCode: 400, code: 'invalid_knowledge' });
    await expect(
      createKnowledgeItem(
        db,
        wellnessContent({ activityCode: 'WEL-TST-301', category: 'fasting' }) as CreateKnowledgeInput,
      ),
    ).rejects.toMatchObject({ statusCode: 400, code: 'invalid_knowledge' });
    // Quarantine proof: the legacy path (no code) still accepts V1 values so
    // history and the legacy import path are never rewritten.
    const legacy = await createKnowledgeItem(
      db,
      fitnessContent({ category: 'Core', subcategory: 'Strength' }) as CreateKnowledgeInput,
    );
    expect(legacy.activityCode).toBeNull();
    expect(legacy.category).toBe('Core');
  });
});

describe('PF-01 publication vs eligibility (proofs 9-13)', () => {
  it('9. keeps drafts out of the Runtime Catalogue', async () => {
    const db = testDb();
    const draft = await createKnowledgeItem(
      db,
      fitnessContent({ activityCode: 'FIT-TST-401' }) as CreateKnowledgeInput,
    );
    expect(draft.lifecycle).toBe('draft');
    const catalogue = await listPublishedKnowledge(db, {});
    expect(catalogue.map((item) => item.id)).not.toContain(draft.id);
  });

  it('10. shows published Activities in the Runtime Catalogue', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      fitnessContent({ activityCode: 'FIT-TST-411' }) as CreateKnowledgeInput,
    );
    await setKnowledgeLifecycle(db, created.id, 'published');
    const catalogue = await listPublishedKnowledge(db, {});
    expect(catalogue.map((item) => item.id)).toContain(created.id);
  });

  it('11. distinguishes published-but-not-eligible Activities', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      fitnessContent({ activityCode: 'FIT-TST-421' }) as CreateKnowledgeInput,
    );
    await setKnowledgeLifecycle(db, created.id, 'published');
    const published = (await getKnowledgeById(db, created.id))!;
    expect(published.publicationReady).toBe(true);
    expect(published.publicationIssues).toEqual([]);
    // No governed Metric/Unit contract yet: catalogue-visible, not eligible.
    expect(published.challengeEligible).toBe(false);
    expect(published.challengeEligibilityIssues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['no_primary_metric', 'no_compatible_unit']),
    );
    // And the establishment gate agrees: identity resolves, but the tuple
    // cannot validate without a contract.
    expect(
      await createDbKnowledgeEligibilityResolverByIdentity(db, 'fitness')('FIT-TST-421'),
    ).not.toBeNull();
  });

  it('12. treats a valid Activity/Metric/Unit tuple as eligible', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      fitnessContent({ activityCode: 'FIT-TST-431' }) as CreateKnowledgeInput,
    );
    await setMeasurementCompatibility(db, created.id, {
      primaryMetrics: ['repetitions'],
      secondaryMetrics: [],
      compatibleUnits: ['reps'],
    });
    await setKnowledgeLifecycle(db, created.id, 'published');
    const eligible = (await getKnowledgeById(db, created.id))!;
    expect(eligible.publicationReady).toBe(true);
    expect(eligible.challengeEligible).toBe(true);
    expect(eligible.challengeEligibilityIssues).toEqual([]);
    const resolver = createDbKnowledgeEligibilityResolverByIdentity(db, 'fitness');
    const proven = (await resolver('FIT-TST-431'))!;
    expect(proven.activityCode).toBe('FIT-TST-431');
    expect(() =>
      assertActivityMeasurementCompatible(
        proven,
        { canonical_key: 'FIT-TST-431', metric: 'repetitions', unit: 'reps' },
        0,
      ),
    ).not.toThrow();
  });

  it('13. fails invalid tuples closed', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      fitnessContent({ activityCode: 'FIT-TST-441' }) as CreateKnowledgeInput,
    );
    await setMeasurementCompatibility(db, created.id, {
      primaryMetrics: ['repetitions'],
      secondaryMetrics: [],
      compatibleUnits: ['reps'],
    });
    await setKnowledgeLifecycle(db, created.id, 'published');
    const proven =
      (await createDbKnowledgeEligibilityResolverByIdentity(db, 'fitness')('FIT-TST-441'))!;
    // Metric the Activity does not permit.
    expect(() =>
      assertActivityMeasurementCompatible(
        proven,
        { canonical_key: 'FIT-TST-441', metric: 'duration', unit: 'minutes' },
        0,
      ),
    ).toThrow();
    // Unit the Activity does not permit.
    expect(() =>
      assertActivityMeasurementCompatible(
        proven,
        { canonical_key: 'FIT-TST-441', metric: 'repetitions', unit: 'minutes' },
        0,
      ),
    ).toThrow();
    // Ungoverned unit.
    expect(() =>
      assertActivityMeasurementCompatible(
        proven,
        { canonical_key: 'FIT-TST-441', metric: 'repetitions', unit: 'banana' },
        0,
      ),
    ).toThrow();
  });
});

describe('PF-01 versioning and history (proofs 14-16)', () => {
  it('14. preserves the historical version across revisions', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      fitnessContent({ activityCode: 'FIT-TST-501' }) as CreateKnowledgeInput,
    );
    const revised = await reviseKnowledgeItem(db, created.id, {
      ...(fitnessContent({ activityCode: 'FIT-TST-501' }) as Record<string, unknown>),
      description: 'A revised governed description.',
    });
    expect(revised.knowledgeVersion).toBe(2);
    const historic = (await getKnowledgeVersion(db, created.id, 1))!;
    expect(historic.description).toBe('A governed test pressing movement.');
    expect((await getKnowledgeById(db, created.id))?.description).toBe(
      'A revised governed description.',
    );
    // Post-edit retrieval: the old version is still reachable.
    expect((await getKnowledgeVersion(db, created.id, 2))?.description).toBe(
      'A revised governed description.',
    );
  });

  it('15. keeps localized historical text resolvable', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      fitnessContent({ activityCode: 'FIT-TST-511' }) as CreateKnowledgeInput,
    );
    await setKnowledgeText(db, created.id, 'fr', 'name', 'Presse de test PF-01');
    await reviseKnowledgeItem(db, created.id, {
      ...(fitnessContent({ activityCode: 'FIT-TST-511' }) as Record<string, unknown>),
      name: 'PF-01 Test Press Revised',
    });
    // Version 2 snapshots the French override current at revision time.
    expect(await listKnowledgeVersionTexts(db, created.id, 2)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ locale: 'fr', field: 'name', value: 'Presse de test PF-01' }),
      ]),
    );
    // Version 1 predates the override: base English text resolves.
    const v1fr = (await getLocalizedKnowledgeVersion(db, created.id, 1, 'fr'))!;
    expect(v1fr.name).toBe('PF-01 Test Press');
    const v2fr = (await getLocalizedKnowledgeVersion(db, created.id, 2, 'fr'))!;
    expect(v2fr.name).toBe('Presse de test PF-01');
    // Later live edits cannot rewrite the pinned version: change the live
    // French text and prove version 2 still resolves the snapshot.
    await setKnowledgeText(db, created.id, 'fr', 'name', 'Presse modifiee');
    expect((await getLocalizedKnowledgeVersion(db, created.id, 2, 'fr'))?.name).toBe(
      'Presse de test PF-01',
    );
  });

  it('16. keeps Metric/Unit compatibility history resolvable', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(
      db,
      fitnessContent({ activityCode: 'FIT-TST-521' }) as CreateKnowledgeInput,
    );
    await setMeasurementCompatibility(db, created.id, {
      primaryMetrics: ['repetitions'],
      secondaryMetrics: [],
      compatibleUnits: ['reps'],
    });
    await reviseKnowledgeItem(
      db,
      created.id,
      fitnessContent({ activityCode: 'FIT-TST-521' }) as CreateKnowledgeInput,
    );
    await setMeasurementCompatibility(db, created.id, {
      primaryMetrics: ['repetitions'],
      secondaryMetrics: ['weight'],
      compatibleUnits: ['reps', 'grams', 'kilograms'],
    });
    const v1 = (await getKnowledgeVersion(db, created.id, 1))!;
    expect(v1.primaryMetrics).toEqual([]);
    expect(v1.compatibleUnits).toEqual([]);
    const v2 = (await getKnowledgeVersion(db, created.id, 2))!;
    expect(v2.primaryMetrics).toEqual(['repetitions']);
    expect(v2.compatibleUnits).toEqual(['reps']);
    const current = (await getKnowledgeById(db, created.id))!;
    expect(current.secondaryMetrics).toEqual(['weight']);
    expect(current.compatibleUnits).toEqual(['grams', 'kilograms', 'reps']);
  });
});

describe('PF-01 exemplars, establishment, quarantine (proofs 17-20)', () => {
  it('17. Push-Up passes applicable KCS readiness', () => {
    const input = pushUpExemplarInput();
    expect(PUSH_UP_ACTIVITY_CODE).toBe('FIT-STR-001');
    expect(isActivityCode(PUSH_UP_ACTIVITY_CODE)).toBe(true);
    const content = validateKnowledgeContent('fitness', input, true);
    const issues = assessPublicationReadiness('fitness', content.contentClasses, {
      ...snapshotForReadiness(content),
    });
    expect(issues).toEqual([]);
  });

  it('17b. Push-Up publishes end-to-end and is Challenge-eligible', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(db, pushUpExemplarInput());
    expect(created.activityCode).toBe(PUSH_UP_ACTIVITY_CODE);
    expect(created.publicationReady).toBe(true);
    await setMeasurementCompatibility(db, created.id, PUSH_UP_CONTRACT);
    await setKnowledgeLifecycle(db, created.id, 'published');
    const published = (await getKnowledgeById(db, created.id))!;
    expect(published.challengeEligible).toBe(true);
  });

  it('18. Breathing Practice passes applicable KCS readiness', async () => {
    const input = breathingPracticeExemplarInput();
    expect(BREATHING_PRACTICE_ACTIVITY_CODE).toBe('WEL-MND-003');
    expect(isActivityCode(BREATHING_PRACTICE_ACTIVITY_CODE)).toBe(true);
    const content = validateKnowledgeContent('wellness', input, true);
    const issues = assessPublicationReadiness('wellness', content.contentClasses, {
      ...snapshotForReadiness(content),
    });
    expect(issues).toEqual([]);
    const db = testDb();
    const created = await createKnowledgeItem(db, breathingPracticeExemplarInput());
    expect(created.publicationReady).toBe(true);
    await setMeasurementCompatibility(db, created.id, BREATHING_PRACTICE_CONTRACT);
    await setKnowledgeLifecycle(db, created.id, 'published');
    expect((await getKnowledgeById(db, created.id))?.challengeEligible).toBe(true);
  });

  it('19. Challenge establishment pins the exemplar by immutable identity', async () => {
    const db = testDb();
    const created = await createKnowledgeItem(db, pushUpExemplarInput());
    await setMeasurementCompatibility(db, created.id, PUSH_UP_CONTRACT);
    await setKnowledgeLifecycle(db, created.id, 'published');

    // Pin by code and by UUID — the two immutable identities agree.
    const pinByCode = (await resolveKnowledgePinByIdentity(db, 'fitness', PUSH_UP_ACTIVITY_CODE))!;
    const pinByUuid = (await resolveKnowledgePinByIdentity(db, 'fitness', created.id))!;
    expect(pinByCode).toEqual(pinByUuid);
    expect(pinByCode.knowledge_id).toBe(created.id);
    expect(pinByCode.current_version).toBe(1);

    // Eligibility proves by code with the governed contract attached.
    const eligibility =
      (await createDbKnowledgeEligibilityResolverByIdentity(db, 'fitness')(
        PUSH_UP_ACTIVITY_CODE,
      ))!;
    expect(eligibility.knowledgeId).toBe(created.id);
    expect(eligibility.activityCode).toBe(PUSH_UP_ACTIVITY_CODE);
    expect(() =>
      assertActivityMeasurementCompatible(
        eligibility,
        { canonical_key: PUSH_UP_ACTIVITY_CODE, metric: 'repetitions', unit: 'reps' },
        0,
      ),
    ).not.toThrow();

    // Establishment-shaped resolvers addressed by code (the exact seam
    // challengeEstablishment consumes via canonical_key).
    const resolveKnowledgePin = createDbKnowledgeIdentityResolver(db, 'fitness');
    const resolveKnowledgeEligibility =
      createDbKnowledgeEligibilityResolverByIdentity(db, 'fitness');
    expect((await resolveKnowledgePin(PUSH_UP_ACTIVITY_CODE))?.knowledge_id).toBe(created.id);
    expect(
      (await resolveKnowledgeEligibility(PUSH_UP_ACTIVITY_CODE))?.knowledgeId,
    ).toBe(created.id);
  });

  it('20. introduces no V1 challenge/activity history migration', async () => {
    const db = testDb();
    // A simulated pre-PF-01 row: legacy category, no code, grandfathered —
    // exactly what migrations 001-012 leave behind. PF-01 must read it
    // untouched, never rewrite it.
    const legacy = await db.query<{ knowledge_id: string }>(
      `INSERT INTO knowledge_items
         (kind, lifecycle, current_version, name, category, subcategory, difficulty,
          description, metric_unit, content_classes, default_locale, grandfathered)
       VALUES ('fitness', 'published', 1, 'Legacy Press', 'Core', 'Strength', 'Beginner',
               'Pre-PF-01 evidence row.', 'reps', '{}', 'en', TRUE)
       RETURNING knowledge_id`,
    );
    const legacyId = String(legacy.rows[0].knowledge_id);
    const reread = (await getKnowledgeById(db, legacyId))!;
    expect(reread.activityCode).toBeNull();
    expect(reread.category).toBe('Core');
    // Readable (grandfathered provenance), but not Challenge-eligible:
    // content-thin and contract-less, failing closed like every EBC-01 item.
    expect(reread.challengeEligible).toBe(false);
    // The quarantined legacy name seam still resolves it for historical
    // compatibility — the V2 path never needed to migrate it.
    expect((await resolveKnowledgePinByName(db, 'fitness', 'Legacy Press'))?.knowledge_id).toBe(
      legacyId,
    );
    // And new V2 creation stays optional-code: omission yields a codeless row,
    // never a backfill.
    const codeless = await createKnowledgeItem(
      db,
      fitnessContent({ name: 'Codeless', category: 'Core', subcategory: 'Strength' }),
    );
    expect(codeless.activityCode).toBeNull();
  });

  it('assessChallengeEligibility keeps publication and eligibility distinct', () => {
    const ready = assessChallengeEligibility({
      lifecycle: 'published',
      kind: 'fitness',
      declared: ['U', 'Q', 'T'],
      snapshot: {
        name: 'X',
        description: 'Y',
        category: 'Strength',
        metricUnit: 'reps',
        measurementGuidance: 'Count.',
        unitSemantics: 'One cycle.',
        setup: 'Set up.',
        execution: 'Execute.',
        techniqueReference: '',
        formCues: ['Cue'],
        commonMistakes: [],
        equipment: '',
        environment: '',
        adaptation: 'Adapt.',
        protocolSteps: [],
        sessionFraming: '',
        completionMeaning: '',
        avoidanceCondition: '',
        semanticDefinition: '',
        safetyNotes: ['Careful'],
      },
      primaryMetrics: [],
      secondaryMetrics: [],
      compatibleUnits: [],
    });
    // Content is KCS-ready (no kcs_not_ready), yet the item is ineligible:
    // publication readiness and Challenge eligibility are separate states.
    expect(ready.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['no_primary_metric', 'no_compatible_unit']),
    );
    expect(ready.map((issue) => issue.code)).not.toContain('kcs_not_ready');
    expect(ready.map((issue) => issue.code)).not.toContain('not_published');
  });
});
