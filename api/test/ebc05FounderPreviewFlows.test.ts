/**
 * EBC-05 Integrated Engine Founder Preview — HTTP flow proof (committed).
 *
 * Proves the WHOLE Founder scenario through the real Fastify routes
 * (governed establishment → join → V2 submission → derived reads →
 * local finalization → frozen history) for all three families, with the
 * REAL database Knowledge eligibility gate and scripted live Group
 * authority (standing in for Firestore, exactly as the EBC-01/02
 * route tests do). Only Firebase token verification is stubbed
 * (token → UID mapping); every domain decision runs for real.
 *
 * FLOW A — COLLECTIVE: establish → join → log → aggregate moves →
 *   overshoot past 100% → goal reached → withdraw preserves history.
 * FLOW B — COMPETITIVE: two members → establish → join → log → live
 *   ranking → local finalization → frozen rank for the finisher, no
 *   rank for the non-completer.
 * FLOW C — STREAK: establish → join → daily logs → Current/Best/Days
 *   visible → local finalization → frozen finalStreak (null before).
 * NEGATIVE: draft Knowledge and wrong-unit tuples are rejected (422)
 *   by the establishment authority.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { endChallenge } from '../src/challenges.js';
import { finalizeChallenge } from '../src/challengeFinalization.js';
import { createDbKnowledgeEligibilityResolver } from '../src/knowledgeEligibility.js';
import type { ChallengeCreationAuthority } from '../src/challengeCreationAuthority.js';
import {
  authHeaders,
  seedGroup,
  seedMember,
  seedMembership,
  stubVerifier,
  testDb,
} from './helpers.js';
import type { Db } from '../src/db.js';

beforeEach(async () => {
  await testDb().query(
    'TRUNCATE challenge_derived_state, challenge_participation_derived, challenge_activity_records, challenge_activity_configs, challenge_config_versions, challenge_participations, challenges, challenge_establishment_keys, member_activity_events, activity_submission_intents, challenge_finalizations, challenge_participation_finals',
  );
});

let seq = 0;
const next = (prefix: string): string => `${prefix}-${(seq += 1)}`;

/**
 * Route-level acceptance runs on wall clock and the owning episode is
 * [joined_at, exited_at): occurrences must land at/after establishment.
 * Capture fresh timestamps at log time; Challenge-local days derive from
 * the governing timezone.
 */
const nowIso = (): string => new Date().toISOString();

function nztDay(offsetDays: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(Date.now() + offsetDays * 86_400_000));
  return parts;
}

/** KCS-ready, compatibility-governed Knowledge (mirrors the preview seed). */
async function seedReadyKnowledge(
  db: Db,
  name: string,
  contract: { primary: string[]; units: string[] } = { primary: ['repetitions'], units: ['reps'] },
): Promise<void> {
  await db.query(
    `INSERT INTO knowledge_items
       (kind, name, lifecycle, grandfathered, description, category,
        metric_unit, measurement_guidance, safety_notes,
        primary_metrics, secondary_metrics, compatible_units)
     VALUES ('fitness', $1, 'published', FALSE,
       'A governed preview movement', 'Upper Body', 'reps',
       'Count full-range repetitions', ARRAY['Stop on sharp pain'],
       $2, ARRAY[]::TEXT[], $3)`,
    [name, contract.primary, contract.units],
  );
}

function permitAll(): ChallengeCreationAuthority {
  return {
    async resolveChallengeCreationAuthority() {
      return {
        permitted: true,
        reason: null,
        groupStatus: 'active',
        allowMemberChallenges: true,
        memberRole: 'admin',
        memberStatus: 'active',
      };
    },
  };
}

function appFor(tokens: Record<string, string>) {
  return buildApp({
    db: testDb(),
    verifier: stubVerifier(tokens),
    challengeActivity: {
      groupMembershipAuthority: {
        resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
      },
    },
    challengeCreation: {
      creationAuthority: permitAll(),
      eligibilityFor: async (kind, key) => createDbKnowledgeEligibilityResolver(testDb(), kind)(key),
    },
  });
}

interface FounderWorld {
  app: ReturnType<typeof appFor>;
  groupId: string;
  tokenOne: string;
  tokenTwo: string;
  knowledgeName: string;
}

async function founderWorld(tag: string): Promise<FounderWorld> {
  const db = testDb();
  const uidOne = `founder-one-${tag}`;
  const uidTwo = `founder-two-${tag}`;
  const tokenOne = `token-one-${tag}`;
  const tokenTwo = `token-two-${tag}`;
  const memberOne = await seedMember(db, uidOne);
  await seedMember(db, uidTwo);
  const groupId = await seedGroup(db, { name: `Preview Group ${tag}` });
  await seedMembership(db, groupId, memberOne, { role: 'admin', status: 'active' });
  const knowledgeName = `Preview Push-Up ${tag}`;
  await seedReadyKnowledge(db, knowledgeName);
  return {
    app: appFor({ [tokenOne]: uidOne, [tokenTwo]: uidTwo }),
    groupId,
    tokenOne,
    tokenTwo,
    knowledgeName,
  };
}

async function establish(
  w: FounderWorld,
  token: string,
  body: Record<string, unknown>,
): Promise<{ status: number; json: any }> {
  const response = await w.app.inject({
    method: 'POST',
    url: '/v1/challenges',
    headers: authHeaders(token),
    payload: body,
  });
  return { status: response.statusCode, json: response.json() };
}

async function logActivity(
  w: FounderWorld,
  token: string,
  challengeId: string,
  body: Record<string, unknown>,
): Promise<{ status: number; json: any }> {
  const response = await w.app.inject({
    method: 'POST',
    url: `/v1/challenges/${challengeId}/activity`,
    headers: authHeaders(token),
    payload: body,
  });
  return { status: response.statusCode, json: response.json() };
}

async function detail(w: FounderWorld, token: string, challengeId: string): Promise<any> {
  const response = await w.app.inject({
    method: 'GET',
    url: `/v1/challenges/${challengeId}`,
    headers: authHeaders(token),
  });
  expect(response.statusCode).toBe(200);
  return response.json();
}

describe('EBC-05 FLOW A — collective establish → join → log → overshoot → withdraw', () => {
  it('aggregate moves with each log, overshoot counts, withdrawal preserves history', async () => {
    const w = await founderWorld(next('flowA'));
    const created = await establish(w, w.tokenOne, {
      group_id: w.groupId,
      challenge_type: 'collective',
      title: 'Team preview push-ups',
      start_date: '2026-01-01',
      end_date: '2027-12-31',
      timezone: 'Pacific/Auckland',
      goal_value: 100,
      goal_unit: 'reps',
      activities: [
        {
          activity_kind: 'fitness',
          canonical_key: w.knowledgeName,
          metric: 'repetitions',
          target_value: 10,
          unit: 'reps',
        },
      ],
      activate: true,
      join_creator: true,
    });
    expect(created.status).toBe(201);
    const challengeId = created.json.challengeId as string;
    expect(created.json.activated).toBe(true);

    // Creator is already participating (join_creator); aggregate starts at 0.
    let seen = await detail(w, w.tokenOne, challengeId);
    expect(seen.collectiveTotal).toBe(0);
    expect(seen.collectiveGoalReached).toBe(false);
    expect(seen.myParticipation).not.toBeNull();
    expect(seen.timezone).toBe('Pacific/Auckland');

    // Second member is NOT automatically a participant: no episode yet.
    const joinResponse = await w.app.inject({
      method: 'POST',
      url: `/v1/challenges/${challengeId}/join`,
      headers: authHeaders(w.tokenTwo),
    });
    expect(joinResponse.statusCode).toBe(200);

    // Log 60 + 50: aggregate visibly moves, then overshoots past 100%.
    for (const [token, value, key] of [
      [w.tokenOne, 60, 'flowA-log-1'],
      [w.tokenTwo, 50, 'flowA-log-2'],
    ] as const) {
      const logged = await logActivity(w, token, challengeId, {
        activity_kind: 'fitness',
        canonical_key: w.knowledgeName,
        value,
        unit: 'reps',
        occurred_at: nowIso(),
        client_key: key,
      });
      expect(logged.status).toBe(200);
    }
    seen = await detail(w, w.tokenOne, challengeId);
    expect(seen.collectiveTotal).toBe(110);
    expect(seen.collectiveGoalReached).toBe(true);

    // Withdrawal closes the episode but preserves history.
    const withdrawn = await w.app.inject({
      method: 'POST',
      url: `/v1/challenges/${challengeId}/withdraw`,
      headers: authHeaders(w.tokenTwo),
    });
    expect(withdrawn.statusCode).toBe(200);
    seen = await detail(w, w.tokenTwo, challengeId);
    expect(seen.myParticipation.status).toBe('withdrawn');
    expect(seen.collectiveTotal).toBe(110);
  });
});

describe('EBC-05 FLOW B — competitive two members → live rank → frozen finals', () => {
  it('live ranking changes with logs; finalization freezes rank, non-completer has none', async () => {
    const w = await founderWorld(next('flowB'));
    // Competitive races to per-activity targets: no challenge-level goal.
    const created = await establish(w, w.tokenOne, {
      group_id: w.groupId,
      challenge_type: 'competitive',
      title: 'Preview squat race',
      start_date: '2026-01-01',
      end_date: '2027-12-31',
      timezone: 'Pacific/Auckland',
      activities: [
        {
          activity_kind: 'fitness',
          canonical_key: w.knowledgeName,
          metric: 'repetitions',
          target_value: 50,
          unit: 'reps',
        },
      ],
      activate: true,
      join_creator: true,
    });
    expect(created.status).toBe(201);
    const challengeId = created.json.challengeId as string;

    const joinTwo = await w.app.inject({
      method: 'POST',
      url: `/v1/challenges/${challengeId}/join`,
      headers: authHeaders(w.tokenTwo),
    });
    expect(joinTwo.statusCode).toBe(200);

    // Founder One completes (50/50); Founder Two logs partial progress.
    for (const [token, value, key] of [
      [w.tokenOne, 50, 'flowB-log-1'],
      [w.tokenTwo, 20, 'flowB-log-2'],
    ] as const) {
      const logged = await logActivity(w, token, challengeId, {
        activity_kind: 'fitness',
        canonical_key: w.knowledgeName,
        value,
        unit: 'reps',
        occurred_at: nowIso(),
        client_key: key,
      });
      expect(logged.status).toBe(200);
    }
    const board = await w.app.inject({
      method: 'GET',
      url: `/v1/challenges/${challengeId}/leaderboard`,
      headers: authHeaders(w.tokenOne),
    });
    expect(board.statusCode).toBe(200);
    const entries = (board.json() as any).entries as Array<{ position: number | null }>;
    expect(entries[0]?.position).toBe(1);

    // Local finalization (the dev-only seam): end, then freeze.
    await endChallenge(testDb(), challengeId);
    await finalizeChallenge(testDb(), challengeId, new Date());

    const frozen = await detail(w, w.tokenOne, challengeId);
    expect(frozen.status).toBe('ended');
    expect(frozen.finalized).toBe(true);
    expect(frozen.finalizedAt).not.toBeNull();
    expect(frozen.finalResult).not.toBeNull();
    expect(frozen.myParticipation.progress.finalPosition).toBe(1);

    const frozenTwo = await detail(w, w.tokenTwo, challengeId);
    expect(frozenTwo.finalized).toBe(true);
    expect(frozenTwo.myParticipation.progress.finalPosition).toBeNull();
  });
});

describe('EBC-05 FLOW C — streak daily log → Current/Best/Days → frozen finalStreak', () => {
  it('terminal proof freezes finalStreak; reads carry null before finalization', async () => {
    const w = await founderWorld(next('flowC'));
    // Window ends on the current Challenge-local day so the terminal
    // freeze evaluates the day just logged (routes run on wall clock).
    const created = await establish(w, w.tokenOne, {
      group_id: w.groupId,
      challenge_type: 'streak',
      title: 'Preview morning streak',
      start_date: nztDay(-6),
      end_date: nztDay(0),
      timezone: 'Pacific/Auckland',
      required_consecutive_days: 5,
      activities: [
        {
          activity_kind: 'fitness',
          canonical_key: w.knowledgeName,
          metric: 'repetitions',
          target_value: 10,
          unit: 'reps',
        },
      ],
      activate: true,
      join_creator: true,
    });
    expect(created.status).toBe(201);
    const challengeId = created.json.challengeId as string;

    const logged = await logActivity(w, w.tokenOne, challengeId, {
      activity_kind: 'fitness',
      canonical_key: w.knowledgeName,
      value: 10,
      unit: 'reps',
      occurred_at: nowIso(),
      client_key: 'flowC-log-1',
    });
    expect(logged.status).toBe(200);

    let seen = await detail(w, w.tokenOne, challengeId);
    expect(seen.myParticipation.progress.currentStreak).toBe(1);
    expect(seen.myParticipation.progress.bestStreak).toBe(1);
    expect(seen.myParticipation.progress.daysCompleted).toBe(1);
    // Unfinalized: no frozen streak yet.
    expect(seen.finalized).toBe(false);
    expect(seen.myParticipation.progress.finalStreak).toBeNull();

    // Terminal local proof: end, then freeze.
    await endChallenge(testDb(), challengeId);
    await finalizeChallenge(testDb(), challengeId, new Date());

    seen = await detail(w, w.tokenOne, challengeId);
    expect(seen.finalized).toBe(true);
    expect(seen.myParticipation.progress.finalStreak).toBe(1);
  });
});

describe('EBC-05 establishment negatives (server authority)', () => {
  it('draft Knowledge and wrong-unit tuples are rejected with 422', async () => {
    const db = testDb();
    const w = await founderWorld(next('flowN'));
    await db.query(
      `INSERT INTO knowledge_items (kind, name, lifecycle) VALUES ('fitness', $1, 'draft')`,
      [`Draft Move ${w.knowledgeName}`],
    );
    const draftName = `Draft Move ${w.knowledgeName}`;

    const draftAttempt = await establish(w, w.tokenOne, {
      group_id: w.groupId,
      challenge_type: 'collective',
      title: 'Draft backed challenge',
      start_date: '2026-01-01',
      end_date: '2027-12-31',
      goal_value: 10,
      goal_unit: 'reps',
      activities: [
        {
          activity_kind: 'fitness',
          canonical_key: draftName,
          metric: 'repetitions',
          target_value: 10,
          unit: 'reps',
        },
      ],
      activate: true,
    });
    expect(draftAttempt.status).toBe(422);

    const wrongUnit = await establish(w, w.tokenOne, {
      group_id: w.groupId,
      challenge_type: 'collective',
      title: 'Wrong unit challenge',
      start_date: '2026-01-01',
      end_date: '2027-12-31',
      goal_value: 10,
      goal_unit: 'reps',
      activities: [
        {
          activity_kind: 'fitness',
          canonical_key: w.knowledgeName,
          metric: 'repetitions',
          target_value: 10,
          unit: 'minutes',
        },
      ],
      activate: true,
    });
    expect(wrongUnit.status).toBe(422);
  });
});
