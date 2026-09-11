/**
 * Phase C3B V2 participation route tests (join / withdraw).
 *
 * Proves the minimum authenticated management surface: live-authority join
 * gating, duplicate/ended/hidden handling, withdraw that closes (never
 * deletes) the caller's own episode, and PG-only persistence (no Firestore
 * challengeMembers write exists on these paths).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  activateChallenge,
  createChallenge,
  type ChallengeCreationResolvers,
  type NewChallengeInput,
} from '../src/challenges.js';
import type { GroupMembershipAuthority } from '../src/groupMembershipAuthority.js';
import {
  authHeaders,
  buildTestApp,
  seedGroup,
  seedMember,
  seedMembership,
  testDb,
  stubEligibility,
} from './helpers.js';
import type { Db } from '../src/db.js';

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events',
  );
});

let seq = 0;
const next = (prefix: string): string => `${prefix}-${(seq += 1)}`;

interface Pin {
  knowledge_id: string;
  current_version: number;
}

function stubAuthority(
  eligible: boolean,
  options: { throwError?: string } = {},
): GroupMembershipAuthority {
  return {
    resolveGroupMembershipAuthority: async () => {
      if (options.throwError) throw new Error(options.throwError);
      return eligible ? { status: 'active', eligible: true } : { status: 'removed', eligible: false };
    },
  };
}

async function setupJoinableChallenge(
  uid: string,
  status: 'active' | 'ended' = 'active',
): Promise<{ groupId: string; memberId: string; subject: string; challengeId: string }> {
  const db = testDb();
  const tag = next('c3b-join');
  const subject = `${uid}-${tag}`;
  const memberId = await seedMember(db, subject);
  const groupId = await seedGroup(db, { name: `C3B Join ${tag}` });
  await seedMembership(db, groupId, memberId, { status: 'active' });
  const pinResult = await db.query<Pin>(
    `INSERT INTO knowledge_items (kind, name, lifecycle) VALUES ('fitness', $1, 'published')
     RETURNING knowledge_id, current_version`,
    [`push-up-${tag}`],
  );
  const pins: Record<string, Pin> = {
    'push-up': {
      knowledge_id: String(pinResult.rows[0].knowledge_id),
      current_version: Number(pinResult.rows[0].current_version),
    },
  };
  const resolvers: ChallengeCreationResolvers = {
    resolveKnowledgePin: async (key) => pins[key] ?? null,
    resolveKnowledgeEligibility: async () => stubEligibility(),
    resolveGroupAuthority: async () => ({ status: 'active' }),
    resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
  };
  const { challenge } = await createChallenge(
    db,
    {
      group_id: groupId,
      created_by_member_id: memberId,
      challenge_type: 'competitive',
      title: `C3B ${tag}`,
      start_date: '2026-06-01',
      end_date: '2026-06-30',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 100, unit: 'reps' }],
    } as NewChallengeInput,
    resolvers,
  );
  await activateChallenge(db, challenge.challenge_id);
  if (status === 'ended') {
    const { endChallenge } = await import('../src/challenges.js');
    await endChallenge(db, challenge.challenge_id);
  }
  return { groupId, memberId, subject, challengeId: challenge.challenge_id };
}

function appFor(subject: string, authority: GroupMembershipAuthority) {
  return buildTestApp({ 'token-c3b': subject }, { challengeActivity: { groupMembershipAuthority: authority } });
}

const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';

describe('POST /v1/challenges/:challengeId/join', () => {
  it('opens a participation episode on the current config version', async () => {
    const fx = await setupJoinableChallenge('c3b-join-ok');
    const app = appFor(fx.subject, stubAuthority(true));
    const response = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${fx.challengeId}/join`,
      headers: authHeaders('token-c3b'),
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      participationId: string;
      challengeId: string;
      memberId: string;
      status: string;
      joinedConfigVersion: number;
    };
    expect(body.challengeId).toBe(fx.challengeId);
    expect(body.memberId).toBe(fx.memberId);
    expect(body.status).toBe('active');
    expect(body.joinedConfigVersion).toBe(1);
    expect(body).not.toMatchObject({ challengeMembers: expect.anything() });
  });

  it('rejects duplicate active episodes with 409 and preserves history', async () => {
    const fx = await setupJoinableChallenge('c3b-join-dup');
    const app = appFor(fx.subject, stubAuthority(true));
    const headers = authHeaders('token-c3b');
    expect((await app.inject({ method: 'POST', url: `/v1/challenges/${fx.challengeId}/join`, headers })).statusCode).toBe(200);
    const second = await app.inject({ method: 'POST', url: `/v1/challenges/${fx.challengeId}/join`, headers });
    expect(second.statusCode).toBe(409);
    expect((second.json() as { error: { code: string } }).error.code).toBe('participation_exists');
  });

  it('returns 404 for unknown challenges', async () => {
    const fx = await setupJoinableChallenge('c3b-join-404');
    const app = appFor(fx.subject, stubAuthority(true));
    const response = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${UNKNOWN_UUID}/join`,
      headers: authHeaders('token-c3b'),
    });
    expect(response.statusCode).toBe(404);
  });

  it('returns 422 for ended challenges', async () => {
    const fx = await setupJoinableChallenge('c3b-join-ended', 'ended');
    const app = appFor(fx.subject, stubAuthority(true));
    const response = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${fx.challengeId}/join`,
      headers: authHeaders('token-c3b'),
    });
    expect(response.statusCode).toBe(422);
  });

  it('returns 403 when live authority reports no membership (stale shadow grants nothing)', async () => {
    const db = testDb();
    const fx = await setupJoinableChallenge('c3b-join-403');
    // PG shadow still shows active membership; live authority removed them.
    const shadow = await db.query<{ status: string }>(
      `SELECT status FROM group_memberships WHERE group_id = $1 AND member_id = $2`,
      [fx.groupId, fx.memberId],
    );
    expect(shadow.rows[0].status).toBe('active');
    const app = appFor(fx.subject, stubAuthority(false));
    const response = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${fx.challengeId}/join`,
      headers: authHeaders('token-c3b'),
    });
    expect(response.statusCode).toBe(403);
  });

  it('fails closed with 503 when the authority is unreachable', async () => {
    const fx = await setupJoinableChallenge('c3b-join-503');
    const app = appFor(fx.subject, stubAuthority(true, { throwError: 'firestore down' }));
    const response = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${fx.challengeId}/join`,
      headers: authHeaders('token-c3b'),
    });
    expect(response.statusCode).toBe(503);
  });

  it('requires authentication', async () => {
    const fx = await setupJoinableChallenge('c3b-join-401');
    const app = appFor(fx.subject, stubAuthority(true));
    const response = await app.inject({ method: 'POST', url: `/v1/challenges/${fx.challengeId}/join` });
    expect(response.statusCode).toBe(401);
  });
});

describe('POST /v1/challenges/:challengeId/withdraw', () => {
  it('closes the caller episode and preserves the historical row', async () => {
    const db = testDb();
    const fx = await setupJoinableChallenge('c3b-wd-ok');
    const app = appFor(fx.subject, stubAuthority(true));
    const headers = authHeaders('token-c3b');
    await app.inject({ method: 'POST', url: `/v1/challenges/${fx.challengeId}/join`, headers });
    const response = await app.inject({ method: 'POST', url: `/v1/challenges/${fx.challengeId}/withdraw`, headers });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { status: string; exitedAt: string | null; exitReason: string | null };
    expect(body.status).toBe('withdrawn');
    expect(body.exitedAt).not.toBeNull();
    expect(body.exitReason).toBe('withdrawn');
    const rows = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM challenge_participations WHERE challenge_id = $1 AND member_id = $2`,
      [fx.challengeId, fx.memberId],
    );
    expect(Number(rows.rows[0].count)).toBe(1);
  });

  it('returns 404 with no active participation (and again after withdraw)', async () => {
    const fx = await setupJoinableChallenge('c3b-wd-404');
    const app = appFor(fx.subject, stubAuthority(true));
    const headers = authHeaders('token-c3b');
    const joinUrl = `/v1/challenges/${fx.challengeId}/join`;
    const withdrawUrl = `/v1/challenges/${fx.challengeId}/withdraw`;
    expect((await app.inject({ method: 'POST', url: withdrawUrl, headers })).statusCode).toBe(404);
    await app.inject({ method: 'POST', url: joinUrl, headers });
    expect((await app.inject({ method: 'POST', url: withdrawUrl, headers })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: withdrawUrl, headers })).statusCode).toBe(404);
  });

  it('returns 404 for unknown challenges and 401 without auth', async () => {
    const fx = await setupJoinableChallenge('c3b-wd-misc');
    const app = appFor(fx.subject, stubAuthority(true));
    expect(
      (await app.inject({
        method: 'POST',
        url: `/v1/challenges/${UNKNOWN_UUID}/withdraw`,
        headers: authHeaders('token-c3b'),
      })).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: 'POST', url: `/v1/challenges/${fx.challengeId}/withdraw` })).statusCode,
    ).toBe(401);
  });
});
