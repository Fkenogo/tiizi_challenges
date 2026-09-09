import { beforeEach, describe, expect, it } from 'vitest';
import { appendActivityEvent, legacyClientKey, type NewActivityEvent } from '../src/activityEvents.js';
import { resolveEventsLimit } from '../src/activityEventsRead.js';
import { testDb, seedMember, buildTestApp, authHeaders } from './helpers.js';

beforeEach(async () => {
  await testDb().query('TRUNCATE activity_events');
});

function eventFor(memberId: string, id: string, day: string): NewActivityEvent {
  return {
    event_type: 'workout',
    member_id: memberId,
    legacy_challenge_id: 'challenge-fs-read',
    canonical_key: 'push-up',
    occurred_at: new Date(`${day}T08:00:00.000Z`),
    occurred_day: day,
    value: 10,
    unit: 'reps',
    points: 50,
    client_key: legacyClientKey('workouts', id),
    legacy_collection: 'workouts',
    legacy_id: id,
    log_type: null,
    metadata: {},
  };
}

describe('GET /v1/activity-events/me', () => {
  it('returns only the caller member events, newest first', async () => {
    const db = testDb();
    const mine = await seedMember(db, 'uid-read-1');
    const other = await seedMember(db, 'uid-read-2');
    await appendActivityEvent(db, eventFor(mine, 'r1', '2026-05-01'));
    await appendActivityEvent(db, eventFor(mine, 'r2', '2026-05-03'));
    await appendActivityEvent(db, eventFor(other, 'r3', '2026-05-02'));
    const app = buildTestApp({ tok1: 'uid-read-1' });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/activity-events/me',
      headers: authHeaders('tok1'),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { memberId: string; events: Array<{ eventId: string; occurredDay: string }> };
    expect(body.memberId).toBe(mine);
    expect(body.events).toHaveLength(2);
    expect(body.events.map((e) => e.occurredDay)).toEqual(['2026-05-03', '2026-05-01']);
  });

  it('requires authentication and respects the limit', async () => {
    const app = buildTestApp({});
    const anon = await app.inject({ method: 'GET', url: '/v1/activity-events/me' });
    expect(anon.statusCode).toBe(401);
    expect(resolveEventsLimit('3')).toBe(3);
    expect(resolveEventsLimit('9999')).toBe(200);
    expect(resolveEventsLimit('bogus')).toBe(50);
    expect(resolveEventsLimit(undefined)).toBe(50);
  });
});
