import { describe, expect, it } from 'vitest';
import type { Db } from '../src/db.js';
import {
  authHeaders,
  buildTestApp,
  seedGroup,
  seedMember,
  seedMembership,
  testDb,
} from './helpers.js';

let seq = 0;

interface ProfileBody {
  memberId: string;
  displayName: string | null;
  profileImage: { status: string };
  groups: {
    count: number;
    items: Array<{
      groupId: string;
      name: string;
      role: string;
      status: string;
      joinedAt: string;
    }>;
    nextCursor: string | null;
  };
  challenges: {
    activeCount: number;
    historyCount: number;
    totalCount: number;
    items: Array<{
      challengeId: string;
      participationId: string;
      title: string;
      status: string;
      bucket: string;
      joinedAt: string;
      exitedAt: string | null;
    }>;
    nextCursor: string | null;
  };
}

async function newMember(prefix = 'profile'): Promise<string> {
  return seedMember(testDb(), `${prefix}-${++seq}`);
}

async function newGroup(name = 'Profile Group'): Promise<string> {
  return seedGroup(testDb(), { name });
}

async function addMembership(
  groupId: string,
  memberId: string,
  options: { role?: string; status?: string; joinedAt?: string } = {},
): Promise<void> {
  await seedMembership(testDb(), groupId, memberId, {
    role: options.role,
    status: options.status,
  });
  if (options.joinedAt) {
    await testDb().query(
      'UPDATE group_memberships SET joined_at = $3 WHERE group_id = $1 AND member_id = $2',
      [groupId, memberId, options.joinedAt],
    );
  }
}

async function newChallenge(
  groupId: string,
  creatorId: string,
  options: {
    title?: string;
    status?: 'establishment' | 'active' | 'ended';
    finalizedAt?: Date | null;
  } = {},
): Promise<string> {
  const result = await testDb().query<{ challenge_id: string }>(
    `INSERT INTO challenges
       (group_id, created_by_member_id, challenge_type, status, title,
        start_date, end_date, finalized_at)
     VALUES ($1, $2, 'competitive', $3, $4, '2026-01-01', '2026-12-31', $5)
     RETURNING challenge_id`,
    [
      groupId,
      creatorId,
      options.status ?? 'active',
      options.title ?? 'Profile Challenge',
      options.finalizedAt ?? null,
    ],
  );
  return String(result.rows[0].challenge_id);
}

async function newParticipation(
  challengeId: string,
  memberId: string,
  options: {
    status?: 'active' | 'withdrawn' | 'removed';
    joinedAt?: Date | string;
    exitedAt?: Date;
  } = {},
): Promise<string> {
  const status = options.status ?? 'active';
  const exited = status === 'active'
    ? null
    : options.exitedAt ?? new Date('2026-05-02T09:00:00.000Z');
  const result = await testDb().query<{ participation_id: string }>(
    `INSERT INTO challenge_participations
       (challenge_id, member_id, status, joined_at, joined_config_version,
        exited_at, exit_reason)
     VALUES ($1, $2, $3, $4, 1, $5, $6)
     RETURNING participation_id`,
    [
      challengeId,
      memberId,
      status,
      options.joinedAt ?? new Date('2026-05-01T09:00:00.000Z'),
      exited,
      status === 'active' ? null : status,
    ],
  );
  return String(result.rows[0].participation_id);
}

async function setDisplayName(memberId: string, displayName: string | null): Promise<void> {
  await testDb().query('UPDATE members SET display_name = $2 WHERE member_id = $1', [
    memberId,
    displayName,
  ]);
}

/** Fail only the MC-2B-2 summary reads, after identity/mutation stay available. */
function summaryUnavailableDb(target: Db): Db {
  const wrap = (inner: Db): Db => ({
    async query<T>(text: string, params?: unknown[]) {
      if (/\b(group_memberships|challenge_participations)\b/i.test(text)) {
        throw new Error('test: Profile summaries unavailable');
      }
      return inner.query<T>(text, params);
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      return inner.transaction((tx) => fn(wrap(tx)));
    },
    close: () => inner.close(),
  });
  return wrap(target);
}

async function patchProfile(
  app: ReturnType<typeof buildTestApp>,
  token: string,
  payload: unknown,
) {
  return app.inject({
    method: 'PATCH',
    url: '/api/me',
    headers: { ...authHeaders(token), 'content-type': 'application/json' },
    payload: payload as Record<string, unknown>,
  });
}

function profileUrl(params: Record<string, string | number | null | undefined> = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) query.set(key, String(value));
  }
  const suffix = query.toString();
  return suffix ? `/api/me?${suffix}` : '/api/me';
}

function allKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) allKeys(item, keys);
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      allKeys(child, keys);
    }
  }
  return keys;
}

function expectProfileEnvelope(body: ProfileBody, memberId: string): void {
  expect(Object.keys(body).sort()).toEqual([
    'challenges',
    'displayName',
    'groups',
    'memberId',
    'profileImage',
  ]);
  expect(body.memberId).toBe(memberId);
  expect(body.profileImage).toEqual({ status: 'not_configured' });
  expect(body.groups.count).toEqual(expect.any(Number));
  expect(Array.isArray(body.groups.items)).toBe(true);
  expect(body.groups.nextCursor === null || typeof body.groups.nextCursor === 'string').toBe(true);
  expect(body.challenges.activeCount).toEqual(expect.any(Number));
  expect(body.challenges.historyCount).toEqual(expect.any(Number));
  expect(body.challenges.totalCount).toEqual(expect.any(Number));
  expect(Array.isArray(body.challenges.items)).toBe(true);
  expect(body.challenges.nextCursor === null || typeof body.challenges.nextCursor === 'string').toBe(true);
}

describe('GET /api/me', () => {
  it('returns the complete governed Profile for the authenticated member', async () => {
    const memberId = await newMember('get-complete');
    await setDisplayName(memberId, 'Ada Lovelace');
    await testDb().query('UPDATE members SET auth_subject = $2 WHERE member_id = $1', [
      memberId, 'get-complete-uid',
    ]);

    const otherMemberId = await newMember('get-other');
    const firstGroup = await newGroup('First group');
    const secondGroup = await newGroup('Second group');
    const pendingGroup = await newGroup('Pending group');
    const otherGroup = await newGroup('Other group');
    await addMembership(firstGroup, memberId, {
      role: 'owner', status: 'active', joinedAt: '2026-05-03T09:00:00.000Z',
    });
    await addMembership(secondGroup, memberId, {
      role: 'member', status: 'joined', joinedAt: '2026-05-02T09:00:00.000Z',
    });
    await addMembership(pendingGroup, memberId, { status: 'pending' });
    await addMembership(otherGroup, otherMemberId, { status: 'active' });

    const creatorId = await newMember('get-creator');
    const activeChallenge = await newChallenge(firstGroup, creatorId, { title: 'Active challenge' });
    const activeParticipation = await newParticipation(activeChallenge, memberId, {
      joinedAt: '2026-05-05T09:00:00.000Z',
    });
    const endedChallenge = await newChallenge(firstGroup, creatorId, {
      title: 'Ended but unfinalized', status: 'ended',
    });
    const endedParticipation = await newParticipation(endedChallenge, memberId, {
      joinedAt: '2026-05-04T09:00:00.000Z',
    });
    const finalizedChallenge = await newChallenge(firstGroup, creatorId, {
      title: 'Finalized challenge', status: 'ended',
      finalizedAt: new Date('2026-06-01T09:00:00.000Z'),
    });
    const finalizedParticipation = await newParticipation(finalizedChallenge, memberId, {
      joinedAt: '2026-05-03T09:00:00.000Z',
    });
    const rejoinChallenge = await newChallenge(firstGroup, creatorId, { title: 'Rejoin challenge' });
    const withdrawnParticipation = await newParticipation(rejoinChallenge, memberId, {
      status: 'withdrawn',
      joinedAt: '2026-05-02T09:00:00.000Z',
      exitedAt: new Date('2026-05-02T10:00:00.000Z'),
    });
    const rejoinedParticipation = await newParticipation(rejoinChallenge, memberId, {
      joinedAt: '2026-05-01T09:00:00.000Z',
    });
    const visibleOnly = await newChallenge(firstGroup, creatorId, { title: 'Visible but unjoined' });
    const otherChallenge = await newChallenge(firstGroup, creatorId, { title: 'Other member challenge' });
    await newParticipation(otherChallenge, otherMemberId);

    const app = buildTestApp({ good: 'get-complete-uid' });

    const response = await app.inject({
      method: 'GET', url: '/api/me', headers: authHeaders('good'),
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as ProfileBody;
    expectProfileEnvelope(body, memberId);
    expect(body.displayName).toBe('Ada Lovelace');

    expect(body.groups.count).toBe(2);
    expect(body.groups.nextCursor).toBeNull();
    expect(body.groups.items.map((item) => item.groupId).sort()).toEqual(
      [firstGroup, secondGroup].sort(),
    );
    expect(body.groups.items.find((item) => item.groupId === firstGroup)).toMatchObject({
      name: 'First group', role: 'owner', status: 'active',
    });

    expect(body.challenges).toMatchObject({
      activeCount: 3, historyCount: 2, totalCount: 5, nextCursor: null,
    });
    const byParticipation = new Map(body.challenges.items.map((item) => [item.participationId, item]));
    expect(byParticipation.get(activeParticipation)).toMatchObject({
      challengeId: activeChallenge, participationId: activeParticipation,
      title: 'Active challenge', status: 'active', bucket: 'active', exitedAt: null,
    });
    expect(byParticipation.get(endedParticipation)).toMatchObject({
      challengeId: endedChallenge, bucket: 'active',
    });
    expect(byParticipation.get(finalizedParticipation)).toMatchObject({
      challengeId: finalizedChallenge, status: 'active', bucket: 'history',
    });
    expect(byParticipation.get(withdrawnParticipation)).toMatchObject({
      challengeId: rejoinChallenge, status: 'withdrawn', bucket: 'history',
    });
    expect(byParticipation.get(rejoinedParticipation)).toMatchObject({
      challengeId: rejoinChallenge, status: 'active', bucket: 'active',
    });
    expect(byParticipation.get(withdrawnParticipation)?.participationId)
      .not.toBe(byParticipation.get(rejoinedParticipation)?.participationId);
    expect(body.challenges.items.map((item) => item.challengeId)).not.toContain(visibleOnly);
    expect(body.challenges.items.map((item) => item.challengeId)).not.toContain(otherChallenge);
  });

  it('returns genuine empty summaries and a null display name for a new member', async () => {
    const memberId = await newMember('get-empty');
    const app = buildTestApp({ empty: 'get-empty-uid' });
    await testDb().query('UPDATE members SET auth_subject = $2 WHERE member_id = $1', [
      memberId, 'get-empty-uid',
    ]);
    const response = await app.inject({
      method: 'GET', url: '/api/me', headers: authHeaders('empty'),
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as ProfileBody;
    expectProfileEnvelope(body, memberId);
    expect(body.displayName).toBeNull();
    expect(body.groups).toEqual({ count: 0, items: [], nextCursor: null });
    expect(body.challenges).toEqual({
      activeCount: 0, historyCount: 0, totalCount: 0, items: [], nextCursor: null,
    });
  });

  it('never exposes prohibited fields or raw authentication identity', async () => {
    const memberId = await newMember('get-exclusions');
    const otherMemberId = await newMember('get-exclusions-other');
    const app = buildTestApp({ exclusions: 'get-exclusions-uid' });
    await testDb().query('UPDATE members SET auth_subject = $2 WHERE member_id = $1', [
      memberId, 'get-exclusions-uid',
    ]);
    const response = await app.inject({
      method: 'GET',
      url: profileUrl({ memberId: otherMemberId, uid: 'another-uid' }),
      headers: authHeaders('exclusions'),
    });
    expect(response.statusCode).toBe(200);
    expect((response.json() as ProfileBody).memberId).toBe(memberId);
    const keys = allKeys(response.json());
    for (const forbidden of [
      'email', 'hasDisplayName', 'uid', 'firebaseUid', 'authSubject',
      'interests', 'goals', 'consent', 'legal', 'legalUrls', 'media',
      'mediaAssets', 'updatedAt',
    ]) {
      expect(keys.has(forbidden)).toBe(false);
    }
    expect(response.body).not.toContain('get-exclusions-uid');
  });

  it('rejects missing, invalid and unknown-member authentication', async () => {
    const app = buildTestApp({ known: 'known-uid' });
    await seedMember(testDb(), 'known-uid');

    const missing = await app.inject({ method: 'GET', url: '/api/me' });
    expect(missing.statusCode).toBe(401);
    expect(missing.json().error.code).toBe('missing_token');

    const invalid = await app.inject({
      method: 'GET', url: '/api/me', headers: authHeaders('bad'),
    });
    expect(invalid.statusCode).toBe(401);
    expect(invalid.json().error.code).toBe('invalid_token');

    const ghostApp = buildTestApp({ ghost: 'ghost-uid' });
    const ghost = await ghostApp.inject({
      method: 'GET', url: '/api/me', headers: authHeaders('ghost'),
    });
    expect(ghost.statusCode).toBe(401);
    expect(ghost.json().error.code).toBe('unknown_member');
  });

  it('paginates Groups and Challenges independently with the MC-2B-2 cursors', async () => {
    const memberId = await newMember('get-pages');
    await testDb().query('UPDATE members SET auth_subject = $2 WHERE member_id = $1', [
      memberId, 'get-pages-uid',
    ]);
    const groupIds: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const groupId = await newGroup(`Paged group ${i}`);
      await addMembership(groupId, memberId, {
        status: 'active', joinedAt: `2026-05-0${i + 1}T09:00:00.000Z`,
      });
      groupIds.push(groupId);
    }
    const creatorId = await newMember('get-pages-creator');
    const participationIds: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const challengeId = await newChallenge(groupIds[0], creatorId, { title: `Paged challenge ${i}` });
      participationIds.push(await newParticipation(challengeId, memberId, {
        joinedAt: `2026-05-0${i + 1}T09:00:00.000Z`,
      }));
    }

    const app = buildTestApp({ pages: 'get-pages-uid' });
    const first = await app.inject({
      method: 'GET',
      url: profileUrl({ groupsLimit: 1, challengesLimit: 2 }),
      headers: authHeaders('pages'),
    });
    expect(first.statusCode).toBe(200);
    const firstBody = first.json() as ProfileBody;
    expect(firstBody.groups.count).toBe(3);
    expect(firstBody.groups.items).toHaveLength(1);
    expect(firstBody.groups.nextCursor).toEqual(expect.any(String));
    expect(firstBody.challenges).toMatchObject({
      activeCount: 3, historyCount: 0, totalCount: 3,
    });
    expect(firstBody.challenges.items).toHaveLength(2);
    expect(firstBody.challenges.nextCursor).toEqual(expect.any(String));

    const second = await app.inject({
      method: 'GET',
      url: profileUrl({
        groupsLimit: 1,
        groupsCursor: firstBody.groups.nextCursor,
        challengesLimit: 2,
        challengesCursor: firstBody.challenges.nextCursor,
      }),
      headers: authHeaders('pages'),
    });
    expect(second.statusCode).toBe(200);
    const secondBody = second.json() as ProfileBody;
    expect(secondBody.groups.count).toBe(3);
    expect(secondBody.groups.items).toHaveLength(1);
    expect(secondBody.groups.nextCursor).toEqual(expect.any(String));
    expect(secondBody.challenges.activeCount).toBe(3);
    expect(secondBody.challenges.items).toHaveLength(1);
    expect(secondBody.challenges.nextCursor).toBeNull();

    const third = await app.inject({
      method: 'GET',
      url: profileUrl({ groupsLimit: 1, groupsCursor: secondBody.groups.nextCursor }),
      headers: authHeaders('pages'),
    });
    expect(third.statusCode).toBe(200);
    const thirdBody = third.json() as ProfileBody;
    expect(thirdBody.groups.items).toHaveLength(1);
    expect(thirdBody.groups.nextCursor).toBeNull();
    expect(new Set([
      ...firstBody.groups.items,
      ...secondBody.groups.items,
      ...thirdBody.groups.items,
    ].map((item) => item.groupId))).toEqual(new Set(groupIds));
    expect(new Set([
      ...firstBody.challenges.items,
      ...secondBody.challenges.items,
    ].map((item) => item.participationId))).toEqual(new Set(participationIds));
  });

  it('rejects invalid limits, malformed cursors, mismatched cursors and cross-member cursors', async () => {
    const memberId = await newMember('get-cursor-owner');
    const otherMemberId = await newMember('get-cursor-other');
    await testDb().query('UPDATE members SET auth_subject = $2 WHERE member_id = $1', [
      memberId, 'cursor-owner-uid',
    ]);
    await testDb().query('UPDATE members SET auth_subject = $2 WHERE member_id = $1', [
      otherMemberId, 'cursor-other-uid',
    ]);
    for (let i = 0; i < 2; i += 1) {
      const groupId = await newGroup(`Cursor group ${i}`);
      await addMembership(groupId, memberId, {
        status: 'active', joinedAt: `2026-05-0${i + 1}T09:00:00.000Z`,
      });
    }
    const app = buildTestApp({ owner: 'cursor-owner-uid', other: 'cursor-other-uid' });

    for (const url of [
      profileUrl({ groupsLimit: 0 }),
      profileUrl({ groupsLimit: 51 }),
      profileUrl({ challengesLimit: 'abc' }),
      profileUrl({ challengesLimit: 0 }),
      profileUrl({ groupsCursor: 'not-base64!!' }),
    ]) {
      const response = await app.inject({ method: 'GET', url, headers: authHeaders('owner') });
      expect(response.statusCode).toBe(400);
      expect(['invalid_limit', 'invalid_cursor']).toContain(response.json().error.code);
    }

    const first = await app.inject({
      method: 'GET',
      url: profileUrl({ groupsLimit: 1, challengesLimit: 1 }),
      headers: authHeaders('owner'),
    });
    expect(first.statusCode).toBe(200);
    const cursor = (first.json() as ProfileBody).groups.nextCursor;
    expect(cursor).toEqual(expect.any(String));

    const mismatched = await app.inject({
      method: 'GET',
      url: profileUrl({ challengesLimit: 1, challengesCursor: cursor }),
      headers: authHeaders('owner'),
    });
    expect(mismatched.statusCode).toBe(400);
    expect(mismatched.json().error.code).toBe('invalid_cursor');

    const wrongLimit = await app.inject({
      method: 'GET',
      url: profileUrl({ groupsLimit: 2, groupsCursor: cursor }),
      headers: authHeaders('owner'),
    });
    expect(wrongLimit.statusCode).toBe(400);
    expect(wrongLimit.json().error.code).toBe('invalid_cursor');

    const crossMember = await app.inject({
      method: 'GET',
      url: profileUrl({ groupsLimit: 1, groupsCursor: cursor }),
      headers: authHeaders('other'),
    });
    expect(crossMember.statusCode).toBe(400);
    expect(crossMember.json().error.code).toBe('invalid_cursor');
  });
});

describe('PATCH /api/me', () => {
  it('commits a normalized display name and returns the complete Profile', async () => {
    const memberId = await newMember('patch-success');
    await testDb().query('UPDATE members SET auth_subject = $2 WHERE member_id = $1', [
      memberId, 'patch-success-uid',
    ]);
    const groupId = await newGroup('Patch group');
    await addMembership(groupId, memberId, {
      role: 'owner', status: 'active', joinedAt: '2026-05-03T09:00:00.000Z',
    });
    const creatorId = await newMember('patch-creator');
    const challengeId = await newChallenge(groupId, creatorId, { title: 'Patch challenge' });
    const participationId = await newParticipation(challengeId, memberId, {
      joinedAt: '2026-05-02T09:00:00.000Z',
    });
    const before = await testDb().query<{ updated_at: Date }>(
      'SELECT updated_at FROM members WHERE member_id = $1', [memberId],
    );
    const app = buildTestApp({ patch: 'patch-success-uid' });

    const response = await patchProfile(app, 'patch', { displayName: '  Cafe\u0301  ' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as ProfileBody;
    expectProfileEnvelope(body, memberId);
    expect(body.displayName).toBe('Café');
    expect(body.groups.count).toBe(1);
    expect(body.groups.items[0]).toMatchObject({
      groupId, name: 'Patch group', role: 'owner', status: 'active',
    });
    expect(body.challenges).toMatchObject({
      activeCount: 1, historyCount: 0, totalCount: 1, nextCursor: null,
    });
    expect(body.challenges.items[0]).toMatchObject({
      challengeId, participationId, title: 'Patch challenge', bucket: 'active',
    });

    const member = await testDb().query<{ display_name: string; updated_at: Date }>(
      'SELECT display_name, updated_at FROM members WHERE member_id = $1', [memberId],
    );
    expect(member.rows[0].display_name).toBe('Café');
    expect(new Date(member.rows[0].updated_at).getTime())
      .toBeGreaterThan(new Date(before.rows[0].updated_at).getTime());
    const history = await testDb().query<{
      actor_member_id: string;
      old_display_name: string | null;
      new_display_name: string;
      source: string;
    }>(
      `SELECT actor_member_id, old_display_name, new_display_name, source
       FROM member_display_name_history WHERE member_id = $1 ORDER BY history_id`,
      [memberId],
    );
    expect(history.rows).toEqual([{
      actor_member_id: memberId,
      old_display_name: null,
      new_display_name: 'Café',
      source: 'profile_self_edit',
    }]);
    const keys = allKeys(body);
    for (const forbidden of [
      'email', 'hasDisplayName', 'uid', 'firebaseUid', 'authSubject',
      'consent', 'legal', 'media', 'updatedAt',
    ]) {
      expect(keys.has(forbidden)).toBe(false);
    }
    expect(response.body).not.toContain('patch-success-uid');

    const afterFirst = await testDb().query<{ updated_at: Date }>(
      'SELECT updated_at FROM members WHERE member_id = $1', [memberId],
    );
    const retry = await patchProfile(app, 'patch', { displayName: 'Café' });
    expect(retry.statusCode).toBe(200);
    expect((retry.json() as ProfileBody).displayName).toBe('Café');
    const afterRetry = await testDb().query<{ updated_at: Date }>(
      'SELECT updated_at FROM members WHERE member_id = $1', [memberId],
    );
    expect(new Date(afterRetry.rows[0].updated_at).getTime())
      .toBe(new Date(afterFirst.rows[0].updated_at).getTime());
    const count = await testDb().query<{ count: number }>(
      'SELECT count(*) FROM member_display_name_history WHERE member_id = $1', [memberId],
    );
    expect(count.rows[0].count).toBe(1);
  });

  it('rejects prohibited fields, cross-member mutation and invalid names without changing state', async () => {
    const memberId = await newMember('patch-invalid');
    const otherMemberId = await newMember('patch-other');
    await setDisplayName(otherMemberId, 'Other member');
    await testDb().query('UPDATE members SET auth_subject = $2 WHERE member_id = $1', [
      memberId, 'patch-invalid-uid',
    ]);
    const app = buildTestApp({ invalid: 'patch-invalid-uid' });

    for (const payload of [
      {},
      { displayName: 'Name', email: 'person@example.com' },
      { displayName: 'Name', memberId: otherMemberId },
      { displayName: 'Name', uid: 'firebase-uid' },
      { displayName: 'Name', role: 'admin' },
      [ { displayName: 'Name' } ],
    ]) {
      const response = await patchProfile(app, 'invalid', payload);
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('invalid_profile_mutation');
    }
    for (const displayName of [
      null, 42, '', '   ', 'x'.repeat(121), 'bad\nname', 'bad\u0000name',
    ]) {
      const response = await patchProfile(app, 'invalid', { displayName });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('invalid_display_name');
    }

    const own = await testDb().query<{ display_name: string | null }>(
      'SELECT display_name FROM members WHERE member_id = $1', [memberId],
    );
    const other = await testDb().query<{ display_name: string | null }>(
      'SELECT display_name FROM members WHERE member_id = $1', [otherMemberId],
    );
    expect(own.rows[0].display_name).toBeNull();
    expect(other.rows[0].display_name).toBe('Other member');
    const history = await testDb().query<{ count: number }>(
      'SELECT count(*) FROM member_display_name_history WHERE member_id = $1', [memberId],
    );
    expect(history.rows[0].count).toBe(0);
  });

  it('authenticates before mutating and rejects unknown members', async () => {
    const memberId = await newMember('patch-auth');
    await testDb().query('UPDATE members SET auth_subject = $2 WHERE member_id = $1', [
      memberId, 'patch-auth-uid',
    ]);
    const app = buildTestApp({ known: 'patch-auth-uid' });

    const missing = await patchProfile(app, '', { displayName: 'Name' });
    expect(missing.statusCode).toBe(401);
    expect(missing.json().error.code).toBe('missing_token');

    const invalid = await patchProfile(app, 'bad', { displayName: 'Name' });
    expect(invalid.statusCode).toBe(401);
    expect(invalid.json().error.code).toBe('invalid_token');

    const ghostApp = buildTestApp({ ghost: 'ghost-uid' });
    const ghost = await patchProfile(ghostApp, 'ghost', { displayName: 'Name' });
    expect(ghost.statusCode).toBe(401);
    expect(ghost.json().error.code).toBe('unknown_member');

    const member = await testDb().query<{ display_name: string | null }>(
      'SELECT display_name FROM members WHERE member_id = $1', [memberId],
    );
    expect(member.rows[0].display_name).toBeNull();
    const history = await testDb().query<{ count: number }>(
      'SELECT count(*) FROM member_display_name_history WHERE member_id = $1', [memberId],
    );
    expect(history.rows[0].count).toBe(0);
  });

  it('does not report success when a post-commit summary read fails, and retry is safe', async () => {
    const memberId = await newMember('patch-summary-failure');
    await testDb().query('UPDATE members SET auth_subject = $2 WHERE member_id = $1', [
      memberId, 'patch-summary-failure-uid',
    ]);
    const failingApp = buildTestApp(
      { failure: 'patch-summary-failure-uid' },
      { db: summaryUnavailableDb(testDb()) },
    );
    const failed = await patchProfile(failingApp, 'failure', { displayName: 'Committed Name' });
    expect(failed.statusCode).toBe(500);
    expect(failed.json().error).toEqual({ code: 'internal_error', message: 'Internal server error' });

    const committed = await testDb().query<{ display_name: string; updated_at: Date }>(
      'SELECT display_name, updated_at FROM members WHERE member_id = $1', [memberId],
    );
    expect(committed.rows[0].display_name).toBe('Committed Name');
    const historyAfterFailure = await testDb().query<{ count: number }>(
      'SELECT count(*) FROM member_display_name_history WHERE member_id = $1', [memberId],
    );
    expect(historyAfterFailure.rows[0].count).toBe(1);

    const healthyApp = buildTestApp({ failure: 'patch-summary-failure-uid' });
    const retried = await patchProfile(healthyApp, 'failure', { displayName: 'Committed Name' });
    expect(retried.statusCode).toBe(200);
    expect((retried.json() as ProfileBody).displayName).toBe('Committed Name');
    const afterRetry = await testDb().query<{ display_name: string; updated_at: Date }>(
      'SELECT display_name, updated_at FROM members WHERE member_id = $1', [memberId],
    );
    expect(afterRetry.rows[0].display_name).toBe('Committed Name');
    expect(new Date(afterRetry.rows[0].updated_at).getTime())
      .toBe(new Date(committed.rows[0].updated_at).getTime());
    const historyAfterRetry = await testDb().query<{ count: number }>(
      'SELECT count(*) FROM member_display_name_history WHERE member_id = $1', [memberId],
    );
    expect(historyAfterRetry.rows[0].count).toBe(1);
  });

  it('serializes concurrent PATCHes and preserves a linear history chain', async () => {
    const memberId = await newMember('patch-concurrent');
    await testDb().query('UPDATE members SET auth_subject = $2 WHERE member_id = $1', [
      memberId, 'patch-concurrent-uid',
    ]);
    const app = buildTestApp({ concurrent: 'patch-concurrent-uid' });
    const responses = await Promise.all([
      patchProfile(app, 'concurrent', { displayName: 'First' }),
      patchProfile(app, 'concurrent', { displayName: 'Second' }),
    ]);
    expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
    const history = await testDb().query<{ old_display_name: string | null; new_display_name: string }>(
      `SELECT old_display_name, new_display_name
       FROM member_display_name_history WHERE member_id = $1 ORDER BY history_id`,
      [memberId],
    );
    expect(history.rows).toHaveLength(2);
    expect(history.rows[0].old_display_name).toBeNull();
    expect(history.rows[1].old_display_name).toBe(history.rows[0].new_display_name);
    const member = await testDb().query<{ display_name: string }>(
      'SELECT display_name FROM members WHERE member_id = $1', [memberId],
    );
    expect(member.rows[0].display_name).toBe(history.rows[1].new_display_name);
  });
});
