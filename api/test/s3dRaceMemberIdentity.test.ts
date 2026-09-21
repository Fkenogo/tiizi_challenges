import { beforeEach, describe, expect, it } from 'vitest';
import {
  activateChallenge,
  createChallenge,
  type ChallengeCreationResolvers,
  type NewChallengeInput,
} from '../src/challenges.js';
import type { GroupMembershipAuthority } from '../src/groupMembershipAuthority.js';
import {
  FINALIZATION_VERSION,
  finalizeChallenge,
  getParticipationFinals,
  rebuildChallengeDerived,
} from '../src/challengeFinalization.js';
import {
  getChallengeDetail,
  getChallengeLeaderboard,
} from '../src/challengeReads.js';
import { applyChallengeActivity } from '../src/challengeActivityApplication.js';
import {
  computeFinishingPositions,
  countCompletingMembers,
  memberFinishingPositions,
} from '../src/derivedTruth.js';
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

/**
 * TIIZI-S3D-READINESS-DISPOSITION-001 — Race member competitive identity.
 *
 * Founder rule: a member is ONE competitive participant in a Race
 * Challenge. Leaving and rejoining must not create several competitive
 * identities in Race results, while every participation episode (and the
 * activity evidence attached to it) stays preserved.
 *
 * Every scenario runs through the production HTTP routes (join / withdraw /
 * activity) and the canonical finalization path (finalizeChallenge with the
 * acceptance clock beyond the governing window — the same seam
 * processExpiredChallenges drives).
 */

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events, activity_submission_intents, challenge_finalizations, challenge_participation_finals',
  );
});

const DAY_MS = 86_400_000;
const dayString = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
let seq = 0;
const next = (prefix: string): string => `${prefix}-${(seq += 1)}`;
const pause = (ms = 6): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const TARGET = 10;

function creationResolvers(pin: { knowledge_id: string; current_version: number }): ChallengeCreationResolvers {
  return {
    resolveKnowledgePin: async () => pin,
    resolveKnowledgeEligibility: async () => stubEligibility(),
    resolveGroupAuthority: async () => ({ status: 'active' }),
    resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
  };
}

const allEligible: GroupMembershipAuthority = {
  resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
};

interface Racer {
  name: string;
  memberId: string;
  token: string;
}

interface RaceFixture {
  db: Db;
  pin: { knowledge_id: string; current_version: number };
  groupId: string;
  app: ReturnType<typeof buildTestApp>;
  challengeId: string;
  key: string;
  wall: number;
  racers: Record<string, Racer>;
}

async function raceFixture(names: string[]): Promise<RaceFixture> {
  const db = testDb();
  const wall = Date.now();
  const tag = next('s3d-race');
  const racers: Record<string, Racer> = {};
  const tokens: Record<string, string> = {};
  for (const name of names) {
    const subject = `${tag}-${name}`;
    racers[name] = { name, token: `tok-${subject}`, memberId: await seedMember(db, subject) };
    tokens[racers[name].token] = subject;
  }
  const groupId = await seedGroup(db, { name: `S3D Race Group ${tag}` });
  for (const racer of Object.values(racers)) {
    await seedMembership(db, groupId, racer.memberId, { status: 'active' });
  }
  const knowledge = await db.query<{ knowledge_id: string; current_version: number }>(
    `INSERT INTO knowledge_items (kind, name, lifecycle) VALUES ('fitness', $1, 'published')
     RETURNING knowledge_id, current_version`,
    [`race-run-${tag}`],
  );
  const pin = {
    knowledge_id: String(knowledge.rows[0].knowledge_id),
    current_version: Number(knowledge.rows[0].current_version),
  };
  const key = pin.knowledge_id;
  const { challenge } = await createChallenge(
    db,
    {
      group_id: groupId,
      created_by_member_id: racers[names[0]].memberId,
      title: `S3D Race ${tag}`,
      start_date: dayString(wall - 2 * DAY_MS),
      end_date: dayString(wall + 2 * DAY_MS),
      timezone: 'UTC',
      challenge_type: 'competitive',
      activities: [{ canonical_key: key, metric: 'distance', target_value: TARGET, unit: 'kilometres' }],
    } as NewChallengeInput,
    creationResolvers(pin),
  );
  await activateChallenge(db, challenge.challenge_id);
  const app = buildTestApp(tokens, { challengeActivity: { groupMembershipAuthority: allEligible } });
  return { db, pin, groupId, app, challengeId: challenge.challenge_id, key, wall, racers };
}

async function join(fx: RaceFixture, who: string): Promise<string> {
  await pause();
  const res = await fx.app.inject({
    method: 'POST', url: `/v1/challenges/${fx.challengeId}/join`, headers: authHeaders(fx.racers[who].token),
  });
  expect(res.statusCode).toBe(200);
  return (res.json() as { participationId: string }).participationId;
}

async function leave(fx: RaceFixture, who: string): Promise<void> {
  await pause();
  const res = await fx.app.inject({
    method: 'POST', url: `/v1/challenges/${fx.challengeId}/withdraw`, headers: authHeaders(fx.racers[who].token),
  });
  expect(res.statusCode).toBe(200);
}

async function log(fx: RaceFixture, who: string, value: number): Promise<void> {
  await pause();
  const res = await fx.app.inject({
    method: 'POST',
    url: `/v1/challenges/${fx.challengeId}/activity`,
    headers: authHeaders(fx.racers[who].token),
    payload: {
      activity_kind: 'fitness',
      canonical_key: fx.key,
      value,
      unit: 'kilometres',
      occurred_at: new Date().toISOString(),
      occurred_tz: 'UTC',
      client_key: next('s3d-key'),
    },
  });
  expect(res.statusCode).toBe(200);
}

async function finalize(fx: RaceFixture) {
  return finalizeChallenge(fx.db, fx.challengeId, new Date(fx.wall + 3 * DAY_MS));
}


// ─── helpers over persisted truth ──────────────────────────────────────────

const auth = { groupMembershipAuthority: allEligible };

async function board(fx: RaceFixture, viewer = 'A') {
  return getChallengeLeaderboard(fx.db, fx.racers[viewer].memberId, fx.challengeId, auth);
}

async function detailOf(fx: RaceFixture, who: string) {
  return getChallengeDetail(fx.db, fx.racers[who].memberId, fx.challengeId, auth);
}

async function episodesOf(fx: RaceFixture, who: string) {
  const result = await fx.db.query<{ participation_id: string; status: string }>(
    `SELECT participation_id, status FROM challenge_participations
     WHERE challenge_id = $1 AND member_id = $2 ORDER BY joined_at ASC, participation_id ASC`,
    [fx.challengeId, fx.racers[who].memberId],
  );
  return result.rows.map((r) => ({ id: String(r.participation_id), status: String(r.status) }));
}

async function finalsRows(fx: RaceFixture) {
  return [...(await getParticipationFinals(fx.db, fx.challengeId)).values()];
}

async function evidenceByEpisode(fx: RaceFixture): Promise<Record<string, number>> {
  const result = await fx.db.query<{ participation_id: string; n: string }>(
    `SELECT participation_id, COUNT(*) AS n FROM challenge_activity_records
     WHERE challenge_id = $1 GROUP BY participation_id`,
    [fx.challengeId],
  );
  return Object.fromEntries(result.rows.map((r) => [String(r.participation_id), Number(r.n)]));
}

async function frozenCompletionsCount(fx: RaceFixture): Promise<number> {
  const row = (await fx.db.query(
    `SELECT result FROM challenge_finalizations WHERE challenge_id = $1`, [fx.challengeId],
  )).rows[0] as { result: unknown };
  const result = typeof row.result === 'string' ? JSON.parse(row.result) : (row.result as Record<string, unknown>);
  return Number(result.completions_count);
}

/** finish(A) -> finish(B) -> partial(C) -> A leaves -> A rejoins. */
async function finishLeaveRejoin(fx: RaceFixture): Promise<void> {
  await join(fx, 'A'); await join(fx, 'B'); await join(fx, 'C');
  await log(fx, 'A', TARGET);
  await log(fx, 'B', TARGET);
  await log(fx, 'C', 4);
  await leave(fx, 'A');
  await join(fx, 'A');
}

describe('Race member identity — finish -> leave -> rejoin -> finish again', () => {
  async function scenario() {
    const fx = await raceFixture(['A', 'B', 'C']);
    await finishLeaveRejoin(fx);
    await log(fx, 'A', TARGET); // second episode also reaches the target
    return fx;
  }

  it('final Race results: one row per member, one position, #1 first, completions = distinct finishers', async () => {
    const fx = await scenario();
    await finalize(fx);

    // History preserved: A holds two participation episodes.
    const aEpisodes = await episodesOf(fx, 'A');
    expect(aEpisodes.map((e) => e.status)).toEqual(['withdrawn', 'active']);

    const result = await board(fx);
    // 2. one member appears once.
    expect(result.entries.map((e) => e.memberId).sort())
      .toEqual([fx.racers.A.memberId, fx.racers.B.memberId, fx.racers.C.memberId].sort());
    // 3 + 5. one final position for A, standings begin at #1: A first finisher.
    const byMember = Object.fromEntries(result.entries.map((e) => [e.memberId, e]));
    expect(byMember[fx.racers.A.memberId].position).toBe(1);
    expect(byMember[fx.racers.B.memberId].position).toBe(2);
    expect(result.entries.map((e) => e.position)).toEqual([1, 2, null]);
    // 7. unfinished participant stays unplaced.
    expect(byMember[fx.racers.C.memberId].position).toBeNull();
    expect(byMember[fx.racers.C.memberId].completionStatus).toBe('in_progress');
    expect(byMember[fx.racers.C.memberId].cumulativeTotal).toBe(4);
    // A's entry keeps the current episode identity ("You" behaviour).
    expect(byMember[fx.racers.A.memberId].participationId).toBe(aEpisodes[1].id);

    // Own read model: identity/status on the current episode, result governing.
    const detailA = await detailOf(fx, 'A');
    expect(detailA.myParticipation?.participationId).toBe(aEpisodes[1].id);
    expect(detailA.myParticipation?.status).toBe('active');
    expect(detailA.myParticipation?.progress.finalPosition).toBe(1);
    expect(detailA.myParticipation?.progress.completionStatus).toBe('completed');
    expect((await detailOf(fx, 'B')).myParticipation?.progress.finalPosition).toBe(2);
    expect((await detailOf(fx, 'C')).myParticipation?.progress.finalPosition).toBeNull();

    // 4. completions_count = distinct completing members (2), not episodes (3).
    expect(await frozenCompletionsCount(fx)).toBe(2);
    expect(detailA.completionsCount).toBe(2);
  });

  it('frozen rows preserve every episode: exactly one position per finishing member', async () => {
    const fx = await scenario();
    await finalize(fx);
    const rows = await finalsRows(fx);
    expect(rows).toHaveLength(4); // every episode keeps its frozen row
    const [ep1, ep2] = await episodesOf(fx, 'A');
    const byId = Object.fromEntries(rows.map((r) => [r.participation_id, r]));
    // Episode-level facts are preserved verbatim…
    expect(byId[ep1.id].completed).toBe(true);
    expect(byId[ep2.id].completed).toBe(true);
    expect(byId[ep1.id].completed_at).not.toBeNull();
    expect(byId[ep2.id].completed_at).not.toBeNull();
    // …the competitive position lives once, on the earliest completion.
    expect(byId[ep1.id].final_position).toBe(1);
    expect(byId[ep2.id].final_position).toBeNull();
    expect(byId[ep1.id].completed_at! < byId[ep2.id].completed_at!).toBe(true);
    const placed = rows.filter((r) => r.final_position != null);
    expect(new Set(placed.map((r) => r.member_id)).size).toBe(placed.length);
    expect(placed.map((r) => r.final_position).sort()).toEqual([1, 2]);
  });

  it('original episode evidence stays attached to its episode (finalization rewrites nothing)', async () => {
    const fx = await scenario();
    const [ep1, ep2] = await episodesOf(fx, 'A');
    const before = await evidenceByEpisode(fx);
    expect(before[ep1.id]).toBe(1);
    expect(before[ep2.id]).toBe(1);
    const recordsBefore = (await fx.db.query(
      `SELECT record_id, participation_id, value, accepted_at FROM challenge_activity_records
       WHERE challenge_id = $1 ORDER BY record_id`, [fx.challengeId],
    )).rows;
    await finalize(fx);
    expect(await evidenceByEpisode(fx)).toEqual(before);
    expect((await fx.db.query(
      `SELECT record_id, participation_id, value, accepted_at FROM challenge_activity_records
       WHERE challenge_id = $1 ORDER BY record_id`, [fx.challengeId],
    )).rows).toEqual(recordsBefore);
    // Episode rows themselves are untouched (still two for A, history visible).
    expect((await episodesOf(fx, 'A'))).toHaveLength(2);
  });

  it('live (unfinalized) standings and completions already use member identity', async () => {
    const fx = await scenario();
    const live = await board(fx);
    expect(live.entries.map((e) => e.position)).toEqual([1, 2, null]);
    expect(live.entries).toHaveLength(3);
    const detailA = await detailOf(fx, 'A');
    expect(detailA.completionsCount).toBe(2); // acceptance-seam count, not 3 episodes
    expect(detailA.myParticipation?.progress.finalPosition).toBeNull(); // no frozen rank yet
    // Authoritative rebuild (unfinalized) reproduces the same member-level count.
    await rebuildChallengeDerived(fx.db, fx.challengeId);
    expect((await detailOf(fx, 'A')).completionsCount).toBe(2);
  });
});

describe('Race member identity — finish -> leave -> rejoin (no further logging)', () => {
  it('the earlier finish stands: A is #1 and finished, not an empty unplaced second episode', async () => {
    const fx = await raceFixture(['A', 'B', 'C']);
    await finishLeaveRejoin(fx);
    await finalize(fx);
    const result = await board(fx);
    expect(result.entries).toHaveLength(3);
    const byMember = Object.fromEntries(result.entries.map((e) => [e.memberId, e]));
    expect(byMember[fx.racers.A.memberId].position).toBe(1);
    expect(byMember[fx.racers.A.memberId].completionStatus).toBe('completed');
    expect(byMember[fx.racers.A.memberId].cumulativeTotal).toBe(TARGET);
    expect(byMember[fx.racers.B.memberId].position).toBe(2);
    expect(byMember[fx.racers.C.memberId].position).toBeNull();
    const detailA = await detailOf(fx, 'A');
    expect(detailA.myParticipation?.progress.finalPosition).toBe(1);
    expect(detailA.myParticipation?.status).toBe('active'); // current episode still gates Leave/Log
    expect(await frozenCompletionsCount(fx)).toBe(2);
    // second episode is preserved, unfinished, unplaced.
    const [, ep2] = await episodesOf(fx, 'A');
    const ep2Final = (await finalsRows(fx)).find((r) => r.participation_id === ep2.id)!;
    expect(ep2Final.completed).toBe(false);
    expect(ep2Final.final_position).toBeNull();
  });
});

describe('Race member identity — ties remain standard competition ranking (1,1,3)', () => {
  it('tied finishers share #1, next is #3, rejoined second episode adds no slot, unfinished null', async () => {
    const fx = await raceFixture(['A', 'B', 'C', 'D']);
    const at = (offsetMs: number): Date => new Date(fx.wall - DAY_MS + offsetMs);
    const insertEpisode = async (who: string, joined: Date, exited: Date | null): Promise<void> => {
      await fx.db.query(
        `INSERT INTO challenge_participations
           (challenge_id, member_id, status, joined_at, joined_config_version, exited_at, exit_reason)
         VALUES ($1, $2, $3, $4, 1, $5, $6)`,
        [fx.challengeId, fx.racers[who].memberId, exited ? 'withdrawn' : 'active',
          joined.toISOString(), exited ? exited.toISOString() : null, exited ? 'withdrawn' : null],
      );
    };
    const logAtInstant = (who: string, value: number, instant: Date) => applyChallengeActivity(
      fx.db, fx.racers[who].memberId, fx.challengeId,
      {
        activity_kind: 'fitness', canonical_key: fx.key, value, unit: 'kilometres',
        occurred_at: instant, client_key: next('tie-key'),
      },
      { resolveKnowledgePin: async () => fx.pin, resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }) },
      { now: instant },
    );
    await insertEpisode('A', at(0), at(3_600_000));            // A episode 1 (closed)
    await insertEpisode('B', at(0), null);
    await insertEpisode('C', at(0), null);
    await insertEpisode('D', at(0), null);
    await insertEpisode('A', at(4_000_000), null);             // A episode 2 (current)
    await logAtInstant('A', TARGET, at(1_000_000));            // A finishes  ┐ identical
    await logAtInstant('B', TARGET, at(1_000_000));            // B finishes  ┘ instant → tie
    await logAtInstant('C', TARGET, at(2_000_000));            // C finishes later
    await logAtInstant('D', 3, at(2_000_000));                 // D unfinished
    await logAtInstant('A', TARGET, at(5_000_000));            // A again in episode 2
    await finalize(fx);

    const result = await board(fx);
    const positions = Object.fromEntries(result.entries.map((e) => [e.memberId, e.position]));
    expect(positions[fx.racers.A.memberId]).toBe(1);
    expect(positions[fx.racers.B.memberId]).toBe(1);
    expect(positions[fx.racers.C.memberId]).toBe(3);
    expect(positions[fx.racers.D.memberId]).toBeNull();
    expect(result.entries.map((e) => e.position)).toEqual([1, 1, 3, null]);
    expect(await frozenCompletionsCount(fx)).toBe(3); // A, B, C — not 4 episodes
    const rows = await finalsRows(fx);
    expect(rows).toHaveLength(5);
    expect(rows.filter((r) => r.completed)).toHaveLength(4); // episode facts preserved
    expect(rows.filter((r) => r.final_position != null)).toHaveLength(3);
  });
});

describe('Race member identity — sealed, idempotent, verifiable', () => {
  it('finalization is idempotent, finals stay immutable, verify-only agrees', async () => {
    const fx = await raceFixture(['A', 'B', 'C']);
    await finishLeaveRejoin(fx);
    await log(fx, 'A', TARGET);
    const first = await finalize(fx);
    expect(first.alreadyFinalized).toBe(false);
    expect(first.finalization.finalization_version).toBe(FINALIZATION_VERSION);
    const snapshot = JSON.stringify(await finalsRows(fx).then((r) => r.sort((x, y) => x.participation_id.localeCompare(y.participation_id))));
    const second = await finalize(fx);
    expect(second.alreadyFinalized).toBe(true);
    expect(second.finalization.result).toEqual(first.finalization.result);
    expect(JSON.stringify((await finalsRows(fx)).sort((x, y) => x.participation_id.localeCompare(y.participation_id)))).toBe(snapshot);

    // 10. sealed: the guard rejects any mutation of finals.
    const [row] = await finalsRows(fx);
    await expect(fx.db.query(
      `UPDATE challenge_participation_finals SET final_position = 9 WHERE participation_id = $1`, [row.participation_id],
    )).rejects.toThrow(/frozen history/);
    await expect(fx.db.query(
      `DELETE FROM challenge_participation_finals WHERE participation_id = $1`, [row.participation_id],
    )).rejects.toThrow(/frozen history/);
    await expect(fx.db.query(
      `UPDATE challenge_finalizations SET result = '{}' WHERE challenge_id = $1`, [fx.challengeId],
    )).rejects.toThrow(/frozen history/);

    const verify = await rebuildChallengeDerived(fx.db, fx.challengeId);
    expect(verify.mode).toBe('verify');
    expect(verify.verified).toBe(true);
    expect(verify.mismatches).toEqual([]);
  });

  it('historical episode-identity finalizations (ebc04/v1) still verify under their own rule', async () => {
    const fx = await raceFixture(['A', 'B', 'C']);
    await finishLeaveRejoin(fx);
    await log(fx, 'A', TARGET);
    await finalize(fx);
    const [ep1, ep2] = await episodesOf(fx, 'A');
    const rows = await finalsRows(fx);
    const bRow = rows.find((r) => r.member_id === fx.racers.B.memberId)!;
    // Reconstruct exactly what the pre-correction code froze (fault
    // injection, bypassing the immutability guard the way the EBC-04
    // corruption test does): episode ranks A1=1, B=2, A2=3; completions 3.
    await fx.db.query('ALTER TABLE challenge_participation_finals DISABLE TRIGGER challenge_participation_finals_no_mutation');
    await fx.db.query('ALTER TABLE challenge_finalizations DISABLE TRIGGER challenge_finalizations_no_mutation');
    await fx.db.query(`UPDATE challenge_participation_finals SET final_position = 3 WHERE participation_id = $1`, [ep2.id]);
    await fx.db.query(`UPDATE challenge_participation_finals SET final_position = 2 WHERE participation_id = $1`, [bRow.participation_id]);
    await fx.db.query(
      `UPDATE challenge_finalizations SET finalization_version = 'ebc04/v1',
         result = jsonb_set(result::jsonb, '{completions_count}', '3') WHERE challenge_id = $1`,
      [fx.challengeId],
    );
    await fx.db.query('ALTER TABLE challenge_participation_finals ENABLE TRIGGER challenge_participation_finals_no_mutation');
    await fx.db.query('ALTER TABLE challenge_finalizations ENABLE TRIGGER challenge_finalizations_no_mutation');
    void ep1;
    const legacy = await rebuildChallengeDerived(fx.db, fx.challengeId);
    expect(legacy.verified).toBe(true); // v1 stamp -> episode rule reproduces it

    // Flip the stamp to v2 without fixing the ranks: verification must fail.
    await fx.db.query('ALTER TABLE challenge_finalizations DISABLE TRIGGER challenge_finalizations_no_mutation');
    await fx.db.query(`UPDATE challenge_finalizations SET finalization_version = 'ebc04/v2' WHERE challenge_id = $1`, [fx.challengeId]);
    await fx.db.query('ALTER TABLE challenge_finalizations ENABLE TRIGGER challenge_finalizations_no_mutation');
    const mismatched = await rebuildChallengeDerived(fx.db, fx.challengeId);
    expect(mismatched.verified).toBe(false);
  });
});

async function derivedByEpisode(fx: RaceFixture) {
  const result = await fx.db.query(
    `SELECT participation_id, cumulative_total, completion_status, logs_accepted
     FROM challenge_participation_derived WHERE challenge_id = $1`,
    [fx.challengeId],
  );
  const out: Record<string, { cumulativeTotal: number; completionStatus: string; logsAccepted: number }> = {};
  for (const r of result.rows as Array<Record<string, unknown>>) {
    out[String(r.participation_id)] = {
      cumulativeTotal: Number(r.cumulative_total),
      completionStatus: String(r.completion_status),
      logsAccepted: Number(r.logs_accepted),
    };
  }
  return out;
}

describe('Race member identity — ITR-001(A): unfinished progress never accumulates across rejoin', () => {
  it('6 + leave + 6 stays 6 on the current episode; member unfinished; no frozen place', async () => {
    const fx = await raceFixture(['A']);
    const ep1 = await join(fx, 'A');
    await log(fx, 'A', 6);
    await leave(fx, 'A');
    const ep2 = await join(fx, 'A');
    await log(fx, 'A', 6);
    expect(ep2).not.toBe(ep1);
    expect((await episodesOf(fx, 'A')).map((e) => e.id)).toEqual([ep1, ep2]);
    const derived = await derivedByEpisode(fx);
    expect(derived[ep1].cumulativeTotal).toBe(6);
    expect(derived[ep1].completionStatus).toBe('in_progress');
    expect(derived[ep2].cumulativeTotal).toBe(6);
    expect(derived[ep2].completionStatus).toBe('in_progress');
    const live = await board(fx);
    expect(live.entries).toHaveLength(1);
    expect(live.entries[0].memberId).toBe(fx.racers.A.memberId);
    expect(live.entries[0].participationId).toBe(ep2);
    expect(live.entries[0].completionStatus).toBe('in_progress');
    expect(live.entries[0].cumulativeTotal).toBe(6);
    expect(live.entries[0].position).toBeNull();
    const detail = await detailOf(fx, 'A');
    expect(detail.myParticipation?.participationId).toBe(ep2);
    expect(detail.myParticipation?.status).toBe('active');
    expect(detail.myParticipation?.progress.cumulativeTotal).toBe(6);
    expect(detail.myParticipation?.progress.completionStatus).toBe('in_progress');
    await finalize(fx);
    const final = await board(fx);
    expect(final.entries).toHaveLength(1);
    expect(final.entries[0].participationId).toBe(ep2);
    expect(final.entries[0].completionStatus).toBe('in_progress');
    expect(final.entries[0].cumulativeTotal).toBe(6);
    expect(final.entries[0].position).toBeNull();
    const rows = await finalsRows(fx);
    expect(rows).toHaveLength(2);
    const byId = Object.fromEntries(rows.map((r) => [r.participation_id, r]));
    expect(byId[ep1].completed).toBe(false);
    expect(byId[ep1].final_position).toBeNull();
    expect(byId[ep2].completed).toBe(false);
    expect(byId[ep2].final_position).toBeNull();
    expect(await frozenCompletionsCount(fx)).toBe(0);
  });
});

describe('Race member identity — ITR-001(B): completed member with an unfinished rejoin', () => {
  it('live board keeps the earlier completion: earliest episode governs, rejoin erases nothing', async () => {
    const fx = await raceFixture(['A', 'B']);
    await join(fx, 'A');
    await join(fx, 'B');
    await log(fx, 'A', TARGET);
    await leave(fx, 'A');
    await join(fx, 'A');
    await log(fx, 'A', 2);
    const eps = await episodesOf(fx, 'A');
    const ep1 = eps[0];
    const ep2 = eps[1];
    const live = await board(fx);
    expect(live.entries).toHaveLength(2);
    const byMember = Object.fromEntries(live.entries.map((e) => [e.memberId, e]));
    const a = byMember[fx.racers.A.memberId];
    expect(a.participationId).toBe(ep2.id);
    expect(a.completionStatus).toBe('completed');
    expect(a.cumulativeTotal).toBe(TARGET);
    expect(a.completedAt).not.toBeNull();
    expect(a.position).toBe(1);
    expect(live.entries.map((e) => e.position)).toEqual([1, null]);
    const derived = await derivedByEpisode(fx);
    expect(derived[ep1.id].completionStatus).toBe('completed');
    expect(derived[ep1.id].cumulativeTotal).toBe(TARGET);
    expect(derived[ep2.id].completionStatus).toBe('in_progress');
    expect(derived[ep2.id].cumulativeTotal).toBe(2);
    const detailA = await detailOf(fx, 'A');
    expect(detailA.myParticipation?.participationId).toBe(ep2.id);
    expect(detailA.myParticipation?.status).toBe('active');
    expect(detailA.myParticipation?.progress.completionStatus).toBe('completed');
    expect(detailA.myParticipation?.progress.cumulativeTotal).toBe(TARGET);
    expect(detailA.myParticipation?.progress.finalPosition).toBeNull();
    await finalize(fx);
    const rows = await finalsRows(fx);
    const byId = Object.fromEntries(rows.map((r) => [r.participation_id, r]));
    expect(byId[ep1.id].completed).toBe(true);
    expect(byId[ep1.id].final_position).toBe(1);
    expect(byId[ep2.id].completed).toBe(false);
    expect(byId[ep2.id].final_position).toBeNull();
    expect(await frozenCompletionsCount(fx)).toBe(1);
    const final = await board(fx);
    const fa = Object.fromEntries(final.entries.map((e) => [e.memberId, e]))[fx.racers.A.memberId];
    expect(fa.participationId).toBe(ep2.id);
    expect(fa.completionStatus).toBe('completed');
    expect(fa.position).toBe(1);
  });
});

describe('Race member identity — pure ranking properties', () => {
  const at = (n: number): string => new Date(Date.UTC(2026, 5, 1, 10, n)).toISOString();

  it('one episode per member: identical to episode ranking (ordinary Races are unchanged)', () => {
    const completions = [
      { participation_id: 'e1', member_id: 'm1', completed_at: at(1) },
      { participation_id: 'e2', member_id: 'm2', completed_at: at(1) },
      { participation_id: 'e3', member_id: 'm3', completed_at: at(3) },
      { participation_id: 'e4', member_id: 'm4', completed_at: null },
    ];
    const ids = completions.map((c) => c.participation_id);
    expect(memberFinishingPositions(completions, ids)).toEqual(
      computeFinishingPositions(completions.map((c) => ({ participation_id: c.participation_id, completed_at: c.completed_at })), ids),
    );
    expect(memberFinishingPositions(completions, ids)).toEqual({ e1: 1, e2: 1, e3: 3, e4: null });
  });

  it('a second completed episode neither holds a slot nor changes anyone else\'s position', () => {
    const completions = [
      { participation_id: 'a1', member_id: 'A', completed_at: at(1) },
      { participation_id: 'b1', member_id: 'B', completed_at: at(2) },
      { participation_id: 'a2', member_id: 'A', completed_at: at(3) },
    ];
    expect(memberFinishingPositions(completions, ['a1', 'b1', 'a2'])).toEqual({ a1: 1, b1: 2, a2: null });
  });

  it('the earliest completion governs regardless of episode order', () => {
    const completions = [
      { participation_id: 'a2', member_id: 'A', completed_at: at(9) },
      { participation_id: 'a1', member_id: 'A', completed_at: at(1) },
    ];
    expect(memberFinishingPositions(completions, ['a1', 'a2'])).toEqual({ a1: 1, a2: null });
  });

  it('completing members are counted once', () => {
    expect(countCompletingMembers([
      { member_id: 'A', completed: true },
      { member_id: 'A', completed: true },
      { member_id: 'B', completed: true },
      { member_id: 'C', completed: false },
    ])).toBe(2);
  });
});

void expect;
