/**
 * S2b — V2 Challenge Creation vertical seam (server-side focused proofs).
 *
 * The S2b experience binds already-merged governed capability through the
 * S2a transport seam and the governed establishment route. These tests prove
 * the server side of that vertical assembly without adding any new authority:
 *
 * - GET /v1/knowledge/:id/options carries the derived `unitsByMetric`
 *   presentation grouping (the single governed measurement vocabulary — no
 *   second compatibility opinion, no client-side unit invention);
 * - a PF-04-shaped draft configured for each Challenge type establishes
 *   through POST /v1/challenges (governed creation authority), never by a
 *   direct write;
 * - the persisted V2 read (GET /v1/challenges/:id) exposes the governing
 *   Metric / Components / Load Reporting Basis / Duration mode / Completion
 *   occurrence so a created Challenge can be re-read and rendered honestly
 *   after refresh;
 * - governed denials (Charter-restricted creation) surface as clear codes and
 *   persist nothing.
 *
 * Semantic validation stays the single PF-03 authority; these tests assert
 * its outcomes, they do not reimplement them.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import {
  createKnowledgeItem,
  setKnowledgeLifecycle,
  setLoadReportingBases,
  setMeasurementCompatibility,
  type CreateKnowledgeInput,
} from '../src/knowledge.js';
import { createDbKnowledgeIdentityResolver } from '../src/knowledgePins.js';
import { createDbKnowledgeEligibilityResolverByIdentity } from '../src/knowledgeEligibility.js';
import type {
  ChallengeCreationAuthority,
  ChallengeCreationAuthorityStatus,
} from '../src/challengeCreationAuthority.js';
import type { GroupMembershipAuthority } from '../src/groupMembershipAuthority.js';
import { authHeaders, seedMember, seedMembership, stubVerifier, testDb } from './helpers.js';

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys CASCADE',
  );
});

function content(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'fitness',
    name: 'S2b Movement',
    category: 'Strength',
    subcategory: 'Push',
    difficulty: 'Intermediate',
    description: 'A governed movement used for S2b establishment proofs.',
    metricUnit: 'reps',
    contentClasses: ['U', 'Q', 'T'],
    measurementGuidance: 'Count each full controlled repetition.',
    unitSemantics: 'One repetition equals one complete down-and-up cycle.',
    setup: 'Adopt a stable start position.',
    execution: 'Move through the full range with control.',
    formCues: ['Keep a straight line'],
    adaptation: 'Reduce the range of motion to regress.',
    safetyNotes: ['Stop on sharp pain'],
    ...overrides,
  };
}

interface SeededActivity {
  id: string;
  version: number;
  code: string;
}

async function seedActivity(opts: {
  code: string;
  name: string;
  metrics: string[];
  units: string[];
  secondary?: string[];
  metricUnit?: string;
  loadBases?: string[];
  components?: Array<{ componentId: string; displayName: string; relationship: string }>;
}): Promise<SeededActivity> {
  const db = testDb();
  const created = await createKnowledgeItem(
    db,
    content({
      activityCode: opts.code,
      name: opts.name,
      metricUnit: opts.metricUnit ?? opts.units[0],
      ...(opts.components ? { components: opts.components } : {}),
    }) as CreateKnowledgeInput,
  );
  await setMeasurementCompatibility(db, created.id, {
    primaryMetrics: opts.metrics,
    secondaryMetrics: opts.secondary ?? [],
    compatibleUnits: opts.units,
  });
  if (opts.loadBases) await setLoadReportingBases(db, created.id, opts.loadBases);
  await setKnowledgeLifecycle(db, created.id, 'published');
  const fresh = await db.query<{ current_version: number }>(
    `SELECT current_version FROM knowledge_items WHERE knowledge_id = $1`,
    [created.id],
  );
  return { id: created.id, version: Number(fresh.rows[0].current_version), code: opts.code };
}

const permitAll: ChallengeCreationAuthority = {
  async resolveChallengeCreationAuthority(): Promise<ChallengeCreationAuthorityStatus> {
    return {
      permitted: true,
      reason: null,
      groupStatus: 'active',
      allowMemberChallenges: true,
      memberRole: 'member',
      memberStatus: 'active',
    };
  },
};

const charterRestricted: ChallengeCreationAuthority = {
  async resolveChallengeCreationAuthority(): Promise<ChallengeCreationAuthorityStatus> {
    return {
      permitted: false,
      reason: 'charter_restricted',
      groupStatus: 'active',
      allowMemberChallenges: false,
      memberRole: 'member',
      memberStatus: 'active',
    };
  },
};

const eligibleMembership: GroupMembershipAuthority = {
  async resolveGroupMembershipAuthority() {
    return { status: 'active', eligible: true };
  },
};

interface World {
  groupId: string;
  token: string;
  uid: string;
  memberId: string;
}

let seq = 0;

async function world(authority: ChallengeCreationAuthority = permitAll) {
  const db = testDb();
  const tag = `s2b${(seq += 1)}`;
  const uid = `s2b-uid-${tag}`;
  const memberId = await seedMember(db, uid);
  const groupRow = await db.query<{ group_id: string }>(
    `INSERT INTO groups (legacy_firestore_id, name, description, is_private)
     VALUES ($1, $2, '', FALSE) RETURNING group_id`,
    [`fs-${tag}`, `S2b Group ${tag}`],
  );
  const groupId = String(groupRow.rows[0].group_id);
  await seedMembership(db, groupId, memberId, { role: 'member', status: 'active' });
  const app = buildApp({
    db,
    verifier: stubVerifier({ [tag]: uid }),
    challengeActivity: { groupMembershipAuthority: eligibleMembership },
    challengeCreation: {
      creationAuthority: authority,
      eligibilityFor: async (kind, key) =>
        createDbKnowledgeEligibilityResolverByIdentity(db, kind)(key),
      pinsFor: async (kind, key) => createDbKnowledgeIdentityResolver(db, kind)(key),
    },
  });
  const worldValue: World = { groupId, token: tag, uid, memberId };
  return { app, world: worldValue };
}

function body(w: World, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    group_id: w.groupId,
    challenge_type: 'competitive',
    title: 'S2b Challenge',
    start_date: '2026-06-01',
    end_date: '2026-06-30',
    activities: [],
    ...overrides,
  };
}

describe('S2b options seam — derived unitsByMetric', () => {
  it('groups the governed compatible units by the Metric each unit expresses', async () => {
    const seeded = await seedActivity({
      code: 'FIT-TST-901',
      name: 'S2b Interval',
      metrics: ['duration'],
      units: ['minutes', 'seconds'],
      metricUnit: 'minutes',
    });
    const { app, world: w } = await world();
    const response = await app.inject({
      method: 'GET',
      url: `/v1/knowledge/${seeded.id}/options`,
      headers: authHeaders(w.token),
    });
    expect(response.statusCode).toBe(200);
    const bodyJson = response.json() as {
      primaryMetrics: string[];
      compatibleUnits: string[];
      unitsByMetric: Record<string, string[]>;
    };
    expect(bodyJson.primaryMetrics).toEqual(['duration']);
    expect(bodyJson.compatibleUnits.sort()).toEqual(['minutes', 'seconds']);
    // Exactly the single governed vocabulary's own mapping — nothing invented.
    expect(bodyJson.unitsByMetric).toEqual({ duration: ['minutes', 'seconds'] });
  });
});

describe('S2b governed establishment through POST /v1/challenges', () => {
  it('establishes a Together (collective) Challenge and re-reads its measurement truth', async () => {
    const seeded = await seedActivity({
      code: 'FIT-TST-910',
      name: 'S2b Community Walk',
      metrics: ['distance'],
      units: ['kilometres'],
    });
    const { app, world: w } = await world();
    const created = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.token),
      payload: body(w, {
        challenge_type: 'collective',
        title: 'S2b Together Walk',
        goal_value: 500,
        goal_unit: 'kilometres',
        activate: true,
        join_creator: true,
        idempotency_key: 's2b-together-1',
        activities: [{
          activity_kind: 'fitness',
          canonical_key: seeded.id,
          version: seeded.version,
          metric: 'distance',
          target_value: 10,
          unit: 'kilometres',
        }],
      }),
    });
    expect(created.statusCode).toBe(201);
    const established = created.json() as { challengeId: string; status: string; activated: boolean };
    expect(established.status).toBe('active');
    expect(established.activated).toBe(true);

    const detail = await app.inject({
      method: 'GET',
      url: `/v1/challenges/${established.challengeId}`,
      headers: authHeaders(w.token),
    });
    expect(detail.statusCode).toBe(200);
    const detailJson = detail.json() as {
      challengeType: string;
      goalValue: number;
      goalUnit: string;
      myParticipation: { status: string } | null;
      config: { activities: Array<Record<string, unknown>> };
    };
    expect(detailJson.challengeType).toBe('collective');
    expect(detailJson.goalValue).toBe(500);
    expect(detailJson.goalUnit).toBe('kilometres');
    expect(detailJson.myParticipation?.status).toBe('active');
    expect(detailJson.config.activities[0]).toMatchObject({
      metric: 'distance',
      unit: 'kilometres',
      targetValue: 10,
      requiredComponents: [],
      loadReportingBasis: null,
      durationMode: null,
      completionOccurrence: null,
    });
  });

  it('establishes a Race (competitive) Challenge', async () => {
    const seeded = await seedActivity({
      code: 'FIT-TST-911',
      name: 'S2b Push-Up Race',
      metrics: ['repetitions'],
      units: ['reps'],
    });
    const { app, world: w } = await world();
    const created = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.token),
      payload: body(w, {
        challenge_type: 'competitive',
        title: 'S2b Race',
        activate: true,
        join_creator: false,
        activities: [{
          activity_kind: 'fitness',
          canonical_key: seeded.id,
          version: seeded.version,
          metric: 'repetitions',
          target_value: 100,
          unit: 'reps',
        }],
      }),
    });
    expect(created.statusCode).toBe(201);
    const established = created.json() as { challengeId: string };
    const detail = await app.inject({
      method: 'GET',
      url: `/v1/challenges/${established.challengeId}`,
      headers: authHeaders(w.token),
    });
    const detailJson = detail.json() as {
      challengeType: string;
      myParticipation: unknown;
      config: { activities: Array<Record<string, unknown>> };
    };
    expect(detailJson.challengeType).toBe('competitive');
    expect(detailJson.myParticipation).toBeNull();
    expect(detailJson.config.activities[0]).toMatchObject({ metric: 'repetitions', unit: 'reps' });
  });

  it('establishes a Streak Challenge carrying timezone and duration mode', async () => {
    const seeded = await seedActivity({
      code: 'FIT-TST-912',
      name: 'S2b Daily Minute',
      metrics: ['duration'],
      units: ['minutes'],
    });
    const { app, world: w } = await world();
    const created = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.token),
      payload: body(w, {
        challenge_type: 'streak',
        title: 'S2b Streak',
        timezone: 'Africa/Nairobi',
        required_consecutive_days: 7,
        activate: true,
        join_creator: true,
        activities: [{
          activity_kind: 'fitness',
          canonical_key: seeded.id,
          version: seeded.version,
          metric: 'duration',
          target_value: 20,
          unit: 'minutes',
          duration_mode: 'CONTINUOUS',
        }],
      }),
    });
    expect(created.statusCode).toBe(201);
    const established = created.json() as { challengeId: string };
    const detail = await app.inject({
      method: 'GET',
      url: `/v1/challenges/${established.challengeId}`,
      headers: authHeaders(w.token),
    });
    const detailJson = detail.json() as {
      timezone: string;
      config: { requiredConsecutiveDays: number | null; activities: Array<Record<string, unknown>> };
    };
    expect(detailJson.timezone).toBe('Africa/Nairobi');
    expect(detailJson.config.requiredConsecutiveDays).toBe(7);
    expect(detailJson.config.activities[0]).toMatchObject({
      metric: 'duration',
      unit: 'minutes',
      durationMode: 'CONTINUOUS',
    });
  });

  it('pins required Components and exposes them on the read', async () => {
    const seeded = await seedActivity({
      code: 'FIT-TST-913',
      name: 'S2b Side Hold',
      metrics: ['duration'],
      units: ['seconds'],
      components: [
        { componentId: 'LEFT', displayName: 'Left side', relationship: 'ALL_REQUIRED' },
        { componentId: 'RIGHT', displayName: 'Right side', relationship: 'ALL_REQUIRED' },
      ],
    });
    const { app, world: w } = await world();
    const created = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.token),
      payload: body(w, {
        challenge_type: 'competitive',
        title: 'S2b Components',
        activate: true,
        activities: [{
          activity_kind: 'fitness',
          canonical_key: seeded.id,
          version: seeded.version,
          metric: 'duration',
          target_value: 30,
          unit: 'seconds',
          duration_mode: 'CONTINUOUS',
          component_ids: ['LEFT', 'RIGHT'],
        }],
      }),
    });
    expect(created.statusCode).toBe(201);
    const established = created.json() as { challengeId: string };
    const detail = await app.inject({
      method: 'GET',
      url: `/v1/challenges/${established.challengeId}`,
      headers: authHeaders(w.token),
    });
    const detailJson = detail.json() as { config: { activities: Array<{ requiredComponents: string[] }> } };
    expect(detailJson.config.activities[0].requiredComponents).toEqual(['LEFT', 'RIGHT']);

    // Partial Component coverage is rejected by the single semantic authority.
    const partial = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.token),
      payload: body(w, {
        challenge_type: 'competitive',
        title: 'S2b Partial',
        activities: [{
          activity_kind: 'fitness',
          canonical_key: seeded.id,
          version: seeded.version,
          metric: 'duration',
          target_value: 30,
          unit: 'seconds',
          duration_mode: 'CONTINUOUS',
          component_ids: ['LEFT'],
        }],
      }),
    });
    expect(partial.statusCode).toBe(422);
    expect((partial.json() as { error: { code: string } }).error.code).toBe('invalid_challenge_definition');
  });

  it('pins and exposes an explicit Weight load reporting basis', async () => {
    const seeded = await seedActivity({
      code: 'FIT-TST-914',
      name: 'S2b Loaded Press',
      metrics: ['weight'],
      units: ['kilograms'],
      loadBases: ['PER_IMPLEMENT'],
    });
    const { app, world: w } = await world();
    const created = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.token),
      payload: body(w, {
        challenge_type: 'competitive',
        title: 'S2b Weight',
        activate: true,
        activities: [{
          activity_kind: 'fitness',
          canonical_key: seeded.id,
          version: seeded.version,
          metric: 'weight',
          target_value: 40,
          unit: 'kilograms',
          load_basis: 'PER_IMPLEMENT',
        }],
      }),
    });
    expect(created.statusCode).toBe(201);
    const established = created.json() as { challengeId: string };
    const detail = await app.inject({
      method: 'GET',
      url: `/v1/challenges/${established.challengeId}`,
      headers: authHeaders(w.token),
    });
    const detailJson = detail.json() as { config: { activities: Array<{ loadReportingBasis: string | null }> } };
    expect(detailJson.config.activities[0].loadReportingBasis).toBe('PER_IMPLEMENT');
  });
});

describe('S2b governed denials', () => {
  it('maps a charter-restricted creation to a clear code and persists nothing', async () => {
    const seeded = await seedActivity({
      code: 'FIT-TST-920',
      name: 'S2b Restricted',
      metrics: ['repetitions'],
      units: ['reps'],
    });
    const { app, world: w } = await world(charterRestricted);
    const before = await testDb().query<{ count: string }>(`SELECT COUNT(*) AS count FROM challenges`);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.token),
      payload: body(w, {
        challenge_type: 'competitive',
        title: 'S2b Restricted',
        activities: [{
          activity_kind: 'fitness',
          canonical_key: seeded.id,
          version: seeded.version,
          metric: 'repetitions',
          target_value: 10,
          unit: 'reps',
        }],
      }),
    });
    expect(response.statusCode).toBe(403);
    expect((response.json() as { error: { code: string } }).error.code).toBe('challenge_creation_forbidden');
    const after = await testDb().query<{ count: string }>(`SELECT COUNT(*) AS count FROM challenges`);
    expect(after.rows[0].count).toBe(before.rows[0].count);
  });
});
