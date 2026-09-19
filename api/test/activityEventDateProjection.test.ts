/**
 * TIIZI-S3B-FOUNDER-PREVIEW-CORR-003 — PostgreSQL DATE projection regression.
 *
 * A PostgreSQL DATE is a calendar day, never an instant. node-postgres hands
 * a DATE to Node as a JS `Date` at *server-local* midnight, so projecting it
 * with `toISOString()` (UTC) shifts the stored day back on positive-offset
 * hosts (host Africa/Bujumbura, UTC+2: stored `2026-09-19` → `2026-09-18`).
 * That made a valid in-window activity governing day fall outside the
 * Challenge window and be rejected `422 outside_challenge_window`
 * (Founder Challenge e13229fb…, window 2026-09-19..2026-10-02).
 *
 * The authoritative DATE-safe helper is `toDayString` (v1.76, reused here).
 * The activity / Challenge path normalizers must all use it.
 *
 * RUN UNDER MULTIPLE PROCESS TIMEZONES with identical expectations:
 *   TZ=UTC npx vitest run test/activityEventDateProjection.test.ts
 *   TZ=Africa/Bujumbura npx vitest run test/activityEventDateProjection.test.ts
 *   TZ=Africa/Nairobi npx vitest run test/activityEventDateProjection.test.ts
 *   TZ=America/New_York npx vitest run test/activityEventDateProjection.test.ts
 *
 * Hermetic PGlite database for the application-path case; no server/network.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { normalizeRow as normalizeEventRow } from '../src/activityEvents.js';
import { normalizeSubmissionIntentRow } from '../src/submissionIntents.js';
import { normalizeParticipationDerived } from '../src/derivedTruth.js';
import { toDayString } from '../src/challengeConfigs.js';
import { activateChallenge, createChallenge, type NewChallengeInput } from '../src/challenges.js';
import { applyChallengeActivity } from '../src/challengeActivityApplication.js';
import type { ChallengeCreationResolvers } from '../src/challenges.js';
import {
  seedGroup,
  seedMember,
  seedMembership,
  stubEligibility,
  testDb,
} from './helpers.js';

/** How node-pg hands a DATE to Node: server-local midnight. */
const driverDate = (isoDay: string): Date => {
  const [y, m, d] = isoDay.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** How PGlite (tests) hands a DATE to Node: UTC midnight. */
const utcDriverDate = (isoDay: string): Date => {
  const [y, m, d] = isoDay.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

const EXPECTED = ['2026-09-19', '2026-09-30', '2026-10-01', '2026-12-31', '2027-01-01'];

function eventRow(occurredDay: string | Date): Record<string, unknown> {
  return {
    event_id: '11111111-1111-4111-8111-111111111111',
    member_id: '22222222-2222-4222-8222-222222222222',
    activity_kind: 'fitness',
    canonical_key: 'corr003-move',
    activity_variant: null,
    knowledge_id: '33333333-3333-4333-8333-333333333333',
    knowledge_version: 1,
    occurred_at: '2026-09-19T09:00:00.000Z',
    occurred_day: occurredDay,
    occurred_tz: 'Africa/Nairobi',
    recorded_at: '2026-09-19T09:05:00.000Z',
    value: 20,
    unit: 'reps',
    client_key: 'corr003-key',
    supersedes_event_id: null,
    correction_kind: null,
    status: 'committed',
    metadata: {},
  };
}

function intentRow(occurredDay: string | Date): Record<string, unknown> {
  return {
    submission_id: '44444444-4444-4444-8444-444444444444',
    member_id: '22222222-2222-4222-8222-222222222222',
    challenge_id: '55555555-5555-4555-8555-555555555555',
    participation_id: '66666666-6666-4666-8666-666666666666',
    client_key: 'corr003-key',
    activity_kind: 'fitness',
    canonical_key: 'corr003-move',
    activity_variant: null,
    value: 20,
    unit: 'reps',
    occurred_at: '2026-09-19T09:00:00.000Z',
    occurred_day: occurredDay,
    occurred_tz: 'Africa/Nairobi',
    submitted_at: '2026-09-19T09:05:00.000Z',
    eligibility_status: 'eligible',
    eligibility_reason: null,
    acceptance_status: 'accepted',
    acceptance_authority: 'automatic_system',
    decided_at: '2026-09-19T09:05:00.000Z',
    event_id: '11111111-1111-4111-8111-111111111111',
    record_id: '77777777-7777-4777-8777-777777777777',
  };
}

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events, activity_submission_intents, challenge_finalizations, challenge_participation_finals',
  );
});

describe('CORR-003 — PostgreSQL DATE normalization keeps the stored calendar day', () => {
  it('toDayString preserves driver Dates, UTC-midnight Dates and day strings', () => {
    for (const day of EXPECTED) {
      expect(toDayString(driverDate(day))).toBe(day);
      expect(toDayString(utcDriverDate(day))).toBe(day);
      expect(toDayString(day)).toBe(day);
    }
  });

  it('activityEvents.normalizeRow preserves occurred_day from driver Dates', () => {
    const asEventRow = (occurredDay: string | Date) =>
      eventRow(occurredDay) as Parameters<typeof normalizeEventRow>[0];
    for (const day of EXPECTED) {
      expect(normalizeEventRow(asEventRow(driverDate(day))).occurred_day).toBe(day);
      expect(normalizeEventRow(asEventRow(utcDriverDate(day))).occurred_day).toBe(day);
      expect(normalizeEventRow(asEventRow(day)).occurred_day).toBe(day);
    }
  });

  it('submissionIntents.normalizeSubmissionIntentRow preserves occurred_day (idempotency binding)', () => {
    for (const day of EXPECTED) {
      expect(normalizeSubmissionIntentRow(intentRow(driverDate(day))).occurred_day).toBe(day);
      expect(normalizeSubmissionIntentRow(intentRow(utcDriverDate(day))).occurred_day).toBe(day);
    }
  });

  it('derivedTruth.normalizeParticipationDerived preserves last_completed_day', () => {
    const row = {
      participation_id: '66666666-6666-4666-8666-666666666666',
      challenge_id: '55555555-5555-4555-8555-555555555555',
      member_id: '22222222-2222-4222-8222-222222222222',
      last_completed_day: driverDate('2026-09-19'),
      updated_at: '2026-09-19T09:00:00.000Z',
    };
    expect(normalizeParticipationDerived(row).lastCompletedDay).toBe('2026-09-19');
    expect(
      normalizeParticipationDerived({ ...row, last_completed_day: utcDriverDate('2026-09-19') })
        .lastCompletedDay,
    ).toBe('2026-09-19');
  });
});

describe('CORR-003 — application path accepts the Founder in-window boundary day', () => {
  it('window 2026-09-19..2026-10-02 with governing day 2026-09-19 is accepted (not outside_challenge_window)', async () => {
    const db = testDb();
    const memberId = await seedMember(db, `corr003-member-${process.pid}-${Date.now()}`);
    const groupId = await seedGroup(db, { name: 'CORR-003 Group' });
    await seedMembership(db, groupId, memberId, { status: 'active' });

    const k = await db.query<{ knowledge_id: string; current_version: number }>(
      `INSERT INTO knowledge_items (kind, name, lifecycle)
       VALUES ('fitness', 'corr003-community-walk', 'published')
       RETURNING knowledge_id, current_version`,
    );
    const pin = {
      knowledge_id: String(k.rows[0].knowledge_id),
      current_version: Number(k.rows[0].current_version),
    };

    const resolvers: ChallengeCreationResolvers = {
      resolveKnowledgePin: async (key) => (key === 'corr003-community-walk' ? pin : null),
      resolveKnowledgeEligibility: async () => stubEligibility(),
      resolveGroupAuthority: async () => ({ status: 'active' }),
      resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
    };

    const { challenge } = await createChallenge(
      db,
      {
        group_id: groupId,
        created_by_member_id: memberId,
        challenge_type: 'collective',
        title: 'CORR-003 Founder boundary',
        start_date: '2026-09-19',
        end_date: '2026-10-02',
        goal_value: 500,
        goal_unit: 'kilometres',
        timezone: 'Africa/Nairobi',
        activities: [
          {
            canonical_key: 'corr003-community-walk',
            metric: 'distance',
            target_value: 500,
            unit: 'kilometres',
          },
        ],
      } as NewChallengeInput,
      resolvers,
    );
    await activateChallenge(db, challenge.challenge_id);
    await db.query(
      `INSERT INTO challenge_participations
         (challenge_id, member_id, status, joined_at, joined_config_version)
       VALUES ($1, $2, 'active', $3, 1)`,
      [challenge.challenge_id, memberId, '2026-09-19T08:00:00.000Z'],
    );

    const result = await applyChallengeActivity(
      db,
      memberId,
      challenge.challenge_id,
      {
        activity_kind: 'fitness',
        canonical_key: 'corr003-community-walk',
        value: 20,
        unit: 'kilometres',
        occurred_at: new Date('2026-09-19T09:00:00.000Z'),
        client_key: `corr003-${process.pid}-${Date.now()}`,
      },
      {
        resolveKnowledgePin: resolvers.resolveKnowledgePin,
        resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
      },
      { now: new Date('2026-09-19T12:00:00.000Z') },
    );

    expect(result.record.occurred_day).toBe('2026-09-19');
    expect(result.duplicate).toBe(false);
  });
});
