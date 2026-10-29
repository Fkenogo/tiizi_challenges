/**
 * TIIZI-FER-P1C-001 — authorized member display names (R2 privacy matrix).
 *
 * The canonical members.display_name is projected ONLY where the viewer is
 * already authorized to see the member: the Group roster (active members), and
 * Together / Race entries for a viewer who is CURRENTLY eligible in the hosting
 * Group (current and finalized). It is a presentation projection — never an
 * identity authority — and never exposes email, authentication ids or previous
 * names. NULL names stay null (the UI shows a neutral label).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { activateChallenge, createChallenge, type ChallengeCreationResolvers, type NewChallengeInput } from '../src/challenges.js';
import { applyChallengeActivity } from '../src/challengeActivityApplication.js';
import { finalizeChallenge } from '../src/challengeFinalization.js';
import { getChallengeContributors, getChallengeLeaderboard } from '../src/challengeReads.js';
import type { GroupMembershipAuthority } from '../src/groupMembershipAuthority.js';
import { authHeaders, buildTestApp, seedGroup, seedMember, seedMembership, stubEligibility, testDb } from './helpers.js';
import type { Db } from '../src/db.js';

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_social_cause_decisions, challenge_social_causes, challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events, activity_submission_intents, challenge_finalizations, challenge_participation_finals',
  );
});

let seq = 0;
const next = (prefix: string): string => `${prefix}-${(seq += 1)}`;
const setName = (db: Db, memberId: string, name: string | null) => db.query('UPDATE members SET display_name = $2 WHERE member_id = $1', [memberId, name]);
const subject = async (db: Db, memberId: string) => (await db.query<{ auth_subject: string }>('SELECT auth_subject FROM members WHERE member_id=$1', [memberId])).rows[0].auth_subject;
const LEAK = /email|phone|photo|avatar|@|auth_subject|authSubject|firebase/i;

describe('P1c Group roster names', () => {
  it('active members and the Steward see current display names; NULL stays null; no email, auth id or previous name', async () => {
    const db = testDb();
    const steward = await seedMember(db, next('p1c-steward')); const member = await seedMember(db, next('p1c-member')); const unnamed = await seedMember(db, next('p1c-unnamed'));
    const stewardUid = await subject(db, steward); const memberUid = await subject(db, member); const unnamedUid = await subject(db, unnamed);
    await setName(db, steward, 'Wanjiru Steward'); await setName(db, member, 'Old Name'); await setName(db, member, 'Amani Member');
    const app = buildTestApp({ steward: stewardUid, member: memberUid, unnamed: unnamedUid });
    const group = (await app.inject({ method: 'POST', url: '/api/groups', headers: authHeaders('steward'), payload: { name: 'P1c crew' } })).json() as { id: string };
    await seedMembership(db, group.id, member, { status: 'active' }); await seedMembership(db, group.id, unnamed, { status: 'active' });
    for (const viewer of ['steward', 'member', 'unnamed']) {
      const response = await app.inject({ method: 'GET', url: `/api/groups/${group.id}/members`, headers: authHeaders(viewer) });
      expect(response.statusCode).toBe(200);
      const body = response.json() as { members: Array<{ memberId: string; displayName: string | null; relationship: string }> };
      const byId = new Map(body.members.map((row) => [row.memberId, row]));
      expect(byId.get(steward)).toMatchObject({ displayName: 'Wanjiru Steward', relationship: 'steward' });
      expect(byId.get(member)?.displayName).toBe('Amani Member');
      expect(byId.get(unnamed)?.displayName).toBeNull();
      const encoded = JSON.stringify(body);
      expect(encoded).not.toContain('Old Name');
      for (const uid of [stewardUid, memberUid, unnamedUid]) expect(encoded).not.toContain(uid);
      expect(encoded).not.toMatch(LEAK);
      expect(Object.keys(body.members[0]).sort()).toEqual(['displayName', 'joinedAt', 'memberId', 'relationship']);
    }
  });

  it('pending applicant, outsider and ended member are denied with no name leakage; only the Steward reads applicant names', async () => {
    const db = testDb();
    const steward = await seedMember(db, next('p1c-s2')); const member = await seedMember(db, next('p1c-m2')); const pending = await seedMember(db, next('p1c-pend'));
    const outsider = await seedMember(db, next('p1c-out')); const ended = await seedMember(db, next('p1c-ended'));
    const uids: Record<string, string> = {};
    for (const [key, id] of Object.entries({ steward, member, pending, outsider, ended })) uids[key] = await subject(db, id);
    await setName(db, steward, 'Hidden Steward'); await setName(db, member, 'Hidden Member'); await setName(db, pending, 'Pending Person'); await setName(db, ended, 'Ended Person');
    const app = buildTestApp(uids);
    const group = (await app.inject({ method: 'POST', url: '/api/groups', headers: authHeaders('steward'), payload: { name: 'Private crew', isPrivate: true, requireAdminApproval: true } })).json() as { id: string };
    await seedMembership(db, group.id, member, { status: 'active' });
    await seedMembership(db, group.id, pending, { status: 'pending' });
    await seedMembership(db, group.id, ended, { status: 'left' });
    for (const viewer of ['pending', 'outsider', 'ended']) {
      const response = await app.inject({ method: 'GET', url: `/api/groups/${group.id}/members`, headers: authHeaders(viewer) });
      expect(response.statusCode).toBe(404);
      expect(response.body).not.toMatch(/Hidden|Pending Person|Ended Person/);
    }
    const asSteward = await app.inject({ method: 'GET', url: `/api/groups/${group.id}/members/pending`, headers: authHeaders('steward') });
    expect(asSteward.json().applicants).toEqual([expect.objectContaining({ memberId: pending, displayName: 'Pending Person' })]);
    for (const viewer of ['member', 'pending', 'outsider', 'ended']) {
      const denied = await app.inject({ method: 'GET', url: `/api/groups/${group.id}/members/pending`, headers: authHeaders(viewer) });
      expect([403, 404]).toContain(denied.statusCode);
      expect(denied.body).not.toMatch(/Pending Person/);
    }
  });

  it('outsider discovery contexts carry no member names', async () => {
    const db = testDb();
    const steward = await seedMember(db, next('p1c-ds')); const viewer = await seedMember(db, next('p1c-dv'));
    await setName(db, steward, 'Discoverable Steward Name');
    const app = buildTestApp({ steward: await subject(db, steward), viewer: await subject(db, viewer) });
    await app.inject({ method: 'POST', url: '/api/groups', headers: authHeaders('steward'), payload: { name: 'Open for discovery' } });
    for (const url of ['/api/groups/discover', '/api/challenges/discover']) {
      const response = await app.inject({ method: 'GET', url, headers: authHeaders('viewer') });
      expect(response.body).not.toContain('Discoverable Steward Name');
      expect(response.body).not.toContain('displayName');
    }
  });
});

interface Pin { knowledge_id: string; current_version: number }

async function fixture(type: 'collective' | 'competitive') {
  const db = testDb();
  const tag = next('p1c-ch');
  const groupId = await seedGroup(db, { name: `P1C ${tag}` });
  const people = {
    viewer: await seedMember(db, `${tag}-viewer`), named: await seedMember(db, `${tag}-named`), unnamed: await seedMember(db, `${tag}-unnamed`),
    exited: await seedMember(db, `${tag}-exited`), outsider: await seedMember(db, `${tag}-outsider`),
  };
  await setName(db, people.viewer, 'Viewer Vee'); await setName(db, people.named, 'Nia Named'); await setName(db, people.exited, 'Exit Ed');
  for (const id of [people.viewer, people.named, people.unnamed]) await seedMembership(db, groupId, id, { status: 'active' });
  const kn = await db.query<{ knowledge_id: string; current_version: number }>(`INSERT INTO knowledge_items (kind, name, lifecycle) VALUES ('fitness', $1, 'published') RETURNING knowledge_id, current_version`, [`push-up-${tag}`]);
  const pin: Pin = { knowledge_id: String(kn.rows[0].knowledge_id), current_version: Number(kn.rows[0].current_version) };
  const resolvers: ChallengeCreationResolvers = {
    resolveKnowledgePin: async () => pin, resolveKnowledgeEligibility: async () => stubEligibility(),
    resolveGroupAuthority: async () => ({ status: 'active' }), resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
  };
  const { challenge } = await createChallenge(db, {
    group_id: groupId, created_by_member_id: people.viewer, title: `P1C ${tag}`, start_date: '2026-06-01', end_date: '2026-06-30', challenge_type: type,
    ...(type === 'collective' ? { goal_value: 100, goal_unit: 'reps' } : {}),
    activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: type === 'collective' ? 20 : 50, unit: 'reps' }],
  } as NewChallengeInput, resolvers);
  await activateChallenge(db, challenge.challenge_id);
  const eligible = new Set([people.viewer, people.named, people.unnamed]);
  for (const id of [people.viewer, people.named, people.unnamed, people.exited]) {
    await db.query(`INSERT INTO challenge_participations (challenge_id, member_id, status, joined_at, joined_config_version) VALUES ($1,$2,$3,'2026-06-01T00:00:00Z',1)`, [challenge.challenge_id, id, id === people.exited ? 'withdrawn' : 'active']);
  }
  let n = 0;
  for (const id of [people.viewer, people.named, people.unnamed]) {
    n += 1;
    const occurred = new Date(`2026-06-1${n}T12:00:00Z`);
    await applyChallengeActivity(db, id, challenge.challenge_id,
      { activity_kind: 'fitness', canonical_key: 'push-up', value: 50, unit: 'reps', occurred_at: occurred, client_key: next('k') },
      { resolveKnowledgePin: async () => pin, resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }) }, { now: occurred });
  }
  const authority: GroupMembershipAuthority = {
    resolveGroupMembershipAuthority: async (_group: string, memberId: string) => (eligible.has(memberId) ? { status: 'active', eligible: true } : { status: 'no_membership', eligible: false }),
  };
  return { db, people, challengeId: challenge.challenge_id, deps: { groupMembershipAuthority: authority } };
}

const nameOf = (entries: Array<{ memberId: string; displayName: string | null }>, memberId: string) => entries.find((entry) => entry.memberId === memberId)?.displayName;

describe('P1c Together / Race participant names', () => {
  for (const type of ['collective', 'competitive'] as const) {
    const read = (fx: Awaited<ReturnType<typeof fixture>>, viewer: string) => type === 'collective'
      ? getChallengeContributors(fx.db, viewer, fx.challengeId, fx.deps).then((r) => r.contributors)
      : getChallengeLeaderboard(fx.db, viewer, fx.challengeId, fx.deps).then((r) => r.entries);

    it(`${type}: a currently eligible member sees names; NULL is null; no email, auth id or previous name`, async () => {
      const fx = await fixture(type);
      await setName(fx.db, fx.people.named, 'Previous Nia'); await setName(fx.db, fx.people.named, 'Nia Named');
      const entries = await read(fx, fx.people.viewer);
      expect(nameOf(entries, fx.people.named)).toBe('Nia Named');
      expect(nameOf(entries, fx.people.viewer)).toBe('Viewer Vee');
      expect(nameOf(entries, fx.people.unnamed)).toBeNull();
      const encoded = JSON.stringify(entries);
      expect(encoded).not.toContain('Previous Nia');
      expect(encoded).not.toMatch(LEAK);
      expect(encoded).not.toContain(await subject(fx.db, fx.people.named));
    });

    it(`${type}: a member whose Group access ended keeps their own history view but sees no names`, async () => {
      const fx = await fixture(type);
      const entries = await read(fx, fx.people.exited);
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) expect(entry.displayName).toBeNull();
      expect(JSON.stringify(entries)).not.toMatch(/Nia Named|Viewer Vee|Exit Ed/);
    });

    it(`${type}: an outsider with no history is refused and no name is disclosed`, async () => {
      const fx = await fixture(type);
      await expect(read(fx, fx.people.outsider)).rejects.toMatchObject({ statusCode: 404 });
    });

    it(`${type}: finalized results keep names for eligible viewers and withhold them otherwise; a cleared (anonymized) name falls back`, async () => {
      const fx = await fixture(type);
      await finalizeChallenge(fx.db, fx.challengeId, new Date('2026-07-05T00:00:00Z'));
      const eligibleView = await read(fx, fx.people.viewer);
      expect(nameOf(eligibleView, fx.people.named)).toBe('Nia Named');
      const exitedView = await read(fx, fx.people.exited);
      for (const entry of exitedView) expect(entry.displayName).toBeNull();
      await setName(fx.db, fx.people.named, null);
      expect(nameOf(await read(fx, fx.people.viewer), fx.people.named)).toBeNull();
    });
  }
});
