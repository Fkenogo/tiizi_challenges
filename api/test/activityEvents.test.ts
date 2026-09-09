import { beforeEach, describe, expect, it } from 'vitest';
import {
  appendActivityEvent,
  appendCorrectionEvent,
  dayInTimezone,
  listEffectiveEvents,
  type ActivityEventResolvers,
  type NewActivityEvent,
} from '../src/activityEvents.js';
import { testDb, seedMember } from './helpers.js';

beforeEach(async () => {
  await testDb().query('TRUNCATE member_activity_events');
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let keySeq = 0;

async function seedKnowledge(
  kind: 'fitness' | 'wellness' = 'fitness',
  name = 'Push-Up',
): Promise<{ knowledge_id: string; current_version: number }> {
  const db = testDb();
  const result = await db.query<{ knowledge_id: string; current_version: number }>(
    `INSERT INTO knowledge_items (kind, name) VALUES ($1, $2)
     RETURNING knowledge_id, current_version`,
    [kind, `${name}-${keySeq}`],
  );
  return {
    knowledge_id: String(result.rows[0].knowledge_id),
    current_version: Number(result.rows[0].current_version),
  };
}

function resolversFor(
  pins: Record<string, { knowledge_id: string; current_version: number }>,
): ActivityEventResolvers {
  return {
    resolveKnowledgePin: async (key) => pins[key] ?? null,
  };
}

/** Synthetic V2 Evidence fixture — intentionally constructed, no V1 provenance. */
function v2Event(memberId: string, overrides?: Partial<NewActivityEvent>): NewActivityEvent {
  keySeq += 1;
  return {
    member_id: memberId,
    activity_kind: 'fitness',
    canonical_key: 'push-up',
    occurred_at: new Date('2026-05-01T08:00:00.000Z'),
    occurred_day: '2026-05-01',
    value: 20,
    unit: 'reps',
    client_key: `v2-client:key-${keySeq}`,
    metadata: {},
    ...overrides,
  };
}

async function setup(): Promise<{
  memberId: string;
  pin: { knowledge_id: string; current_version: number };
  resolvers: ActivityEventResolvers;
}> {
  const db = testDb();
  const memberId = await seedMember(db, `uid-v2-${keySeq}-${Date.now()}`);
  const pin = await seedKnowledge();
  return { memberId, pin, resolvers: resolversFor({ 'push-up': pin }) };
}

describe('valid Member Activity Event (Evidence only)', () => {
  it('stores reported Evidence with a server-resolved Knowledge pin', async () => {
    const db = testDb();
    const { memberId, pin, resolvers } = await setup();
    const { row, inserted } = await appendActivityEvent(db, v2Event(memberId), resolvers);
    expect(inserted).toBe(true);
    expect(row.event_id).toMatch(UUID_RE);
    expect(row.member_id).toBe(memberId);
    expect(row.activity_kind).toBe('fitness');
    expect(row.canonical_key).toBe('push-up');
    expect(row.value).toBe(20);
    expect(row.unit).toBe('reps');
    expect(row.knowledge_id).toBe(pin.knowledge_id);
    expect(row.knowledge_version).toBe(pin.current_version);
    expect(row.status).toBe('committed');
  });

  it('stores no Challenge scoring or ownership on the base event', async () => {
    const db = testDb();
    const { memberId, resolvers } = await setup();
    const { row } = await appendActivityEvent(db, v2Event(memberId), resolvers);
    expect(row).not.toHaveProperty('challenge_id');
    expect(row).not.toHaveProperty('points');
    expect(row).not.toHaveProperty('scoring_method');
    expect(row).not.toHaveProperty('scoring_version');
    expect(row).not.toHaveProperty('version_source');
  });

  it('derives occurred_day from occurred_at when the day is omitted', async () => {
    const db = testDb();
    const { memberId, resolvers } = await setup();
    const { row } = await appendActivityEvent(
      db,
      v2Event(memberId, { occurred_day: undefined }),
      resolvers,
    );
    expect(row.occurred_day).toBe('2026-05-01');
  });

  it('stores a Knowledge variant where the Activity defines one', async () => {
    const db = testDb();
    const { memberId, resolvers } = await setup();
    const { row } = await appendActivityEvent(
      db,
      v2Event(memberId, { activity_variant: 'close-grip' }),
      resolvers,
    );
    expect(row.activity_variant).toBe('close-grip');
    expect(row.canonical_key).toBe('push-up');
  });
});

describe('server-authoritative Knowledge pin', () => {
  it('pins the resolver current version, never a client version', async () => {
    const db = testDb();
    const { memberId, pin, resolvers } = await setup();
    const { row } = await appendActivityEvent(db, v2Event(memberId), resolvers);
    expect(row.knowledge_id).toBe(pin.knowledge_id);
    expect(row.knowledge_version).toBe(pin.current_version);
  });

  it('rejects unknown canonical activities (pins are never invented)', async () => {
    const db = testDb();
    const { memberId } = await setup();
    await expect(
      appendActivityEvent(
        db,
        v2Event(memberId, { canonical_key: 'not-a-real-activity' }),
        resolversFor({}),
      ),
    ).rejects.toThrow(/unknown activity/);
  });

  it('rejects client-authored knowledge pins', async () => {
    const db = testDb();
    const { memberId, pin, resolvers } = await setup();
    await expect(
      appendActivityEvent(
        db,
        {
          ...v2Event(memberId),
          knowledge_id: pin.knowledge_id,
          knowledge_version: pin.current_version,
        } as unknown as NewActivityEvent,
        resolvers,
      ),
    ).rejects.toThrow(/server-resolved/);
  });
});

describe('no Challenge application on the base event', () => {
  it('rejects caller-supplied points', async () => {
    const db = testDb();
    const { memberId, resolvers } = await setup();
    await expect(
      appendActivityEvent(
        db,
        { ...v2Event(memberId), points: 10 } as unknown as NewActivityEvent,
        resolvers,
      ),
    ).rejects.toThrow(/do not belong on a Member Activity Event/);
  });

  it('rejects challenge association on the Evidence', async () => {
    const db = testDb();
    const { memberId, resolvers } = await setup();
    await expect(
      appendActivityEvent(
        db,
        { ...v2Event(memberId), challenge_id: 'challenge-1' } as unknown as NewActivityEvent,
        resolvers,
      ),
    ).rejects.toThrow(/does not belong on a Member Activity Event/);
  });

  it('rejects remote-identity confusion (member FK enforced)', async () => {
    const db = testDb();
    const { resolvers } = await setup();
    await expect(
      appendActivityEvent(
        db,
        v2Event('00000000-0000-0000-0000-000000000000'),
        resolvers,
      ),
    ).rejects.toThrow();
  });

  it('validates measurement shape before touching the database', async () => {
    const db = testDb();
    const { memberId, resolvers } = await setup();
    await expect(
      appendActivityEvent(db, v2Event(memberId, { value: -1 }), resolvers),
    ).rejects.toThrow(/value/);
    await expect(
      appendActivityEvent(db, v2Event(memberId, { activity_kind: 'workout' as never }), resolvers),
    ).rejects.toThrow(/activity_kind/);
  });
});

describe('authoritative local-day semantics', () => {
  it('rejects an occurred_day that disagrees with occurred_at', async () => {
    const db = testDb();
    const { memberId, resolvers } = await setup();
    await expect(
      appendActivityEvent(db, v2Event(memberId, { occurred_day: '2026-05-02' }), resolvers),
    ).rejects.toThrow(/disagrees/);
  });

  it('accepts a timezone day that matches occurred_at in that zone', async () => {
    const db = testDb();
    const { memberId, resolvers } = await setup();
    // 2026-05-01T22:30Z is 2026-05-02 in Pacific/Auckland (+12).
    const { row } = await appendActivityEvent(
      db,
      v2Event(memberId, {
        occurred_at: new Date('2026-05-01T22:30:00.000Z'),
        occurred_day: '2026-05-02',
        occurred_tz: 'Pacific/Auckland',
      }),
      resolvers,
    );
    expect(row.occurred_day).toBe('2026-05-02');
    expect(row.occurred_tz).toBe('Pacific/Auckland');
  });

  it('rejects unknown timezones', () => {
    expect(() => dayInTimezone(new Date(), 'Not/AZone')).toThrow(/occurred_tz/);
  });
});

describe('idempotent retry', () => {
  it('converges duplicate client_key submissions on the first row', async () => {
    const db = testDb();
    const { memberId, resolvers } = await setup();
    const event = v2Event(memberId, { client_key: 'v2-client:dup-1' });
    const first = await appendActivityEvent(db, event, resolvers);
    expect(first.inserted).toBe(true);
    const second = await appendActivityEvent(db, { ...event, value: 999 }, resolvers);
    expect(second.inserted).toBe(false);
    expect(second.row.event_id).toBe(first.row.event_id);
    expect(second.row.value).toBe(20);
    const count = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM member_activity_events WHERE client_key = $1`,
      [event.client_key],
    );
    expect(count.rows[0].n).toBe('1');
  });
});

describe('append-only enforcement', () => {
  it('rejects UPDATE and DELETE of committed content', async () => {
    const db = testDb();
    const { memberId, resolvers } = await setup();
    const { row } = await appendActivityEvent(
      db,
      v2Event(memberId, { client_key: 'v2-client:imm-1' }),
      resolvers,
    );
    await expect(
      db.query(`UPDATE member_activity_events SET value = 1 WHERE event_id = $1`, [row.event_id]),
    ).rejects.toThrow(/append-only/);
    await expect(
      db.query(`DELETE FROM member_activity_events WHERE event_id = $1`, [row.event_id]),
    ).rejects.toThrow(/append-only/);
  });
});

describe('correction/supersede behavior', () => {
  it('supersedes the target and keeps the correction live', async () => {
    const db = testDb();
    const { memberId, resolvers } = await setup();
    const original = await appendActivityEvent(
      db,
      v2Event(memberId, { client_key: 'v2-client:corr-1', value: 20 }),
      resolvers,
    );
    const fix = await appendCorrectionEvent(
      db,
      {
        ...v2Event(memberId, { client_key: 'v2-client:corr-1-fix', value: 25 }),
        supersedes_event_id: original.row.event_id,
        correction_kind: 'correction',
      },
      resolvers,
    );
    expect(fix.supersedes_event_id).toBe(original.row.event_id);
    expect(fix.status).toBe('committed');
    expect(fix.value).toBe(25);
    const target = await db.query<{ status: string }>(
      `SELECT status FROM member_activity_events WHERE event_id = $1`,
      [original.row.event_id],
    );
    expect(target.rows[0].status).toBe('superseded');
    const effective = await listEffectiveEvents(db, { member_id: memberId });
    expect(effective.map((r) => r.event_id)).toEqual([fix.event_id]);
  });

  it('rejects double-supersede and missing targets', async () => {
    const db = testDb();
    const { memberId, resolvers } = await setup();
    const original = await appendActivityEvent(
      db,
      v2Event(memberId, { client_key: 'v2-client:corr-2' }),
      resolvers,
    );
    await appendCorrectionEvent(
      db,
      {
        ...v2Event(memberId, { client_key: 'v2-client:corr-2-fix' }),
        supersedes_event_id: original.row.event_id,
        correction_kind: 'reversal',
      },
      resolvers,
    );
    await expect(
      appendCorrectionEvent(
        db,
        {
          ...v2Event(memberId, { client_key: 'v2-client:corr-2-fix2' }),
          supersedes_event_id: original.row.event_id,
          correction_kind: 'correction',
        },
        resolvers,
      ),
    ).rejects.toThrow(/not committed/);
    await expect(
      appendCorrectionEvent(
        db,
        {
          ...v2Event(memberId, { client_key: 'v2-client:corr-2-ghost' }),
          supersedes_event_id: '00000000-0000-4000-8000-000000000000',
          correction_kind: 'correction',
        },
        resolvers,
      ),
    ).rejects.toThrow(/does not exist|foreign key constraint/);
  });
});

describe('future challenge_activity_records compatibility', () => {
  it('exposes a stable UUID primary key and no Challenge-owned columns', async () => {
    const db = testDb();
    const pk = await db.query<{ key: string; type: string }>(
      `SELECT kcu.column_name AS key, c.data_type AS type
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
       JOIN information_schema.columns c
         ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name
       WHERE tc.table_name = 'member_activity_events'
         AND tc.constraint_type = 'PRIMARY KEY'`,
    );
    // A C2 record table can reference event_id with no schema change here.
    expect(pk.rows).toEqual([{ key: 'event_id', type: 'uuid' }]);
    const columns = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'member_activity_events'`,
    );
    const names = new Set(columns.rows.map((r) => r.column_name));
    for (const owned of ['challenge_id', 'points', 'scoring_method', 'scoring_version', 'version_source']) {
      expect(names.has(owned)).toBe(false);
    }
    for (const evidence of [
      'event_id', 'member_id', 'activity_kind', 'canonical_key', 'activity_variant',
      'knowledge_id', 'knowledge_version', 'occurred_at', 'occurred_day', 'occurred_tz',
      'value', 'unit', 'client_key', 'recorded_at', 'status',
      'supersedes_event_id', 'correction_kind', 'metadata',
    ]) {
      expect(names.has(evidence)).toBe(true);
    }
  });

  it('carries no V1 migration dependency', async () => {
    const db = testDb();
    const columns = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'member_activity_events'`,
    );
    const names = new Set(columns.rows.map((r) => r.column_name));
    for (const legacy of ['legacy_collection', 'legacy_id', 'legacy_challenge_id', 'legacy_group_id', 'log_type']) {
      expect(names.has(legacy)).toBe(false);
    }
  });
});

describe('deterministic recomputation from synthetic sequences', () => {
  it('lists effective events in replay order and aggregates the totals view', async () => {
    const db = testDb();
    const { memberId, resolvers } = await setup();
    for (const [id, day, value] of [
      ['a', '2026-05-03', 20],
      ['b', '2026-05-01', 10],
      ['c', '2026-05-02', 20],
    ] as Array<[string, string, number]>) {
      await appendActivityEvent(
        db,
        v2Event(memberId, {
          client_key: `v2-client:${id}`,
          occurred_at: new Date(`${day}T08:00:00.000Z`),
          occurred_day: day,
          value,
        }),
        resolvers,
      );
    }
    const rows = await listEffectiveEvents(db, { member_id: memberId });
    expect(rows.map((r) => r.occurred_day)).toEqual(['2026-05-01', '2026-05-02', '2026-05-03']);
    const totals = await db.query<{
      event_count: string;
      value_sum: number;
      day_count: string;
    }>(
      `SELECT event_count::text, value_sum, day_count::text
       FROM v_member_activity_event_totals WHERE member_id = $1`,
      [memberId],
    );
    expect(totals.rows[0]).toMatchObject({
      event_count: '3',
      value_sum: 50,
      day_count: '3',
    });
  });
});
