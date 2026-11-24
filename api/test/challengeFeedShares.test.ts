/**
 * CF-2 / CF-3 (S1) — Challenge Feed Activity Share publication, withdrawal
 * and authorized read.
 *
 * Proves the Founder-authorized minimum: self-only explicit publication of
 * the member's own accepted Activity, preview-free server authority,
 * idempotency (one active Share per member per source), withdrawal that
 * never touches canonical Activity evidence or progress, correction
 * safety at read time, the CF-01 §5 audience predicate on every read,
 * cursor paging, retention expiry, and strict Group Feed isolation.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appendCorrectionEvent, type ActivityEventResolvers, type KnowledgePin } from '../src/activityEvents.js';
import {
  applyChallengeActivity,
  type ChallengeActivityResolvers,
  type NewChallengeActivityInput,
} from '../src/challengeActivityApplication.js';
import {
  activateChallenge,
  createChallenge,
  type ChallengeCreationResolvers,
  type NewChallengeInput,
} from '../src/challenges.js';
import type { Db } from '../src/db.js';
import type { GroupMembershipAuthority } from '../src/groupMembershipAuthority.js';
import { listMigrationFiles, runMigrations, splitStatements } from '../src/migrate.js';
import {
  authHeaders,
  buildTestApp,
  seedGroup,
  seedMember,
  seedMembership,
  stubEligibility,
  testDb,
} from './helpers.js';

const CURSOR_SECRET = 'a'.repeat(64);

beforeEach(async () => {
  process.env.TIIZI_CHALLENGE_FEED_CURSOR_SECRET = CURSOR_SECRET;
  await testDb().query(
    'TRUNCATE challenge_feed_kudos, challenge_feed_share_choices, challenge_feed_shares, group_feed_projection_actions, group_feed_projection, group_feed_outbox, challenge_social_cause_decisions, challenge_social_causes, challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events, activity_submission_intents, challenge_finalizations, challenge_participation_finals',
  );
});

afterEach(() => {
  delete process.env.TIIZI_CHALLENGE_FEED_CURSOR_SECRET;
});

let seq = 0;
const next = (prefix: string): string => `${prefix}-${(seq += 1)}`;

function stubAuthority(
  eligible: boolean,
  options: { throwError?: string } = {},
): GroupMembershipAuthority {
  return {
    resolveGroupMembershipAuthority: async () => {
      if (options.throwError) throw new Error(options.throwError);
      return eligible ? { status: 'active', eligible: true } : { status: 'removed', eligible: false };
    },
  };
}

/** Membership authority that only ever reports the fixture's Group members
 * as eligible, so an outsider with no seeded membership is truly denied. */
function memberScopedAuthority(eligibleMemberIds: string[]): GroupMembershipAuthority {
  const eligible = new Set(eligibleMemberIds);
  return {
    resolveGroupMembershipAuthority: async (_groupId, memberId) =>
      eligible.has(memberId) ? { status: 'active', eligible: true } : { status: 'none', eligible: false },
  };
}

interface Fixture {
  sharerSubject: string;
  fellowSubject: string;
  outsiderSubject: string;
  sharerMemberId: string;
  fellowMemberId: string;
  groupId: string;
  challengeId: string;
  pin: KnowledgePin;
}

async function setupFixture(tag: string): Promise<Fixture> {
  const db = testDb();
  const sharerSubject = `${tag}-sharer`;
  const fellowSubject = `${tag}-fellow`;
  const outsiderSubject = `${tag}-outsider`;
  const sharerMemberId = await seedMember(db, sharerSubject);
  const fellowMemberId = await seedMember(db, fellowSubject);
  await seedMember(db, outsiderSubject);
  await db.query(`UPDATE members SET display_name = $1 WHERE member_id = $2`, ['Amara Test', sharerMemberId]);
  const groupId = await seedGroup(db, { name: `CF ${tag} Group` });
  await seedMembership(db, groupId, sharerMemberId, { status: 'active' });
  await seedMembership(db, groupId, fellowMemberId, { status: 'active' });
  const pinResult = await db.query<{ knowledge_id: string; current_version: number }>(
    `INSERT INTO knowledge_items (kind, name, lifecycle) VALUES ('fitness', $1, 'published')
     RETURNING knowledge_id, current_version`,
    [`Push-Up ${tag}`],
  );
  const pin: KnowledgePin = {
    knowledge_id: String(pinResult.rows[0].knowledge_id),
    current_version: Number(pinResult.rows[0].current_version),
  };
  const pins: Record<string, KnowledgePin> = { 'push-up': pin };
  const creationResolvers: ChallengeCreationResolvers = {
    resolveKnowledgePin: async (key) => pins[key] ?? null,
    resolveKnowledgeEligibility: async () => stubEligibility(),
    resolveGroupAuthority: async () => ({ status: 'active' }),
    resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
  };
  const { challenge } = await createChallenge(
    db,
    {
      group_id: groupId,
      created_by_member_id: sharerMemberId,
      challenge_type: 'collective',
      title: `CF ${tag} Challenge`,
      start_date: '2026-06-01',
      end_date: '2026-06-30',
      goal_value: 100,
      goal_unit: 'reps',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 100, unit: 'reps' }],
    } as NewChallengeInput,
    creationResolvers,
  );
  await activateChallenge(db, challenge.challenge_id);
  await db.query(
    `INSERT INTO challenge_participations
       (challenge_id, member_id, status, joined_at, joined_config_version)
     VALUES ($1, $2, 'active', '2026-06-02T10:00:00Z', 1)`,
    [challenge.challenge_id, sharerMemberId],
  );
  return {
    sharerSubject, fellowSubject, outsiderSubject,
    sharerMemberId, fellowMemberId, groupId, challengeId: challenge.challenge_id, pin,
  };
}

function activityResolvers(fx: Fixture): ChallengeActivityResolvers {
  return {
    resolveKnowledgePin: async () => fx.pin,
    resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
  };
}

function logInput(overrides?: Partial<NewChallengeActivityInput>): NewChallengeActivityInput {
  return {
    activity_kind: 'fitness',
    canonical_key: 'push-up',
    value: 10,
    unit: 'reps',
    occurred_at: new Date('2026-06-10T12:00:00Z'),
    client_key: next('cf-key'),
    ...overrides,
  };
}

async function acceptedActivity(fx: Fixture, value: number): Promise<string> {
  const result = await applyChallengeActivity(
    testDb(),
    fx.sharerMemberId,
    fx.challengeId,
    logInput({ value }),
    activityResolvers(fx),
    { now: new Date('2026-06-10T12:00:00Z') },
  );
  return result.record.event_id;
}

function appFor(fx: Fixture, authority?: GroupMembershipAuthority) {
  return buildTestApp(
    {
      'token-sharer': fx.sharerSubject,
      'token-fellow': fx.fellowSubject,
      'token-outsider': fx.outsiderSubject,
    },
    { challengeActivity: { groupMembershipAuthority: authority ?? memberScopedAuthority([fx.sharerMemberId, fx.fellowMemberId]) } },
  );
}

interface ShareState {
  shareId: string;
  activityEventId: string;
  publishedAt: string;
  withdrawn: boolean;
  visible: boolean;
  hiddenReason: string | null;
  shareGeneration: number;
}

interface FeedItem {
  feedItemId: string;
  kind: string;
  activityEventId?: string;
  kudosCount: number;
  viewerKudos: boolean;
  sharerDisplayName: string | null;
  activityName: string;
  value: number;
  unit: string;
  publishedAt: string;
  ownShare: boolean;
}

let choiceSeq = 0;
async function publish(
  app: { inject: (opts: unknown) => Promise<{ statusCode: number; json: () => unknown }> },
  challengeId: string,
  eventId: string,
  previewedValue: number,
  clientKey = `cf-choice-${(choiceSeq += 1)}-0123456789abcdef`,
  previewedUnit = 'reps',
  token = 'token-sharer',
  expectedGeneration = 0,
) {
  return app.inject({
    method: 'POST',
    url: `/api/challenges/${challengeId}/feed/activity-shares`,
    headers: { ...authHeaders(token), 'content-type': 'application/json' },
    payload: { activityEventId: eventId, clientKey, previewedValue, previewedUnit, expectedGeneration },
  });
}

describe('CF-2 S1 Activity Share publication', () => {
  it('publishes the member own accepted Activity and lists it for authorized viewers', async () => {
    const fx = await setupFixture(next('cf-s1-publish'));
    const app = appFor(fx, stubAuthority(true));
    const eventId = await acceptedActivity(fx, 25);

    const response = await publish(app, fx.challengeId, eventId, 25);
    expect(response.statusCode).toBe(200);
    const state = response.json() as ShareState;
    expect(state.withdrawn).toBe(false);
    expect(state.activityEventId).toBe(eventId);

    const feed = await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed`,
      headers: authHeaders('token-fellow'),
    });
    expect(feed.statusCode).toBe(200);
    const page = feed.json() as { items: FeedItem[]; nextCursor: string | null };
    expect(page.items).toHaveLength(1);
    const item = page.items[0];
    expect(item.kind).toBe('activity_share');
    expect(item.sharerDisplayName).toBe('Amara Test');
    expect(item.value).toBe(25);
    expect(item.unit).toBe('reps');
    expect(item.activityName).toContain('Push-Up');
    expect(item.ownShare).toBe(false);

    const own = await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed`,
      headers: authHeaders('token-sharer'),
    });
    expect(((own.json() as { items: FeedItem[] }).items[0]).ownShare).toBe(true);
  });

  it('is idempotent: repeat requests converge on one row, never a duplicate', async () => {
    const fx = await setupFixture(next('cf-s1-idem'));
    const app = appFor(fx, stubAuthority(true));
    const eventId = await acceptedActivity(fx, 12);

    const first = await publish(app, fx.challengeId, eventId, 12);
    const second = await publish(app, fx.challengeId, eventId, 12);
    expect(second.statusCode).toBe(200);
    expect((second.json() as ShareState).shareId).toBe((first.json() as ShareState).shareId);

    const rows = await testDb().query<{ count: string; active: string }>(
      `SELECT COUNT(*)::text AS count,
              COUNT(*) FILTER (WHERE withdrawn_at IS NULL AND suppressed_at IS NULL)::text AS active
         FROM challenge_feed_shares`,
    );
    expect(rows.rows[0].count).toBe('1');
    expect(rows.rows[0].active).toBe('1');
  });

  it('withdrawal hides the Share and never touches the canonical Activity', async () => {
    const fx = await setupFixture(next('cf-s1-withdraw'));
    const db = testDb();
    const app = appFor(fx, stubAuthority(true));
    const eventId = await acceptedActivity(fx, 18);
    await publish(app, fx.challengeId, eventId, 18);

    const ledgerBefore = await db.query(
      `SELECT e.event_id, e.value, e.status, e.recorded_at, r.record_id, r.accepted_at
         FROM member_activity_events e
         JOIN challenge_activity_records r ON r.event_id = e.event_id
        WHERE e.event_id = $1`,
      [eventId],
    );

    const withdraw = await app.inject({
      method: 'DELETE',
      url: `/api/challenges/${fx.challengeId}/feed/activity-shares/${eventId}`,
      headers: authHeaders('token-sharer'),
    });
    expect(withdraw.statusCode).toBe(200);
    expect((withdraw.json() as ShareState).withdrawn).toBe(true);

    // Idempotent withdrawal keeps the same state.
    const again = await app.inject({
      method: 'DELETE',
      url: `/api/challenges/${fx.challengeId}/feed/activity-shares/${eventId}`,
      headers: authHeaders('token-sharer'),
    });
    expect(again.statusCode).toBe(200);
    expect((again.json() as ShareState).withdrawn).toBe(true);

    const feed = await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed`,
      headers: authHeaders('token-fellow'),
    });
    expect(((feed.json() as { items: FeedItem[] }).items)).toHaveLength(0);

    const ledgerAfter = await db.query(
      `SELECT e.event_id, e.value, e.status, e.recorded_at, r.record_id, r.accepted_at
         FROM member_activity_events e
         JOIN challenge_activity_records r ON r.event_id = e.event_id
        WHERE e.event_id = $1`,
      [eventId],
    );
    expect(ledgerAfter.rows).toEqual(ledgerBefore.rows);
  });

  it('re-Sharing after withdrawal revives the same row', async () => {
    const fx = await setupFixture(next('cf-s1-revive'));
    const app = appFor(fx, stubAuthority(true));
    const eventId = await acceptedActivity(fx, 30);
    const first = (await publish(app, fx.challengeId, eventId, 30)).json() as ShareState;
    expect(first.shareGeneration).toBe(1);
    const withdrawn = (await app.inject({
      method: 'DELETE',
      url: `/api/challenges/${fx.challengeId}/feed/activity-shares/${eventId}`,
      headers: authHeaders('token-sharer'),
    })).json() as ShareState;
    expect(withdrawn.shareGeneration).toBe(2);
    const revived = await publish(app, fx.challengeId, eventId, 30, undefined, 'reps', 'token-sharer', withdrawn.shareGeneration);
    expect(revived.statusCode).toBe(200);
    const state = revived.json() as ShareState;
    expect(state.shareId).toBe(first.shareId);
    expect(state.withdrawn).toBe(false);
    expect(state.shareGeneration).toBe(3);
    const rows = await testDb().query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM challenge_feed_shares',
    );
    expect(rows.rows[0].count).toBe('1');
  });

  it('is self-only and audience-gated: foreign or unapplied Activities and outsiders are not-found', async () => {
    const fx = await setupFixture(next('cf-s1-selfonly'));
    // Default scoped authority: only the fixture's actual Group members are
    // eligible, so the outsider is genuinely denied on every path.
    const app = appFor(fx);
    const eventId = await acceptedActivity(fx, 40);

    // A fellow group member cannot publish the sharer's Activity.
    const foreign = await publish(app, fx.challengeId, eventId, 40, undefined, 'reps', 'token-fellow');
    expect(foreign.statusCode).toBe(404);

    // An outsider (no Group membership) cannot publish or read; the denial
    // is indistinguishable from an unknown Challenge.
    const outsiderPublish = await publish(app, fx.challengeId, eventId, 40, undefined, 'reps', 'token-outsider');
    expect(outsiderPublish.statusCode).toBe(404);
    const outsiderRead = await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed`,
      headers: authHeaders('token-outsider'),
    });
    expect(outsiderRead.statusCode).toBe(404);

    // Unauthenticated requests are rejected by the API auth hook.
    const anonymous = await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed`,
    });
    expect(anonymous.statusCode).toBe(401);

    // A non-member outsider withdrawing is also not-found.
    const outsiderWithdraw = await app.inject({
      method: 'DELETE',
      url: `/api/challenges/${fx.challengeId}/feed/activity-shares/${eventId}`,
      headers: authHeaders('token-outsider'),
    });
    expect(outsiderWithdraw.statusCode).toBe(404);
  });

  it('a corrected Activity stays shareable under its accepted identity and displays the current effective value', async () => {
    const fx = await setupFixture(next('cf-s1-corrected'));
    const db = testDb();
    const app = appFor(fx, stubAuthority(true));
    const eventId = await acceptedActivity(fx, 22);

    // Correct BEFORE sharing: this is the UI path (Recent Activity keeps the
    // accepted identity and displays the corrected value the member previews).
    const eventResolvers: ActivityEventResolvers = {
      resolveKnowledgePin: async () => fx.pin,
    };
    const original = await db.query<{ member_id: string; activity_kind: 'fitness'; canonical_key: string }>(
      'SELECT member_id, activity_kind, canonical_key FROM member_activity_events WHERE event_id = $1',
      [eventId],
    );
    await appendCorrectionEvent(db, {
      member_id: String(original.rows[0].member_id),
      activity_kind: original.rows[0].activity_kind,
      canonical_key: original.rows[0].canonical_key,
      occurred_at: new Date('2026-06-10T12:00:00Z'),
      occurred_day: '2026-06-10',
      value: 55,
      unit: 'reps',
      client_key: next('cf-corr'),
      supersedes_event_id: eventId,
      correction_kind: 'correction',
    }, eventResolvers);

    // The member previews the corrected value (55) and confirms under the
    // accepted identity; a stale pre-correction preview is refused.
    const stalePreview = await publish(app, fx.challengeId, eventId, 22);
    expect(stalePreview.statusCode).toBe(409);
    expect(((stalePreview.json() as { error: { code: string } }).error.code)).toBe('source_changed');

    const published = await publish(app, fx.challengeId, eventId, 55);
    expect(published.statusCode).toBe(200);

    // The read resolves the CURRENT lineage head: the Share displays the
    // corrected effective value (the same value the owner's History shows).
    const page = (await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed`,
      headers: authHeaders('token-fellow'),
    })).json() as { items: FeedItem[] };
    expect(page.items).toHaveLength(1);
    expect(page.items[0].value).toBe(55);
    expect(page.items[0].activityEventId).toBeUndefined();
  });

  it('a reversed Activity is never shareable and disappears from the Feed', async () => {
    const fx = await setupFixture(next('cf-s1-reversed'));
    const db = testDb();
    const app = appFor(fx, stubAuthority(true));
    const eventId = await acceptedActivity(fx, 30);
await publish(app, fx.challengeId, eventId, 30);

    const eventResolvers: ActivityEventResolvers = {
      resolveKnowledgePin: async () => fx.pin,
    };
    const original = await db.query<{ member_id: string; activity_kind: 'fitness'; canonical_key: string }>(
      'SELECT member_id, activity_kind, canonical_key FROM member_activity_events WHERE event_id = $1',
      [eventId],
    );
    await appendCorrectionEvent(db, {
      member_id: String(original.rows[0].member_id),
      activity_kind: original.rows[0].activity_kind,
      canonical_key: original.rows[0].canonical_key,
      occurred_at: new Date('2026-06-10T12:00:00Z'),
      occurred_day: '2026-06-10',
      value: 20,
      unit: 'reps',
      client_key: next('cf-rev'),
      supersedes_event_id: eventId,
      correction_kind: 'reversal',
    }, eventResolvers);

    const feed = await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed`,
      headers: authHeaders('token-fellow'),
    });
    expect(((feed.json() as { items: FeedItem[] }).items)).toHaveLength(0);

    // A reversed Activity is refused on publish — for the original AND for
    // a fresh application attempt of the same lineage.
const refused = await publish(app, fx.challengeId, eventId, 30);
    expect(refused.statusCode).toBe(409);
    expect(((refused.json() as { error: { code: string } }).error.code)).toBe('source_reversed');
  });

  it('an ancestor application in another Challenge never authorizes a source', async () => {
    const fx = await setupFixture(next('cf-s1-cross'));
    const db = testDb();
    const app = appFor(fx, stubAuthority(true));
    const eventId = await acceptedActivity(fx, 40);

    // A second Challenge in the same Group with the same configured Activity.
    const second = await db.query<{ challenge_id: string }>(
      `INSERT INTO challenges
         (group_id, created_by_member_id, challenge_type, status, title, start_date, end_date, goal_value, goal_unit, current_config_version)
       VALUES ($1, $2, 'collective', 'active', 'Second CF Challenge', '2026-06-01', '2026-06-30', 10, 'reps', 1)
       RETURNING challenge_id`,
      [fx.groupId, fx.sharerMemberId],
    );
    const secondId = String(second.rows[0].challenge_id);

    // Publishing the first Challenge's Activity into the second Challenge is
    // not-found: only a DIRECT application in the requested Challenge binds.
    const cross = await publish(app, secondId, eventId, 40);
    expect(cross.statusCode).toBe(404);

    // The lineage path: a correction of the first Challenge's Activity has
    // NO application of its own anywhere — its only ancestor applied in the
    // FIRST Challenge. Publishing that correction into the second Challenge
    // must still be not-found.
    const eventResolvers: ActivityEventResolvers = {
      resolveKnowledgePin: async () => fx.pin,
    };
    const original = await db.query<{ member_id: string; activity_kind: 'fitness'; canonical_key: string }>(
      'SELECT member_id, activity_kind, canonical_key FROM member_activity_events WHERE event_id = $1',
      [eventId],
    );
    const correction = await appendCorrectionEvent(db, {
      member_id: String(original.rows[0].member_id),
      activity_kind: original.rows[0].activity_kind,
      canonical_key: original.rows[0].canonical_key,
      occurred_at: new Date('2026-06-10T12:00:00Z'),
      occurred_day: '2026-06-10',
      value: 77,
      unit: 'reps',
      client_key: next('cf-cross-corr'),
      supersedes_event_id: eventId,
      correction_kind: 'correction',
    }, eventResolvers);
    const crossLineage = await publish(app, secondId, correction.event_id, 77);
    expect(crossLineage.statusCode).toBe(404);
    const rows = await db.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM challenge_feed_shares',
    );
    expect(rows.rows[0].count).toBe('0');
  });

  it('retries converge without reordering; a withdrawn Share needs a fresh choice', async () => {
    const fx = await setupFixture(next('cf-s1-retry'));
    const db = testDb();
    const app = appFor(fx, stubAuthority(true));
    const eventId = await acceptedActivity(fx, 9);
    const choiceKey = next('cf-choice-retry');

const first = await publish(app, fx.challengeId, eventId, 9, choiceKey);
    expect(first.statusCode).toBe(200);
    const firstState = first.json() as ShareState;
    const firstAt = (await db.query<{ published_at: string }>(
      'SELECT published_at FROM challenge_feed_shares WHERE share_id = $1',
      [firstState.shareId],
    )).rows[0].published_at;

    // An ordinary retry (same choice) does not reorder the Feed.
const retry = await publish(app, fx.challengeId, eventId, 9, choiceKey);
    expect(retry.statusCode).toBe(200);
    expect(((retry.json() as ShareState)).shareId).toBe(firstState.shareId);
    const retryAt = (await db.query<{ published_at: string }>(
      'SELECT published_at FROM challenge_feed_shares WHERE share_id = $1',
      [firstState.shareId],
    )).rows[0].published_at;
    expect(new Date(retryAt).getTime()).toBe(new Date(firstAt).getTime());

    // A repeat deliberate choice on an active Share is idempotent too.
const repeat = await publish(app, fx.challengeId, eventId, 9, next('cf-choice-fresh'));
    expect(repeat.statusCode).toBe(200);

    // Withdraw, then a DELAYED RETRY of the withdrawn choice cannot undo it.
    await app.inject({
      method: 'DELETE',
      url: `/api/challenges/${fx.challengeId}/feed/activity-shares/${eventId}`,
      headers: authHeaders('token-sharer'),
    });
const stale = await publish(app, fx.challengeId, eventId, 9, choiceKey);
    expect(stale.statusCode).toBe(409);
    expect(((stale.json() as { error: { code: string } }).error.code)).toBe('share_withdrawn');
    const hidden = await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed`,
      headers: authHeaders('token-sharer'),
    });
    expect(((hidden.json() as { items: FeedItem[] }).items)).toHaveLength(0);

    // A fresh explicit choice matching the current withdrawn generation
    // revives the same row with a new publication.
    const revived = await publish(app, fx.challengeId, eventId, 9, next('cf-choice-new'), 'reps', 'token-sharer', 2);
    expect(revived.statusCode).toBe(200);
    expect(((revived.json() as ShareState)).shareId).toBe(firstState.shareId);
    expect(((revived.json() as ShareState)).shareGeneration).toBe(3);
    const rows = await db.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM challenge_feed_shares',
    );
    expect(rows.rows[0].count).toBe('1');
  });

  it('pages across sub-millisecond boundaries without skipping Shares', async () => {
    const fx = await setupFixture(next('cf-s1-microseconds'));
    const db = testDb();
    const app = appFor(fx, stubAuthority(true));
    const events: Array<[string, number]> = [
      [await acceptedActivity(fx, 1), 1],
      [await acceptedActivity(fx, 2), 2],
      [await acceptedActivity(fx, 3), 3],
    ];
    for (const [eventId, value] of events) await publish(app, fx.challengeId, eventId, value);
    // Force two Shares to differ ONLY below millisecond precision — a JS
    // Date cursor would collapse this boundary and skip a row.
    await db.query(
      `UPDATE challenge_feed_shares SET published_at = '2026-06-10T12:00:00.123456Z'::timestamptz WHERE activity_event_id = $1`,
      [events[0][0]],
    );
    await db.query(
      `UPDATE challenge_feed_shares SET published_at = '2026-06-10T12:00:00.123400Z'::timestamptz WHERE activity_event_id = $1`,
      [events[1][0]],
    );
    await db.query(
      `UPDATE challenge_feed_shares SET published_at = '2026-06-10T12:00:00.123300Z'::timestamptz WHERE activity_event_id = $1`,
      [events[2][0]],
    );

    const first = await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed?limit=2`,
      headers: authHeaders('token-fellow'),
    });
    const page1 = first.json() as { items: FeedItem[]; nextCursor: string | null };
    expect(page1.items).toHaveLength(2);
    expect(page1.items[0].value).toBe(1);
    expect(page1.items[1].value).toBe(2);

    const second = await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed?limit=2&cursor=${encodeURIComponent(page1.nextCursor!)}`,
      headers: authHeaders('token-fellow'),
    });
    const page2 = second.json() as { items: FeedItem[] };
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0].value).toBe(3);
  });

  it('lets an eligible member toggle the single Kudos type on a visible entry', async () => {
    const fx = await setupFixture(next('cf-s1-kudos'));
    const db = testDb();
    const app = appFor(fx);
    const eventId = await acceptedActivity(fx, 24);
    await publish(app, fx.challengeId, eventId, 24);
    const feed = (await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed`,
      headers: authHeaders('token-sharer'),
    })).json() as { items: FeedItem[] };
    const entry = feed.items[0];

    // Add (idempotent), read back through the Feed, then remove.
    const add = await app.inject({
      method: 'POST',
      url: `/api/challenges/${fx.challengeId}/feed/entries/${entry.feedItemId}/kudos`,
      headers: authHeaders('token-fellow'),
    });
    expect(add.statusCode).toBe(200);
    const first = add.json() as { kudosCount: number; viewerKudos: boolean };
    expect(first.viewerKudos).toBe(true);
    expect(first.kudosCount).toBe(1);

    const addAgain = await app.inject({
      method: 'POST',
      url: `/api/challenges/${fx.challengeId}/feed/entries/${entry.feedItemId}/kudos`,
      headers: authHeaders('token-fellow'),
    });
    expect(addAgain.statusCode).toBe(200);
    expect((addAgain.json() as { kudosCount: number }).kudosCount).toBe(1);

    const feedWithKudos = (await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed`,
      headers: authHeaders('token-fellow'),
    })).json() as { items: FeedItem[] };
    expect(feedWithKudos.items[0].kudosCount).toBe(1);
    expect(feedWithKudos.items[0].viewerKudos).toBe(true);

    const remove = await app.inject({
      method: 'DELETE',
      url: `/api/challenges/${fx.challengeId}/feed/entries/${entry.feedItemId}/kudos`,
      headers: authHeaders('token-fellow'),
    });
    expect(remove.statusCode).toBe(200);
    expect((remove.json() as { viewerKudos: boolean }).viewerKudos).toBe(false);
    expect((remove.json() as { kudosCount: number }).kudosCount).toBe(0);

    // Removal never touches the Share or the canonical Activity.
    const shares = await db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM challenge_feed_shares');
    expect(shares.rows[0].count).toBe('1');
  });

  it('refuses self-Kudos, denies non-members, and hides Kudos on withdrawn entries', async () => {
    const fx = await setupFixture(next('cf-s1-kudos-guards'));
    const app = appFor(fx);
    const eventId = await acceptedActivity(fx, 26);
    await publish(app, fx.challengeId, eventId, 26);
    const feed = (await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed`,
      headers: authHeaders('token-sharer'),
    })).json() as { items: FeedItem[] };
    const entry = feed.items[0];
    const kudosUrl = `/api/challenges/${fx.challengeId}/feed/entries/${entry.feedItemId}/kudos`;

    // No self-Kudos (CF-01 §6.2).
    const self = await app.inject({ method: 'POST', url: kudosUrl, headers: authHeaders('token-sharer') });
    expect(self.statusCode).toBe(409);
    expect(((self.json() as { error: { code: string } }).error.code)).toBe('self_kudos');

    // An outsider with no Group membership is denied indistinguishably.
    const outsider = await app.inject({ method: 'POST', url: kudosUrl, headers: authHeaders('token-outsider') });
    expect(outsider.statusCode).toBe(404);

    // A withdrawn entry is no longer Kudos-mutable.
    await app.inject({
      method: 'DELETE',
      url: `/api/challenges/${fx.challengeId}/feed/activity-shares/${eventId}`,
      headers: authHeaders('token-sharer'),
    });
    const withdrawn = await app.inject({ method: 'POST', url: kudosUrl, headers: authHeaders('token-fellow') });
    expect(withdrawn.statusCode).toBe(404);
  });

  it('serves the owner a state read that reports reversal, suppression and expiry honestly', async () => {
    const fx = await setupFixture(next('cf-s1-hidden-reasons'));
    const db = testDb();
    const app = appFor(fx, stubAuthority(true));
    const eventId = await acceptedActivity(fx, 33);
    await publish(app, fx.challengeId, eventId, 33);

    const stateUrl = `/api/challenges/${fx.challengeId}/feed/activity-shares/${eventId}`;
    const active = await app.inject({ method: 'GET', url: stateUrl, headers: authHeaders('token-sharer') });
    expect(((active.json() as ShareState)).visible).toBe(true);
    expect(((active.json() as ShareState)).hiddenReason).toBeNull();

    // Reversal hides the Share; the owner state says so.
    const eventResolvers: ActivityEventResolvers = { resolveKnowledgePin: async () => fx.pin };
    const original = await db.query<{ member_id: string; activity_kind: 'fitness'; canonical_key: string }>(
      'SELECT member_id, activity_kind, canonical_key FROM member_activity_events WHERE event_id = $1',
      [eventId],
    );
    await appendCorrectionEvent(db, {
      member_id: String(original.rows[0].member_id),
      activity_kind: original.rows[0].activity_kind,
      canonical_key: original.rows[0].canonical_key,
      occurred_at: new Date('2026-06-10T12:00:00Z'),
      occurred_day: '2026-06-10',
      value: 33,
      unit: 'reps',
      client_key: next('cf-hidden-rev'),
      supersedes_event_id: eventId,
      correction_kind: 'reversal',
    }, eventResolvers);
    const reversedState = (await app.inject({ method: 'GET', url: stateUrl, headers: authHeaders('token-sharer') })).json() as ShareState;
    expect(reversedState.visible).toBe(false);
    expect(reversedState.hiddenReason).toBe('reversed');

    // A withdrawal followed by reversal still reports REVERSAL — the more
    // actionable reason — so the panel never offers a Share action for it.
    await app.inject({
      method: 'DELETE',
      url: `/api/challenges/${fx.challengeId}/feed/activity-shares/${eventId}`,
      headers: authHeaders('token-sharer'),
    });
    const withdrawnThenReversed = (await app.inject({ method: 'GET', url: stateUrl, headers: authHeaders('token-sharer') })).json() as ShareState;
    expect(withdrawnThenReversed.visible).toBe(false);
    expect(withdrawnThenReversed.hiddenReason).toBe('reversed');

    // Suppression is reported as suppression, never as a plain withdrawal
    // reason (the earlier member withdrawal remains a truthful audit fact).
    await db.query(
      `UPDATE challenge_feed_shares SET suppressed_at = now(), suppression_reason_code = 'system_safety' WHERE member_id = $1 AND activity_event_id = $2`,
      [fx.sharerMemberId, eventId],
    );
    const suppressedState = (await app.inject({ method: 'GET', url: stateUrl, headers: authHeaders('token-sharer') })).json() as ShareState;
    expect(suppressedState.visible).toBe(false);
    expect(suppressedState.hiddenReason).toBe('suppressed');
    expect(suppressedState.withdrawn).toBe(true);

    // Retention expiry hides the Share too, reported exactly.
    await db.query(`UPDATE challenges SET ended_at = now() - interval '100 days' WHERE challenge_id = $1`, [fx.challengeId]);
    const expiredState = (await app.inject({ method: 'GET', url: stateUrl, headers: authHeaders('token-sharer') })).json() as ShareState;
    expect(expiredState.visible).toBe(false);
    expect(expiredState.hiddenReason).toBe('expired');
  });

  it('a withdrawal followed by a reversal still reports reversal as the actionable reason', async () => {
    const fx = await setupFixture(next('cf-s1-wdr'));
    const db = testDb();
    const app = appFor(fx, stubAuthority(true));
    const eventId = await acceptedActivity(fx, 31);
    await publish(app, fx.challengeId, eventId, 31);

    // The member withdraws FIRST…
    const withdrawn = await app.inject({
      method: 'DELETE',
      url: `/api/challenges/${fx.challengeId}/feed/activity-shares/${eventId}`,
      headers: authHeaders('token-sharer'),
    });
    expect(withdrawn.statusCode).toBe(200);

    // …and the Activity is then reversed.
    const eventResolvers: ActivityEventResolvers = { resolveKnowledgePin: async () => fx.pin };
    const original = await db.query<{ member_id: string; activity_kind: 'fitness'; canonical_key: string }>(
      'SELECT member_id, activity_kind, canonical_key FROM member_activity_events WHERE event_id = $1',
      [eventId],
    );
    await appendCorrectionEvent(db, {
      member_id: String(original.rows[0].member_id),
      activity_kind: original.rows[0].activity_kind,
      canonical_key: original.rows[0].canonical_key,
      occurred_at: new Date('2026-06-10T12:00:00Z'),
      occurred_day: '2026-06-10',
      value: 31,
      unit: 'reps',
      client_key: next('cf-wdr-rev'),
      supersedes_event_id: eventId,
      correction_kind: 'reversal',
    }, eventResolvers);

    const state = (await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed/activity-shares/${eventId}`,
      headers: authHeaders('token-sharer'),
    })).json() as ShareState;
    expect(state.visible).toBe(false);
    expect(state.hiddenReason).toBe('reversed');
    expect(state.withdrawn).toBe(true);
  });

  it('a successful retry refreshes its own replay protection instead of pruning it', async () => {
    const fx = await setupFixture(next('cf-s1-aged-key'));
    const db = testDb();
    const app = appFor(fx, stubAuthority(true));
    const eventId = await acceptedActivity(fx, 16);
    const agedKey = next('cf-choice-aged');

    const first = await publish(app, fx.challengeId, eventId, 16, agedKey);
    expect(first.statusCode).toBe(200);
    const shareId = (first.json() as ShareState).shareId;

    // Age the acknowledged key beyond the 24-hour horizon, then RETRY it
    // while the Share is still active: the retry succeeds and must refresh
    // its acknowledged timestamp rather than let the prune delete it.
    await db.query(
      `UPDATE challenge_feed_share_choices SET acknowledged_at = now() - interval '25 hours' WHERE share_id = $1`,
      [shareId],
    );
    const retry = await publish(app, fx.challengeId, eventId, 16, agedKey);
    expect(retry.statusCode).toBe(200);

    await app.inject({
      method: 'DELETE',
      url: `/api/challenges/${fx.challengeId}/feed/activity-shares/${eventId}`,
      headers: authHeaders('token-sharer'),
    });

    // The aged key's replay after the withdrawal is refused — its
    // successful retry kept its replay protection alive.
    const replay = await publish(app, fx.challengeId, eventId, 16, agedKey);
    expect(replay.statusCode).toBe(409);
    expect(((replay.json() as { error: { code: string } }).error.code)).toBe('share_withdrawn');
  });

  it('authorizes Kudos REMOVAL with the same entry predicate as the add', async () => {
    const fx = await setupFixture(next('cf-s1-kudos-remove'));
    const db = testDb();
    const app = appFor(fx);
    const eventId = await acceptedActivity(fx, 28);
    await publish(app, fx.challengeId, eventId, 28);
    const feed = (await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed`,
      headers: authHeaders('token-sharer'),
    })).json() as { items: FeedItem[] };
    const entry = feed.items[0];
    await app.inject({
      method: 'POST',
      url: `/api/challenges/${fx.challengeId}/feed/entries/${entry.feedItemId}/kudos`,
      headers: authHeaders('token-fellow'),
    });

    // Removal succeeds on the visible entry…
    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/challenges/${fx.challengeId}/feed/entries/${entry.feedItemId}/kudos`,
      headers: authHeaders('token-fellow'),
    });
    expect(removed.statusCode).toBe(200);
    expect(((removed.json() as { viewerKudos: boolean })).viewerKudos).toBe(false);

    // …but a cross-Challenge entry id is not-found, never a silent zero state.
    const other = await setupFixture(next('cf-s1-kudos-remove-other'));
    const crossChallenge = await app.inject({
      method: 'DELETE',
      url: `/api/challenges/${other.challengeId}/feed/entries/${entry.feedItemId}/kudos`,
      headers: authHeaders('token-fellow'),
    });
    expect(crossChallenge.statusCode).toBe(404);

    // A withdrawn entry is not Kudos-mutable for removal either.
    await app.inject({
      method: 'DELETE',
      url: `/api/challenges/${fx.challengeId}/feed/activity-shares/${eventId}`,
      headers: authHeaders('token-sharer'),
    });
    const withdrawnRemove = await app.inject({
      method: 'DELETE',
      url: `/api/challenges/${fx.challengeId}/feed/entries/${entry.feedItemId}/kudos`,
      headers: authHeaders('token-fellow'),
    });
    expect(withdrawnRemove.statusCode).toBe(404);

    // A missing entry id is not-found (never a 200 zero-count).
    const missing = await app.inject({
      method: 'DELETE',
      url: `/api/challenges/${fx.challengeId}/feed/entries/00000000-0000-4000-8000-0000000000ff/kudos`,
      headers: authHeaders('token-fellow'),
    });
    expect(missing.statusCode).toBe(404);

  });

  it('rate-limits every Kudos mutation call, including add/remove toggling', async () => {
    const fx = await setupFixture(next('cf-s1-kudos-rate'));
    const app = appFor(fx);
    const eventId = await acceptedActivity(fx, 19);
    await publish(app, fx.challengeId, eventId, 19);
    const feed = (await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed`,
      headers: authHeaders('token-sharer'),
    })).json() as { items: FeedItem[] };
    const entry = feed.items[0];

    // The in-process sliding window counts EVERY mutation call — including
    // idempotent re-adds and add/remove toggling on one entry — so a
    // hard-deleted row can never reset the counter: the 31st mutation in a
    // minute is refused with 429.
    let limitedSeen = false;
    let succeeded = 0;
    for (let i = 0; i < 40 && !limitedSeen; i += 1) {
      const attempt = await app.inject({
        method: i % 2 === 0 ? 'POST' : 'DELETE',
        url: `/api/challenges/${fx.challengeId}/feed/entries/${entry.feedItemId}/kudos`,
        headers: authHeaders('token-fellow'),
      });
      if (attempt.statusCode === 429) {
        limitedSeen = true;
        expect(((attempt.json() as { error: { code: string } }).error.code)).toBe('kudos_rate_limited');
      } else {
        succeeded += 1;
      }
    }
    expect(limitedSeen).toBe(true);
    expect(succeeded).toBe(30);
  });

  it('discloses the canonical event ID only to the Share owner, and serves the owner an exact state read', async () => {
    const fx = await setupFixture(next('cf-s1-disclosure'));
    const app = appFor(fx, stubAuthority(true));
    const eventId = await acceptedActivity(fx, 21);
await publish(app, fx.challengeId, eventId, 21);

    const fellowView = (await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed`,
      headers: authHeaders('token-fellow'),
    })).json() as { items: FeedItem[] };
    expect(fellowView.items[0].activityEventId).toBeUndefined();

    const ownView = (await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed`,
      headers: authHeaders('token-sharer'),
    })).json() as { items: FeedItem[] };
    expect(ownView.items[0].activityEventId).toBe(eventId);

    // The owner's exact state read; another member's request is not-found.
    const ownState = await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed/activity-shares/${eventId}`,
      headers: authHeaders('token-sharer'),
    });
    expect(ownState.statusCode).toBe(200);
    expect(((ownState.json() as ShareState)).withdrawn).toBe(false);
    const foreignState = await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed/activity-shares/${eventId}`,
      headers: authHeaders('token-fellow'),
    });
    expect(foreignState.statusCode).toBe(404);

    // After withdrawal the owner's read reports the hidden state.
    await app.inject({
      method: 'DELETE',
      url: `/api/challenges/${fx.challengeId}/feed/activity-shares/${eventId}`,
      headers: authHeaders('token-sharer'),
    });
    const withdrawnState = await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed/activity-shares/${eventId}`,
      headers: authHeaders('token-sharer'),
    });
    expect(((withdrawnState.json() as ShareState)).withdrawn).toBe(true);
  });


  it('publishes no Group Feed event (strict Group Feed isolation)', async () => {
    const fx = await setupFixture(next('cf-s1-isolation'));
    const app = appFor(fx);
    const eventId = await acceptedActivity(fx, 15);
    // Challenge activation itself legitimately publishes an automatic Group
    // Feed transition; the baseline proves the Share adds nothing on top.
    const before = await testDb().query<{ outbox: string; projection: string }>(
      `SELECT (SELECT COUNT(*)::text FROM group_feed_outbox) AS outbox,
              (SELECT COUNT(*)::text FROM group_feed_projection) AS projection`,
    );
await publish(app, fx.challengeId, eventId, 9);
    const after = await testDb().query<{ outbox: string; projection: string }>(
      `SELECT (SELECT COUNT(*)::text FROM group_feed_outbox) AS outbox,
              (SELECT COUNT(*)::text FROM group_feed_projection) AS projection`,
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it('pages with a signed challenge-bound cursor without duplicating or skipping', async () => {
    const fx = await setupFixture(next('cf-s1-paging'));
    const app = appFor(fx, stubAuthority(true));
    const events: Array<[string, number]> = [
      [await acceptedActivity(fx, 1), 1],
      [await acceptedActivity(fx, 2), 2],
      [await acceptedActivity(fx, 3), 3],
    ];
    for (const [eventId, value] of events) await publish(app, fx.challengeId, eventId, value);

    const first = await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed?limit=2`,
      headers: authHeaders('token-fellow'),
    });
    const page1 = first.json() as { items: FeedItem[]; nextCursor: string | null };
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).toBeTruthy();

    const second = await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed?limit=2&cursor=${encodeURIComponent(page1.nextCursor!)}`,
      headers: authHeaders('token-fellow'),
    });
    const page2 = second.json() as { items: FeedItem[]; nextCursor: string | null };
    expect(page2.items).toHaveLength(1);
    const seenIds = [...page1.items, ...page2.items].map((item) => item.feedItemId);
    expect(new Set(seenIds).size).toBe(3);
    expect(page2.nextCursor).toBeNull();

    // The cursor is Challenge-bound: another Challenge rejects it.
    const other = await setupFixture(next('cf-s1-paging-other'));
    const rebound = await app.inject({
      method: 'GET',
      url: `/api/challenges/${other.challengeId}/feed?limit=2&cursor=${encodeURIComponent(page1.nextCursor!)}`,
      headers: authHeaders('token-fellow'),
    });
    expect(rebound.statusCode).toBe(400);
    expect(((rebound.json() as { error: { code: string } }).error.code)).toBe('invalid_cursor');
  });

  it('expires the Feed after the Challenge lifetime plus 90 days', async () => {
    const fx = await setupFixture(next('cf-s1-retention'));
    const db = testDb();
    const app = appFor(fx, stubAuthority(true));
    const eventId = await acceptedActivity(fx, 9);
    await publish(app, fx.challengeId, eventId, 9);
    await db.query(`UPDATE challenges SET ended_at = now() - interval '100 days' WHERE challenge_id = $1`, [fx.challengeId]);

    const feed = await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed`,
      headers: authHeaders('token-sharer'),
    });
    expect(feed.statusCode).toBe(200);
    expect(((feed.json() as { items: FeedItem[] }).items)).toHaveLength(0);

    const expired = await publish(app, fx.challengeId, eventId, 9);
    expect(expired.statusCode).toBe(409);
    expect(((expired.json() as { error: { code: string } }).error.code)).toBe('feed_expired');
  });

  it('fails closed on authority outage and denies removed members as not-found', async () => {
    const fx = await setupFixture(next('cf-s1-authority'));
    const eventId = await acceptedActivity(fx, 7);

    const outage = appFor(fx, stubAuthority(true, { throwError: 'authority down' }));
    const outageResponse = await outage.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed`,
      headers: authHeaders('token-sharer'),
    });
    expect(outageResponse.statusCode).toBe(503);
    expect(((outageResponse.json() as { error: { code: string } }).error.code)).toBe('feed_unavailable');

    const removed = appFor(fx, stubAuthority(false));
    const removedResponse = await removed.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed`,
      headers: authHeaders('token-sharer'),
    });
    expect(removedResponse.statusCode).toBe(404);
    const removedPublish = await publish(removed, fx.challengeId, eventId, 7);
    expect(removedPublish.statusCode).toBe(404);
  });

  it('rejects replayed choice key after 24h pruning and withdrawal across a fresh session, while allowing genuine fresh confirmation', async () => {
    const fx = await setupFixture(next('cf-s1-replay-pruned'));
    const db = testDb();
    const app = appFor(fx, stubAuthority(true));
    const eventId = await acceptedActivity(fx, 42);
    const keyA = next('cf-replay-key-a');
    const keyB = next('cf-replay-key-b');
    const keyC = next('cf-replay-key-c');

    // Capture baseline Activity evidence & Challenge progress.
    const progressBefore = await db.query(
      `SELECT d.collective_total, p.logs_accepted, p.cumulative_total
         FROM challenge_derived_state d
         JOIN challenge_participation_derived p ON p.challenge_id = d.challenge_id
        WHERE d.challenge_id = $1`,
      [fx.challengeId],
    );

    // 1. Publish Activity with acknowledged choice key A (expectedGeneration = 0).
    const first = await publish(app, fx.challengeId, eventId, 42, keyA, 'reps', 'token-sharer', 0);
    expect(first.statusCode).toBe(200);
    const firstState = first.json() as ShareState;
    expect(firstState.visible).toBe(true);
    expect(firstState.shareGeneration).toBe(1);

    // 2. Withdraw publication.
    const w1 = await app.inject({
      method: 'DELETE',
      url: `/api/challenges/${fx.challengeId}/feed/activity-shares/${eventId}`,
      headers: authHeaders('token-sharer'),
    });
    expect(w1.statusCode).toBe(200);
    expect((w1.json() as ShareState).shareGeneration).toBe(2);

    // 3. Advance clock beyond 24h retention horizon for choice key A.
    await db.query(
      `UPDATE challenge_feed_share_choices
          SET acknowledged_at = now() - interval '25 hours'
        WHERE share_id = $1 AND client_key = $2`,
      [firstState.shareId, keyA],
    );

    // 4. Cause acknowledged-key pruning through an otherwise valid fresh publication (key B).
    const republish = await publish(app, fx.challengeId, eventId, 42, keyB, 'reps', 'token-sharer', 2);
    expect(republish.statusCode).toBe(200);
    expect((republish.json() as ShareState).shareGeneration).toBe(3);

    // Confirm key A really was pruned from challenge_feed_share_choices.
    const remainingKeys = await db.query<{ client_key: string }>(
      `SELECT client_key FROM challenge_feed_share_choices WHERE share_id = $1`,
      [firstState.shareId],
    );
    expect(remainingKeys.rows.map((r) => r.client_key)).toEqual([keyB]);

    // Also verify replaying key A while generation 3 is active is refused.
    const replayWhileActive = await publish(app, fx.challengeId, eventId, 42, keyA, 'reps', 'token-sharer', 0);
    expect(replayWhileActive.statusCode).toBe(409);
    expect(((replayWhileActive.json() as { error: { code: string } }).error.code)).toBe('share_withdrawn');

    // 5. Withdraw the subsequent publication.
    const w2 = await app.inject({
      method: 'DELETE',
      url: `/api/challenges/${fx.challengeId}/feed/activity-shares/${eventId}`,
      headers: authHeaders('token-sharer'),
    });
    expect(w2.statusCode).toBe(200);
    const withdrawn2 = w2.json() as ShareState;
    expect(withdrawn2.withdrawn).toBe(true);
    expect(withdrawn2.shareGeneration).toBe(4);

    // 6. Replay previously acknowledged key A using a fresh valid authenticated session.
    const freshSessionApp = buildTestApp(
      { 'fresh-session-token': fx.sharerSubject },
      { challengeActivity: { groupMembershipAuthority: memberScopedAuthority([fx.sharerMemberId, fx.fellowMemberId]) } },
    );
    const replayAfterPrune = await publish(
      freshSessionApp,
      fx.challengeId,
      eventId,
      42,
      keyA,
      'reps',
      'fresh-session-token',
      0,
    );
    expect(replayAfterPrune.statusCode).toBe(409);
    expect(((replayAfterPrune.json() as { error: { code: string } }).error.code)).toBe('share_withdrawn');

    // Feed remains empty; owner state remains withdrawn at generation 4.
    const feedWhileWithdrawn = await freshSessionApp.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed`,
      headers: authHeaders('fresh-session-token'),
    });
    expect(((feedWhileWithdrawn.json() as { items: FeedItem[] }).items)).toHaveLength(0);

    // Genuine fresh confirmation with current shareGeneration succeeds.
    const ownerState = (await freshSessionApp.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed/activity-shares/${eventId}`,
      headers: authHeaders('fresh-session-token'),
    })).json() as ShareState;
    expect(ownerState.shareGeneration).toBe(4);

    const freshConfirm = await publish(
      freshSessionApp,
      fx.challengeId,
      eventId,
      42,
      keyC,
      'reps',
      'fresh-session-token',
      ownerState.shareGeneration,
    );
    expect(freshConfirm.statusCode).toBe(200);
    const finalState = freshConfirm.json() as ShareState;
    expect(finalState.visible).toBe(true);
    expect(finalState.withdrawn).toBe(false);
    expect(finalState.shareGeneration).toBe(5);

    // Same-key retry immediately after revival (still submitting expectedGeneration = 4)
    // remains idempotent and keeps shareGeneration at 5.
    const postRevivalRetry = await publish(
      freshSessionApp,
      fx.challengeId,
      eventId,
      42,
      keyC,
      'reps',
      'fresh-session-token',
      ownerState.shareGeneration,
    );
    expect(postRevivalRetry.statusCode).toBe(200);
    expect((postRevivalRetry.json() as ShareState).shareGeneration).toBe(5);
    expect((postRevivalRetry.json() as ShareState).publishedAt).toBe(finalState.publishedAt);

    const feedAfterFresh = await app.inject({
      method: 'GET',
      url: `/api/challenges/${fx.challengeId}/feed`,
      headers: authHeaders('token-fellow'),
    });
    expect(((feedAfterFresh.json() as { items: FeedItem[] }).items)).toHaveLength(1);

    // Activity evidence and Challenge progress remain completely unchanged.
    const progressAfter = await db.query(
      `SELECT d.collective_total, p.logs_accepted, p.cumulative_total
         FROM challenge_derived_state d
         JOIN challenge_participation_derived p ON p.challenge_id = d.challenge_id
        WHERE d.challenge_id = $1`,
      [fx.challengeId],
    );
    expect(progressAfter.rows).toEqual(progressBefore.rows);
  });

  it('bounds choice-key storage per Share and rejects stale or invalid generations', async () => {
    const fx = await setupFixture(next('cf-s1-bounded-choices'));
    const db = testDb();
    const app = appFor(fx, stubAuthority(true));
    const eventId = await acceptedActivity(fx, 19);

    // Mismatched generation when no Share exists yet -> 409 share_state_changed.
    const wrongInitial = await publish(app, fx.challengeId, eventId, 19, next('cf-bad-gen-0123456789'), 'reps', 'token-sharer', 1);
    expect(wrongInitial.statusCode).toBe(409);
    expect(((wrongInitial.json() as { error: { code: string } }).error.code)).toBe('share_state_changed');

    // Negative generation -> 400 validation error.
    const negativeGen = await publish(app, fx.challengeId, eventId, 19, next('cf-neg-gen-0123456789'), 'reps', 'token-sharer', -1);
    expect(negativeGen.statusCode).toBe(400);

    // Publish 70 distinct keys on active Share -> choice table stays capped at 64 rows
    // and oldest key is evicted even within the 24-hour window.
    const firstCapKey = next('cf-cap-00-0123456789');
    const first = await publish(app, fx.challengeId, eventId, 19, firstCapKey, 'reps', 'token-sharer', 0);
    expect(first.statusCode).toBe(200);
    const shareId = (first.json() as ShareState).shareId;
    await db.query(
      `UPDATE challenge_feed_share_choices
          SET acknowledged_at = now() - interval '1 minute'
        WHERE share_id = $1 AND client_key = $2`,
      [shareId, firstCapKey],
    );
    for (let i = 1; i < 70; i += 1) {
      const res = await publish(app, fx.challengeId, eventId, 19, next(`cf-cap-${i}-0123456789`), 'reps', 'token-sharer', 1);
      expect(res.statusCode).toBe(200);
    }

    const rowCount = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM challenge_feed_share_choices WHERE share_id = $1`,
      [shareId],
    );
    expect(Number(rowCount.rows[0].count)).toBeLessThanOrEqual(64);

    const evictedPresence = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM challenge_feed_share_choices WHERE share_id = $1 AND client_key = $2`,
      [shareId, firstCapKey],
    );
    expect(Number(evictedPresence.rows[0].count)).toBe(0);

    // Future generation while active -> 409 share_state_changed.
    const futureGen = await publish(app, fx.challengeId, eventId, 19, next('cf-future-gen-0123456789'), 'reps', 'token-sharer', 99);
    expect(futureGen.statusCode).toBe(409);
    expect(((futureGen.json() as { error: { code: string } }).error.code)).toBe('share_state_changed');

    // Withdraw -> even key #0 (evicted by the 64-row cap) cannot replay.
    await app.inject({
      method: 'DELETE',
      url: `/api/challenges/${fx.challengeId}/feed/activity-shares/${eventId}`,
      headers: authHeaders('token-sharer'),
    });
    const evictedReplay = await publish(app, fx.challengeId, eventId, 19, firstCapKey, 'reps', 'token-sharer', 0);
    expect(evictedReplay.statusCode).toBe(409);
    expect(((evictedReplay.json() as { error: { code: string } }).error.code)).toBe('share_withdrawn');
  });

  it('upgrades a database already migrated at the prior PR #181 Kudos schema (033_challenge_feed_kudos.sql) while preserving existing Kudos and Share rows', async () => {
    const pg = new PGlite({ extensions: { pgcrypto } });
    const legacyDb: Db = {
      query: async <T>(text: string, params?: unknown[]) => {
        const res = await pg.query<T>(text, params);
        return { rows: res.rows };
      },
      transaction: async <T>(fn: (tx: Db) => Promise<T>) => pg.transaction(async (tx) => fn({
        query: async <U>(text: string, params?: unknown[]) => {
          const res = await tx.query<U>(text, params);
          return { rows: res.rows };
        },
        transaction: async () => {
          throw new Error('nested transactions unsupported');
        },
        close: async () => {},
      })),
      close: () => pg.close(),
    };

    const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
    const files = await listMigrationFiles();
    const index033 = files.indexOf('033_challenge_feed_share_generation.sql');
    expect(index033).toBeGreaterThan(0);

    await legacyDb.query(`CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    for (const file of files.slice(0, index033)) {
      for (const statement of splitStatements(await readFile(join(migrationsDir, file), 'utf8'))) {
        await legacyDb.query(statement);
      }
      await legacyDb.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    }

    // Simulate the previous PR #181 head where Kudos occupied slot 033.
    const priorKudosSql = `
      CREATE TABLE challenge_feed_kudos (
        kudos_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        share_id UUID NOT NULL,
        member_id UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT challenge_feed_kudos_member_uq UNIQUE (share_id, member_id)
      );
      CREATE INDEX challenge_feed_kudos_share_idx ON challenge_feed_kudos (share_id);
      CREATE INDEX challenge_feed_kudos_member_recent_idx ON challenge_feed_kudos (member_id, created_at);
    `;
    for (const statement of splitStatements(priorKudosSql)) {
      await legacyDb.query(statement);
    }
    await legacyDb.query('INSERT INTO schema_migrations (filename) VALUES ($1)', ['033_challenge_feed_kudos.sql']);

    const challengeId = '11111111-1111-4111-8111-111111111111';
    const sharerId = '22222222-2222-4222-8222-222222222222';
    const giverId = '33333333-3333-4333-8333-333333333333';
    const eventId = '44444444-4444-4444-8444-444444444444';
    const recordId = '55555555-5555-4555-8555-555555555555';
    const shareRow = await legacyDb.query<{ share_id: string }>(
      `INSERT INTO challenge_feed_shares
         (challenge_id, member_id, activity_event_id, activity_record_id, event_family, last_publish_key)
       VALUES ($1, $2, $3, $4, 'activity_share', 'legacy-key-0123456789')
       RETURNING share_id`,
      [challengeId, sharerId, eventId, recordId],
    );
    const shareId = String(shareRow.rows[0].share_id);
    const kudosRow = await legacyDb.query<{ kudos_id: string }>(
      `INSERT INTO challenge_feed_kudos (share_id, member_id) VALUES ($1, $2) RETURNING kudos_id`,
      [shareId, giverId],
    );
    const kudosId = String(kudosRow.rows[0].kudos_id);

    // Upgrade via runMigrations -> applies 033_challenge_feed_share_generation and 034_challenge_feed_kudos cleanly.
    expect(await runMigrations(legacyDb)).toEqual([
      '033_challenge_feed_share_generation.sql',
      '034_challenge_feed_kudos.sql',
      '035_media_assets_and_references.sql',
    ]);

    const upgradedShare = await legacyDb.query<{ share_generation: number }>(
      `SELECT share_generation FROM challenge_feed_shares WHERE share_id = $1`,
      [shareId],
    );
    expect(Number(upgradedShare.rows[0].share_generation)).toBe(1);

    const preservedKudos = await legacyDb.query<{ kudos_id: string; share_id: string; member_id: string }>(
      `SELECT kudos_id, share_id, member_id FROM challenge_feed_kudos WHERE share_id = $1`,
      [shareId],
    );
    expect(preservedKudos.rows).toHaveLength(1);
    expect(String(preservedKudos.rows[0].kudos_id)).toBe(kudosId);
    expect(String(preservedKudos.rows[0].member_id)).toBe(giverId);

    // Subsequent runs are no-ops.
    expect(await runMigrations(legacyDb)).toEqual([]);
    await legacyDb.close();
  });
});

