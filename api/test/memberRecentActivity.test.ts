import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { activateChallenge, createChallenge, type ChallengeCreationResolvers, type NewChallengeInput } from '../src/challenges.js';
import { appendCorrectionEvent } from '../src/activityEvents.js';
import {
  applyChallengeActivity,
  type ChallengeActivityResolvers,
  type NewChallengeActivityInput,
} from '../src/challengeActivityApplication.js';
import { recomputeChallengeDerived } from '../src/derivedTruth.js';
import {
  authHeaders,
  buildTestApp,
  seedGroup,
  seedMember,
  seedMembership,
  stubEligibility,
  testDb,
} from './helpers.js';

type HistoryItem = {
  activityId: string;
  activityName: string;
  value: number;
  unit: string;
  occurredAt: string;
  recordedAt: string;
  acceptedAt: string;
  displayTimezone: string;
  revisionState: 'current' | 'updated' | 'reversed';
  challenge: { id: string; title: string };
};

type HistoryPage = { items: HistoryItem[]; nextCursor: string | null };

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_social_cause_decisions, challenge_social_causes, challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events, activity_submission_intents, challenge_finalizations, challenge_participation_finals',
  );
});

let sequence = 0;
const next = (prefix: string) => `${prefix}-${++sequence}`;
const instant = (value: string) => new Date(value);

interface TestOwner {
  memberId: string;
  subject: string;
  challengeId: string;
  participationId: string;
  activityResolvers: ChallengeActivityResolvers;
}

async function setupOwner(): Promise<TestOwner> {
  const db = testDb();
  const subject = next('recent-owner');
  const memberId = await seedMember(db, subject);
  const groupId = await seedGroup(db, { name: `Recent Activity ${subject}` });
  await seedMembership(db, groupId, memberId, { status: 'active' });

  const knowledge = await db.query<{ knowledge_id: string; current_version: number }>(
    `INSERT INTO knowledge_items (kind, name, lifecycle) VALUES ('fitness', 'Push-Up', 'published')
     RETURNING knowledge_id, current_version`,
  );
  const pin = {
    knowledge_id: String(knowledge.rows[0].knowledge_id),
    current_version: Number(knowledge.rows[0].current_version),
  };
  await db.query(
    `INSERT INTO knowledge_item_versions (item_id, version, name) VALUES ($1, $2, $3)`,
    [pin.knowledge_id, pin.current_version, 'Push-Up historical label'],
  );
  const pins: Record<string, typeof pin> = { 'push-up': pin };
  const creationResolvers: ChallengeCreationResolvers = {
    resolveKnowledgePin: async (key) => pins[key] ?? null,
    resolveKnowledgeEligibility: async () => stubEligibility(),
    resolveGroupAuthority: async () => ({ status: 'active' }),
    resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
  };
  const activityResolvers: ChallengeActivityResolvers = {
    resolveKnowledgePin: async (key) => pins[key] ?? null,
    resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
  };
  const created = await createChallenge(
    db,
    {
      group_id: groupId,
      created_by_member_id: memberId,
      title: `Recent Challenge ${subject}`,
      start_date: '2026-06-01',
      end_date: '2026-06-30',
      challenge_type: 'competitive',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' }],
    } as NewChallengeInput,
    creationResolvers,
  );
  await activateChallenge(db, created.challenge.challenge_id);
  const participation = await db.query<{ participation_id: string }>(
    `INSERT INTO challenge_participations (challenge_id, member_id, status, joined_at, joined_config_version)
     VALUES ($1, $2, 'active', $3, 1) RETURNING participation_id`,
    [created.challenge.challenge_id, memberId, '2026-06-01T00:00:00Z'],
  );
  return {
    memberId,
    subject,
    challengeId: created.challenge.challenge_id,
    participationId: String(participation.rows[0].participation_id),
    activityResolvers,
  };
}

function logInput(overrides: Partial<NewChallengeActivityInput> = {}): NewChallengeActivityInput {
  return {
    activity_kind: 'fitness',
    canonical_key: 'push-up',
    value: 25,
    unit: 'reps',
    occurred_at: instant('2026-06-10T12:00:00Z'),
    occurred_tz: 'America/New_York',
    client_key: next('client'),
    ...overrides,
  };
}

async function apply(owner: TestOwner, input: NewChallengeActivityInput) {
  return applyChallengeActivity(testDb(), owner.memberId, owner.challengeId, input, owner.activityResolvers, {
    now: input.occurred_at,
  });
}

async function appendCorrection(
  owner: TestOwner,
  options: { supersedes: string; value: number; kind: 'correction' | 'reversal'; at?: string },
) {
  return appendCorrectionEvent(
    testDb(),
    {
      member_id: owner.memberId,
      activity_kind: 'fitness',
      canonical_key: 'push-up',
      value: options.value,
      unit: 'reps',
      occurred_at: instant(options.at ?? '2026-06-10T12:00:00Z'),
      occurred_tz: 'America/New_York',
      client_key: next(options.kind),
      supersedes_event_id: options.supersedes,
      correction_kind: options.kind,
    },
    owner.activityResolvers,
  );
}

function createApp(owner: TestOwner, otherSubject?: string) {
  return buildTestApp({
    'owner-token': owner.subject,
    ...(otherSubject ? { 'other-token': otherSubject } : {}),
  });
}

async function getHistory(app: FastifyInstance, token = 'owner-token', query = '') {
  return app.inject({ method: 'GET', url: `/api/me/activity${query}`, headers: authHeaders(token) });
}

async function jsonPage(response: { body: string }): Promise<HistoryPage> {
  return JSON.parse(response.body) as HistoryPage;
}

describe('owner-only Personal Recent Activity', () => {
  it('shows one accepted Activity, its historical label, distinct timestamps and authorized Challenge context', async () => {
    const owner = await setupOwner();
    const feedBefore = await testDb().query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM group_feed_outbox',
    );
    await apply(owner, logInput());
    const progressBefore = await testDb().query(
      'SELECT * FROM challenge_participation_derived WHERE participation_id = $1',
      [owner.participationId],
    );
    const app = createApp(owner);
    try {
      const response = await getHistory(app);
      expect(response.statusCode).toBe(200);
      const page = await jsonPage(response);
      expect(page.items).toHaveLength(1);
      expect(page.items[0]).toMatchObject({
        activityName: 'Push-Up historical label',
        value: 25,
        unit: 'reps',
        occurredAt: '2026-06-10T12:00:00.000Z',
        displayTimezone: 'America/New_York',
        revisionState: 'current',
        challenge: { id: owner.challengeId, title: `Recent Challenge ${owner.subject}` },
      });
      expect(page.items[0].recordedAt).not.toBe(page.items[0].occurredAt);
      expect(page.items[0].acceptedAt).not.toBe(page.items[0].recordedAt);

      const details = await app.inject({
        method: 'GET',
        url: `/api/challenges/${owner.challengeId}`,
        headers: authHeaders('owner-token'),
      });
      expect(details.statusCode).toBe(200);
      const progressAfter = await testDb().query(
        'SELECT * FROM challenge_participation_derived WHERE participation_id = $1',
        [owner.participationId],
      );
      expect(progressAfter.rows).toEqual(progressBefore.rows);
      const feedAfter = await testDb().query<{ count: string }>(
        'SELECT COUNT(*) AS count FROM group_feed_outbox',
      );
      expect(feedAfter.rows).toEqual(feedBefore.rows);
    } finally {
      await app.close();
    }
  });

  it('shows only the latest correction once and preserves the original accepted Challenge context', async () => {
    const owner = await setupOwner();
    const accepted = await apply(owner, logInput());
    const first = await appendCorrection(owner, {
      supersedes: accepted.event.event_id,
      value: 27,
      kind: 'correction',
      at: '2026-06-10T13:00:00Z',
    });
    const latest = await appendCorrection(owner, {
      supersedes: first.event_id,
      value: 30,
      kind: 'correction',
      at: '2026-06-10T14:00:00Z',
    });

    const app = createApp(owner);
    try {
      const response = await getHistory(app);
      expect(response.statusCode).toBe(200);
      const page = await jsonPage(response);
      expect(page.items).toHaveLength(1);
      expect(page.items[0]).toMatchObject({
        activityId: accepted.event.event_id,
        value: 30,
        occurredAt: '2026-06-10T14:00:00.000Z',
        recordedAt: latest.recorded_at,
        acceptedAt: accepted.record.accepted_at,
        revisionState: 'updated',
        challenge: { id: owner.challengeId },
      });
    } finally {
      await app.close();
    }
  });

  it('keeps a reversal visible while recomputation excludes the superseded accepted record', async () => {
    const owner = await setupOwner();
    const accepted = await apply(owner, logInput());
    const before = await testDb().query<{ points: number | null }>(
      'SELECT total_points AS points FROM challenge_participation_derived WHERE participation_id = $1',
      [owner.participationId],
    );
    const reversed = await appendCorrection(owner, {
      supersedes: accepted.event.event_id,
      value: 0,
      kind: 'reversal',
    });

    const app = createApp(owner);
    try {
      const response = await getHistory(app);
      expect(response.statusCode).toBe(200);
      const page = await jsonPage(response);
      expect(page.items).toHaveLength(1);
      expect(page.items[0]).toMatchObject({
        activityId: accepted.event.event_id,
        value: 25,
        occurredAt: '2026-06-10T12:00:00.000Z',
        recordedAt: reversed.recorded_at,
        acceptedAt: accepted.record.accepted_at,
        revisionState: 'reversed',
      });
      const replay = await recomputeChallengeDerived(testDb(), owner.challengeId);
      expect(replay.recordsReplayed).toBe(0);
      const after = await testDb().query<{ points: number | null }>(
        'SELECT total_points AS points FROM challenge_participation_derived WHERE participation_id = $1',
        [owner.participationId],
      );
      expect(after.rows).toEqual(before.rows);
    } finally {
      await app.close();
    }
  });

  it('does not show rejected submissions or duplicate retries as extra history entries', async () => {
    const owner = await setupOwner();
    const acceptedInput = logInput({ client_key: next('retry') });
    await apply(owner, acceptedInput);
    const retry = await apply(owner, acceptedInput);
    expect(retry.duplicate).toBe(true);
    await expect(apply(owner, logInput({
      occurred_at: instant('2026-07-01T12:00:00Z'),
    }))).rejects.toThrow();

    const app = createApp(owner);
    try {
      const response = await getHistory(app);
      expect(response.statusCode).toBe(200);
      const page = await jsonPage(response);
      expect(page.items).toHaveLength(1);
      const records = await testDb().query<{ count: string }>(
        'SELECT COUNT(*) AS count FROM challenge_activity_records WHERE challenge_id = $1',
        [owner.challengeId],
      );
      expect(Number(records.rows[0].count)).toBe(1);
    } finally {
      await app.close();
    }
  });

  it('paginates newest-first without duplicates or omissions when performed times tie', async () => {
    const owner = await setupOwner();
    for (let index = 0; index < 3; index += 1) {
      await apply(owner, logInput({
        value: 25 + index,
        client_key: `pagination-${index}`,
        ...(index === 2 ? { occurred_at: instant('2026-06-10T13:00:00Z') } : {}),
      }));
    }

    const app = createApp(owner);
    try {
      const collected: HistoryItem[] = [];
      let cursor: string | null = null;
      let pageCount = 0;
      do {
        const params = new URLSearchParams({ limit: '1' });
        if (cursor) params.set('cursor', cursor);
        const response = await getHistory(app, 'owner-token', `?${params.toString()}`);
        expect(response.statusCode).toBe(200);
        const page = await jsonPage(response);
        expect(page.items).toHaveLength(1);
        collected.push(...page.items);
        cursor = page.nextCursor;
        pageCount += 1;
      } while (cursor && pageCount < 4);

      expect(pageCount).toBe(3);
      expect(cursor).toBeNull();
      expect(new Set(collected.map((item) => item.activityId)).size).toBe(3);
      const fullResponse = await getHistory(app, 'owner-token', '?limit=10');
      expect(fullResponse.statusCode).toBe(200);
      const fullPage = await jsonPage(fullResponse);
      expect(fullPage.items[0].occurredAt).toBe('2026-06-10T13:00:00.000Z');
      expect(collected.map((item) => item.activityId))
        .toEqual(fullPage.items.map((item) => item.activityId));
    } finally {
      await app.close();
    }
  });

  it('derives the owner from verified authentication and ignores caller-selected owners', async () => {
    const owner = await setupOwner();
    await apply(owner, logInput());
    const otherSubject = next('other-member');
    await seedMember(testDb(), otherSubject);
    const app = createApp(owner, otherSubject);
    try {
      const unauthenticated = await app.inject({ method: 'GET', url: '/api/me/activity' });
      expect(unauthenticated.statusCode).toBe(401);
      const own = await getHistory(app);
      expect((await jsonPage(own)).items).toHaveLength(1);
      const other = await getHistory(app, 'other-token');
      expect(other.statusCode).toBe(200);
      expect((await jsonPage(other)).items).toHaveLength(0);
      const forged = await getHistory(app, 'other-token', `?memberId=${encodeURIComponent(owner.memberId)}`);
      expect(forged.statusCode).toBe(200);
      expect((await jsonPage(forged)).items).toHaveLength(0);
    } finally {
      await app.close();
    }
  });
});
