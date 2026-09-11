/**
 * EBC-01 Challenge creation authority tests (HTTP boundary).
 *
 * Proves the governed V2 establishment route with a scripted live
 * creation authority (standing in for Firestore) and the REAL database
 * Knowledge eligibility gate:
 * - eligible Group actors can establish valid V2 Challenges;
 * - ineligible actors (non-members, removed members, restricted members)
 *   cannot — the PG shadow never authorizes;
 * - failed authority checks persist no Challenge/config state;
 * - retry with the same idempotency key replays instead of duplicating;
 * - a reused key with a different payload is rejected;
 * - no V1/Firestore Challenge write exists on this path (PG-only);
 * - client-supplied actor identity is rejected and never used.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { stubVerifier, testDb, seedMember, seedGroup, seedMembership, authHeaders } from './helpers.js';
import type { ChallengeCreationAuthority } from '../src/challengeCreationAuthority.js';
import { createFirestoreChallengeCreationAuthority } from '../src/firestoreChallengeCreationAuthority.js';
import { createDbKnowledgeEligibilityResolver } from '../src/knowledgeEligibility.js';
import type { GroupMutationStore } from '../src/groupMutations.js';

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events',
  );
});

type Decision =
  | { permitted: true; role?: string; allow?: boolean }
  | { permitted: false; reason: 'group_inactive' | 'no_membership' | 'membership_inactive' | 'charter_restricted' }
  | null
  | 'throw';

/** Scripted live creation authority: group UUID -> member UUID -> decision. */
function fakeAuthority(
  decide: (groupId: string, memberId: string) => Decision,
): ChallengeCreationAuthority {
  return {
    async resolveChallengeCreationAuthority(groupId: string, memberId: string) {
      const decision = decide(groupId, memberId);
      if (decision === 'throw') throw new Error('authority exploded');
      if (decision === null) return null;
      if (decision.permitted) {
        return {
          permitted: true,
          reason: null,
          groupStatus: 'active',
          allowMemberChallenges: decision.allow ?? true,
          memberRole: decision.role ?? 'member',
          memberStatus: 'active',
        };
      }
      return {
        permitted: false,
        reason: decision.reason,
        groupStatus: decision.reason === 'group_inactive' ? 'archived' : 'active',
        allowMemberChallenges: true,
        memberRole: decision.reason === 'no_membership' ? null : 'member',
        memberStatus: decision.reason === 'no_membership' ? null : 'removed',
      };
    },
  };
}

function unusedStore(): GroupMutationStore {
  const nope = (): never => {
    throw new Error('challenge path must never touch the group store');
  };
  return {
    createGroupWithOwner: nope,
    getGroup: nope,
    updateGroupCounter: nope,
    getMembership: nope,
    setMembership: nope,
    updateMembership: nope,
  };
}

let seq = 0;

interface World {
  groupId: string;
  creatorToken: string;
  creatorUid: string;
  creatorMemberId: string;
  knowledgeName: string;
}

function tokensFor(w: World): Record<string, string> {
  return { [w.creatorToken]: w.creatorUid };
}

/**
 * Seed a KCS-ready, compatibility-governed Knowledge item for
 * establishment: published with current content satisfying the KCS gate
 * (description, category, metric unit, measurement guidance, safety
 * notes) plus a governed measurement contract.
 */
async function seedEligibleKnowledge(name: string): Promise<void> {
  await testDb().query(
    `INSERT INTO knowledge_items
       (kind, name, lifecycle, grandfathered, description, category,
        metric_unit, measurement_guidance, safety_notes,
        primary_metrics, secondary_metrics, compatible_units)
     VALUES ('fitness', $1, 'published', FALSE,
       'A governed test movement', 'Upper Body', 'reps',
       'Count full-range repetitions', ARRAY['Stop on sharp pain'],
       ARRAY['repetitions'], ARRAY[]::TEXT[], ARRAY['reps'])`,
    [name],
  );
}

async function world(): Promise<World> {
  const db = testDb();
  const tag = `cc${(seq += 1)}`;
  const creatorUid = `creator-${tag}`;
  const creatorMemberId = await seedMember(db, creatorUid);
  const groupId = await seedGroup(db, { name: `Creation Group ${tag}` });
  const knowledgeName = `push-up-${tag}`;
  await seedEligibleKnowledge(knowledgeName);
  return { groupId, creatorToken: `token-${tag}`, creatorUid, creatorMemberId, knowledgeName };
}

describe('governed challenge establishment', () => {
  it('eligible Group actor establishes a valid V2 Challenge atomically', async () => {
    const w = await world();
    const app = appFor(w, () => ({ permitted: true, role: 'member' }));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.creatorToken),
      payload: validBody(w),
    });
    expect(response.statusCode).toBe(201);
    const body = response.json() as {
      challengeId: string; groupId: string; status: string; configVersion: number;
      activated: boolean; creatorParticipationId: string | null; idempotentReplay: boolean;
    };
    expect(body.groupId).toBe(w.groupId);
    expect(body.status).toBe('active');
    expect(body.configVersion).toBe(1);
    expect(body.activated).toBe(true);
    expect(body.creatorParticipationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(body.idempotentReplay).toBe(false);

    // The creator is the TOKEN identity: created_by matches the seeded member.
    const row = await testDb().query<{ created_by_member_id: string }>(
      `SELECT created_by_member_id FROM challenges WHERE challenge_id = $1`,
      [body.challengeId],
    );
    expect(String(row.rows[0].created_by_member_id)).toBe(w.creatorMemberId);

    // The immutable v1 snapshot carries the proven governed tuple.
    const snapshot = await testDb().query<{ snapshot: { activities: Array<{ metric: string; unit: string }> } }>(
      `SELECT snapshot FROM challenge_config_versions WHERE challenge_id = $1 AND version = 1`,
      [body.challengeId],
    );
    expect(snapshot.rows[0].snapshot.activities[0]).toMatchObject({
      metric: 'repetitions',
      unit: 'reps',
    });
  });

  it('non-member cannot authorize through an active PG shadow', async () => {
    const w = await world();
    // Active shadow row for the very same member: must not authorize.
    await seedMembership(testDb(), w.groupId, w.creatorMemberId, { role: 'member', status: 'active' });
    const app = appFor(w, () => ({ permitted: false, reason: 'no_membership' }));
    const before = await allRowCounts();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.creatorToken),
      payload: validBody(w),
    });
    expect(response.statusCode).toBe(403);
    expect(await allRowCounts()).toEqual(before);
  });

  it('stale PG membership cannot authorize after live removal', async () => {
    const w = await world();
    await seedMembership(testDb(), w.groupId, w.creatorMemberId, { role: 'member', status: 'active' });
    const app = appFor(w, () => ({ permitted: false, reason: 'membership_inactive' }));
    const before = await allRowCounts();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.creatorToken),
      payload: validBody(w),
    });
    expect(response.statusCode).toBe(403);
    expect(await allRowCounts()).toEqual(before);
  });

  it('missing group fails closed with no state', async () => {
    const w = await world();
    const app = appFor(w, () => null);
    const before = await allRowCounts();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.creatorToken),
      payload: validBody(w),
    });
    expect(response.statusCode).toBe(404);
    expect(await allRowCounts()).toEqual(before);
  });

  it('inactive group fails closed with no state', async () => {
    const w = await world();
    const app = appFor(w, () => ({ permitted: false, reason: 'group_inactive' }));
    const before = await allRowCounts();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.creatorToken),
      payload: validBody(w),
    });
    expect(response.statusCode).toBe(422);
    expect(await allRowCounts()).toEqual(before);
  });

  it('unreachable authority fails closed rather than falling back to PG', async () => {
    const w = await world();
    await seedMembership(testDb(), w.groupId, w.creatorMemberId, { role: 'owner', status: 'active' });
    const app = appFor(w, () => 'throw');
    const before = await allRowCounts();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.creatorToken),
      payload: validBody(w),
    });
    expect(response.statusCode).toBe(503);
    expect(await allRowCounts()).toEqual(before);
  });

  it('charter-restricted group: member refused, steward permitted', async () => {
    const w = await world();
    const refused = appFor(w, () => ({ permitted: false, reason: 'charter_restricted' }));
    const before = await allRowCounts();
    const denied = await refused.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.creatorToken),
      payload: validBody(w),
    });
    expect(denied.statusCode).toBe(403);
    expect(await allRowCounts()).toEqual(before);

    const allowed = appFor(w, () => ({ permitted: true, role: 'owner', allow: false }));
    const created = await allowed.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.creatorToken),
      payload: validBody(w),
    });
    expect(created.statusCode).toBe(201);
  });

  it('client-supplied actor identity is rejected and never used', async () => {
    const w = await world();
    const app = appFor(w, () => ({ permitted: true }));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.creatorToken),
      payload: { ...validBody(w), created_by_member_id: '00000000-0000-4000-8000-000000000000' },
    });
    expect(response.statusCode).toBe(400);
    expect(await challengeRowCount()).toBe(0);
  });

  it('idempotent retry replays the original establishment without duplicating', async () => {
    const w = await world();
    const app = appFor(w, () => ({ permitted: true }));
    const key = `est-key-${w.creatorToken}`;

    const first = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.creatorToken),
      payload: validBody(w, { idempotency_key: key }),
    });
    expect(first.statusCode).toBe(201);
    const firstBody = first.json() as { challengeId: string; creatorParticipationId: string | null };

    const second = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.creatorToken),
      payload: validBody(w, { idempotency_key: key }),
    });
    expect(second.statusCode).toBe(200);
    const secondBody = second.json() as {
      challengeId: string; creatorParticipationId: string | null; idempotentReplay: boolean;
    };
    expect(secondBody.challengeId).toBe(firstBody.challengeId);
    expect(secondBody.creatorParticipationId).toBe(firstBody.creatorParticipationId);
    expect(secondBody.idempotentReplay).toBe(true);
    expect(await challengeRowCount()).toBe(1);
  });

  it('reused idempotency key with a different payload is rejected without new state', async () => {
    const w = await world();
    const app = appFor(w, () => ({ permitted: true }));
    const key = `est-key-conflict-${w.creatorToken}`;

    const first = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.creatorToken),
      payload: validBody(w, { idempotency_key: key }),
    });
    expect(first.statusCode).toBe(201);

    const conflict = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.creatorToken),
      payload: validBody(w, { idempotency_key: key, title: 'A different undertaking' }),
    });
    expect(conflict.statusCode).toBe(409);
    expect(await challengeRowCount()).toBe(1);
  });

  it('establishment writes PG only: no V1/Firestore challenge write exists', async () => {
    const reads: Array<{ collection: string; docId: string }> = [];
    const w = await world();
    const app = buildApp({
      db: testDb(),
      verifier: stubVerifier(tokensFor(w)),
      groupMutation: { store: unusedStore() },
      challengeCreation: {
        creationAuthority: {
          async resolveChallengeCreationAuthority(groupId: string, memberId: string) {
            reads.push({ collection: 'groups', docId: groupId });
            reads.push({ collection: 'groupMembers', docId: `${groupId}_${memberId}` });
            return {
              permitted: true,
              reason: null,
              groupStatus: 'active',
              allowMemberChallenges: true,
              memberRole: 'member',
              memberStatus: 'active',
            };
          },
        },
        eligibilityFor: async (kind, key) => createDbKnowledgeEligibilityResolver(testDb(), kind)(key),
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.creatorToken),
      payload: validBody(w),
    });
    expect(response.statusCode).toBe(201);
    // The only Firestore collections ever touched are the Group authority
    // reads; no challenge collection is read or written (the seam has no
    // write capability by construction — the group store is unused here).
    expect(reads.length).toBeGreaterThan(0);
    for (const read of reads) {
      expect(['groups', 'groupMembers']).toContain(read.collection);
    }
    expect(await challengeRowCount()).toBe(1);
  });

  it('missing creation wiring fails closed instead of establishing', async () => {
    const w = await world();
    const app = buildApp({ db: testDb(), verifier: stubVerifier(tokensFor(w)) });
    const before = await allRowCounts();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges',
      headers: authHeaders(w.creatorToken),
      payload: validBody(w),
    });
    expect(response.statusCode).toBe(503);
    expect(await allRowCounts()).toEqual(before);
  });
});

describe('firestore creation authority adapter', () => {
  it('eligible member permitted; charter restriction binds members but not stewards', async () => {
    const tag = `ah${(seq += 1)}`;
    const db = testDb();
    const memberId = await seedMember(db, `ah-uid-${tag}`);
    const stewardId = await seedMember(db, `ah-steward-${tag}`);
    const groupId = await seedGroup(db, { legacyId: `legacy-ah-${tag}`, name: `Adapter ${tag}` });
    const docs: Record<string, Record<string, unknown> | null> = {
      [`groups/legacy-ah-${tag}`]: { status: 'active', allowMemberChallenges: false },
      [`groupMembers/legacy-ah-${tag}_ah-uid-${tag}`]: { status: 'active', role: 'member' },
      [`groupMembers/legacy-ah-${tag}_ah-steward-${tag}`]: { status: 'active', role: 'owner' },
    };
    const reader = {
      async getDocument(collection: string, docId: string) {
        const data = docs[`${collection}/${docId}`];
        return { exists: data != null, data: () => data ?? undefined };
      },
    };
    const authority = createFirestoreChallengeCreationAuthority(db, reader);

    const denied = await authority.resolveChallengeCreationAuthority(groupId, memberId);
    expect(denied).toMatchObject({ permitted: false, reason: 'charter_restricted', memberRole: 'member' });

    const allowed = await authority.resolveChallengeCreationAuthority(groupId, stewardId);
    expect(allowed).toMatchObject({ permitted: true, memberRole: 'owner' });
  });

  it('missing group returns null; inactive group, non-member, and removed member denied', async () => {
    const db = testDb();
    const tag = `an${(seq += 1)}`;
    const memberId = await seedMember(db, `an-uid-${tag}`);
    const outsiderId = await seedMember(db, `an-out-${tag}`);
    const removedId = await seedMember(db, `an-rem-${tag}`);
    const groupId = await seedGroup(db, { legacyId: `legacy-an-${tag}`, name: `Adapter ${tag}` });
    const docs: Record<string, Record<string, unknown> | null> = {
      [`groups/legacy-an-${tag}`]: { status: 'active' },
      [`groupMembers/legacy-an-${tag}_an-uid-${tag}`]: { status: 'active', role: 'member' },
      [`groupMembers/legacy-an-${tag}_an-rem-${tag}`]: { status: 'left', role: 'member' },
    };
    const reader = {
      async getDocument(collection: string, docId: string) {
        const data = docs[`${collection}/${docId}`];
        return { exists: data != null, data: () => data ?? undefined };
      },
    };
    const authority = createFirestoreChallengeCreationAuthority(db, reader);

    expect(await authority.resolveChallengeCreationAuthority(groupId, memberId)).toMatchObject({
      permitted: true,
    });
    expect(await authority.resolveChallengeCreationAuthority(groupId, outsiderId)).toMatchObject({
      permitted: false,
      reason: 'no_membership',
    });
    expect(await authority.resolveChallengeCreationAuthority(groupId, removedId)).toMatchObject({
      permitted: false,
      reason: 'membership_inactive',
    });
    // Group row without a legacy mapping (or with a missing Firestore doc) → null.
    const unmapped = await seedGroup(db, { name: `Unmapped ${tag}` });
    expect(await authority.resolveChallengeCreationAuthority(unmapped, memberId)).toBeNull();
    // Inactive group lifecycle denies even eligible members.
    docs[`groups/legacy-an-${tag}`] = { status: 'archived' };
    expect(await authority.resolveChallengeCreationAuthority(groupId, memberId)).toMatchObject({
      permitted: false,
      reason: 'group_inactive',
    });
  });

  it('authority outage throws so callers fail closed', async () => {
    const db = testDb();
    const tag = `ao${(seq += 1)}`;
    const memberId = await seedMember(db, `ao-uid-${tag}`);
    const groupId = await seedGroup(db, { legacyId: `legacy-ao-${tag}`, name: `Adapter ${tag}` });
    const reader = {
      async getDocument(): Promise<never> {
        throw new Error('firestore down');
      },
    };
    const authority = createFirestoreChallengeCreationAuthority(db, reader);
    await expect(authority.resolveChallengeCreationAuthority(groupId, memberId)).rejects.toThrow(
      'firestore down',
    );
  });
});

function appFor(w: World, decide: (groupId: string, memberId: string) => Decision) {
  return buildApp({
    db: testDb(),
    verifier: stubVerifier(tokensFor(w)),
    groupMutation: { store: unusedStore() },
    challengeCreation: {
      creationAuthority: fakeAuthority(decide),
      eligibilityFor: async (kind, key) => createDbKnowledgeEligibilityResolver(testDb(), kind)(key),
    },
  });
}

function validBody(w: World, overrides: Record<string, unknown> = {}) {
  return {
    group_id: w.groupId,
    challenge_type: 'collective',
    title: 'Governed collective',
    start_date: '2026-06-01',
    end_date: '2026-06-30',
    goal_value: 1000,
    goal_unit: 'reps',
    activities: [
      {
        activity_kind: 'fitness',
        canonical_key: w.knowledgeName,
        metric: 'repetitions',
        target_value: 20,
        unit: 'reps',
      },
    ],
    activate: true,
    join_creator: true,
    ...overrides,
  };
}

async function challengeRowCount(): Promise<number> {
  const result = await testDb().query<{ count: string }>(`SELECT COUNT(*) AS count FROM challenges`);
  return Number(result.rows[0].count);
}

async function allRowCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const table of [
    'challenges',
    'challenge_config_versions',
    'challenge_activity_configs',
    'challenge_participations',
    'challenge_establishment_keys',
  ]) {
    const result = await testDb().query<{ count: string }>(`SELECT COUNT(*) AS count FROM ${table}`);
    out[table] = Number(result.rows[0].count);
  }
  return out;
}
