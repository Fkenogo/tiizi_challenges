import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runGroupFeedCommand } from '../src/groupFeedCli.js';
import { testDb } from './helpers.js';

beforeEach(async () => {
  await testDb().query('TRUNCATE group_feed_projection_actions, group_feed_projection, group_feed_outbox CASCADE');
});

describe('GF-02 bounded worker CLI', () => {
  it('prints a structured bounded processing summary', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runGroupFeedCommand(testDb(), ['process', '--limit', '3']);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^group-feed: process \{"claimed":0/));
    log.mockRestore();
  });

  it('requeues only blocked outbox rows through the internal recovery command', async () => {
    await testDb().query(
      `INSERT INTO group_feed_outbox
       (group_id, source_type, source_id, event_type, source_transition_version,
        contract_version, source_transition_at, idempotency_key, status)
       VALUES (gen_random_uuid(), 'challenge', gen_random_uuid(), 'challenge_established',
         1, 1, now(), 'cli-blocked-test', 'blocked')`,
    );
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runGroupFeedCommand(testDb(), ['retry-blocked', '--limit', '2']);
    expect((await testDb().query<{ status: string }>(
      "SELECT status FROM group_feed_outbox WHERE idempotency_key = 'cli-blocked-test'",
    )).rows[0].status).toBe('pending');
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^group-feed: retry-blocked/));
    log.mockRestore();
  });

  it('rejects worker batch limits outside the bounded range', async () => {
    await expect(runGroupFeedCommand(testDb(), ['process', '--limit', '101']))
      .rejects.toThrow(/between 1 and 100/);
  });
});
