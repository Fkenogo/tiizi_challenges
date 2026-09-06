import { describe, expect, it } from 'vitest';
import {
  authHeaders,
  buildTestApp,
  seedGroup,
  seedMember,
  seedMembership,
  testDb,
} from './helpers.js';

describe('GET /v1/memberships/me', () => {
  it('returns the caller memberships in provider-neutral shape', async () => {
    const db = testDb();
    const memberId = await seedMember(db, 'uid-a');
    const groupId = await seedGroup(db, { legacyId: 'fs-group-1', name: 'Runners' });
    await seedMembership(db, groupId, memberId, { role: 'admin', status: 'active' });

    const app = buildTestApp({ tokenA: 'uid-a' });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/memberships/me',
      headers: authHeaders('tokenA'),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      memberId,
      memberships: [
        {
          groupId,
          role: 'admin',
          status: 'active',
          joinedAt: expect.any(String),
          group: {
            id: groupId,
            name: 'Runners',
            description: '',
            isPrivate: false,
          },
        },
      ],
    });
  });

  it('never exposes the Firebase UID in the response', async () => {
    const db = testDb();
    const memberId = await seedMember(db, 'super-secret-uid-123');
    const groupId = await seedGroup(db, { name: 'Cyclists' });
    await seedMembership(db, groupId, memberId);

    const app = buildTestApp({ t: 'super-secret-uid-123' });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/memberships/me',
      headers: authHeaders('t'),
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain('super-secret-uid-123');
  });

  it('isolates callers: only the authenticated member memberships are returned', async () => {
    const db = testDb();
    const memberA = await seedMember(db, 'uid-a');
    const memberB = await seedMember(db, 'uid-b');
    const groupA = await seedGroup(db, { name: 'Group A' });
    const groupB = await seedGroup(db, { name: 'Group B' });
    await seedMembership(db, groupA, memberA);
    await seedMembership(db, groupB, memberB);

    const app = buildTestApp({ t: 'uid-a' });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/memberships/me',
      headers: authHeaders('t'),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().memberships).toHaveLength(1);
    expect(res.json().memberships[0].groupId).toBe(groupA);
  });

  it('returns an empty list for members without memberships', async () => {
    const db = testDb();
    const memberId = await seedMember(db, 'lonely-uid');
    const app = buildTestApp({ t: 'lonely-uid' });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/memberships/me',
      headers: authHeaders('t'),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ memberId, memberships: [] });
  });
});
