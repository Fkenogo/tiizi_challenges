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
    display_name: string | null;
  }>('SELECT member_id, auth_provider, auth_subject, role, display_name FROM members ORDER BY created_at');
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

  describe('canonical first-create display name', () => {
    const post = (app: ReturnType<typeof buildTestApp>, payload?: unknown, token = 'tok') =>
      app.inject({
        method: 'POST',
        url: BOOTSTRAP,
        headers: { ...authHeaders(token), ...(payload === undefined ? {} : { 'content-type': 'application/json' }) },
        ...(payload === undefined ? {} : { payload: payload as object }),
      });

    it('A: email signup name is persisted (trimmed, Unicode preserved) on first creation', async () => {
      const app = buildTestApp({ tok: 'uid-n1' });
      const res = await post(app, { displayName: '  Wanjiru Müller 李  ' });
      expect(res.statusCode).toBe(200);
      expect(Object.keys(res.json()).sort()).toEqual(['created', 'memberId']);
      const rows = await memberRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].display_name).toBe('Wanjiru Müller 李');
      expect(rows[0].role).toBe('member');
    });

    it('B: repeat bootstrap never overwrites the existing name', async () => {
      const app = buildTestApp({ tok: 'uid-n2' });
      await post(app, { displayName: 'First Name' });
      const again = await post(app, { displayName: 'Other Name' });
      expect(again.json().created).toBe(false);
      const none = await post(app);
      expect(none.json().created).toBe(false);
      const rows = await memberRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].display_name).toBe('First Name');
    });

    it('B: an existing member with NULL name is not backfilled by bootstrap', async () => {
      await seedMember(testDb(), 'legacy-uid');
      const app = buildTestApp({ tok: 'legacy-uid' });
      const res = await post(app, { displayName: 'Late Name' });
      expect(res.json().created).toBe(false);
      expect((await memberRows())[0].display_name).toBeNull();
    });

    it('C: body identity/authority fields cannot influence actor or authority', async () => {
      const victim = await seedMember(testDb(), 'victim-uid');
      const app = buildTestApp({ tok: 'attacker-uid' });
      const res = await post(app, {
        displayName: 'Attacker',
        uid: 'victim-uid', authSubject: 'victim-uid', memberId: victim,
        role: 'super_admin', isAdmin: true, operator: true,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().memberId).not.toBe(victim);
      const rows = await memberRows();
      expect(rows.find((r) => r.member_id === victim)?.display_name).toBeNull();
      const attacker = rows.find((r) => r.auth_subject === 'attacker-uid');
      expect(attacker).toMatchObject({ role: 'member', display_name: 'Attacker' });
      expect(await count('platform_operator_cause_reviewers')).toBe(0);
    });

    it('D/F: absent displayName creates the member with NULL (nothing derived)', async () => {
      const app = buildTestApp({ tok: 'someone.else@example.com' });
      for (const payload of [undefined, {}, { displayName: null }]) {
        await testDb().query('TRUNCATE members CASCADE');
        const res = await post(app, payload);
        expect(res.statusCode).toBe(200);
        const rows = await memberRows();
        expect(rows).toHaveLength(1);
        expect(rows[0].display_name).toBeNull();
      }
    });

    it('E: a provider (Google) name seeds first creation and never overwrites later', async () => {
      const app = buildTestApp({ tok: 'google-uid' });
      expect((await post(app, { displayName: 'Provider Name' })).json().created).toBe(true);
      await post(app, { displayName: 'Changed Provider Name' });
      expect((await memberRows())[0].display_name).toBe('Provider Name');
    });

    it('rejects explicitly supplied empty, whitespace, non-string, oversize or control-char names', async () => {
      const app = buildTestApp({ tok: 'uid-bad' });
      for (const bad of ['', '   ', 42, ['x'], { a: 1 }, 'x'.repeat(121), 'bad\u0000name', 'line\nbreak']) {
        const res = await post(app, { displayName: bad });
        expect(res.statusCode, JSON.stringify(bad)).toBe(400);
        expect(res.json().error.code).toBe('invalid_display_name');
      }
      expect(await memberRows()).toHaveLength(0);
      expect((await post(app, { displayName: 'x'.repeat(120) })).statusCode).toBe(200);
    });

    it('G: concurrent first creations with differing names converge on one winning name', async () => {
      const app = buildTestApp({ tok: 'uid-race' });
      const names = Array.from({ length: 6 }, (_, i) => `Name ${i}`);
      const responses = await Promise.all(names.map((displayName) => post(app, { displayName })));
      for (const res of responses) expect(res.statusCode).toBe(200);
      expect(new Set(responses.map((r) => r.json().memberId)).size).toBe(1);
      expect(responses.filter((r) => r.json().created === true)).toHaveLength(1);
      const rows = await memberRows();
      expect(rows).toHaveLength(1);
      expect(names).toContain(rows[0].display_name);
      // The winner is the only request that reported created:true.
      const winnerIdx = responses.findIndex((r) => r.json().created === true);
      expect(rows[0].display_name).toBe(names[winnerIdx]);
    });

    it('database rejects non-trimmed or oversize stored names', async () => {
      const insert = (name: string) =>
        testDb().query(`INSERT INTO members (auth_provider, auth_subject, display_name) VALUES ('firebase', $1, $2)`, [`s-${name.length}`, name]);
      await expect(insert(' padded')).rejects.toThrow();
      await expect(insert('x'.repeat(121))).rejects.toThrow();
    });
  });
});
