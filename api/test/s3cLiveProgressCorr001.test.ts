/**
 * TIIZI-S3C-LIVE-PROGRESS-CORR-001 — bounded correction regressions for
 * independent review TIIZI-S3C-LIVE-PROGRESS-ITR-001.
 *
 * Blocker 1 (collective contributor reconciliation): the contributor
 * projection read only the LATEST episode per member, so a member who
 * logged 40, withdrew, rejoined and logged 70 showed 70 against a
 * canonical total of 110. The projection now aggregates governed Derived
 * Truth across ALL of a member's episodes (member-level identity) while
 * history stays attached to its original episode (no migration, no
 * reassignment). Proven here over registered production HTTP routes with
 * real persistence — join -> log -> withdraw -> rejoin -> log -> GET
 * contributors — never service functions alone.
 *
 * Blocker 2 (finalized competitive authority): the S3c competitive
 * surface could consume frozen final_position as "live" once finalized.
 * The backend frozen authority is preserved for S3d (proven here: the
 * leaderboard route still serves frozen positions after finalize); S3c
 * consumption is gated at query enablement + render (proven by the S3c
 * guards + the finalized flag asserted here).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  activateChallenge,
  createChallenge,
  endChallenge,
  type ChallengeCreationResolvers,
  type NewChallengeInput,
} from '../src/challenges.js';
import {
  applyChallengeActivity,
  type ChallengeActivityResolvers,
  type NewChallengeActivityInput,
} from '../src/challengeActivityApplication.js';
import type { GroupMembershipAuthority } from '../src/groupMembershipAuthority.js';
import { finalizeChallenge } from '../src/challengeFinalization.js';
import {
  getChallengeContributors,
  getChallengeDetail,
  getChallengeLeaderboard,
} from '../src/challengeReads.js';
import {
  authHeaders,
  buildTestApp,
  seedGroup,
  seedMember,
  seedMembership,
  testDb,
  stubEligibility,
} from './helpers.js';
import type { Db } from '../src/db.js';

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events, activity_submission_intents, challenge_finalizations, challenge_participation_finals',
  );
});

const T = (iso: string): Date => new Date(iso);
const DAY_MS = 86_400_000;
const dayString = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
let seq = 0;
const next = (prefix: string): string => `${prefix}-${(seq += 1)}`;

interface Pin {
  knowledge_id: string;
  current_version: number;
}

async function seedKnowledge(db: Db, name: string): Promise<Pin> {
  const result = await db.query<{ knowledge_id: string; current_version: number }>(
    `INSERT INTO knowledge_items (kind, name, lifecycle) VALUES ('fitness', $1, 'published')
     RETURNING knowledge_id, current_version`,
    [`${name}-${seq}`],
  );
  return {
    knowledge_id: String(result.rows[0].knowledge_id),
    current_version: Number(result.rows[0].current_version),
  };
}

function creationResolvers(pins: Record<string, Pin>): ChallengeCreationResolvers {
  return {
    resolveKnowledgePin: async (key) => pins[key] ?? null,
    resolveKnowledgeEligibility: async () => stubEligibility(),
    resolveGroupAuthority: async () => ({ status: 'active' }),
    resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
  };
}

function activityResolvers(
  pins: Record<string, Pin>,
  authority: GroupMembershipAuthority['resolveGroupMembershipAuthority'],
): ChallengeActivityResolvers {
  return {
    resolveKnowledgePin: async (key) => pins[key] ?? null,
    resolveGroupMembershipAuthority: authority,
  };
}

function stubAuthority(eligibleGroups: Set<string>): GroupMembershipAuthority {
  return {
    resolveGroupMembershipAuthority: async (groupId: string) => {
      if (eligibleGroups.has(groupId)) return { status: 'active', eligible: true };
      return { status: 'no_membership', eligible: false };
    },
  };
}

describe('CORR-001 Blocker 1: leave/rejoin reconciliation over HTTP routes', () => {
  /** Live-window collective fixture keyed by immutable Knowledge identity. */
  async function liveCollective() {
    const db = testDb();
    const wall = Date.now();
    const tag = next('corr1');
    const subjectA = `corr1-a-${tag}`;
    const memberA = await seedMember(db, subjectA);
    const groupId = await seedGroup(db, { name: `CORR1 Group ${tag}` });
    await seedMembership(db, groupId, memberA, { status: 'active' });
    const pin = await seedKnowledge(db, 'community-walk');
    // Governed V2 identity path (CORR-002): the canonical key IS the
    // immutable Knowledge UUID, exactly as the production route resolves.
    const key = pin.knowledge_id;
    const { challenge } = await createChallenge(
      db,
      {
        group_id: groupId,
        created_by_member_id: memberA,
        title: `CORR1 ${tag}`,
        start_date: dayString(wall - 30 * DAY_MS),
        end_date: dayString(wall + 30 * DAY_MS),
        timezone: 'UTC',
        challenge_type: 'collective',
        goal_value: 500,
        goal_unit: 'kilometres',
        activities: [{ canonical_key: key, metric: 'distance', target_value: 20, unit: 'kilometres' }],
      } as NewChallengeInput,
      creationResolvers({ [key]: pin }),
    );
    await activateChallenge(db, challenge.challenge_id);
    return { groupId, memberA, subjectA, challengeId: challenge.challenge_id, key };
  }

  function appFor(tokens: Record<string, string>, groups: Set<string>) {
    return buildTestApp(tokens, {
      challengeActivity: { groupMembershipAuthority: stubAuthority(groups) },
    });
  }

  async function postActivity(
    app: ReturnType<typeof buildTestApp>,
    challengeId: string,
    token: string,
    key: string,
    value: number,
    occurredAt: string,
  ) {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/challenges/${challengeId}/activity`,
      headers: authHeaders(token),
      payload: {
        activity_kind: 'fitness',
        canonical_key: key,
        value,
        unit: 'kilometres',
        occurred_at: occurredAt,
        occurred_tz: 'UTC',
        client_key: next('corr1-key'),
      },
    });
    expect(res.statusCode).toBe(200);
    return res.json() as { participationId: string };
  }

  it('40 + withdraw + rejoin + 70 reconciles: total 110, member 110, share 1, history unmoved', async () => {
    const db = testDb();
    const fx = await liveCollective();
    const app = appFor({ tokA: fx.subjectA }, new Set([fx.groupId]));

    // 1. Member joins (episode 1).
    const join1 = await app.inject({
      method: 'POST', url: `/v1/challenges/${fx.challengeId}/join`, headers: authHeaders('tokA'),
    });
    expect(join1.statusCode).toBe(200);
    const episode1 = (join1.json() as { participationId: string }).participationId;
    expect(episode1).toMatch(/^[0-9a-f-]{36}$/i);

    // 2. Logs 40. The owning episode is [joined_at, exited_at), so the
    // evidence instant is captured AFTER the join, never before it.
    await postActivity(app, fx.challengeId, 'tokA', fx.key, 40, new Date().toISOString());

    // 3. Leaves/withdraws.
    const withdraw = await app.inject({
      method: 'POST', url: `/v1/challenges/${fx.challengeId}/withdraw`, headers: authHeaders('tokA'),
    });
    expect(withdraw.statusCode).toBe(200);

    // 4. Rejoins creating a new participation episode.
    const join2 = await app.inject({
      method: 'POST', url: `/v1/challenges/${fx.challengeId}/join`, headers: authHeaders('tokA'),
    });
    expect(join2.statusCode).toBe(200);
    const episode2 = (join2.json() as { participationId: string }).participationId;
    expect(episode2).not.toBe(episode1);

    // 5. Logs 70 (evidence after the rejoin instant).
    await postActivity(app, fx.challengeId, 'tokA', fx.key, 70, new Date().toISOString());

    // 6. GET contributor route: reconciled member-level truth.
    const rollupRes = await app.inject({
      method: 'GET', url: `/v1/challenges/${fx.challengeId}/contributors`, headers: authHeaders('tokA'),
    });
    expect(rollupRes.statusCode).toBe(200);
    const rollup = rollupRes.json() as {
      collectiveTotal: number;
      contributors: Array<{
        memberId: string; participationId: string; participationStatus: string;
        contributionTotal: number; share: number | null; logsAccepted: number;
      }>;
    };
    expect(rollup.collectiveTotal).toBe(110);
    expect(rollup.contributors).toHaveLength(1);
    const sole = rollup.contributors[0];
    expect(sole.memberId).toBe(fx.memberA);
    expect(sole.contributionTotal).toBe(110);
    expect(sole.share).toBe(1);
    expect(sole.logsAccepted).toBe(2);
    // Current participation remains episode 2.
    expect(sole.participationId).toBe(episode2);
    expect(sole.participationStatus).toBe('active');
    expect(rollup.contributors.reduce((s, c) => s + c.contributionTotal, 0)).toBe(rollup.collectiveTotal);

    // Detail agrees; "You" resolves to the current episode.
    const detailRes = await app.inject({
      method: 'GET', url: `/v1/challenges/${fx.challengeId}`, headers: authHeaders('tokA'),
    });
    expect(detailRes.statusCode).toBe(200);
    const detailBody = detailRes.json() as {
      collectiveTotal: number;
      myParticipation: { participationId: string; progress: { cumulativeTotal: number } };
    };
    expect(detailBody.collectiveTotal).toBe(110);
    expect(detailBody.myParticipation.participationId).toBe(episode2);

    // Historical evidence remains attached to its original episode:
    // record 1 -> episode 1 (40), record 2 -> episode 2 (70). No mutation.
    const records = await db.query<{ record_id: string; participation_id: string; value: string }>(
      `SELECT record_id, participation_id, value FROM challenge_activity_records
       WHERE challenge_id = $1 ORDER BY accepted_at ASC, record_id ASC`,
      [fx.challengeId],
    );
    expect(records.rows).toHaveLength(2);
    expect(String(records.rows[0].participation_id)).toBe(episode1);
    expect(Number(records.rows[0].value)).toBe(40);
    expect(String(records.rows[1].participation_id)).toBe(episode2);
    expect(Number(records.rows[1].value)).toBe(70);
    const derived = await db.query<{ participation_id: string; cumulative_total: string }>(
      `SELECT participation_id, cumulative_total FROM challenge_participation_derived
       WHERE challenge_id = $1`,
      [fx.challengeId],
    );
    const byEpisode = new Map(derived.rows.map((r) => [String(r.participation_id), Number(r.cumulative_total)]));
    expect(byEpisode.get(episode1)).toBe(40);
    expect(byEpisode.get(episode2)).toBe(70);
  });

  it('multi-member with a multi-episode member reconciles sums and shares', async () => {
    const db = testDb();
    const fx = await liveCollective();
    const tag = next('corr1b');
    const subjectB = `corr1-b-${tag}`;
    const memberB = await seedMember(db, subjectB);
    await seedMembership(db, fx.groupId, memberB, { status: 'active' });
    const app = appFor({ tokA: fx.subjectA, tokB: subjectB }, new Set([fx.groupId]));

    // A: join -> 40 -> withdraw -> rejoin -> 70 (two episodes, 110 total).
    await app.inject({ method: 'POST', url: `/v1/challenges/${fx.challengeId}/join`, headers: authHeaders('tokA') });
    await postActivity(app, fx.challengeId, 'tokA', fx.key, 40, new Date().toISOString());
    await app.inject({ method: 'POST', url: `/v1/challenges/${fx.challengeId}/withdraw`, headers: authHeaders('tokA') });
    await app.inject({ method: 'POST', url: `/v1/challenges/${fx.challengeId}/join`, headers: authHeaders('tokA') });
    await postActivity(app, fx.challengeId, 'tokA', fx.key, 70, new Date().toISOString());
    // B: join -> 30 (one episode).
    await app.inject({ method: 'POST', url: `/v1/challenges/${fx.challengeId}/join`, headers: authHeaders('tokB') });
    await postActivity(app, fx.challengeId, 'tokB', fx.key, 30, new Date().toISOString());

    const rollup = await getChallengeContributors(db, fx.memberA, fx.challengeId, {
      groupMembershipAuthority: stubAuthority(new Set([fx.groupId])),
    });
    expect(rollup.collectiveTotal).toBe(140);
    expect(rollup.contributors).toHaveLength(2);
    const byMember = Object.fromEntries(rollup.contributors.map((c) => [c.memberId, c]));
    expect(byMember[fx.memberA].contributionTotal).toBe(110);
    expect(byMember[memberB].contributionTotal).toBe(30);
    expect(rollup.contributors.reduce((s, c) => s + c.contributionTotal, 0)).toBe(rollup.collectiveTotal);
    const shareSum = rollup.contributors.reduce((s, c) => s + (c.share ?? 0), 0);
    expect(shareSum).toBeCloseTo(1, 10);
    for (const entry of rollup.contributors) {
      expect(entry).not.toHaveProperty('position');
      expect(entry).not.toHaveProperty('rank');
    }
  });

  it('aggregation cannot expose foreign-group/member data', async () => {
    const db = testDb();
    const fx = await liveCollective();
    const wall = Date.now();
    const app = appFor({ tokA: fx.subjectA }, new Set([fx.groupId]));
    await app.inject({ method: 'POST', url: `/v1/challenges/${fx.challengeId}/join`, headers: authHeaders('tokA') });
    await postActivity(app, fx.challengeId, 'tokA', fx.key, 25, new Date().toISOString());

    // Foreign member in another group: 404, no leak.
    const tag = next('corr1f');
    const subjectF = `corr1-f-${tag}`;
    const memberF = await seedMember(db, subjectF);
    const groupF = await seedGroup(db, { name: `CORR1 Foreign ${tag}` });
    await seedMembership(db, groupF, memberF, { status: 'active' });
    const appForeign = appFor({ tokF: subjectF }, new Set([groupF]));
    const hidden = await appForeign.inject({
      method: 'GET', url: `/v1/challenges/${fx.challengeId}/contributors`, headers: authHeaders('tokF'),
    });
    expect(hidden.statusCode).toBe(404);

    // A second challenge elsewhere does not bleed members/totals across.
    const pinF = await seedKnowledge(db, 'foreign-walk');
    const keyF = pinF.knowledge_id;
    const { challenge: other } = await createChallenge(
      db,
      {
        group_id: groupF,
        created_by_member_id: memberF,
        title: `CORR1 other ${tag}`,
        start_date: dayString(wall - 30 * DAY_MS),
        end_date: dayString(wall + 30 * DAY_MS),
        timezone: 'UTC',
        challenge_type: 'collective',
        goal_value: 500,
        goal_unit: 'kilometres',
        activities: [{ canonical_key: keyF, metric: 'distance', target_value: 20, unit: 'kilometres' }],
      } as NewChallengeInput,
      creationResolvers({ [keyF]: pinF }),
    );
    await activateChallenge(db, other.challenge_id);
    const appOther = appFor({ tokF: subjectF }, new Set([groupF]));
    await appOther.inject({ method: 'POST', url: `/v1/challenges/${other.challenge_id}/join`, headers: authHeaders('tokF') });
    await postActivity(appOther, other.challenge_id, 'tokF', keyF, 999, new Date().toISOString());

    const rollupA = await getChallengeContributors(db, fx.memberA, fx.challengeId, {
      groupMembershipAuthority: stubAuthority(new Set([fx.groupId])),
    });
    expect(rollupA.collectiveTotal).toBe(25);
    expect(rollupA.contributors).toHaveLength(1);
    expect(rollupA.contributors[0].memberId).toBe(fx.memberA);
  });
});

describe('CORR-001 Blocker 2: finalized competitive authority stays S3d-owned', () => {
  async function raceFixture() {
    const db = testDb();
    const tag = next('corr2');
    const memberId = await seedMember(db, `corr2-a-${tag}`);
    const groupId = await seedGroup(db, { name: `CORR2 Group ${tag}` });
    await seedMembership(db, groupId, memberId, { status: 'active' });
    const pins: Record<string, Pin> = {};
    const pin = await seedKnowledge(db, 'push-up');
    pins['push-up'] = pin;
    const { challenge } = await createChallenge(
      db,
      {
        group_id: groupId,
        created_by_member_id: memberId,
        title: `CORR2 ${tag}`,
        start_date: '2026-06-01',
        end_date: '2026-06-30',
        challenge_type: 'competitive',
        activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 50, unit: 'reps' }],
      } as NewChallengeInput,
      creationResolvers(pins),
    );
    await activateChallenge(db, challenge.challenge_id);
    return { groupId, memberId, challengeId: challenge.challenge_id, pins };
  }

  function logInput(overrides?: Partial<NewChallengeActivityInput>): NewChallengeActivityInput {
    return {
      activity_kind: 'fitness',
      canonical_key: 'push-up',
      value: 10,
      unit: 'reps',
      occurred_at: T('2026-06-10T12:00:00Z'),
      client_key: next('key'),
      ...overrides,
    };
  }

  async function log(db: Db, memberId: string, challengeId: string, pins: Record<string, Pin>, input: NewChallengeActivityInput, now?: Date) {
    await applyChallengeActivity(
      db, memberId, challengeId, input,
      activityResolvers(pins, async () => ({ status: 'active', eligible: true })),
      now === undefined ? { now: input.occurred_at } : { now },
    );
  }

  async function insertEpisode(db: Db, challengeId: string, memberId: string): Promise<void> {
    await db.query(
      `INSERT INTO challenge_participations (challenge_id, member_id, status, joined_at, joined_config_version)
       VALUES ($1, $2, 'active', '2026-06-01T00:00:00Z', 1)`,
      [challengeId, memberId],
    );
  }

  it('live serves positions; after finalize the route freezes them and detail marks finalized', async () => {
    const db = testDb();
    const fx = await raceFixture();
    const rival = await seedMember(db, `corr2-b-${next('m')}`);
    await seedMembership(db, fx.groupId, rival, { status: 'active' });
    await insertEpisode(db, fx.challengeId, fx.memberId);
    await insertEpisode(db, fx.challengeId, rival);
    const deps = { groupMembershipAuthority: stubAuthority(new Set([fx.groupId])) };

    await log(db, fx.memberId, fx.challengeId, fx.pins,
      logInput({ value: 50, occurred_at: T('2026-06-10T10:00:00Z') }), T('2026-06-10T10:00:00Z'));
    await log(db, rival, fx.challengeId, fx.pins,
      logInput({ value: 10, client_key: next('key'), occurred_at: T('2026-06-10T11:00:00Z') }),
      T('2026-06-10T11:00:00Z'));

    // Active + unfinalized: live position served; S3c flag clear.
    const live = await getChallengeLeaderboard(db, fx.memberId, fx.challengeId, deps);
    const liveBy = Object.fromEntries(live.entries.map((e) => [e.memberId, e.position]));
    expect(liveBy[fx.memberId]).toBe(1);
    expect(liveBy[rival]).toBeNull();
    const liveDetail = await getChallengeDetail(db, fx.memberId, fx.challengeId, deps);
    expect(liveDetail.finalized).toBe(false);

    // End + finalize: frozen authority belongs to the domain/API (future S3d).
    await endChallenge(db, fx.challengeId);
    await finalizeChallenge(db, fx.challengeId, T('2026-06-20T00:00:00Z'));
    const frozen = await getChallengeLeaderboard(db, fx.memberId, fx.challengeId, deps);
    const frozenBy = Object.fromEntries(frozen.entries.map((e) => [e.memberId, e.position]));
    expect(frozenBy[fx.memberId]).toBe(1);
    expect(frozenBy[rival]).toBeNull();
    const sealedDetail = await getChallengeDetail(db, fx.memberId, fx.challengeId, deps);
    expect(sealedDetail.finalized).toBe(true);
    expect(sealedDetail.finalResult).not.toBeNull();
    // The S3c gate reads exactly this flag: finalized detail must never
    // feed the live surface (hook disabled + component unmounts).
  });
});
