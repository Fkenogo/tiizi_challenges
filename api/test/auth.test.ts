import { describe, expect, it } from 'vitest';
import {
  authHeaders,
  buildTestApp,
  seedMember,
  testDb,
} from './helpers.js';

describe('authentication adapter', () => {
  it('rejects requests without a token', async () => {
    const app = buildTestApp({});
    const res = await app.inject({ method: 'GET', url: '/v1/memberships/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('missing_token');
  });

  it('rejects malformed authorization headers', async () => {
    const app = buildTestApp({});
    const res = await app.inject({
      method: 'GET',
      url: '/v1/memberships/me',
      headers: { authorization: 'Token abc' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects tokens the verifier does not recognise', async () => {
    const app = buildTestApp({ good: 'uid-1' });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/memberships/me',
      headers: authHeaders('bad'),
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('invalid_token');
  });

  it('rejects authenticated UIDs with no linked member (no auto-provisioning)', async () => {
    const app = buildTestApp({ good: 'ghost-uid' });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/memberships/me',
      headers: authHeaders('good'),
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('unknown_member');
  });

  it('maps a known UID to its internal member_id', async () => {
    const memberId = await seedMember(testDb(), 'known-uid');
    const app = buildTestApp({ good: 'known-uid' });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/memberships/me',
      headers: authHeaders('good'),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().memberId).toBe(memberId);
  });
});
