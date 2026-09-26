/**
 * TIIZI-S4A-GROUP-CREATION-AND-HOME-001 — Group Home read-model acceptance tests.
 *
 * Proves the S4a Group read/write contracts over the real API routes and
 * PostgreSQL authority:
 *
 * A. Group creation persists the governed configuration (isPrivate,
 *    requireAdminApproval, allowMemberChallenges) to PostgreSQL.
 * B. The creator becomes the correct singular Accountable Steward / owner.
 * C. GET /v1/groups/:groupId returns canonical Group truth and leaks no
 *    Firebase UID, legacy id, owner attribution internals, or invite code.
 * D. The viewer membership relationship is server-derived (steward / member /
 *    pending / none) — never client-declared.
 * E. The member count is server-derived from live authority.
 * F. Unauthorized / non-visible Group reads fail closed (401 unauthenticated,
 *    404 unknown-or-invisible with no existence oracle, 503 store outage,
 *    503 PostgreSQL outage, 400 malformed id).
 * G. GET /v1/challenges?groupId= returns only genuine Challenges of that
 *    Group (entitled subset for members; EOG §9 discovery projection for
 *    public Groups; empty for private Groups to outsiders).
 * H. The existing unfiltered Challenge list behaviour is unchanged.
 * I. Existing Group join/leave/create behaviour is not regressed.
 * J. Existing S2/S3 Challenge behaviour remains green (full suite, validation).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  activateChallenge,
  createChallenge,
  type ChallengeCreationResolvers,
  type NewChallengeInput,
} from '../src/challenges.js';
import type { Db } from '../src/db.js';
import { createPostgresGroupMembershipAuthority } from '../src/postgresGroupAuthority.js';
import {
  authHeaders,
  buildTestApp,
  groupAuthorityUnavailableDb,
  seedGroup,
  seedMember,
  seedMembership,
  stubEligibility,
  testDb,
} from './helpers.js';

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events, activity_submission_intents, challenge_finalizations, challenge_participation_finals',
  );
});

function appFor(tokens: Record<string, string>, db: Db = testDb()) {
  return buildTestApp(tokens, { db, challengeActivity: { groupMembershipAuthority: createPostgresGroupMembershipAuthority(db) } });
}

interface CreatedGroup {
  id: string;
  legacyId: string;
  name: string;
  isPrivate: boolean;
  role: string;
  status: string;
}

async function subjectFor(db: Db, memberId: string): Promise<string> {
  const result = await db.query<{ auth_subject: string }>(
    `SELECT auth_subject FROM members WHERE member_id = $1`,
    [memberId],
  );
  return String(result.rows[0].auth_subject);
}

async function createViaApi(
  app: ReturnType<typeof buildTestApp>,
  token: string,
  body: Record<string, unknown>,
): Promise<CreatedGroup> {
  const res = await app.inject({ method: 'POST', url: '/v1/groups', headers: authHeaders(token), payload: body });
  expect(res.statusCode).toBe(201);
  return res.json() as CreatedGroup;
}

async function detailFor(
  app: ReturnType<typeof buildTestApp>,
  token: string,
  groupId: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await app.inject({
    method: 'GET',
    url: `/v1/groups/${groupId}`,
    headers: authHeaders(token),
  });
  return { status: res.statusCode, body: res.json() as Record<string, unknown> };
}

// ─── Challenge fixture (minimal governed establishment, S3c pattern) ─────────

interface Pin {
  knowledge_id: string;
  current_version: number;
}

let seq = 0;
const next = (prefix: string): string => `${prefix}-${(seq += 1)}`;

async function seedKnowledge(db: Db, name: string): Promise<Pin> {
  const result = await db.query<{ knowledge_id: string; current_version: number }>(
    `INSERT INTO knowledge_items (kind, name, lifecycle) VALUES ('fitness', $1, 'published')
     RETURNING knowledge_id, current_version`,
    [`${name}-${seq}`],
  );
  return {
    knowledge_id: String(result.rows[0].knowledge_id),
    current_version: Number(result.rows[0].current_version),
  };
}

function creationResolvers(pins: Record<string, Pin>): ChallengeCreationResolvers {
  return {
    resolveKnowledgePin: async (key) => pins[key] ?? null,
    resolveKnowledgeEligibility: async () => stubEligibility(),
    resolveGroupAuthority: async () => ({ status: 'active' }),
    resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
  };
}

async function setupGroupChallenge(groupId: string, memberId: string, tag: string): Promise<string> {
  const db = testDb();
  const pins: Record<string, Pin> = {};
  pins['push-up'] = await seedKnowledge(db, `s4a-${tag}`);
  const { challenge } = await createChallenge(
    db,
    {
      group_id: groupId,
      created_by_member_id: memberId,
      title: `S4A ${tag}`,
      start_date: '2026-09-01',
      end_date: '2026-09-30',
      challenge_type: 'collective',
      goal_value: 100,
      goal_unit: 'reps',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 10, unit: 'reps' }],
    } as NewChallengeInput,
    creationResolvers(pins),
  );
  await activateChallenge(db, challenge.challenge_id);
  return challenge.challenge_id;
}

describe('s4a comprehensive creation persists governed configuration (A)', () => {
  it('creation with all governed fields persists them to live authority and the detail read', async () => {
    const db = testDb();
    const memberId = await seedMember(db, `s4a-creator-${next('u')}`);
    const subject = await subjectFor(db, memberId);
    const app = appFor({ 'token-s4a': subject });

    const created = await createViaApi(app, 'token-s4a', {
      name: 'Karura Dawn Patrol',
      description: 'Sunrise miles before work.',
      isPrivate: true,
      requireAdminApproval: true,
      allowMemberChallenges: false,
    });
    expect(created.isPrivate).toBe(true);

    const persisted = await db.query<{ is_private: boolean; require_admin_approval: boolean; allow_member_challenges: boolean }>(
      `SELECT is_private, require_admin_approval, allow_member_challenges FROM groups WHERE group_id=$1`, [created.id],
    );
    expect(persisted.rows[0]).toEqual({ is_private: true, require_admin_approval: true, allow_member_challenges: false });

    const { status, body } = await detailFor(app, 'token-s4a', created.id);
    expect(status).toBe(200);
    expect(body).toMatchObject({
      id: created.id,
      name: 'Karura Dawn Patrol',
      description: 'Sunrise miles before work.',
      isPrivate: true,
      requireAdminApproval: true,
      allowMemberChallenges: false,
      memberCount: 1,
      viewerRelationship: 'steward',
    });
  });
});

describe('s4a creator becomes the singular Accountable Steward (B)', () => {
  it('steward attribution is server-resolved to the creator; no second steward exists', async () => {
    const db = testDb();
    const memberId = await seedMember(db, `s4a-steward-${next('u')}`);
    const subject = await subjectFor(db, memberId);
    const app = appFor({ 'token-s4a': subject });

    const created = await createViaApi(app, 'token-s4a', { name: 'Steward Group' });
    const { body } = await detailFor(app, 'token-s4a', created.id);
    expect(body.steward).toEqual({ memberId });
    expect(body.viewerRelationship).toBe('steward');
    expect(body.viewerMembership).toMatchObject({ status: 'active', role: 'owner' });

    // A second member joining never becomes steward.
    const joiner = await seedMember(db, `s4a-joiner-${next('u')}`);
    const joinerSubject = await subjectFor(db, joiner);
    const app2 = appFor(
      { 'token-s4a': subject, 'token-joiner': joinerSubject },
      testDb(),
    );
    const join = await app2.inject({
      method: 'POST',
      url: `/v1/groups/${created.id}/join`,
      headers: authHeaders('token-joiner'),
      payload: {},
    });
    expect(join.statusCode).toBe(200);
    const after = await detailFor(app2, 'token-joiner', created.id);
    expect(after.body.steward).toEqual({ memberId });
    expect(after.body.viewerRelationship).toBe('member');
    expect(after.body.viewerMembership).toMatchObject({ status: 'active', role: 'member' });
  });
});

describe('s4a detail returns canonical truth without internals (C)', () => {
  it('detail carries identity, settings, count, steward and timestamps — never provider internals', async () => {
    const db = testDb();
    const memberId = await seedMember(db, `s4a-canon-${next('u')}`);
    const subject = await subjectFor(db, memberId);
    const app = appFor({ 'token-s4a': subject });
    const created = await createViaApi(app, 'token-s4a', {
      name: 'Canonical Group',
      description: 'Purpose stated.',
    });
    const { status, body } = await detailFor(app, 'token-s4a', created.id);
    expect(status).toBe(200);
    expect(typeof body.createdAt).toBe('string');
    const raw = JSON.stringify(body);
    expect(raw).not.toContain(subject);
    for (const leaked of ['legacyId', 'ownerId', 'firebaseUid', 'inviteCode', 'moderationStatus']) {
      expect(body).not.toHaveProperty(leaked);
    }
  });
});

describe('s4a viewer relationship is server-derived (D) + count is live (E)', () => {
  it('member, pending and none relationships come from live authority; count tracks admissions', async () => {
    const db = testDb();
    const owner = await seedMember(db, `s4a-rel-owner-${next('u')}`);
    const ownerSubject = await subjectFor(db, owner);
    const app = appFor({ 'token-owner': ownerSubject });
    const open = await createViaApi(app, 'token-owner', { name: 'Open Group' });
    const gated = await createViaApi(app, 'token-owner', {
      name: 'Gated Group',
      requireAdminApproval: true,
    });

    const viewer = await seedMember(db, `s4a-rel-viewer-${next('u')}`);
    const viewerSubject = await subjectFor(db, viewer);
    const app2 = appFor(
      { 'token-owner': ownerSubject, 'token-viewer': viewerSubject },
      testDb(),
    );
    // Join the open group → active member; request the gated group → pending.
    expect((await app2.inject({ method: 'POST', url: `/v1/groups/${open.id}/join`, headers: authHeaders('token-viewer'), payload: {} })).statusCode).toBe(200);
    const pendingJoin = await app2.inject({ method: 'POST', url: `/v1/groups/${gated.id}/join`, headers: authHeaders('token-viewer'), payload: {} });
    expect(pendingJoin.statusCode).toBe(200);
    expect((pendingJoin.json() as { status: string }).status).toBe('pending');

    const asMember = await detailFor(app2, 'token-viewer', open.id);
    expect(asMember.body.viewerRelationship).toBe('member');
    expect(asMember.body.memberCount).toBe(2);

    // Pending viewer on a public gated group sees the discoverable subset + pending state.
    const asPending = await detailFor(app2, 'token-viewer', gated.id);
    expect(asPending.status).toBe(200);
    expect(asPending.body.viewerRelationship).toBe('pending');
    expect(asPending.body.requireAdminApproval).toBeNull();
    expect(asPending.body.steward).toBeNull();
  });
});

describe('s4a reads fail closed (F)', () => {
  async function setup() {
    const db = testDb();
    const owner = await seedMember(db, `s4a-fail-owner-${next('u')}`);
    const ownerSubject = await subjectFor(db, owner);
    const outsider = await seedMember(db, `s4a-fail-out-${next('u')}`);
    const outsiderSubject = await subjectFor(db, outsider);
    const app = appFor({ 'token-owner': ownerSubject, 'token-out': outsiderSubject });
    const open = await createViaApi(app, 'token-owner', { name: 'Fail Open' });
    const priv = await createViaApi(app, 'token-owner', { name: 'Fail Private', isPrivate: true });
    return { app, db, ownerSubject, outsiderSubject, open, priv };
  }

  it('unauthenticated reads are 401', async () => {
    const { app, open } = await setup();
    const res = await app.inject({ method: 'GET', url: `/v1/groups/${open.id}` });
    expect(res.statusCode).toBe(401);
  });

  it('unknown, private-to-outsider, inactive and malformed ids fail closed with no oracle', async () => {
    const { app, db, open, priv } = await setup();
    const unknownId = '11111111-1111-4111-8111-111111111111';
    const unknown = await detailFor(app, 'token-out', unknownId);
    expect(unknown.status).toBe(404);

    // Private Groups are invisible to outsiders: identical 404, no leak.
    const privOut = await detailFor(app, 'token-out', priv.id);
    expect(privOut.status).toBe(404);
    expect(JSON.stringify(privOut.body)).toBe(JSON.stringify(unknown.body));

    // Inactive Groups are invisible too.
    await db.query(`UPDATE groups SET status='suspended' WHERE group_id=$1`, [open.id]);
    const inactive = await detailFor(app, 'token-out', open.id);
    expect(inactive.status).toBe(404);

    const malformed = await detailFor(app, 'token-out', 'not-a-uuid');
    expect(malformed.status).toBe(400);
  });

  it('discoverable subset for public outsiders carries no internals', async () => {
    const { app, open } = await setup();
    const { status, body } = await detailFor(app, 'token-out', open.id);
    expect(status).toBe(200);
    expect(body.viewerRelationship).toBe('none');
    expect(body.viewerMembership).toBeNull();
    expect(body.requireAdminApproval).toBeNull();
    expect(body.allowMemberChallenges).toBeNull();
    expect(body.steward).toBeNull();
    expect(body.name).toBe('Fail Open');
  });

  it('PostgreSQL outage is 503, never an authorization or Firestore fallback', async () => {
    const { open, ownerSubject } = await setup();
    const app = appFor({ 'token-owner': ownerSubject }, groupAuthorityUnavailableDb());
    const { status, body } = await detailFor(app, 'token-owner', open.id);
    expect(status).toBe(503);
    expect(JSON.stringify(body)).toContain('group_store_unavailable');
  });
});

describe('s4a group-scoped Challenge list (G) + unfiltered list unchanged (H)', () => {
  async function setup() {
    const db = testDb();
    const owner = await seedMember(db, `s4a-ch-owner-${next('u')}`);
    const ownerSubject = await subjectFor(db, owner);
    const outsider = await seedMember(db, `s4a-ch-out-${next('u')}`);
    const outsiderSubject = await subjectFor(db, outsider);
    const app = appFor({ 'token-owner': ownerSubject, 'token-out': outsiderSubject });
    const home = await createViaApi(app, 'token-owner', { name: 'Home Group' });
    const away = await createViaApi(app, 'token-owner', { name: 'Away Private', isPrivate: true });
    const other = await createViaApi(app, 'token-owner', { name: 'Other Public' });
    const homeChallenge = await setupGroupChallenge(home.id, owner, 'home');
    const awayChallenge = await setupGroupChallenge(away.id, owner, 'away');
    const otherChallenge = await setupGroupChallenge(other.id, owner, 'other');
    // Owner is live-eligible in all three groups for the entitled path.
    const entitled = appFor(
      { 'token-owner': ownerSubject, 'token-out': outsiderSubject },
      testDb(),
    );
    return { app: entitled, ownerSubject, outsiderSubject, home, away, other, homeChallenge, awayChallenge, otherChallenge };
  }

  async function scoped(app: ReturnType<typeof buildTestApp>, token: string, groupId: string) {
    return app.inject({
      method: 'GET',
      url: `/v1/challenges?groupId=${groupId}`,
      headers: authHeaders(token),
    });
  }

  it('entitled members see only the requested Group genuinely scoped challenges', async () => {
    const { app, home, away, homeChallenge, awayChallenge, otherChallenge } = await setup();
    const res = await scoped(app, 'token-owner', home.id);
    expect(res.statusCode).toBe(200);
    const body = res.json() as { memberId: string; groupId: string; challenges: Array<{ challengeId: string; groupId: string }> };
    expect(body.groupId).toBe(home.id);
    expect(body.challenges.map((c) => c.challengeId)).toEqual([homeChallenge]);
    for (const challenge of body.challenges) expect(challenge.groupId).toBe(home.id);
    expect(body.challenges.map((c) => c.challengeId)).not.toContain(awayChallenge);
    expect(body.challenges.map((c) => c.challengeId)).not.toContain(otherChallenge);
  });

  it('private Groups show outsiders nothing; public Groups show the discovery projection', async () => {
    const { app, away, other, otherChallenge } = await setup();
    const priv = await scoped(app, 'token-out', away.id);
    expect(priv.statusCode).toBe(200);
    expect((priv.json() as { challenges: unknown[] }).challenges).toEqual([]);

    const pub = await scoped(app, 'token-out', other.id);
    expect(pub.statusCode).toBe(200);
    const pubBody = pub.json() as { challenges: Array<{ challengeId: string; myParticipation: null }> };
    expect(pubBody.challenges.map((c) => c.challengeId)).toEqual([otherChallenge]);
    for (const challenge of pubBody.challenges) expect(challenge.myParticipation).toBeNull();
  });

  it('unknown, malformed and store-down filters fail closed', async () => {
    const { app, ownerSubject, home } = await setup();
    expect((await scoped(app, 'token-owner', '22222222-2222-4222-8222-222222222222')).statusCode).toBe(404);
    expect((await scoped(app, 'token-owner', 'nope')).statusCode).toBe(400);
    const outage = appFor({ 'token-owner': ownerSubject }, groupAuthorityUnavailableDb());
    expect((await scoped(outage, 'token-owner', home.id)).statusCode).toBe(503);
  });

  it('unfiltered list keeps its contract and scope', async () => {
    const { app, homeChallenge, awayChallenge, otherChallenge } = await setup();
    const res = await app.inject({ method: 'GET', url: '/v1/challenges', headers: authHeaders('token-owner') });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { memberId: string; challenges: Array<{ challengeId: string }> };
    expect(body).not.toHaveProperty('groupId');
    const ids = body.challenges.map((c) => c.challengeId);
    expect(ids).toContain(homeChallenge);
    expect(ids).toContain(awayChallenge);
    expect(ids).toContain(otherChallenge);
  });
});

describe('s4a existing Group behaviour unregressed (I)', () => {
  it('join/leave/create semantics from S2-G still hold', async () => {
    const db = testDb();
    const owner = await seedMember(db, `s4a-reg-owner-${next('u')}`);
    const ownerSubject = await subjectFor(db, owner);
    const member = await seedMember(db, `s4a-reg-member-${next('u')}`);
    const memberSubject = await subjectFor(db, member);
    const app = appFor(
      { 'token-owner': ownerSubject, 'token-member': memberSubject },
      testDb(),
    );
    const open = await createViaApi(app, 'token-owner', { name: 'Reg Open' });
    const gated = await createViaApi(app, 'token-owner', { name: 'Reg Gated', requireAdminApproval: true });

    // PostgreSQL Group identity is sufficient; no Firestore identity is needed.
    const legacyId = await seedGroup(db, { name: 'Legacy PG row' });
    await seedMembership(db, legacyId, member, { status: 'active' });
    const legacyJoin = await app.inject({
      method: 'POST',
      url: `/v1/groups/${legacyId}/join`,
      headers: authHeaders('token-member'),
      payload: {},
    });
    expect(legacyJoin.statusCode).toBe(200);
    expect((legacyJoin.json() as { status: string }).status).toBe('joined');

    // Public join → joined; approval join → pending; owner leave → 403; member leave → left.
    const join = await app.inject({ method: 'POST', url: `/v1/groups/${open.id}/join`, headers: authHeaders('token-member'), payload: {} });
    expect(join.statusCode).toBe(200);
    expect((join.json() as { status: string }).status).toBe('joined');
    const approval = await app.inject({ method: 'POST', url: `/v1/groups/${gated.id}/join`, headers: authHeaders('token-member'), payload: {} });
    expect((approval.json() as { status: string }).status).toBe('pending');
    const ownerLeave = await app.inject({ method: 'POST', url: `/v1/groups/${open.id}/leave`, headers: authHeaders('token-owner'), payload: {} });
    expect(ownerLeave.statusCode).toBe(403);
    const leave = await app.inject({ method: 'POST', url: `/v1/groups/${open.id}/leave`, headers: authHeaders('token-member'), payload: {} });
    expect((leave.json() as { status: string }).status).toBe('left');

    // Smuggled actor identity still rejected on creation.
    const forged = await app.inject({
      method: 'POST',
      url: '/v1/groups',
      headers: authHeaders('token-member'),
      payload: { name: 'Forged', ownerId: 'intruder' },
    });
    expect(forged.statusCode).toBe(400);
  });
});
