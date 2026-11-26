import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../src/db.js';
import type { ObjectStore } from '../src/r2ObjectStore.js';
import { getTodayProjection } from '../src/today.js';

const MEMBER_ID = '11111111-1111-4111-8111-111111111111';
const GROUP_ID = '22222222-2222-4222-8222-222222222222';
const STREAK_ID = '33333333-3333-4333-8333-333333333333';
const TOGETHER_ID = '44444444-4444-4444-8444-444444444444';
const OPP_ID = '55555555-5555-4555-8555-555555555555';
const ASSET_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ASSET_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ASSET_3 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function createMockDb(): { db: Db; mediaQueries: number } {
  const state = { mediaQueries: 0 };
  const db: Db = {
    transaction: vi.fn(),
    close: vi.fn(),
    async query(sql: string) {
      if (sql.includes('FROM challenge_participations') && sql.includes('DISTINCT challenge_id')) {
        return { rows: [{ challenge_id: STREAK_ID }, { challenge_id: TOGETHER_ID }] } as never;
      }
      if (sql.includes('FROM group_memberships')) {
        return { rows: [{ group_id: GROUP_ID }] } as never;
      }
      if (sql.includes('SELECT challenge_id FROM challenges WHERE')) {
        return { rows: [{ challenge_id: STREAK_ID }, { challenge_id: TOGETHER_ID }, { challenge_id: OPP_ID }] } as never;
      }
      if (sql.includes('FROM challenge_participations') && sql.includes('ANY($1::uuid[])')) {
        return {
          rows: [
            {
              participation_id: '66666666-6666-4666-8666-666666666661',
              challenge_id: STREAK_ID,
              member_id: MEMBER_ID,
              status: 'active',
              joined_at: '2026-11-01T00:00:00.000Z',
              exited_at: null,
              finalized_at: null,
              completed_at: null,
              final_position: null,
              exit_reason: null,
              exited_by_member_id: null,
              created_at: '2026-11-01T00:00:00.000Z',
              updated_at: '2026-11-01T00:00:00.000Z',
            },
            {
              participation_id: '66666666-6666-4666-8666-666666666662',
              challenge_id: TOGETHER_ID,
              member_id: MEMBER_ID,
              status: 'active',
              joined_at: '2026-11-01T00:00:00.000Z',
              exited_at: null,
              finalized_at: null,
              completed_at: null,
              final_position: null,
              exit_reason: null,
              exited_by_member_id: null,
              created_at: '2026-11-01T00:00:00.000Z',
              updated_at: '2026-11-01T00:00:00.000Z',
            },
          ],
        } as never;
      }
      if (sql.includes('SELECT * FROM challenges WHERE')) {
        return {
          rows: [
            {
              challenge_id: STREAK_ID,
              group_id: GROUP_ID,
              creator_member_id: MEMBER_ID,
              title: 'Streak With Cover',
              description: '',
              challenge_type: 'streak',
              status: 'active',
              start_date: '2026-11-01',
              end_date: '2026-11-12',
              timezone: 'UTC',
              goal_value: null,
              goal_unit: null,
              current_config_version: 1,
              cover_asset_id: ASSET_1,
              created_at: '2026-11-01T00:00:00.000Z',
              updated_at: '2026-11-01T00:00:00.000Z',
              activated_at: '2026-11-01T00:00:00.000Z',
              ended_at: null,
            },
            {
              challenge_id: TOGETHER_ID,
              group_id: GROUP_ID,
              creator_member_id: MEMBER_ID,
              title: 'Together With Cover',
              description: '',
              challenge_type: 'collective',
              status: 'active',
              start_date: '2026-11-01',
              end_date: '2026-11-30',
              timezone: 'UTC',
              goal_value: 100,
              goal_unit: 'reps',
              current_config_version: 1,
              cover_asset_id: ASSET_2,
              created_at: '2026-11-01T00:00:00.000Z',
              updated_at: '2026-11-01T00:00:00.000Z',
              activated_at: '2026-11-01T00:00:00.000Z',
              ended_at: null,
            },
            {
              challenge_id: OPP_ID,
              group_id: GROUP_ID,
              creator_member_id: MEMBER_ID,
              title: 'Opportunity With Cover',
              description: '',
              challenge_type: 'collective',
              status: 'establishment',
              start_date: '2026-11-12',
              end_date: '2026-11-30',
              timezone: 'UTC',
              goal_value: 200,
              goal_unit: 'km',
              current_config_version: 1,
              cover_asset_id: ASSET_3,
              created_at: '2026-11-01T00:00:00.000Z',
              updated_at: '2026-11-01T00:00:00.000Z',
              activated_at: null,
              ended_at: null,
            },
          ],
        } as never;
      }
      if (sql.includes('FROM challenges c') && sql.includes('LEFT JOIN groups g')) {
        return {
          rows: [
            { challenge_id: STREAK_ID, group_name: 'Kilimanjaro Group', position: 0, name: 'Push-Ups', kind: 'fitness', category: 'strength', subcategory: 'upper' },
            { challenge_id: TOGETHER_ID, group_name: 'Kilimanjaro Group', position: 0, name: 'Steps', kind: 'fitness', category: 'cardio', subcategory: 'walk' },
            { challenge_id: OPP_ID, group_name: 'Kilimanjaro Group', position: 0, name: 'Running', kind: 'fitness', category: 'cardio', subcategory: 'run' },
          ],
        } as never;
      }
      if (sql.includes('FROM challenge_derived_state')) return { rows: [] } as never;
      if (sql.includes('FROM participation_derived_state')) return { rows: [] } as never;
      if (sql.includes('FROM participation_final_results')) return { rows: [] } as never;
      if (sql.includes('FROM challenge_finalizations')) return { rows: [] } as never;
      if (sql.includes('FROM media_assets')) {
        state.mediaQueries += 1;
        return {
          rows: [
            { asset_id: ASSET_1, object_key: 'challenges/1.webp', content_type: 'image/webp', width: 800, height: 600, status: 'ready', suppressed_at: null },
            { asset_id: ASSET_2, object_key: 'challenges/2.webp', content_type: 'image/webp', width: 800, height: 600, status: 'ready', suppressed_at: null },
            { asset_id: ASSET_3, object_key: 'challenges/3.webp', content_type: 'image/webp', width: 800, height: 600, status: 'ready', suppressed_at: null },
          ],
        } as never;
      }
      if (sql.includes('FROM challenge_config_versions')) {
        return {
          rows: [
            {
              challenge_id: STREAK_ID,
              version: 1,
              created_at: '2026-11-01T00:00:00.000Z',
              snapshot: {
                challenge_type: 'streak',
                period: { start_date: '2026-11-01', end_date: '2026-11-12' },
                type_params: { goal_value: null, goal_unit: null, required_consecutive_days: 7, reset_on_miss: true },
                timezone: 'UTC',
                activities: [{ position: 0, knowledge_id: 'k1', knowledge_version: 1, canonical_key: 'push-up', activity_variant: null, target_value: 20, unit: 'reps', completion_occurrence: null }],
              },
            },
            {
              challenge_id: TOGETHER_ID,
              version: 1,
              created_at: '2026-11-01T00:00:00.000Z',
              snapshot: {
                challenge_type: 'collective',
                period: { start_date: '2026-11-01', end_date: '2026-11-30' },
                type_params: { goal_value: 100, goal_unit: 'reps', required_consecutive_days: null, reset_on_miss: false },
                timezone: 'UTC',
                activities: [{ position: 0, knowledge_id: 'k2', knowledge_version: 1, canonical_key: 'steps', activity_variant: null, target_value: 100, unit: 'reps', completion_occurrence: null }],
              },
            },
            {
              challenge_id: OPP_ID,
              version: 1,
              created_at: '2026-11-01T00:00:00.000Z',
              snapshot: {
                challenge_type: 'collective',
                period: { start_date: '2026-11-12', end_date: '2026-11-30' },
                type_params: { goal_value: 200, goal_unit: 'km', required_consecutive_days: null, reset_on_miss: false },
                timezone: 'UTC',
                activities: [{ position: 0, knowledge_id: 'k3', knowledge_version: 1, canonical_key: 'running', activity_variant: null, target_value: 200, unit: 'km', completion_occurrence: null }],
              },
            },
          ],
        } as never;
      }
      if (sql.includes('FROM challenge_activity_configs')) {
        return {
          rows: [
            { challenge_id: STREAK_ID, version: 1, position: 0, knowledge_id: 'k1', knowledge_version: 1, canonical_key: 'push-up', activity_variant: null, target_value: 20, unit: 'reps', completion_occurrence: null, created_at: '2026-11-01T00:00:00.000Z' },
            { challenge_id: TOGETHER_ID, version: 1, position: 0, knowledge_id: 'k2', knowledge_version: 1, canonical_key: 'steps', activity_variant: null, target_value: 100, unit: 'reps', completion_occurrence: null, created_at: '2026-11-01T00:00:00.000Z' },
            { challenge_id: OPP_ID, version: 1, position: 0, knowledge_id: 'k3', knowledge_version: 1, canonical_key: 'running', activity_variant: null, target_value: 200, unit: 'km', completion_occurrence: null, created_at: '2026-11-01T00:00:00.000Z' },
          ],
        } as never;
      }
      return { rows: [] } as never;
    },
  };
  return {
    db,
    get mediaQueries() {
      return state.mediaQueries;
    },
  };
}

describe('Today Challenge cover projection', () => {
  it('projects coverImage across requiredToday, joinedChallengeProgress, groupChallengeOpportunities, and upcoming in one batched media query', async () => {
    const mock = createMockDb();
    const store: ObjectStore = {
      putObject: vi.fn(),
      deleteObject: vi.fn(),
      getSignedReadUrl: ({ key }) => `https://r2.example.test/${key}?sig=1`,
    };

    const projection = await getTodayProjection(mock.db, MEMBER_ID, {
      now: () => new Date('2026-11-10T10:00:00.000Z'),
      groupMembershipAuthority: {
        async resolveGroupMembershipAuthority() {
          return { status: 'eligible', source: 'postgres' } as never;
        },
      },
      mediaDeps: { objectStore: store, readUrlTtlSeconds: 60 },
    });

    expect(mock.mediaQueries).toBe(1);
    expect(projection.requiredToday[0].coverImage).toMatchObject({ status: 'ready', assetId: ASSET_1, url: 'https://r2.example.test/challenges/1.webp?sig=1' });
    expect(projection.joinedChallengeProgress.find((c) => c.challengeId === TOGETHER_ID)?.coverImage).toMatchObject({ status: 'ready', assetId: ASSET_2 });
    expect(projection.groupChallengeOpportunities[0].coverImage).toMatchObject({ status: 'ready', assetId: ASSET_3 });
    expect(projection.upcoming.find((u) => u.challengeId === STREAK_ID)?.coverImage).toMatchObject({ status: 'ready', assetId: ASSET_1 });
    expect(projection.upcoming.find((u) => u.challengeId === OPP_ID)?.coverImage).toMatchObject({ status: 'ready', assetId: ASSET_3 });
  });
});
