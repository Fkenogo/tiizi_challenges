import { describe, expect, it } from 'vitest';
import {
  authHeaders,
  buildTestApp,
  seedGroup,
  seedMember,
  seedMembership,
  testDb,
} from './helpers.js';

describe('GET /v1/compat/group-ids (transitional identity bridge)', () => {
  it('maps legacy Firestore ids to Tiizi UUIDs', async () => {
    const db = testDb();
    const groupId = await seedGroup(db, { legacyId: 'fs-g1', name: 'Runners' });
    await seedGroup(db, { legacyId: 'fs-g2', name: 'Cyclists' });
    await seedMember(db, 'uid-a');

    const app = buildTestApp({ t: 'uid-a' });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/compat/group-ids?legacyId=fs-g1&legacyId=fs-g2',
      headers: authHeaders('t'),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      mappings: [
        { legacyId: 'fs-g1', id: groupId },
        { legacyId: 'fs-g2', id: expect.any(String) },
      ],
    });
  });

  it('maps Tiizi UUIDs back to legacy Firestore ids', async () => {
    const db = testDb();
    const groupId = await seedGroup(db, { legacyId: 'fs-g9', name: 'Swimmers' });
    await seedMember(db, 'uid-a');

    const app = buildTestApp({ t: 'uid-a' });
    const res = await app.inject({
      method: 'GET',
      url: `/v1/compat/group-ids?id=${groupId}`,
      headers: authHeaders('t'),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      mappings: [{ legacyId: 'fs-g9', id: groupId }],
    });
  });

  it('omits unknown ids instead of inventing mappings', async () => {
    const db = testDb();
    const groupId = await seedGroup(db, { legacyId: 'fs-known', name: 'Known' });
    await seedMember(db, 'uid-a');

    const app = buildTestApp({ t: 'uid-a' });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/compat/group-ids?legacyId=fs-known&legacyId=fs-ghost&id=00000000-0000-0000-0000-000000000000',
      headers: authHeaders('t'),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      mappings: [{ legacyId: 'fs-known', id: groupId }],
    });
  });

  it('returns an empty mapping set for empty or malformed input', async () => {
    const db = testDb();
    await seedMember(db, 'uid-a');

    const app = buildTestApp({ t: 'uid-a' });
    for (const url of ['/v1/compat/group-ids', '/v1/compat/group-ids?id=not-a-uuid']) {
      const res = await app.inject({ method: 'GET', url, headers: authHeaders('t') });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ mappings: [] });
    }
  });

  it('is read-only: resolving never creates UUIDs', async () => {
    const db = testDb();
    await seedMember(db, 'uid-a');
    const before = await db.query<{ count: string }>('SELECT COUNT(*) AS count FROM groups');

    const app = buildTestApp({ t: 'uid-a' });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/compat/group-ids?legacyId=fs-never-seen',
      headers: authHeaders('t'),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ mappings: [] });
    const after = await db.query<{ count: string }>('SELECT COUNT(*) AS count FROM groups');
    expect(after.rows[0].count).toBe(before.rows[0].count);
  });

  it('requires authentication like every other /v1 route', async () => {
    const app = buildTestApp({});
    const res = await app.inject({ method: 'GET', url: '/v1/compat/group-ids?legacyId=x' });
    expect(res.statusCode).toBe(401);
  });

  it('round-trips through memberships: UUID from /v1/memberships/me resolves back', async () => {
    const db = testDb();
    const memberId = await seedMember(db, 'uid-a');
    const groupId = await seedGroup(db, { legacyId: 'fs-round', name: 'Round' });
    await seedMembership(db, groupId, memberId);

    const app = buildTestApp({ t: 'uid-a' });
    const me = await app.inject({
      method: 'GET',
      url: '/v1/memberships/me',
      headers: authHeaders('t'),
    });
    const uuid = me.json().memberships[0].groupId as string;

    const resolved = await app.inject({
      method: 'GET',
      url: `/v1/compat/group-ids?id=${uuid}`,
      headers: authHeaders('t'),
    });
    expect(resolved.json()).toEqual({ mappings: [{ legacyId: 'fs-round', id: uuid }] });
  });
});
