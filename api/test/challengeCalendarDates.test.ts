/**
 * TIIZI-CHALLENGE-DATE-READ-CORR-001 — calendar-date read regression.
 *
 * A PostgreSQL DATE is a calendar date, not an instant. The Challenge read
 * path once projected driver Dates through `toISOString()` (UTC), so a
 * persisted 2026-09-17 read back as 2026-09-16 on UTC+ servers while the
 * canonical stored value stayed correct.
 *
 * These tests prove the same persisted DATE reads back unchanged through
 * normalization, detail, list, and definition version carry-forward.
 *
 * RUN UNDER THREE PROCESS TIMEZONES with identical expectations:
 *   TZ=UTC npx vitest run test/challengeCalendarDates.test.ts
 *   TZ=Africa/Nairobi npx vitest run test/challengeCalendarDates.test.ts
 *   TZ=America/New_York npx vitest run test/challengeCalendarDates.test.ts
 *
 * Hermetic PGlite database; no server, emulator, or network access.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { toDayString, addChallengeConfigVersion } from '../src/challengeConfigs.js';
import {
  activateChallenge,
  createChallenge,
  normalizeChallengeRow,
  type ChallengeCreationResolvers,
  type NewChallengeInput,
} from '../src/challenges.js';
import { getChallengeDetail, listVisibleChallenges } from '../src/challengeReads.js';
import type { GroupMembershipAuthority } from '../src/groupMembershipAuthority.js';
import {
  seedGroup,
  seedMember,
  seedMembership,
  stubEligibility,
  testDb,
} from './helpers.js';
import type { Db } from '../src/db.js';

const START = '2026-09-17';
const END = '2026-09-30';

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

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys CASCADE',
  );
});

function authority(): GroupMembershipAuthority {
  return {
    resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
  };
}

async function seedPin(db: Db, key: string): Promise<{ knowledge_id: string; current_version: number }> {
  const result = await db.query<{ knowledge_id: string; current_version: number }>(
    `INSERT INTO knowledge_items (kind, name, lifecycle) VALUES ('fitness', $1, 'published')
     RETURNING knowledge_id, current_version`,
    [`Calendar ${key}`],
  );
  return {
    knowledge_id: String(result.rows[0].knowledge_id),
    current_version: Number(result.rows[0].current_version),
  };
}

describe('toDayString preserves calendar dates', () => {
  it('keeps driver Dates on their stored calendar day', () => {
    expect(toDayString(driverDate(START))).toBe(START);
    expect(toDayString(driverDate(END))).toBe(END);
  });

  it('keeps UTC-midnight driver Dates on their stored calendar day', () => {
    expect(toDayString(utcDriverDate(START))).toBe(START);
    expect(toDayString(utcDriverDate(END))).toBe(END);
  });

  it('passes day strings through untouched', () => {
    expect(toDayString(START)).toBe(START);
    expect(toDayString(END)).toBe(END);
  });
});

describe('normalizeChallengeRow preserves calendar dates', () => {
  it('detail normalization keeps the stored days', () => {
    const row = normalizeChallengeRow({
      challenge_id: '11111111-1111-4111-8111-111111111111',
      group_id: '22222222-2222-4222-8222-222222222222',
      created_by_member_id: '33333333-3333-4333-8333-333333333333',
      challenge_type: 'collective',
      status: 'active',
      title: 'Calendar',
      description: '',
      instructions: '',
      start_date: driverDate(START),
      end_date: driverDate(END),
      current_config_version: 1,
      goal_value: 100,
      goal_unit: 'reps',
      required_consecutive_days: null,
      reset_on_miss: true,
      timezone: 'Africa/Nairobi',
      finalized_at: null,
      activated_at: '2026-09-17T11:00:00.000Z',
      ended_at: null,
      created_at: '2026-09-17T11:00:00.000Z',
      updated_at: '2026-09-17T11:00:00.000Z',
    });
    expect(row.start_date).toBe(START);
    expect(row.end_date).toBe(END);
  });
});

describe('persisted challenge reads back its calendar dates', () => {
  async function establish(): Promise<{ memberId: string; challengeId: string }> {
    const db = testDb();
    const memberId = await seedMember(db, `calendar-member-${process.pid}`);
    const groupId = await seedGroup(db, { name: 'Calendar Group' });
    await seedMembership(db, groupId, memberId, { status: 'active' });
    const pin = await seedPin(db, 'push-up');
    const resolvers: ChallengeCreationResolvers = {
      resolveKnowledgePin: async (key) => (key === 'push-up' ? pin : null),
      resolveKnowledgeEligibility: async () => stubEligibility(),
      resolveGroupAuthority: async () => ({ status: 'active' }),
      resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
    };
    const input: NewChallengeInput = {
      group_id: groupId,
      created_by_member_id: memberId,
      challenge_type: 'collective',
      title: 'Calendar Challenge',
      start_date: START,
      end_date: END,
      goal_value: 100,
      goal_unit: 'reps',
      timezone: 'Africa/Nairobi',
      activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 100, unit: 'reps' }],
    };
    const { challenge } = await createChallenge(db, input, resolvers);
    await activateChallenge(db, challenge.challenge_id);
    return { memberId, challengeId: challenge.challenge_id };
  }

  it('detail read keeps the stored days (B)', async () => {
    const db = testDb();
    const fx = await establish();
    const detail = await getChallengeDetail(db, fx.memberId, fx.challengeId, {
      groupMembershipAuthority: authority(),
    });
    expect(detail.startDate).toBe(START);
    expect(detail.endDate).toBe(END);
    expect(detail.timezone).toBe('Africa/Nairobi');
  });

  it('list read keeps the stored days (C)', async () => {
    const db = testDb();
    const fx = await establish();
    const listed = await listVisibleChallenges(db, fx.memberId, {
      groupMembershipAuthority: authority(),
    });
    const entry = listed.find((challenge) => challenge.challengeId === fx.challengeId);
    expect(entry?.startDate).toBe(START);
    expect(entry?.endDate).toBe(END);
  });

  it('date-less version carry-forward keeps the stored days (D)', async () => {
    const db = testDb();
    const fx = await establish();
    const pin = await seedPin(db, 'push-up-v2');
    await addChallengeConfigVersion(
      db,
      fx.challengeId,
      {
        // No dates: the governing basis must carry the stored days forward.
        activities: [{ canonical_key: 'push-up-v2', metric: 'repetitions', target_value: 150, unit: 'reps' }],
      },
      {
        resolveKnowledgePin: async (key) => (key === 'push-up-v2' ? pin : null),
        resolveKnowledgeEligibility: async () => stubEligibility(),
      },
    );
    const detail = await getChallengeDetail(db, fx.memberId, fx.challengeId, {
      groupMembershipAuthority: authority(),
    });
    expect(detail.config.period.startDate).toBe(START);
    expect(detail.config.period.endDate).toBe(END);
  });
});
