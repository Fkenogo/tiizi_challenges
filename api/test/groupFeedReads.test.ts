import { beforeEach, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { getGroupFeedPage } from '../src/groupFeedReads.js';
import { createPostgresGroupMembershipAuthority } from '../src/postgresGroupAuthority.js';
import { authHeaders, buildTestApp, seedGroup, seedMember, seedMembership, testDb } from './helpers.js';

let seq = 0;

async function source(groupId: string, title = 'Visible challenge') {
  const creatorId = await seedMember(testDb(), `gf03-source-${++seq}`);
  const result = await testDb().query<{ challenge_id: string }>(
    `INSERT INTO challenges
      (group_id, created_by_member_id, challenge_type, status, title, start_date, end_date,
       goal_value, goal_unit, required_consecutive_days, timezone)
     VALUES ($1, $2, 'streak', 'establishment', $3, '2026-06-01', '2026-06-30', NULL, NULL, 1, 'UTC')
     RETURNING challenge_id`, [groupId, creatorId, title],
  );
  return result.rows[0].challenge_id;
}

async function project(groupId: string, challengeId: string, eventType: string, occurredAt: Date) {
  const feedEventId = crypto.randomUUID();
  await testDb().query(
    `INSERT INTO group_feed_outbox
      (outbox_id, group_id, source_type, source_id, event_type, source_transition_version,
       contract_version, source_transition_at, idempotency_key, status)
     VALUES ($1, $2, 'challenge', $3, $4, 1, 1, $5, $6, 'projected')`,
    [feedEventId, groupId, challengeId, eventType, occurredAt.toISOString(), `gf03-${feedEventId}`],
  );
  await testDb().query(
    `INSERT INTO group_feed_projection
      (feed_event_id, group_id, source_type, source_id, event_type, source_transition_version,
       contract_version, source_transition_at)
     VALUES ($1, $2, 'challenge', $3, $4, 1, 1, $5)`,
    [feedEventId, groupId, challengeId, eventType, occurredAt.toISOString()],
  );
  return feedEventId;
}

async function fixture(status = 'active', steward = false) {
  const groupId = await seedGroup(testDb(), { name: 'Feed group' });
  const memberId = await seedMember(testDb(), `gf03-viewer-${++seq}`);
  await seedMembership(testDb(), groupId, memberId, { role: steward ? 'owner' : 'member', status });
  if (steward) await testDb().query('UPDATE groups SET steward_member_id=$2 WHERE group_id=$1', [groupId, memberId]);
  const identity = (await testDb().query<{ auth_subject: string }>(
    'SELECT auth_subject FROM members WHERE member_id = $1', [memberId],
  )).rows[0].auth_subject;
  return { groupId, memberId, identity };
}

function signedCursor(fields: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(fields)).toString('base64url');
  const key = process.env.TIIZI_GROUP_FEED_CURSOR_SECRET!;
  return `${body}.${createHmac('sha256', key).update(body).digest('base64url')}`;
}

function aliasUnusedTerminalBits(encoded: string, decodedLength: number): string {
  const remainder = decodedLength % 3;
  const unusedBits = remainder === 1 ? 4 : remainder === 2 ? 2 : 0;
  if (unusedBits === 0) throw new Error('encoded value has no unused terminal bits');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const terminal = alphabet.indexOf(encoded.at(-1)!);
  const unusedMask = (1 << unusedBits) - 1;
  const aliasTerminal = (terminal & ~unusedMask) | (((terminal & unusedMask) + 1) % (1 << unusedBits));
  if (aliasTerminal === terminal) throw new Error('terminal alias did not change the encoding');
  return `${encoded.slice(0, -1)}${alphabet[aliasTerminal]}`;
}

beforeEach(async () => {
  await testDb().query('TRUNCATE group_feed_projection_actions, group_feed_projection, group_feed_outbox CASCADE');
  await testDb().query('TRUNCATE challenge_social_cause_decisions, challenge_social_causes, challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events, activity_submission_intents, challenge_finalizations, challenge_participation_finals CASCADE');
});

describe('GF-03 Group Feed member read boundary', () => {
  it('returns allow-listed cards in source transition order and disables caching', async () => {
    const { groupId, identity } = await fixture();
    const early = await source(groupId, 'Earlier title');
    const late = await source(groupId, 'Later title');
    const now = Date.now();
    await project(groupId, early, 'challenge_established', new Date(now - 2_000));
    await project(groupId, late, 'challenge_started', new Date(now - 1_000));
    process.env.TIIZI_GROUP_FEED_CURSOR_SECRET = 'test-only-cursor-secret-with-sufficient-entropy';

    const app = buildTestApp({ token: identity }, {
      challengeActivity: { groupMembershipAuthority: createPostgresGroupMembershipAuthority(testDb()) },
    });
    const response = await app.inject({ method: 'GET', url: `/api/groups/${groupId}/feed`, headers: authHeaders('token') });
    await app.close();

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.events.map((event: { eventType: string }) => event.eventType)).toEqual([
      'challenge_started', 'challenge_established',
    ]);
    expect(body.events[0]).toEqual({
      feedEventId: expect.any(String), eventType: 'challenge_started', challengeId: late,
      challengeTitle: 'Later title', presentationTitle: 'The Challenge has started',
      occurredAt: new Date(now - 1_000).toISOString(),
      navigationTarget: { type: 'challenge', challengeId: late },
    });
    expect(Object.keys(body.events[0]).sort()).toEqual([
      'challengeId', 'challengeTitle', 'eventType', 'feedEventId', 'navigationTarget', 'occurredAt', 'presentationTitle',
    ]);
    expect(response.headers['cache-control']).toBe('private, no-store');
  });

  it('uses the four fixed GF-01 v1.1 presentation titles verbatim', async () => {
    const { groupId, memberId } = await fixture();
    const expected = new Map([
      ['challenge_established', 'A new Challenge is available'],
      ['challenge_started', 'The Challenge has started'],
      ['together_goal_achieved', 'The Group reached its Challenge goal'],
      ['challenge_ended', 'The Challenge has ended'],
    ]);
    let index = 0;
    for (const eventType of expected.keys()) {
      const challengeId = await source(groupId, `Title ${index}`);
      await project(groupId, challengeId, eventType, new Date(Date.now() - index++ * 1000));
    }
    const page = await getGroupFeedPage(testDb(), createPostgresGroupMembershipAuthority(testDb()), memberId, groupId);
    expect(Object.fromEntries(page.events.map((event) => [event.eventType, event.presentationTitle])))
      .toEqual(Object.fromEntries(expected));
  });

  it('marks authentication failures no-store too', async () => {
    const app = buildTestApp({ token: 'known-identity' }, {
      challengeActivity: { groupMembershipAuthority: createPostgresGroupMembershipAuthority(testDb()) },
    });
    const response = await app.inject({ method: 'GET', url: '/api/groups/00000000-0000-4000-8000-000000000001/feed' });
    await app.close();
    expect(response.statusCode).toBe(401);
    expect(response.headers['cache-control']).toBe('private, no-store');
  });

  it('uses the same not-found denial for pending membership, private and discoverable outsiders, and an unknown Group', async () => {
    const groupId = await seedGroup(testDb(), { isPrivate: true });
    const pending = await seedMember(testDb(), `gf03-pending-${++seq}`);
    await seedMembership(testDb(), groupId, pending, { status: 'pending' });
    const outsider = await seedMember(testDb(), `gf03-outsider-${++seq}`);
    const discoverableOutsider = await seedMember(testDb(), `gf03-discoverable-${++seq}`);
    const pendingUid = (await testDb().query<{ auth_subject: string }>('SELECT auth_subject FROM members WHERE member_id=$1', [pending])).rows[0].auth_subject;
    const outsiderUid = (await testDb().query<{ auth_subject: string }>('SELECT auth_subject FROM members WHERE member_id=$1', [outsider])).rows[0].auth_subject;
    const discoverableUid = (await testDb().query<{ auth_subject: string }>('SELECT auth_subject FROM members WHERE member_id=$1', [discoverableOutsider])).rows[0].auth_subject;
    const authority = createPostgresGroupMembershipAuthority(testDb());
    const pendingApp = buildTestApp({ token: pendingUid }, { challengeActivity: { groupMembershipAuthority: authority } });
    const outsiderApp = buildTestApp({ token: outsiderUid }, { challengeActivity: { groupMembershipAuthority: authority } });
    const discoverableApp = buildTestApp({ token: discoverableUid }, { challengeActivity: { groupMembershipAuthority: authority } });
    const pendingResponse = await pendingApp.inject({ method: 'GET', url: `/api/groups/${groupId}/feed`, headers: authHeaders('token') });
    const outsiderResponse = await outsiderApp.inject({ method: 'GET', url: `/api/groups/${groupId}/feed`, headers: authHeaders('token') });
    const discoverableGroup = await seedGroup(testDb(), { isPrivate: false });
    const discoverableResponse = await discoverableApp.inject({ method: 'GET', url: `/api/groups/${discoverableGroup}/feed`, headers: authHeaders('token') });
    const unknownResponse = await outsiderApp.inject({ method: 'GET', url: '/api/groups/00000000-0000-4000-8000-000000000099/feed', headers: authHeaders('token') });
    await Promise.all([pendingApp.close(), outsiderApp.close(), discoverableApp.close()]);
    expect(pendingResponse.statusCode).toBe(404);
    expect(pendingResponse.body).toBe(outsiderResponse.body);
    expect(discoverableResponse.statusCode).toBe(404);
    expect(discoverableResponse.body).toBe(unknownResponse.body);
    expect(outsiderResponse.statusCode).toBe(404);
  });

  it('omits suppressed and expired projection rows without exposing outbox history', async () => {
    const { groupId, identity } = await fixture();
    const hidden = await source(groupId, 'Hidden title');
    const expired = await source(groupId, 'Expired title');
    const retained = await source(groupId, 'Retained title');
    const hiddenId = await project(groupId, hidden, 'challenge_established', new Date(Date.now() - 1_000));
    await project(groupId, expired, 'challenge_started', new Date(Date.now() - 91 * 24 * 60 * 60 * 1000));
    await project(groupId, retained, 'challenge_ended', new Date());
    await testDb().query("UPDATE group_feed_projection SET suppressed_at=now(), suppression_reason_code='system_safety' WHERE feed_event_id=$1", [hiddenId]);
    process.env.TIIZI_GROUP_FEED_CURSOR_SECRET = 'test-only-cursor-secret-with-sufficient-entropy';
    const app = buildTestApp({ token: identity }, { challengeActivity: { groupMembershipAuthority: createPostgresGroupMembershipAuthority(testDb()) } });
    const response = await app.inject({ method: 'GET', url: `/api/groups/${groupId}/feed`, headers: authHeaders('token') });
    await app.close();
    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain('system_safety');
    expect(response.body).not.toContain('Hidden title');
    expect(response.body).not.toContain('Expired title');
    expect(response.body).toContain('Retained title');
  });

  it('allows active and joined members, including the Steward through ordinary membership', async () => {
    for (const [status, steward] of [['active', false], ['joined', false], ['active', true]] as const) {
      const { groupId, identity } = await fixture(status, steward);
      const challengeId = await source(groupId);
      await project(groupId, challengeId, 'challenge_established', new Date());
      const app = buildTestApp({ token: identity }, {
        challengeActivity: { groupMembershipAuthority: createPostgresGroupMembershipAuthority(testDb()) },
      });
      const response = await app.inject({ method: 'GET', url: `/api/groups/${groupId}/feed`, headers: authHeaders('token') });
      await app.close();
      expect(response.statusCode).toBe(200);
      expect(response.json().events).toHaveLength(1);
    }
  });

  it.each(['rejected', 'left'] as const)('denies %s members with the Group not-found contract', async (status) => {
    const { groupId, identity } = await fixture(status);
    const app = buildTestApp({ token: identity }, {
      challengeActivity: { groupMembershipAuthority: createPostgresGroupMembershipAuthority(testDb()) },
    });
    const response = await app.inject({ method: 'GET', url: `/api/groups/${groupId}/feed`, headers: authHeaders('token') });
    await app.close();
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { code: 'unknown_group', message: 'Group not found' } });
  });

  it('does not return another Group’s event through path substitution or Challenge substitution', async () => {
    const a = await fixture();
    const bGroup = await seedGroup(testDb());
    const bChallenge = await source(bGroup, 'Group B secret title');
    await project(bGroup, bChallenge, 'challenge_started', new Date());
    const app = buildTestApp({ token: a.identity }, {
      challengeActivity: { groupMembershipAuthority: createPostgresGroupMembershipAuthority(testDb()) },
    });
    const response = await app.inject({ method: 'GET', url: `/api/groups/${bGroup}/feed`, headers: authHeaders('token') });
    await app.close();
    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain(bChallenge);
    expect(response.body).not.toContain('Group B secret title');
  });

  it('cannot use a client event-ID filter as an alternate read path', async () => {
    const { groupId, identity } = await fixture();
    const app = buildTestApp({ token: identity }, {
      challengeActivity: { groupMembershipAuthority: createPostgresGroupMembershipAuthority(testDb()) },
    });
    const response = await app.inject({
      method: 'GET', url: `/api/groups/${groupId}/feed?feedEventId=00000000-0000-4000-8000-000000000099`,
      headers: authHeaders('token'),
    });
    await app.close();
    expect(response.statusCode).toBe(200);
    expect(response.json().events).toEqual([]);
    expect(response.body).not.toContain('00000000-0000-4000-8000-000000000099');
  });

  it('omits source rows whose Challenge now belongs to a different Group', async () => {
    const { groupId, identity } = await fixture();
    const otherGroup = await seedGroup(testDb());
    const visibleChallenge = await source(groupId, 'Visible sibling');
    await project(groupId, visibleChallenge, 'challenge_established', new Date());
    const challengeId = await source(otherGroup, 'Mismatched source');
    // The legacy publication tables deliberately have no Challenge FK. This
    // fixture proves a mismatched source Group is excluded at read time.
    await project(groupId, challengeId, 'challenge_established', new Date());
    const app = buildTestApp({ token: identity }, {
      challengeActivity: { groupMembershipAuthority: createPostgresGroupMembershipAuthority(testDb()) },
    });
    const response = await app.inject({ method: 'GET', url: `/api/groups/${groupId}/feed`, headers: authHeaders('token') });
    await app.close();
    expect(response.statusCode).toBe(200);
    expect(response.json().events.map((event: { challengeId: string }) => event.challengeId)).toEqual([visibleChallenge]);
  });

  it('silently omits a stale projection source without an authoritative Challenge while returning other cards', async () => {
    const { groupId, identity } = await fixture();
    const visible = await source(groupId, 'Still visible');
    const invalidSource = await source(groupId, 'Invalid source');
    await project(groupId, visible, 'challenge_started', new Date(Date.now() - 1000));
    await project(groupId, invalidSource, 'challenge_established', new Date(Date.now() - 2000));
    // Challenge truth is append-preserved. Simulate a stale/invalid source
    // reference by changing only the legacy projection identity; no source
    // row can then satisfy the authoritative join.
    await testDb().query("UPDATE group_feed_projection SET source_id='00000000-0000-4000-8000-000000000099' WHERE source_id=$1", [invalidSource]);
    const app = buildTestApp({ token: identity }, {
      challengeActivity: { groupMembershipAuthority: createPostgresGroupMembershipAuthority(testDb()) },
    });
    const response = await app.inject({ method: 'GET', url: `/api/groups/${groupId}/feed`, headers: authHeaders('token') });
    await app.close();
    expect(response.statusCode).toBe(200);
    expect(response.json().events.map((event: { challengeId: string }) => event.challengeId)).toEqual([visible]);
    expect(response.body).not.toContain('Invalid source');
  });

  it('binds the signed cursor to its Group and rejects tampering, expiry, and unsupported versions', async () => {
    process.env.TIIZI_GROUP_FEED_CURSOR_SECRET = 'test-only-cursor-secret-with-sufficient-entropy';
    const { groupId, memberId } = await fixture();
    const authority = createPostgresGroupMembershipAuthority(testDb());
    const challengeIds = await Promise.all(Array.from({ length: 3 }, () => source(groupId)));
    for (let index = 0; index < challengeIds.length; index += 1) {
      await project(groupId, challengeIds[index], 'challenge_established', new Date(Date.now() - (3 - index) * 1000));
    }
    const now = new Date();
    const first = await getGroupFeedPage(testDb(), authority, memberId, groupId, { limit: 1, now });
    expect(first.events).toHaveLength(1);
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = await getGroupFeedPage(testDb(), authority, memberId, groupId, { limit: 1, cursor: first.nextCursor!, now });
    expect(second.events).toHaveLength(1);
    expect(second.events[0].feedEventId).not.toBe(first.events[0].feedEventId);

    const [cursorBody, cursorSignature] = first.nextCursor!.split('.');
    const signatureBytes = Buffer.from(cursorSignature, 'base64url');
    const signatureAlias = aliasUnusedTerminalBits(cursorSignature, signatureBytes.length);
    expect(signatureAlias).not.toBe(cursorSignature);
    expect(Buffer.from(signatureAlias, 'base64url')).toEqual(signatureBytes);
    await expect(getGroupFeedPage(testDb(), authority, memberId, groupId, {
      limit: 1, cursor: `${cursorBody}.${signatureAlias}`, now,
    })).rejects.toMatchObject({ statusCode: 400, code: 'invalid_cursor' });
    await expect(getGroupFeedPage(testDb(), authority, memberId, groupId, {
      limit: 1, cursor: `${cursorBody}=.${cursorSignature}`, now,
    })).rejects.toMatchObject({ statusCode: 400, code: 'invalid_cursor' });
    await expect(getGroupFeedPage(testDb(), authority, memberId, groupId, {
      limit: 1, cursor: `${cursorBody}.${cursorSignature}=`, now,
    })).rejects.toMatchObject({ statusCode: 400, code: 'invalid_cursor' });

    let paddingLength = 0;
    let paddedBody = '';
    let paddedCursor = '';
    do {
      paddedCursor = signedCursor({ ...JSON.parse(Buffer.from(cursorBody, 'base64url').toString('utf8')), padding: 'x'.repeat(paddingLength) });
      paddedBody = paddedCursor.split('.')[0];
      paddingLength += 1;
    } while (Buffer.from(paddedBody, 'base64url').length % 3 === 0);
    const paddedBodyBytes = Buffer.from(paddedBody, 'base64url');
    const bodyAlias = aliasUnusedTerminalBits(paddedBody, paddedBodyBytes.length);
    expect(Buffer.from(bodyAlias, 'base64url')).toEqual(paddedBodyBytes);
    const bodyAliasSignature = createHmac('sha256', process.env.TIIZI_GROUP_FEED_CURSOR_SECRET!)
      .update(bodyAlias).digest('base64url');
    await expect(getGroupFeedPage(testDb(), authority, memberId, groupId, {
      limit: 1, cursor: `${bodyAlias}.${bodyAliasSignature}`, now,
    })).rejects.toMatchObject({ statusCode: 400, code: 'invalid_cursor' });

    const otherGroup = await seedGroup(testDb());
    const otherMember = await seedMember(testDb(), `gf03-cursor-other-${++seq}`);
    await seedMembership(testDb(), otherGroup, otherMember);
    await expect(getGroupFeedPage(testDb(), authority, otherMember, otherGroup, { limit: 1, cursor: first.nextCursor!, now }))
      .rejects.toMatchObject({ statusCode: 400, code: 'invalid_cursor' });
    const ordinaryMutation = cursorSignature[0] === 'A' ? 'B' : 'A';
    await expect(getGroupFeedPage(testDb(), authority, memberId, groupId, {
      limit: 1, cursor: `${cursorBody}.${ordinaryMutation}${cursorSignature.slice(1)}`, now,
    })).rejects.toMatchObject({ statusCode: 400, code: 'invalid_cursor' });
    await expect(getGroupFeedPage(testDb(), authority, memberId, groupId, {
      limit: 2, cursor: first.nextCursor!, now,
    })).rejects.toMatchObject({ statusCode: 400, code: 'invalid_cursor' });

    const base = JSON.parse(Buffer.from(first.nextCursor!.split('.')[0], 'base64url').toString('utf8')) as Record<string, unknown>;
    await expect(getGroupFeedPage(testDb(), authority, memberId, groupId, {
      limit: 1, cursor: signedCursor({ ...base, v: 2 }), now,
    })).rejects.toMatchObject({ statusCode: 400, code: 'invalid_cursor' });
    await expect(getGroupFeedPage(testDb(), authority, memberId, groupId, {
      limit: 1, cursor: first.nextCursor!, now: new Date(now.getTime() + 25 * 60 * 60 * 1000),
    })).rejects.toMatchObject({ statusCode: 400, code: 'invalid_cursor' });
  });

  it('rechecks membership when a cursor is used for the next page', async () => {
    const { groupId, memberId } = await fixture();
    const authority = createPostgresGroupMembershipAuthority(testDb());
    for (let index = 0; index < 2; index += 1) {
      const challengeId = await source(groupId);
      await project(groupId, challengeId, 'challenge_established', new Date(Date.now() - (2 - index) * 1000));
    }
    const first = await getGroupFeedPage(testDb(), authority, memberId, groupId, { limit: 1 });
    expect(first.nextCursor).not.toBeNull();
    await testDb().query("UPDATE group_memberships SET status='left', left_at=now() WHERE group_id=$1 AND member_id=$2", [groupId, memberId]);
    await expect(getGroupFeedPage(testDb(), authority, memberId, groupId, { limit: 1, cursor: first.nextCursor! }))
      .rejects.toMatchObject({ statusCode: 404, code: 'unknown_group' });
  });

  it('returns exactly 20 by default and rejects a page limit above 50', async () => {
    const { groupId, memberId } = await fixture();
    const authority = createPostgresGroupMembershipAuthority(testDb());
    for (let index = 0; index < 21; index += 1) {
      const challengeId = await source(groupId, `Page ${index}`);
      await project(groupId, challengeId, 'challenge_established', new Date(Date.now() - index));
    }
    const page = await getGroupFeedPage(testDb(), authority, memberId, groupId);
    expect(page.events).toHaveLength(20);
    expect(page.nextCursor).not.toBeNull();
    await expect(getGroupFeedPage(testDb(), authority, memberId, groupId, { limit: 51 }))
      .rejects.toMatchObject({ statusCode: 400, code: 'invalid_limit' });
  });

  it('caps a requested page at the authorized maximum of 50 events', async () => {
    const { groupId, memberId } = await fixture();
    const authority = createPostgresGroupMembershipAuthority(testDb());
    for (let index = 0; index < 51; index += 1) {
      const challengeId = await source(groupId, `Maximum page ${index}`);
      await project(groupId, challengeId, 'challenge_established', new Date(Date.now() - index));
    }
    const page = await getGroupFeedPage(testDb(), authority, memberId, groupId, { limit: 50 });
    expect(page.events).toHaveLength(50);
    expect(page.nextCursor).not.toBeNull();
  });

  it('keeps historical established cards after normal Challenge lifecycle progression', async () => {
    const { groupId, memberId } = await fixture();
    const challengeId = await source(groupId, 'Past transition');
    await project(groupId, challengeId, 'challenge_established', new Date(Date.now() - 1000));
    await project(groupId, challengeId, 'challenge_started', new Date(Date.now() - 500));
    await testDb().query("UPDATE challenges SET status='ended', activated_at=now(), ended_at=now() WHERE challenge_id=$1", [challengeId]);
    const page = await getGroupFeedPage(testDb(), createPostgresGroupMembershipAuthority(testDb()), memberId, groupId);
    expect(page.events.map((event) => event.eventType)).toEqual(['challenge_started', 'challenge_established']);
  });

  it('keeps ended visible after finalization and never returns a finalized card', async () => {
    // GF-01 v1.1: no finalized Group Feed event exists. Legacy finalized
    // projection rows (inserted here directly as SQL fixtures) are excluded
    // by the read allow-list; the ended card remains independently visible.
    const { groupId, memberId } = await fixture();
    const visibleChallenge = await source(groupId, 'Visible finalized');
    const suppressedChallenge = await source(groupId, 'Suppressed finalized');
    const expiredChallenge = await source(groupId, 'Expired finalized');
    await testDb().query(
      "UPDATE challenges SET status='ended', ended_at=now(), finalized_at=now() WHERE challenge_id=$1",
      [visibleChallenge],
    );
    await project(groupId, visibleChallenge, 'challenge_ended', new Date(Date.now() - 1000));
    await project(groupId, visibleChallenge, 'challenge_finalized', new Date(Date.now() - 500));
    await project(groupId, suppressedChallenge, 'challenge_ended', new Date(Date.now() - 900));
    const suppressedFinal = await project(groupId, suppressedChallenge, 'challenge_finalized', new Date(Date.now() - 400));
    await testDb().query("UPDATE group_feed_projection SET suppressed_at=now(), suppression_reason_code='system_safety' WHERE feed_event_id=$1", [suppressedFinal]);
    await project(groupId, expiredChallenge, 'challenge_ended', new Date(Date.now() - 800));
    await project(groupId, expiredChallenge, 'challenge_finalized', new Date(Date.now() - 91 * 24 * 60 * 60 * 1000));
    const page = await getGroupFeedPage(testDb(), createPostgresGroupMembershipAuthority(testDb()), memberId, groupId);
    const eventsByChallenge = new Map<string, string[]>([]);
    for (const event of page.events) eventsByChallenge.set(event.challengeId, [...(eventsByChallenge.get(event.challengeId) ?? []), event.eventType]);
    expect(eventsByChallenge.get(visibleChallenge)).toEqual(['challenge_ended']);
    expect(eventsByChallenge.get(suppressedChallenge)).toEqual(['challenge_ended']);
    expect(eventsByChallenge.get(expiredChallenge)).toEqual(['challenge_ended']);
    expect(page.events.some((event) => (event.eventType as string) === 'challenge_finalized')).toBe(false);
    expect(page.events.some((event) => (event.presentationTitle as string) === 'Challenge results are ready')).toBe(false);
  });

  it('serves all four families in source-transition order without consolidation', async () => {
    const { groupId, memberId } = await fixture();
    const older = await source(groupId, 'Ended pair');
    const newest = await source(groupId, 'Newer event');
    await testDb().query(
      "UPDATE challenges SET status='ended', ended_at=now(), finalized_at=now() WHERE challenge_id=$1",
      [older],
    );
    await project(groupId, older, 'challenge_ended', new Date(Date.now() - 3000));
    await project(groupId, older, 'challenge_finalized', new Date(Date.now() - 2000));
    await project(groupId, newest, 'challenge_started', new Date(Date.now() - 1000));
    const authority = createPostgresGroupMembershipAuthority(testDb());
    const first = await getGroupFeedPage(testDb(), authority, memberId, groupId, { limit: 1 });
    const second = await getGroupFeedPage(testDb(), authority, memberId, groupId, { limit: 1, cursor: first.nextCursor! });
    expect(first.events.map((event) => event.eventType)).toEqual(['challenge_started']);
    expect(second.events.map((event) => event.eventType)).toEqual(['challenge_ended']);
    expect(second.nextCursor).toBeNull();
  });

  it('keeps pagination moving across suppressed rows without exposing their position', async () => {
    const { groupId, memberId } = await fixture();
    const hidden = await source(groupId, 'Suppressed');
    const visibleNewest = await source(groupId, 'Visible newest');
    const visibleOlder = await source(groupId, 'Visible older');
    const hiddenId = await project(groupId, hidden, 'challenge_established', new Date(Date.now() - 1000));
    await project(groupId, visibleNewest, 'challenge_started', new Date(Date.now() - 2000));
    await project(groupId, visibleOlder, 'challenge_ended', new Date(Date.now() - 3000));
    await testDb().query("UPDATE group_feed_projection SET suppressed_at=now(), suppression_reason_code='system_safety' WHERE feed_event_id=$1", [hiddenId]);
    const authority = createPostgresGroupMembershipAuthority(testDb());
    const first = await getGroupFeedPage(testDb(), authority, memberId, groupId, { limit: 1 });
    const second = await getGroupFeedPage(testDb(), authority, memberId, groupId, { limit: 1, cursor: first.nextCursor! });
    expect(first.events[0].challengeTitle).toBe('Visible newest');
    expect(second.events[0].challengeTitle).toBe('Visible older');
    expect(JSON.stringify([first, second])).not.toContain('Suppressed');
  });

  it('includes the exact 90-day boundary and excludes rows older by one millisecond', async () => {
    const { groupId, memberId } = await fixture();
    const now = new Date('2026-10-05T12:00:00.000Z');
    const exact = await source(groupId, 'Exact boundary');
    const old = await source(groupId, 'Outside window');
    await project(groupId, exact, 'challenge_established', new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000));
    await project(groupId, old, 'challenge_started', new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000 - 1));
    const page = await getGroupFeedPage(testDb(), createPostgresGroupMembershipAuthority(testDb()), memberId, groupId, { now });
    expect(page.events.map((event) => event.challengeTitle)).toEqual(['Exact boundary']);
  });
});
