import { describe, expect, it } from 'vitest';
import { activateChallenge, createChallenge, type ChallengeCreationResolvers } from '../src/challenges.js';
import { applyChallengeActivity } from '../src/challengeActivityApplication.js';
import { stubEligibility, authHeaders, buildTestApp, seedGroup, seedMember, seedMembership, testDb } from './helpers.js';
import { getTodayProjection } from '../src/today.js';
import type { Db } from '../src/db.js';
import type { GroupMembershipAuthority } from '../src/groupMembershipAuthority.js';

async function makeStreak(db: Db, memberId: string) {
  const groupId = await seedGroup(db, { name: 'Today Group' });
  await seedMembership(db, groupId, memberId, { status: 'active' });
  const pins = new Map<string, string>();
  for (const key of ['push-up', 'walk']) {
    const result = await db.query<{ knowledge_id: string; current_version: number }>(
      "INSERT INTO knowledge_items (kind,name,lifecycle) VALUES ('fitness',$1,'published') RETURNING knowledge_id,current_version", [key],
    );
    pins.set(key, String(result.rows[0].knowledge_id));
  }
  const resolvers: ChallengeCreationResolvers = {
    resolveKnowledgePin: async (key) => {
      const knowledge_id = pins.get(key);
      return knowledge_id ? { knowledge_id, current_version: 1 } : null;
    },
    resolveKnowledgeEligibility: async () => stubEligibility(),
    resolveGroupAuthority: async () => ({ status: 'active' }),
    resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
  };
  const { challenge } = await createChallenge(db, {
    group_id: groupId, created_by_member_id: memberId, title: 'Morning Streak',
    challenge_type: 'streak', start_date: '2026-06-01', end_date: '2026-06-30',
    required_consecutive_days: 10, timezone: 'Africa/Bujumbura',
    activities: [
      { canonical_key: 'push-up', metric: 'repetitions', target_value: 10, unit: 'reps' },
      { canonical_key: 'walk', metric: 'distance', target_value: 1, unit: 'kilometres' },
    ],
  }, resolvers);
  await activateChallenge(db, challenge.challenge_id);
  await db.query("INSERT INTO challenge_participations (challenge_id,member_id,status,joined_at,joined_config_version) VALUES ($1,$2,'active',$3,1)",
    [challenge.challenge_id, memberId, '2026-06-01T00:00:00Z']);
  const authority: GroupMembershipAuthority = { resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }) };
  await applyChallengeActivity(db, memberId, challenge.challenge_id, {
    activity_kind: 'fitness', canonical_key: 'push-up', value: 12, unit: 'reps',
    occurred_at: new Date('2026-06-10T12:00:00.000Z'), client_key: 'today-streak-log',
  }, { resolveKnowledgePin: async (key) => {
    const knowledge_id = pins.get(key);
    return knowledge_id ? { knowledge_id, current_version: 1 } : null;
  }, resolveGroupMembershipAuthority: authority.resolveGroupMembershipAuthority }, { now: new Date('2026-06-10T12:00:00.000Z') });
  return { challengeId: challenge.challenge_id, groupId };
}

describe('GET /v1/today S5a projection', () => {
  it('requires authentication', async () => {
    const app = buildTestApp({});
    const response = await app.inject({ method: 'GET', url: '/v1/today' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('returns a useful member-scoped zero state without fabricating unsupported capabilities', async () => {
    const db = testDb();
    const ownMember = await seedMember(db, 'today-own');
    const otherMember = await seedMember(db, 'today-other');
    const subject = await db.query<{ auth_subject: string }>(
      'SELECT auth_subject FROM members WHERE member_id = $1', [ownMember],
    );
    const app = buildTestApp({ 'today-token': String(subject.rows[0].auth_subject) });
    const response = await app.inject({ method: 'GET', url: '/v1/today', headers: authHeaders('today-token') });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.todayContext.activeChallengeCount).toBe(0);
    expect(body.requiredToday).toEqual([]);
    expect(body.joinedChallengeProgress).toEqual([]);
    expect(body.groupChallengeOpportunities).toEqual([]);
    expect(body.upcoming).toEqual([]);
    expect(body.finalizedResults).toEqual([]);
    expect(JSON.stringify(body)).not.toContain(otherMember);
    expect(body.unsupportedSections).toEqual({
      invitations: { available: false, disposition: 'deferred' },
      communityMoments: { available: false, disposition: 'deferred' },
      notifications: { available: false, disposition: 'deferred' },
    });
    expect(body).not.toHaveProperty('feed');
    expect(body).not.toHaveProperty('payment');
    expect(body).not.toHaveProperty('invitations');
    expect(body.projection.countdown).toBe('omitted_boundary_equivalence_unproven');
    await app.close();
  });

  it('projects required Streak Activities as completed or pending from accepted application truth', async () => {
    const db = testDb();
    const memberId = await seedMember(db, 'today-streak-member');
    const { challengeId, groupId } = await makeStreak(db, memberId);
    const result = await getTodayProjection(db, memberId, {
      now: () => new Date('2026-06-10T12:00:00.000Z'),
      groupMembershipAuthority: { resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }) },
    });
    expect(result.todayContext.activeChallengeCount).toBe(1);
    expect(result.requiredToday).toHaveLength(1);
    expect(result.requiredToday[0]).toMatchObject({ challengeId, governingToday: '2026-06-10', timezone: 'Africa/Bujumbura' });
    expect(result.requiredToday[0]?.requirements.map((item) => item.state)).toEqual(['completed', 'pending']);
    expect(result.requiredToday[0]?.streak.dayState).toMatchObject({ complete: false });
    expect(result.requiredToday[0]?.streak.currentStreak).toBe(0);
    expect(result.joinedChallengeProgress[0]?.challengeType).toBe('streak');
    expect(JSON.stringify(result)).not.toContain('missedYesterday');
    expect(result.groupChallengeOpportunities).toEqual([]); // already actively participating
    const contextualMember = await seedMember(db, 'today-context-member');
    await seedMembership(db, groupId, contextualMember, { status: 'active' });
    const contextual = await getTodayProjection(db, contextualMember, {
      now: () => new Date('2026-06-10T12:00:00.000Z'),
      groupMembershipAuthority: { resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }) },
    });
    expect(contextual.groupChallengeOpportunities).toHaveLength(1);
    expect(contextual.groupChallengeOpportunities[0]).toMatchObject({ challengeId, joinability: 'not_asserted' });
    expect(contextual.groupChallengeOpportunities[0]).not.toHaveProperty('canJoin');
    expect(JSON.stringify(contextual)).not.toContain(memberId);
  });
});
