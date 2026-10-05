import { beforeEach, describe, expect, it } from 'vitest';
import {
  expireGroupFeedProjections,
  processGroupFeedOutboxBatch,
  recordChallengePublication,
  restoreGroupFeedProjectionAfterSourceRevalidation,
  retryBlockedGroupFeedOutbox,
  suppressGroupFeedProjection,
} from '../src/groupFeedPublication.js';
import { seedGroup, seedMember, testDb } from './helpers.js';

let seq = 0;

async function challenge(groupId: string, status: 'establishment' | 'active' | 'ended' = 'establishment') {
  const memberId = await seedMember(testDb(), `feed-pub-${++seq}`);
  const result = await testDb().query<{ challenge_id: string }>(
    `INSERT INTO challenges
      (group_id, created_by_member_id, challenge_type, status, title, start_date, end_date,
       activated_at, ended_at, required_consecutive_days, timezone)
     VALUES ($1, $2, 'streak', $3, 'Publication source', '2026-06-01', '2026-06-30',
       CASE WHEN $3 IN ('active','ended') THEN now() ELSE NULL END,
       CASE WHEN $3 = 'ended' THEN now() ELSE NULL END, 1, 'UTC')
     RETURNING challenge_id`,
    [groupId, memberId, status],
  );
  return result.rows[0].challenge_id;
}

beforeEach(async () => {
  await testDb().query('TRUNCATE group_feed_projection_actions, group_feed_projection, group_feed_outbox CASCADE');
  await testDb().query('TRUNCATE challenges CASCADE');
});

describe('GF-02 trusted publication outbox', () => {
  it('records one Challenge-established envelope from canonical source state', async () => {
    const groupId = await seedGroup(testDb(), { name: 'Feed publication group' });
    const challengeId = await challenge(groupId);

    const event = await recordChallengePublication(testDb(), {
      eventType: 'challenge_established',
      challengeId,
      sourceTransitionVersion: 1,
    });

    expect(event).toMatchObject({
      groupId,
      sourceType: 'challenge',
      sourceId: challengeId,
      eventType: 'challenge_established',
      contractVersion: 1,
      sourceTransitionVersion: 1,
    });
    const rows = await testDb().query('SELECT * FROM group_feed_outbox');
    expect(rows.rows).toHaveLength(1);
    expect(JSON.stringify(rows.rows[0])).not.toMatch(/payload|activity|evidence|note|rank|score/i);
  });

  it('rejects a source event that is not currently authoritative', async () => {
    const groupId = await seedGroup(testDb(), { name: 'Feed publication group' });
    const challengeId = await challenge(groupId);

    await expect(recordChallengePublication(testDb(), {
      eventType: 'challenge_started',
      challengeId,
      sourceTransitionVersion: 1,
    })).rejects.toThrow(/not eligible/);
    expect((await testDb().query('SELECT * FROM group_feed_outbox')).rows).toHaveLength(0);
  });

  it('uses the authoritative Challenge Group and deduplicates a repeated transition call', async () => {
    const groupId = await seedGroup(testDb(), { name: 'Authoritative group' });
    const challengeId = await challenge(groupId);
    const first = await recordChallengePublication(testDb(), {
      eventType: 'challenge_established', challengeId, sourceTransitionVersion: 1,
    });
    const second = await recordChallengePublication(testDb(), {
      eventType: 'challenge_established', challengeId, sourceTransitionVersion: 1,
    });
    expect(second.outboxId).toBe(first.outboxId);
    expect((await testDb().query('SELECT outbox_id FROM group_feed_outbox')).rows).toHaveLength(1);
  });

  it('projects idempotently and expires only projection while retaining dedupe identity', async () => {
    const groupId = await seedGroup(testDb(), { name: 'Projection group' });
    const challengeId = await challenge(groupId);
    const event = await recordChallengePublication(testDb(), {
      eventType: 'challenge_established', challengeId, sourceTransitionVersion: 1,
    });
    const now = new Date(Date.now() + 2_000);
    expect(await processGroupFeedOutboxBatch(testDb(), { now })).toMatchObject({
      claimed: 1, projected: 1, suppressed: 0,
    });
    expect(await processGroupFeedOutboxBatch(testDb(), { now: new Date(now.getTime() + 2_000) }))
      .toMatchObject({ claimed: 0, projected: 0 });
    expect((await testDb().query('SELECT feed_event_id FROM group_feed_projection')).rows).toHaveLength(1);

    const sourceTime = new Date(event.sourceTransitionAt);
    const expired = await expireGroupFeedProjections(testDb(), {
      now: new Date(sourceTime.getTime() + 91 * 24 * 60 * 60 * 1000),
    });
    expect(expired).toBe(1);
    expect((await testDb().query('SELECT feed_event_id FROM group_feed_projection')).rows).toHaveLength(0);
    expect((await testDb().query('SELECT outbox_id, status, expired_at, attempt_count FROM group_feed_outbox')).rows)
      .toMatchObject([{ outbox_id: event.outboxId, status: 'expired', attempt_count: 0 }]);
    expect((await testDb().query<{ expired_at: Date | null }>(
      'SELECT expired_at FROM group_feed_outbox WHERE outbox_id = $1', [event.outboxId],
    )).rows[0].expired_at).not.toBeNull();
    expect((await testDb().query("SELECT action_type FROM group_feed_projection_actions WHERE action_type = 'purged'")).rows)
      .toHaveLength(1);
  });

  it('isolates a worker failure and leaves the eligible publication available for recovery', async () => {
    const groupId = await seedGroup(testDb(), { name: 'Retry group' });
    const challengeId = await challenge(groupId);
    const event = await recordChallengePublication(testDb(), {
      eventType: 'challenge_established', challengeId, sourceTransitionVersion: 1,
    });
    const now = new Date(Date.now() + 2_000);
    const brokenDb = failingProjectionInsertDb(testDb());
    expect(await processGroupFeedOutboxBatch(brokenDb, { now, maxAttempts: 1 }))
      .toMatchObject({ claimed: 1, blocked: 1, blockedIds: [event.outboxId] });
    expect((await testDb().query<{ status: string }>(
      'SELECT status FROM group_feed_outbox WHERE outbox_id = $1', [event.outboxId],
    )).rows[0].status).toBe('blocked');
    expect((await testDb().query('SELECT feed_event_id FROM group_feed_projection')).rows).toHaveLength(0);

    expect(await retryBlockedGroupFeedOutbox(testDb(), { now })).toBe(1);
    expect(await processGroupFeedOutboxBatch(testDb(), { now })).toMatchObject({ projected: 1, blocked: 0 });
    expect((await testDb().query('SELECT feed_event_id FROM group_feed_projection')).rows).toHaveLength(1);
  });

  it('recovers a claimed event after worker crash and lease expiry', async () => {
    const groupId = await seedGroup(testDb(), { name: 'Crash recovery group' });
    const challengeId = await challenge(groupId);
    const event = await recordChallengePublication(testDb(), {
      eventType: 'challenge_established', challengeId, sourceTransitionVersion: 1,
    });
    const now = new Date(Date.now() + 120_000);
    await testDb().query(
      `UPDATE group_feed_outbox SET status = 'processing', attempt_count = 1,
         claimed_until = $2 WHERE outbox_id = $1`,
      [event.outboxId, new Date(now.getTime() - 61_000).toISOString()],
    );
    expect(await processGroupFeedOutboxBatch(testDb(), { now })).toMatchObject({
      claimed: 1, projected: 1, blocked: 0,
    });
    expect((await testDb().query<{ status: string; attempt_count: number }>(
      'SELECT status, attempt_count FROM group_feed_outbox WHERE outbox_id = $1', [event.outboxId],
    )).rows[0]).toMatchObject({ status: 'projected', attempt_count: 2 });
  });

  it('suppresses and restores only the projection with a system audit trace', async () => {
    const groupId = await seedGroup(testDb(), { name: 'Suppression group' });
    const challengeId = await challenge(groupId);
    const event = await recordChallengePublication(testDb(), {
      eventType: 'challenge_established', challengeId, sourceTransitionVersion: 1,
    });
    const now = new Date(Date.now() + 2_000);
    await processGroupFeedOutboxBatch(testDb(), { now });
    expect(await suppressGroupFeedProjection(testDb(), event.outboxId, 'system_safety', now)).toBe(true);
    expect((await testDb().query<{ status: string }>(
      'SELECT status FROM challenges WHERE challenge_id = $1', [challengeId],
    )).rows[0].status).toBe('establishment');
    const restoredAt = new Date(now.getTime() + 1_000);
    expect(await restoreGroupFeedProjectionAfterSourceRevalidation(testDb(), event.outboxId, restoredAt)).toBe(true);
    expect((await testDb().query<{ suppression_reason_code: string | null }>(
      'SELECT suppression_reason_code FROM group_feed_projection WHERE feed_event_id = $1', [event.outboxId],
    )).rows[0].suppression_reason_code).toBeNull();
    expect((await testDb().query<{ action_type: string; actor_kind: string }>(
      'SELECT action_type, actor_kind FROM group_feed_projection_actions ORDER BY acted_at, action_id',
    )).rows.map((row) => [row.action_type, row.actor_kind])).toEqual([
      ['suppressed', 'system'], ['restored', 'system'],
    ]);
  });

  it('does not project an outbox row whose Group scope no longer matches its Challenge', async () => {
    const sourceGroupId = await seedGroup(testDb(), { name: 'Source group' });
    const otherGroupId = await seedGroup(testDb(), { name: 'Other group' });
    const challengeId = await challenge(sourceGroupId);
    const event = await recordChallengePublication(testDb(), {
      eventType: 'challenge_established', challengeId, sourceTransitionVersion: 1,
    });
    await testDb().query('UPDATE group_feed_outbox SET group_id = $2 WHERE outbox_id = $1', [event.outboxId, otherGroupId]);
    const result = await processGroupFeedOutboxBatch(testDb(), { now: new Date(Date.now() + 2_000) });
    expect(result.suppressed).toBe(1);
    expect((await testDb().query<{ group_id: string; suppressed_at: Date | null }>(
      'SELECT group_id, suppressed_at FROM group_feed_projection WHERE feed_event_id = $1', [event.outboxId],
    )).rows[0]).toMatchObject({ group_id: otherGroupId });
    expect((await testDb().query<{ suppressed_at: Date | null }>(
      'SELECT suppressed_at FROM group_feed_projection WHERE feed_event_id = $1', [event.outboxId],
    )).rows[0].suppressed_at).not.toBeNull();
  });

  it('rejects event families outside the GF-01 allow-list at the database boundary', async () => {
    await expect(testDb().query(
      `INSERT INTO group_feed_outbox
       (group_id, source_type, source_id, event_type, source_transition_version,
        contract_version, source_transition_at, idempotency_key)
       VALUES (gen_random_uuid(), 'challenge', gen_random_uuid(), 'member_joined', 1, 1, now(), 'invalid')`,
    )).rejects.toThrow(/check constraint/i);
  });
});

function failingProjectionInsertDb(target: ReturnType<typeof testDb>): ReturnType<typeof testDb> {
  const wrap = (tx: ReturnType<typeof testDb>): ReturnType<typeof testDb> => ({
    query: async <T>(sql: string, params?: unknown[]) => {
      if (/INSERT INTO group_feed_projection\s*\(/i.test(sql)) throw new Error('injected projection failure');
      return tx.query<T>(sql, params);
    },
    transaction: (fn) => tx.transaction((inner) => fn(wrap(inner))),
    close: async () => {},
  });
  return {
    query: (sql, params) => target.query(sql, params),
    transaction: (fn) => target.transaction((tx) => fn(wrap(tx))),
    close: async () => {},
  };
}
