/**
 * TIIZI-FER-P2-001 — preference-based discovery ordering and the
 * Challenge -> hosting Group -> Challenge journey.
 *
 * Preferences ORDER the already-authorized discoverable set. They never
 * filter, gate, join, enroll, or touch Challenge scoring.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { activateChallenge, createChallenge, type ChallengeCreationResolvers, type NewChallengeInput } from '../src/challenges.js';
import type { Db } from '../src/db.js';
import { createPostgresGroupMembershipAuthority } from '../src/postgresGroupAuthority.js';
import { MEMBER_INTEREST_OPTIONS } from '../src/memberPreferences.js';
import { authHeaders, buildTestApp, seedGroup, seedMember, seedMembership, stubEligibility, testDb } from './helpers.js';

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE member_preference_events, member_preferences, challenge_social_cause_decisions, challenge_social_causes, challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events, activity_submission_intents, challenge_finalizations, challenge_participation_finals',
  );
});

function appFor(tokens: Record<string, string>, db: Db = testDb()) {
  const authority = createPostgresGroupMembershipAuthority(db);
  return buildTestApp(tokens, {
    db,
    challengeActivity: { groupMembershipAuthority: authority },
    participation: { groupMembershipAuthority: authority },
  });
}

let seq = 0;
const tag = () => `p2-${(seq += 1)}`;
const idFor = (label: string) => MEMBER_INTEREST_OPTIONS.find((o) => o.label === label)!.id;

async function putPrefs(app: ReturnType<typeof appFor>, token: string, body: Record<string, string[]>) {
  const res = await app.inject({ method: 'PUT', url: '/api/me/preferences', headers: authHeaders(token), payload: body });
  expect(res.statusCode).toBe(200);
}

async function makeGroup(
  db: Db,
  name: string,
  options: { focusTags?: string[]; goalIds?: string[]; approval?: boolean; isPrivate?: boolean; stewardId?: string; ageSeconds?: number } = {},
): Promise<string> {
  const groupId = await seedGroup(db, { name, isPrivate: options.isPrivate ?? false });
  await db.query(
    `UPDATE groups SET focus_tags=$2::text[], goal_ids=$3::text[], require_admin_approval=$4,
       created_at = now() - make_interval(secs => $5::int) WHERE group_id=$1`,
    [groupId, options.focusTags ?? [], options.goalIds ?? [], options.approval ?? false, options.ageSeconds ?? 0],
  );
  if (options.stewardId) {
    await seedMembership(db, groupId, options.stewardId, { role: 'owner', status: 'active' });
    await db.query(`UPDATE groups SET steward_member_id=$2 WHERE group_id=$1`, [groupId, options.stewardId]);
  }
  return groupId;
}

interface Pin { knowledge_id: string; current_version: number }

async function makeChallenge(db: Db, groupId: string, creatorId: string, kind: 'fitness' | 'wellness' = 'fitness', title = 'Challenge'): Promise<string> {
  const key = `act-${tag()}`;
  const item = await db.query<{ knowledge_id: string; current_version: number }>(
    `INSERT INTO knowledge_items (kind, name, lifecycle) VALUES ($1, $2, 'published') RETURNING knowledge_id, current_version`,
    [kind, key],
  );
  const pin: Pin = { knowledge_id: String(item.rows[0].knowledge_id), current_version: Number(item.rows[0].current_version) };
  const resolvers: ChallengeCreationResolvers = {
    resolveKnowledgePin: async () => pin,
    resolveKnowledgeEligibility: async () => stubEligibility(),
    resolveGroupAuthority: async () => ({ status: 'active' }),
    resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
  };
  const { challenge } = await createChallenge(db, {
    group_id: groupId, created_by_member_id: creatorId, title, challenge_type: 'collective',
    start_date: '2026-06-01', end_date: '2026-12-30', goal_value: 500, goal_unit: 'reps',
    activities: [{ canonical_key: key, metric: 'repetitions', target_value: 20, unit: 'reps' }],
  } as NewChallengeInput, resolvers);
  await activateChallenge(db, challenge.challenge_id);
  return challenge.challenge_id;
}

type G = { id: string; name: string; relevance: { interests: string[]; goals: string[] } };
const discover = async (app: ReturnType<typeof appFor>, token: string, qs = '') => {
  const res = await app.inject({ method: 'GET', url: `/api/groups/discover?limit=30${qs}`, headers: authHeaders(token) });
  expect(res.statusCode).toBe(200);
  return res.json() as { groups: G[]; nextCursor: string | null; ranking: { applied: boolean } };
};

describe('P2 Group discovery ordering', () => {
  async function fixture() {
    const db = testDb();
    const owner = await seedMember(db, 'p2-owner');
    for (const u of ['p2-strength', 'p2-sleep', 'p2-none', 'p2-unmatched']) await seedMember(db, u);
    // Oldest first so unranked order (newest first) is: Plain, Goal, Sleep, Strength.
    const strength = await makeGroup(db, 'Strength Club', { focusTags: ['Strength'], ageSeconds: 400 });
    const sleep = await makeGroup(db, 'Rest Circle', { focusTags: ['Sleep & Rest'], goalIds: ['improve_sleep'], ageSeconds: 300 });
    const goalOnly = await makeGroup(db, 'Habit Crew', { goalIds: ['build_strength'], ageSeconds: 200 });
    const plain = await makeGroup(db, 'Plain Walkers', { ageSeconds: 100 });
    const hidden = await makeGroup(db, 'Hidden', { isPrivate: true, focusTags: ['Strength'], ageSeconds: 50 });
    const ended = await makeGroup(db, 'Gone', { focusTags: ['Strength'], ageSeconds: 40 });
    await db.query(`UPDATE groups SET status='ended' WHERE group_id=$1`, [ended]);
    const app = appFor({ strength: 'p2-strength', sleep: 'p2-sleep', none: 'p2-none', unmatched: 'p2-unmatched', owner: 'p2-owner' });
    return { db, app, owner, ids: { strength, sleep, goalOnly, plain, hidden, ended } };
  }

  it('orders by saved preferences, differentiates Interests > Goals, and isolates members', async () => {
    const { app, ids } = await fixture();
    await putPrefs(app, 'strength', { interestIds: [idFor('Strength')], goalIds: ['build_strength'] });
    await putPrefs(app, 'sleep', { interestIds: [idFor('Sleep & Rest')], goalIds: ['improve_sleep'] });

    const a = await discover(app, 'strength');
    expect(a.ranking.applied).toBe(true);
    // Strength Club = interest(3); Habit Crew = goal(2); the rest score 0 (newest first).
    expect(a.groups.map((g) => g.id)).toEqual([ids.strength, ids.goalOnly, ids.plain, ids.sleep]);
    expect(a.groups[0].relevance).toEqual({ interests: ['Strength'], goals: [] });
    expect(a.groups[1].relevance).toEqual({ interests: [], goals: ['Build strength'] });

    const b = await discover(app, 'sleep');
    expect(b.groups[0].id).toBe(ids.sleep); // interest(3)+goal(2)
    expect(b.groups[0].relevance).toEqual({ interests: ['Sleep & Rest'], goals: ['Improve sleep'] });
    // Member isolation: a's order is unchanged after b saved.
    expect((await discover(app, 'strength')).groups.map((g) => g.id)).toEqual(a.groups.map((g) => g.id));
    await app.close();
  });

  it('never changes WHICH Groups are discoverable (exact set preservation)', async () => {
    const { app, ids } = await fixture();
    await putPrefs(app, 'strength', { interestIds: [idFor('Strength')], goalIds: ['build_strength'] });
    const ranked = await discover(app, 'strength');
    const general = await discover(app, 'strength', '&rank=general');
    const noPrefs = await discover(app, 'none');
    const set = (r: { groups: G[] }) => r.groups.map((g) => g.id).sort();
    expect(set(ranked)).toEqual(set(general));
    expect(set(ranked)).toEqual(set(noPrefs));
    expect(set(ranked)).toEqual([ids.strength, ids.sleep, ids.goalOnly, ids.plain].sort());
    expect(set(ranked)).not.toContain(ids.hidden);
    expect(set(ranked)).not.toContain(ids.ended);
    // Search narrows the same authorized set; ranking still only orders it.
    const searched = await discover(app, 'strength', '&q=strength');
    expect(searched.groups.map((g) => g.id)).toEqual([ids.strength, ids.goalOnly]);
    await app.close();
  });

  it('keeps general discovery for members with no or unmatched preferences', async () => {
    const { app, ids } = await fixture();
    const none = await discover(app, 'none');
    expect(none.ranking.applied).toBe(false);
    expect(none.groups.map((g) => g.id)).toEqual([ids.plain, ids.goalOnly, ids.sleep, ids.strength]);
    expect(none.groups.every((g) => g.relevance.interests.length === 0 && g.relevance.goals.length === 0)).toBe(true);

    await putPrefs(app, 'unmatched', { interestIds: [idFor('Nutrition & Hydration')], goalIds: [] });
    const unmatched = await discover(app, 'unmatched');
    expect(unmatched.groups.map((g) => g.id)).toEqual(none.groups.map((g) => g.id)); // same general order
    expect(unmatched.groups.every((g) => g.relevance.interests.length === 0)).toBe(true);

    const general = await discover(app, 'strength', '&rank=general');
    expect(general.ranking.applied).toBe(false);
    expect((await app.inject({ method: 'GET', url: '/api/groups/discover?rank=bogus', headers: authHeaders('none') })).statusCode).toBe(400);
    await app.close();
  });

  it('paginates the ranked order without gaps or duplicates', async () => {
    const { app, ids } = await fixture();
    await putPrefs(app, 'sleep', { interestIds: [idFor('Sleep & Rest')], goalIds: ['improve_sleep', 'build_strength'] });
    const walked: string[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 6; i += 1) {
      const res = await app.inject({ method: 'GET', url: `/api/groups/discover?limit=1${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, headers: authHeaders('sleep') });
      expect(res.statusCode).toBe(200);
      const page = res.json() as { groups: G[]; nextCursor: string | null };
      walked.push(...page.groups.map((g) => g.id));
      cursor = page.nextCursor;
      if (!cursor) break;
    }
    const full = (await discover(app, 'sleep')).groups.map((g) => g.id);
    expect(walked).toEqual(full);
    expect(new Set(walked).size).toBe(walked.length);
    expect(walked).toHaveLength(4);
    expect(walked[0]).toBe(ids.sleep);
    await app.close();
  });

  it('fails open when the preference read fails, and creates no membership', async () => {
    const { db, app, ids } = await fixture();
    await putPrefs(app, 'strength', { interestIds: [idFor('Strength')], goalIds: [] });
    const failing: Db = {
      query: (text: string, params?: unknown[]) =>
        /member_preferences/.test(text) ? Promise.reject(new Error('preferences down')) : db.query(text, params),
      transaction: (fn) => db.transaction(fn),
      close: () => db.close(),
    } as Db;
    const broken = appFor({ strength: 'p2-strength' }, failing);
    const res = await broken.inject({ method: 'GET', url: '/api/groups/discover?limit=30', headers: authHeaders('strength') });
    expect(res.statusCode).toBe(200);
    expect(res.json().ranking.applied).toBe(false);
    expect(res.json().groups.map((g: G) => g.id)).toEqual([ids.plain, ids.goalOnly, ids.sleep, ids.strength]);
    const memberships = await db.query(`SELECT count(*)::int AS n FROM group_memberships`);
    expect((memberships.rows[0] as { n: number }).n).toBe(0);
    const participations = await db.query(`SELECT count(*)::int AS n FROM challenge_participations`);
    expect((participations.rows[0] as { n: number }).n).toBe(0);
    await broken.close(); await app.close();
  });
});

describe('P2 Challenge discovery and the Group-join journey', () => {
  type C = {
    challengeId: string; title: string; groupId: string;
    host: { groupId: string; admissionMode: string; viewerRelationship: string };
    relevance: { interests: string[]; goals: string[]; domains: string[] };
    collectiveTotal: number; myParticipation: unknown;
  };
  const challenges = async (app: ReturnType<typeof appFor>, token: string, qs = '') => {
    const res = await app.inject({ method: 'GET', url: `/api/challenges/discover${qs}`, headers: authHeaders(token) });
    expect(res.statusCode).toBe(200);
    return res.json() as { challenges: C[]; ranking: { applied: boolean } };
  };

  async function fixture() {
    const db = testDb();
    const steward = await seedMember(db, 'p2c-steward');
    const viewer = await seedMember(db, 'p2c-viewer');
    await seedMember(db, 'p2c-other');
    const strengthGroup = await makeGroup(db, 'Strength Group', { focusTags: ['Strength'], stewardId: steward, ageSeconds: 300 });
    const goalGroup = await makeGroup(db, 'Goal Group', { goalIds: ['improve_sleep'], stewardId: steward, ageSeconds: 200 });
    const wellnessGroup = await makeGroup(db, 'Wellness Group', { stewardId: steward, approval: true, ageSeconds: 100 });
    const privateGroup = await makeGroup(db, 'Private Group', { isPrivate: true, focusTags: ['Strength'], stewardId: steward });
    const cStrength = await makeChallenge(db, strengthGroup, steward, 'fitness', 'Strength Challenge');
    const cGoal = await makeChallenge(db, goalGroup, steward, 'fitness', 'Goal Challenge');
    const cWellness = await makeChallenge(db, wellnessGroup, steward, 'wellness', 'Wellness Challenge');
    const cPrivate = await makeChallenge(db, privateGroup, steward, 'fitness', 'Private Challenge');
    const app = appFor({ steward: 'p2c-steward', viewer: 'p2c-viewer', other: 'p2c-other' });
    return { db, app, steward, viewer, groups: { strengthGroup, goalGroup, wellnessGroup, privateGroup }, c: { cStrength, cGoal, cWellness, cPrivate } };
  }

  it('lists only Challenges of discoverable Groups, with outsider projection and host admission', async () => {
    const { app, c } = await fixture();
    const res = await challenges(app, 'viewer');
    expect(res.ranking.applied).toBe(false);
    expect(res.challenges.map((x) => x.challengeId).sort()).toEqual([c.cStrength, c.cGoal, c.cWellness].sort());
    expect(res.challenges.map((x) => x.challengeId)).not.toContain(c.cPrivate);
    expect(res.challenges.every((x) => x.myParticipation === null)).toBe(true);
    const wellness = res.challenges.find((x) => x.challengeId === c.cWellness)!;
    expect(wellness.host).toMatchObject({ admissionMode: 'approval', viewerRelationship: 'none' });
    expect(JSON.stringify(res)).not.toMatch(/inviteCode|firebase|legacy/i);
    await app.close();
  });

  it('orders by Group Interests > Group Goals > activity domain, preserving the exact set', async () => {
    const { app, c } = await fixture();
    await putPrefs(app, 'viewer', { interestIds: [idFor('Strength'), idFor('Sleep & Rest')], goalIds: ['improve_sleep'] });
    const ranked = await challenges(app, 'viewer');
    expect(ranked.ranking.applied).toBe(true);
    // Strength Group: interest(3)+fitness domain(1)=4; Goal Group: goal(2)+fitness domain(1)=3;
    // Wellness Group: wellness domain(1) via the Sleep & Rest interest.
    expect(ranked.challenges.map((x) => x.challengeId)).toEqual([c.cStrength, c.cGoal, c.cWellness]);
    expect(ranked.challenges[0].relevance).toEqual({ interests: ['Strength'], goals: [], domains: ['fitness'] });
    expect(ranked.challenges[1].relevance.goals).toEqual(['Improve sleep']);
    const general = await challenges(app, 'viewer', '?rank=general');
    expect(general.ranking.applied).toBe(false);
    expect(general.challenges.map((x) => x.challengeId).sort()).toEqual(ranked.challenges.map((x) => x.challengeId).sort());
    // Scoring truth is identical with and without ranking.
    for (const r of ranked.challenges) {
      const g = general.challenges.find((x) => x.challengeId === r.challengeId)!;
      expect(r.collectiveTotal).toBe(g.collectiveTotal);
    }
    expect((await app.inject({ method: 'GET', url: '/api/challenges/discover?rank=bogus', headers: authHeaders('viewer') })).statusCode).toBe(400);
    // Different member, different preferences, different order; no cross-effect.
    await putPrefs(app, 'other', { interestIds: [idFor('Mind & Emotional Wellbeing')], goalIds: [] });
    expect((await challenges(app, 'other')).challenges[0].challengeId).toBe(c.cWellness);
    expect((await challenges(app, 'viewer')).challenges[0].challengeId).toBe(c.cStrength);
    await app.close();
  });

  it('keeps general discovery for empty and unmatched preferences and creates nothing', async () => {
    const { db, app, c } = await fixture();
    const base = await challenges(app, 'viewer');
    await putPrefs(app, 'viewer', { interestIds: [idFor('Nutrition & Hydration')], goalIds: [] });
    const unmatched = await challenges(app, 'viewer');
    // No Group Interest/Goal matches; only the weakest signal (a Wellness interest
    // vs a Wellness activity) can move one Challenge. The set is unchanged.
    expect([...unmatched.challenges.map((x) => x.challengeId)].sort()).toEqual([...base.challenges.map((x) => x.challengeId)].sort());
    expect(unmatched.challenges.every((x) => x.relevance.interests.length === 0 && x.relevance.goals.length === 0)).toBe(true);
    expect(unmatched.challenges.map((x) => x.challengeId).slice(1)).toEqual(base.challenges.map((x) => x.challengeId).filter((id) => id !== c.cWellness));
    expect(unmatched.challenges[0].challengeId).toBe(c.cWellness);
    expect(unmatched.challenges.length).toBe(3);
    expect(Object.values(c)).toHaveLength(4);
    const m = await db.query(`SELECT count(*)::int AS n FROM group_memberships WHERE member_id = (SELECT member_id FROM members WHERE auth_subject='p2c-viewer')`);
    const p = await db.query(`SELECT count(*)::int AS n FROM challenge_participations`);
    expect((m.rows[0] as { n: number }).n).toBe(0);
    expect((p.rows[0] as { n: number }).n).toBe(0);
    await app.close();
  });

  it('open Group: join Group, then the Challenge leaves discovery and is visible; Challenge join stays separate', async () => {
    const { db, app, c, groups } = await fixture();
    const detailBefore = await app.inject({ method: 'GET', url: `/api/challenges/${c.cStrength}`, headers: authHeaders('viewer') });
    expect(detailBefore.statusCode).toBe(404);
    const join = await app.inject({ method: 'POST', url: `/api/groups/${groups.strengthGroup}/join`, headers: authHeaders('viewer'), payload: {} });
    expect(join.statusCode).toBe(200);
    expect(['active', 'joined']).toContain(join.json().status);
    // Group membership alone never enrolls.
    expect(((await db.query(`SELECT count(*)::int AS n FROM challenge_participations`)).rows[0] as { n: number }).n).toBe(0);
    expect((await challenges(app, 'viewer')).challenges.map((x) => x.challengeId)).not.toContain(c.cStrength);
    const detail = await app.inject({ method: 'GET', url: `/api/challenges/${c.cStrength}`, headers: authHeaders('viewer') });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().myParticipation).toBeNull();
    const joinChallenge = await app.inject({ method: 'POST', url: `/api/challenges/${c.cStrength}/join`, headers: authHeaders('viewer'), payload: {} });
    expect(joinChallenge.statusCode).toBe(200);
    expect(((await db.query(`SELECT count(*)::int AS n FROM challenge_participations`)).rows[0] as { n: number }).n).toBe(1);
    await app.close();
  });

  it('approval Group: pending stays discoverable as pending, never opens the Challenge, then approval returns it', async () => {
    const { db, app, c, groups, viewer } = await fixture();
    const join = await app.inject({ method: 'POST', url: `/api/groups/${groups.wellnessGroup}/join`, headers: authHeaders('viewer'), payload: {} });
    expect(join.statusCode).toBe(200);
    expect(join.json().status).toBe('pending');
    const listed = (await challenges(app, 'viewer')).challenges.find((x) => x.challengeId === c.cWellness)!;
    expect(listed.host.viewerRelationship).toBe('pending');
    // Pending is not entitlement: no detail, no Challenge join, no participation.
    expect((await app.inject({ method: 'GET', url: `/api/challenges/${c.cWellness}`, headers: authHeaders('viewer') })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: `/api/challenges/${c.cWellness}/join`, headers: authHeaders('viewer'), payload: {} })).statusCode).not.toBe(200);
    // Non-stewards cannot approve; the steward can.
    expect((await app.inject({ method: 'POST', url: `/api/groups/${groups.wellnessGroup}/applications/${viewer}/approve`, headers: authHeaders('other'), payload: {} })).statusCode).toBeGreaterThanOrEqual(400);
    const approve = await app.inject({ method: 'POST', url: `/api/groups/${groups.wellnessGroup}/applications/${viewer}/approve`, headers: authHeaders('steward'), payload: {} });
    expect(approve.statusCode).toBe(200);
    expect((await challenges(app, 'viewer')).challenges.map((x) => x.challengeId)).not.toContain(c.cWellness);
    const detail = await app.inject({ method: 'GET', url: `/api/challenges/${c.cWellness}`, headers: authHeaders('viewer') });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().myParticipation).toBeNull(); // approval never auto-enrolls
    expect(((await db.query(`SELECT count(*)::int AS n FROM challenge_participations`)).rows[0] as { n: number }).n).toBe(0);
    await app.close();
  });

  it('fails open when preferences cannot be read', async () => {
    const { db, c } = await fixture();
    const failing: Db = {
      query: (text: string, params?: unknown[]) =>
        /member_preferences/.test(text) ? Promise.reject(new Error('down')) : db.query(text, params),
      transaction: (fn) => db.transaction(fn),
      close: () => db.close(),
    } as Db;
    const app = appFor({ viewer: 'p2c-viewer' }, failing);
    const res = await app.inject({ method: 'GET', url: '/api/challenges/discover', headers: authHeaders('viewer') });
    expect(res.statusCode).toBe(200);
    expect(res.json().ranking.applied).toBe(false);
    expect(res.json().challenges).toHaveLength(3);
    expect(Object.keys(c)).toHaveLength(4);
    await app.close();
  });

  it('requires authentication', async () => {
    const app = appFor({});
    expect((await app.inject({ method: 'GET', url: '/api/challenges/discover' })).statusCode).toBe(401);
    await app.close();
  });
});
