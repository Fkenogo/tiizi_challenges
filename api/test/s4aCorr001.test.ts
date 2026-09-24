/**
 * TIIZI-S4A-CORR-001 — richer Group identity bounded-extension tests.
 *
 * Proves the five optional presentation-level fields (coverId, tagline,
 * location, focusTags, rules) over the REAL routes with an in-memory live
 * store standing in for Firestore:
 *
 * - governed values persist to live authority + PG shadow on creation;
 * - unknown cover ids, overlong strings, oversized arrays and mistyped
 *   fields fail closed with 400 (never persisted, never shadowed);
 * - `GET /v1/groups/:groupId` exposes them on the member projection and
 *   the pre-join-appropriate subset on the discoverable projection (rules
 *   stay member-only);
 * - `GET /v1/memberships/me` exposes the card set (cover/tagline/location/
 *   focusTags) with legacy-tolerant defaults;
 * - legacy live documents without the new fields read as empty/null
 *   (no crash, no fabrication);
 * - join re-sync keeps the richer mirror intact.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { GroupMutationStore } from '../src/groupMutations.js';
import type { GroupMembershipAuthority } from '../src/groupMembershipAuthority.js';
import {
  authHeaders,
  buildTestApp,
  seedMember,
  testDb,
} from './helpers.js';

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events, activity_submission_intents, challenge_finalizations, challenge_participation_finals',
  );
});

function fakeStore(): GroupMutationStore & {
  groups: Map<string, Record<string, unknown>>;
} {
  const groups = new Map<string, Record<string, unknown>>();
  const memberships = new Map<string, Record<string, unknown>>();
  let seq = 0;
  return {
    groups,
    async createGroupWithOwner(group, ownerUid, ownerMembership) {
      seq += 1;
      const id = `corr-${seq}`;
      groups.set(id, { ...group });
      memberships.set(`${id}_${ownerUid}`, { ...ownerMembership, groupId: id });
      return id;
    },
    async getGroup(legacyId) { return groups.get(legacyId) ?? null; },
    async updateGroupCounter(legacyId, delta) {
      const g = groups.get(legacyId);
      if (!g) throw new Error('missing');
      g.memberCount = Number(g.memberCount ?? 0) + delta;
    },
    async getMembership(legacyId, uid) { return memberships.get(`${legacyId}_${uid}`) ?? null; },
    async setMembership(legacyId, uid, data) { memberships.set(`${legacyId}_${uid}`, { ...data }); },
    async updateMembership(legacyId, uid, patch) {
      memberships.set(`${legacyId}_${uid}`, { ...memberships.get(`${legacyId}_${uid}`), ...patch });
    },
  };
}

const openAuthority: GroupMembershipAuthority = {
  resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
};

async function subjectFor(memberId: string): Promise<string> {
  const r = await testDb().query<{ auth_subject: string }>(
    `SELECT auth_subject FROM members WHERE member_id = $1`, [memberId],
  );
  return String(r.rows[0].auth_subject);
}

describe('corr-001 richer identity persists and validates', () => {
  it('creation persists cover/tagline/location/tags/rules to live authority, shadow, and reads', async () => {
    const db = testDb();
    const store = fakeStore();
    const memberId = await seedMember(db, 'corr-rich-owner');
    const subject = await subjectFor(memberId);
    const app = buildTestApp({ 't-corr': subject }, { groupMutation: { store }, challengeActivity: { groupMembershipAuthority: openAuthority } });
    const payload = {
      name: 'Rich Group',
      tagline: 'Dawn miles, honest logs.',
      location: 'Karura Forest',
      focusTags: ['Running', 'Wellness'],
      rules: ['Encourage every pace.'],
      coverId: 'cover-3',
    };
    const created = await app.inject({ method: 'POST', url: '/v1/groups', headers: authHeaders('t-corr'), payload });
    expect(created.statusCode).toBe(201);
    const createdBody = created.json() as { id: string; legacyId: string };
    const doc = store.groups.get(createdBody.legacyId)!;
    expect(doc).toMatchObject(payload);

    const detail = await app.inject({ method: 'GET', url: `/v1/groups/${createdBody.id}`, headers: authHeaders('t-corr') });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({ ...payload, viewerRelationship: 'steward' });

    const mine = await app.inject({ method: 'GET', url: '/v1/memberships/me', headers: authHeaders('t-corr') });
    expect(mine.statusCode).toBe(200);
    const groups = (mine.json() as { memberships: Array<{ group: Record<string, unknown> }> }).memberships;
    expect(groups).toHaveLength(1);
    expect(groups[0].group).toMatchObject({
      coverId: 'cover-3',
      tagline: 'Dawn miles, honest logs.',
      location: 'Karura Forest',
      focusTags: ['Running', 'Wellness'],
    });
  });

  it('unknown cover ids, overlong strings, oversized arrays and mistypes fail closed', async () => {
    const db = testDb();
    const store = fakeStore();
    const memberId = await seedMember(db, 'corr-reject-owner');
    const subject = await subjectFor(memberId);
    const app = buildTestApp({ 't-corr': subject }, { groupMutation: { store }, challengeActivity: { groupMembershipAuthority: openAuthority } });
    const cases: Array<Record<string, unknown>> = [
      { name: 'Bad cover', coverId: 'https://evil.example/x.png' },
      { name: 'Bad cover 2', coverId: 'cover-9' },
      { name: 'Long tagline', tagline: 'x'.repeat(141) },
      { name: 'Long location', location: 'x'.repeat(121) },
      { name: 'Many tags', focusTags: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] },
      { name: 'Long tag', focusTags: ['x'.repeat(31)] },
      { name: 'Many rules', rules: ['1', '2', '3', '4', '5', '6'] },
      { name: 'Long rule', rules: ['x'.repeat(201)] },
      { name: 'Mistyped', tagline: 42 },
      { name: 'Mistyped tags', focusTags: 'Running' },
    ];
    for (const payload of cases) {
      const res = await app.inject({ method: 'POST', url: '/v1/groups', headers: authHeaders('t-corr'), payload });
      expect(res.statusCode).toBe(400);
    }
    expect(store.groups.size).toBe(0);
    const shadow = await db.query(`SELECT COUNT(*)::int AS n FROM groups`);
    expect(shadow.rows[0].n).toBe(0);
  });

  it('legacy documents and subset projections stay honest', async () => {
    const db = testDb();
    const store = fakeStore();
    const owner = await seedMember(db, 'corr-legacy-owner');
    const outsider = await seedMember(db, 'corr-legacy-out');
    const ownerSub = await subjectFor(owner);
    const outSub = await subjectFor(outsider);
    const app = buildTestApp(
      { 't-o': ownerSub, 't-x': outSub },
      { groupMutation: { store }, challengeActivity: { groupMembershipAuthority: openAuthority } },
    );
    const created = (await app.inject({ method: 'POST', url: '/v1/groups', headers: authHeaders('t-o'), payload: { name: 'Legacy Shaped' } })).json() as { id: string; legacyId: string };
    // Simulate a pre-extension live document: strip the new keys.
    const doc = store.groups.get(created.legacyId)!;
    delete doc.coverId; delete doc.tagline; delete doc.location; delete doc.focusTags; delete doc.rules;
    const full = await app.inject({ method: 'GET', url: `/v1/groups/${created.id}`, headers: authHeaders('t-o') });
    expect(full.statusCode).toBe(200);
    expect(full.json()).toMatchObject({
      coverId: null, tagline: '', location: '', focusTags: [], rules: [],
    });
    const subset = await app.inject({ method: 'GET', url: `/v1/groups/${created.id}`, headers: authHeaders('t-x') });
    expect(subset.statusCode).toBe(200);
    expect(subset.json()).toMatchObject({
      coverId: null, tagline: '', location: '', focusTags: [], rules: null,
    });
  });

  it('join re-sync preserves the richer mirror', async () => {
    const db = testDb();
    const store = fakeStore();
    const owner = await seedMember(db, 'corr-sync-owner');
    const joiner = await seedMember(db, 'corr-sync-joiner');
    const ownerSub = await subjectFor(owner);
    const joinerSub = await subjectFor(joiner);
    const app = buildTestApp(
      { 't-o': ownerSub, 't-j': joinerSub },
      { groupMutation: { store }, challengeActivity: { groupMembershipAuthority: openAuthority } },
    );
    const created = (await app.inject({
      method: 'POST', url: '/v1/groups', headers: authHeaders('t-o'),
      payload: { name: 'Sync Group', coverId: 'cover-5', tagline: 'Kept.', focusTags: ['Kept'] },
    })).json() as { id: string };
    const join = await app.inject({ method: 'POST', url: `/v1/groups/${created.id}/join`, headers: authHeaders('t-j'), payload: {} });
    expect(join.statusCode).toBe(200);
    const shadow = await db.query<{ cover_id: string | null; tagline: string }>(
      `SELECT cover_id, tagline FROM groups WHERE group_id = $1`, [created.id],
    );
    expect(shadow.rows[0]).toMatchObject({ cover_id: 'cover-5', tagline: 'Kept.' });
  });
});
