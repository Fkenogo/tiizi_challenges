/**
 * MC-1 — explicit V2 member bootstrap.
 * Proves the single provisioning seam, its idempotency and race convergence,
 * actor-identity exclusivity, and that the normal auth boundary stays strict.
 */
import { describe, expect, it } from 'vitest';
import { authHeaders, buildTestApp, seedMember, testDb } from './helpers.js';

const BOOTSTRAP = '/api/members/bootstrap';

async function memberRows() {
  const result = await testDb().query<{
    member_id: string;
    auth_provider: string;
    auth_subject: string;
    role: string;
  }>('SELECT member_id, auth_provider, auth_subject, role FROM members ORDER BY created_at');
  return result.rows;
}

async function count(table: string): Promise<number> {
  const result = await testDb().query<{ n: string }>(`SELECT count(*)::text AS n FROM ${table}`);
  return Number(result.rows[0].n);
}

describe('MC-1 member bootstrap', () => {
  it('A: first bootstrap creates exactly one ordinary member', async () => {
    const app = buildTestApp({ tok: 'new-uid' });
    const res = await app.inject({ method: 'POST', url: BOOTSTRAP, headers: authHeaders('tok') });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.created).toBe(true);
    expect(Object.keys(body).sort()).toEqual(['created', 'memberId']);

    const rows = await memberRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].member_id).toBe(body.memberId);
    expect(rows[0].auth_provider).toBe('firebase');
    expect(rows[0].auth_subject).toBe('new-uid');
    expect(rows[0].role).toBe('member');
    expect(JSON.stringify(body)).not.toContain('new-uid');
  });

  it('A: creates no Group, Challenge, operator or other domain side effects', async () => {
    const app = buildTestApp({ tok: 'new-uid' });
    await app.inject({ method: 'POST', url: BOOTSTRAP, headers: authHeaders('tok') });
    expect(await count('group_memberships')).toBe(0);
    expect(await count('challenge_participations')).toBe(0);
    expect(await count('platform_operator_cause_reviewers')).toBe(0);
  });

  it('B: repeat bootstrap returns the same member and no second row', async () => {
    const app = buildTestApp({ tok: 'uid-b' });
    const first = (await app.inject({ method: 'POST', url: BOOTSTRAP, headers: authHeaders('tok') })).json();
    const second = (await app.inject({ method: 'POST', url: BOOTSTRAP, headers: authHeaders('tok') })).json();
    expect(second.memberId).toBe(first.memberId);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(await memberRows()).toHaveLength(1);
  });

  it('C: simultaneous first bootstraps converge on one mapping', async () => {
    const app = buildTestApp({ tok: 'uid-c' });
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        app.inject({ method: 'POST', url: BOOTSTRAP, headers: authHeaders('tok') }),
      ),
    );
    for (const res of responses) expect(res.statusCode).toBe(200);
    const ids = new Set(responses.map((res) => res.json().memberId));
    expect(ids.size).toBe(1);
    expect(responses.filter((res) => res.json().created === true)).toHaveLength(1);
    const rows = await memberRows();
    expect(rows).toHaveLength(1);
    expect([...ids][0]).toBe(rows[0].member_id);
  });

  it('D: body and query cannot choose UID, member id, role or authority', async () => {
    const existingId = await seedMember(testDb(), 'victim-uid');
    const app = buildTestApp({ tok: 'attacker-uid' });
    const res = await app.inject({
      method: 'POST',
      url: `${BOOTSTRAP}?uid=victim-uid&memberId=${existingId}&role=admin`,
      headers: { ...authHeaders('tok'), 'content-type': 'application/json' },
      payload: {
        uid: 'victim-uid',
        authSubject: 'victim-uid',
        auth_subject: 'victim-uid',
        memberId: existingId,
        member_id: existingId,
        role: 'super_admin',
        isAdmin: true,
        operator: true,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().memberId).not.toBe(existingId);
    const rows = await memberRows();
    const attacker = rows.find((row) => row.auth_subject === 'attacker-uid');
    expect(attacker?.role).toBe('member');
    expect(rows.find((row) => row.member_id === existingId)?.auth_subject).toBe('victim-uid');
    expect(rows).toHaveLength(2);
    expect(await count('platform_operator_cause_reviewers')).toBe(0);
  });

  it('E: strict auth is preserved outside bootstrap (unmapped subject => 401 unknown_member)', async () => {
    const app = buildTestApp({ tok: 'unmapped-uid' });
    const res = await app.inject({ method: 'GET', url: '/api/memberships/me', headers: authHeaders('tok') });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('unknown_member');
    expect(await memberRows()).toHaveLength(0);
  });

  it('E: only POST bootstrap is exempt; other methods and lookalike paths stay strict', async () => {
    const app = buildTestApp({ tok: 'unmapped-uid' });
    for (const [method, url] of [
      ['GET', BOOTSTRAP],
      ['POST', `${BOOTSTRAP}/`],
      ['POST', '/api/members/bootstrap-extra'],
      ['POST', '/api/members/other'],
    ] as const) {
      const res = await app.inject({ method, url, headers: authHeaders('tok') });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
      expect(res.json().error.code).toBe('unknown_member');
    }
    expect(await memberRows()).toHaveLength(0);
  });

  it('E: after bootstrap the same subject passes the normal protected boundary', async () => {
    const app = buildTestApp({ tok: 'uid-e' });
    const boot = (await app.inject({ method: 'POST', url: BOOTSTRAP, headers: authHeaders('tok') })).json();
    const res = await app.inject({ method: 'GET', url: '/api/memberships/me', headers: authHeaders('tok') });
    expect(res.statusCode).toBe(200);
    expect(res.json().memberId).toBe(boot.memberId);
  });

  it('F/G: existing member role and columns are never overwritten or elevated', async () => {
    const memberId = await seedMember(testDb(), 'admin-uid');
    await testDb().query(`UPDATE members SET role = 'admin' WHERE member_id = $1`, [memberId]);
    const before = (await memberRows())[0];
    const beforeRow = await testDb().query(`SELECT * FROM members WHERE member_id = $1`, [memberId]);

    const app = buildTestApp({ tok: 'admin-uid' });
    const res = await app.inject({
      method: 'POST',
      url: BOOTSTRAP,
      headers: { ...authHeaders('tok'), 'content-type': 'application/json' },
      payload: { role: 'member', displayName: 'Overwrite Attempt' },
    });
    expect(res.json()).toEqual({ memberId, created: false });
    const afterRow = await testDb().query(`SELECT * FROM members WHERE member_id = $1`, [memberId]);
    expect(afterRow.rows).toEqual(beforeRow.rows);
    expect(before.role).toBe('admin');
    expect((await memberRows())[0].role).toBe('admin');
  });

  it('G: bootstrap never creates operator authority', async () => {
    const app = buildTestApp({ tok: 'op-uid' });
    await app.inject({ method: 'POST', url: BOOTSTRAP, headers: authHeaders('tok') });
    expect((await memberRows())[0].role).toBe('member');
    expect(await count('platform_operator_cause_reviewers')).toBe(0);
  });

  it('H: missing, malformed and invalid tokens are rejected without provisioning', async () => {
    const app = buildTestApp({ good: 'uid-h' });
    const missing = await app.inject({ method: 'POST', url: BOOTSTRAP });
    expect(missing.statusCode).toBe(401);
    expect(missing.json().error.code).toBe('missing_token');
    const malformed = await app.inject({ method: 'POST', url: BOOTSTRAP, headers: { authorization: 'Token abc' } });
    expect(malformed.statusCode).toBe(401);
    const invalid = await app.inject({ method: 'POST', url: BOOTSTRAP, headers: authHeaders('bad') });
    expect(invalid.statusCode).toBe(401);
    expect(invalid.json().error.code).toBe('invalid_token');
    expect(await memberRows()).toHaveLength(0);
  });

  it('fails closed when the mapping cannot be resolved after a conflict', async () => {
    const real = testDb();
    const brokenDb = {
      ...real,
      query: async (text: string, params?: unknown[]) =>
        /INSERT INTO members/.test(text)
          ? { rows: [] }
          : /SELECT member_id FROM members/.test(text)
            ? { rows: [] }
            : real.query(text, params),
    } as typeof real;
    const app = buildTestApp({ tok: 'uid-x' }, { db: brokenDb });
    const res = await app.inject({ method: 'POST', url: BOOTSTRAP, headers: authHeaders('tok') });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('member_mapping_inconsistent');
  });
});
