import { beforeEach, describe, expect, it } from 'vitest';
import {
  appendActivityEvent,
  appendCorrectionEvent,
  deterministicEventId,
  legacyClientKey,
  listEffectiveEvents,
  type NewActivityEvent,
} from '../src/activityEvents.js';
import { testDb, seedMember } from './helpers.js';

beforeEach(async () => {
  await testDb().query('TRUNCATE activity_events');
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function workoutEvent(memberId: string, overrides?: Partial<NewActivityEvent>): NewActivityEvent {
  return {
    event_type: 'workout',
    member_id: memberId,
    legacy_challenge_id: 'challenge-fs-1',
    legacy_group_id: 'group-fs-1',
    canonical_key: 'exercise-push-up',
    occurred_at: new Date('2026-05-01T08:00:00.000Z'),
    occurred_day: '2026-05-01',
    value: 20,
    unit: 'reps',
    points: 80,
    client_key: legacyClientKey('workouts', `doc-${Math.random().toString(36).slice(2)}`),
    legacy_collection: 'workouts',
    legacy_id: `doc-${Date.now()}`,
    log_type: null,
    metadata: {},
    ...overrides,
  };
}

describe('deterministic legacy mapping', () => {
  it('maps one client key to one stable UUIDv5', () => {
    const key = legacyClientKey('workouts', 'abc123');
    expect(deterministicEventId(key)).toBe(deterministicEventId(key));
    expect(deterministicEventId(key)).toMatch(UUID_RE);
    expect(deterministicEventId(legacyClientKey('wellnessLogs', 'abc123'))).not.toBe(
      deterministicEventId(key),
    );
  });
});

describe('append + idempotency', () => {
  it('inserts once and converges duplicate retries on client_key', async () => {
    const db = testDb();
    const memberId = await seedMember(db, 'uid-events-1');
    const event = workoutEvent(memberId, {
      client_key: 'firestore:workouts:dup-1',
      legacy_id: 'dup-1',
    });
    const first = await appendActivityEvent(db, event);
    expect(first.inserted).toBe(true);
    expect(first.row.event_id).toBe(deterministicEventId(event.client_key));
    const second = await appendActivityEvent(db, { ...event, value: 999 });
    expect(second.inserted).toBe(false);
    expect(second.row.event_id).toBe(first.row.event_id);
    expect(second.row.value).toBe(20);
    const count = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM activity_events WHERE client_key = $1`,
      [event.client_key],
    );
    expect(count.rows[0].n).toBe('1');
  });

  it('rejects remote-identity confusion (member FK enforced)', async () => {
    const db = testDb();
    await expect(
      appendActivityEvent(db, workoutEvent('00000000-0000-0000-0000-000000000000')),
    ).rejects.toThrow();
  });

  it('validates event shape before touching the database', async () => {
    const db = testDb();
    const memberId = await seedMember(db, 'uid-events-2');
    await expect(appendActivityEvent(db, workoutEvent(memberId, { value: -1 }))).rejects.toThrow(/value/);
    await expect(
      appendActivityEvent(db, workoutEvent(memberId, { event_type: 'wellness', log_type: null })),
    ).rejects.toThrow(/log_type/);
    await expect(
      appendActivityEvent(db, workoutEvent(memberId, { knowledge_id: 'x' as string })),
    ).rejects.toThrow(/partial knowledge pin/);
  });
});

describe('append-only enforcement (DB level)', () => {
  it('refuses UPDATE of committed content and DELETE entirely', async () => {
    const db = testDb();
    const memberId = await seedMember(db, 'uid-events-3');
    const { row } = await appendActivityEvent(
      db,
      workoutEvent(memberId, { client_key: 'firestore:workouts:imm-1', legacy_id: 'imm-1' }),
    );
    await expect(db.query(`UPDATE activity_events SET value = 1 WHERE event_id = $1`, [row.event_id])).rejects.toThrow(
      /append-only/,
    );
    await expect(db.query(`DELETE FROM activity_events WHERE event_id = $1`, [row.event_id])).rejects.toThrow(
      /append-only/,
    );
  });

  it('correction inserts a new row and supersedes the target', async () => {
    const db = testDb();
    const memberId = await seedMember(db, 'uid-events-4');
    const { row: original } = await appendActivityEvent(
      db,
      workoutEvent(memberId, { client_key: 'firestore:workouts:corr-1', legacy_id: 'corr-1', value: 20 }),
    );
    const correction = await appendCorrectionEvent(db, {
      ...workoutEvent(memberId, {
        client_key: 'firestore:workouts:corr-1-fix',
        legacy_id: 'corr-1-fix',
        value: 25,
      }),
      supersedes_event_id: original.event_id,
      correction_kind: 'correction',
    });
    expect(correction.supersedes_event_id).toBe(original.event_id);
    const target = await db.query<{ status: string }>(
      `SELECT status FROM activity_events WHERE event_id = $1`,
      [original.event_id],
    );
    expect(target.rows[0].status).toBe('superseded');
    // Superseded rows leave the effective ledger; the correction stays.
    const effective = await listEffectiveEvents(db, {});
    expect(effective.map((r) => r.event_id)).toContain(correction.event_id);
    expect(effective.map((r) => r.event_id)).not.toContain(original.event_id);
    // Double-supersede is rejected (linear chain).
    await expect(
      appendCorrectionEvent(db, {
        ...workoutEvent(memberId, { client_key: 'firestore:workouts:corr-1-fix2', legacy_id: 'corr-1-fix2' }),
        supersedes_event_id: original.event_id,
        correction_kind: 'correction',
      }),
    ).rejects.toThrow(/not committed/);
  });
});

describe('effective ledger ordering', () => {
  it('returns committed rows in deterministic replay order', async () => {
    const db = testDb();
    const memberId = await seedMember(db, 'uid-events-5');
    const mk = (id: string, occurred: string) =>
      workoutEvent(memberId, {
        client_key: `firestore:workouts:${id}`,
        legacy_id: id,
        occurred_at: new Date(occurred),
        occurred_day: occurred.slice(0, 10),
      });
    await appendActivityEvent(db, mk('b', '2026-05-03T08:00:00.000Z'));
    await appendActivityEvent(db, mk('a', '2026-05-01T08:00:00.000Z'));
    await appendActivityEvent(db, mk('c', '2026-05-02T08:00:00.000Z'));
    const rows = await listEffectiveEvents(db, {});
    expect(rows.map((r) => r.legacy_id)).toEqual(['a', 'c', 'b']);
  });
});
