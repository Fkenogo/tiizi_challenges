/**
 * S3d results / finalized-experience guards (run: npm run test:s3d-results).
 *
 * TIIZI-S3D-RESULTS-FINALIZED-EXPERIENCE-001: the V2 Challenge detail presents
 * governed final/frozen truth only, and never manufactures it. Proves
 * (runtime/behavioral first; source-string only for non-existence claims, as
 * in S3a/S3b/S3c):
 *
 *   G-1 pure results derivation: frozen positions/totals are passed through
 *       (never computed/ranked), overshoot preserved, N-of-M from entries;
 *   G-2 end-state routing: live / window-expired-unprocessed / ended-pending /
 *       finalized, with logging + Leave hidden outside live;
 *   G-3 the S3d finalized-standings query runs through a real QueryClient —
 *       enabled (1 transport call) exactly when finalized;
 *   G-4 S3c boundary preserved: no S3d vocabulary leaks into S3c-guarded
 *       files, and the S3c live surface still unmounts when finalized;
 *   G-5 no failure/winner/podium/recognition vocabulary in S3d user copy;
 *   plus the frozen-Final-Streak proof (never the live currentStreak) and the
 *       "no client-manufactured truth" (no setQueryData / no client ranking).
 */
import { readFileSync } from 'node:fs';
import { QueryClient } from '@tanstack/react-query';
import type {
  V2ChallengeDetail,
  V2LeaderboardEntry,
} from '../src/api/v2ChallengeApi.js';
import { v2ChallengeLeaderboardKey } from '../src/v2/challenges/challengeQueryKeys.js';
import {
  endStateFor,
  loggingAvailableForEndState,
  participationMutableForEndState,
} from '../src/v2/challenges/challengeEndState.js';
import { participationViewFor } from '../src/v2/challenges/participationView.js';
import {
  collectiveFinalResultFor,
  competitiveFinalResultFor,
  finalizedStandingsEnabledForS3d,
  inclusivePeriodDays,
  raceStandingsFor,
  streakFinalResultFor,
  streakPeriodDays,
} from '../src/v2/challenges/resultsView.js';

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok: ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
/** Strip block + line comments so vocabulary claims test user-facing code only. */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');

function detail(overrides: Partial<V2ChallengeDetail>): V2ChallengeDetail {
  return {
    challengeId: '11111111-1111-4111-8111-111111111111',
    groupId: '22222222-2222-4222-8222-222222222222',
    title: 'Test Challenge',
    description: '',
    challengeType: 'collective',
    status: 'active',
    startDate: '2026-06-01',
    endDate: '2026-06-05',
    timezone: 'UTC',
    finalized: false,
    currentConfigVersion: 1,
    goalValue: null,
    goalUnit: null,
    collectiveTotal: 0,
    collectiveGoalReached: false,
    completionsCount: 0,
    myParticipation: null,
    instructions: '',
    activatedAt: null,
    endedAt: null,
    finalizedAt: null,
    finalResult: null,
    governingToday: '2026-06-03',
    serverNow: '2026-06-03T06:00:00.000Z',
    config: {
      version: 1,
      period: { startDate: '2026-06-01', endDate: '2026-06-05' },
      requiredConsecutiveDays: null,
      activities: [],
    },
    ...overrides,
  } as V2ChallengeDetail;
}

function participation(overrides: Record<string, unknown> = {}) {
  return {
    participationId: '33333333-3333-4333-8333-333333333333',
    status: 'active',
    joinedAt: '2026-06-01T00:00:00.000Z',
    joinedConfigVersion: 1,
    progress: {
      logsAccepted: 0,
      distinctDays: 0,
      totalPoints: 0,
      completionRate: 0,
      cumulativeValues: {},
      cumulativeTotal: 0,
      currentStreak: 0,
      bestStreak: 0,
      lastCompletedDay: null,
      dayStates: {},
      daysCompleted: 0,
      completionStatus: 'in_progress',
      completedAt: null,
      finalPosition: null,
      ...(overrides.progress as Record<string, unknown> ?? {}),
    },
    final: overrides.final ?? null,
  } as V2ChallengeDetail['myParticipation'];
}

// ─── G-2 lifecycle end-state ────────────────────────────────────────────────
console.log('G-2 lifecycle end-state');
{
  check('active inside window → live',
    endStateFor(detail({ status: 'active', governingToday: '2026-06-03' })) === 'live');
  check('window-expired unprocessed (active, day past end) → ended-pending',
    endStateFor(detail({ status: 'active', governingToday: '2026-06-10' })) === 'ended-pending');
  check('ended not finalized → ended-pending',
    endStateFor(detail({ status: 'ended', governingToday: '2026-06-10' })) === 'ended-pending');
  check('finalized → finalized',
    endStateFor(detail({ status: 'ended', finalized: true, governingToday: '2026-06-10' })) === 'finalized');
  check('logging only in live state',
    loggingAvailableForEndState('live') === true
    && loggingAvailableForEndState('ended-pending') === false
    && loggingAvailableForEndState('finalized') === false);
  check('Leave/mutation only in live state',
    participationMutableForEndState('live') === true
    && participationMutableForEndState('ended-pending') === false
    && participationMutableForEndState('finalized') === false);
  // CORR-001: UI authority agrees with the backend participation lifecycle.
  check('CORR-001 UI: window-expired active is read-only (no Join/Leave)',
    participationViewFor(detail({ status: 'active', governingToday: '2026-06-10' })).kind === 'read-only');
  check('CORR-001 UI: in-window non-participant can still join',
    participationViewFor(detail({ status: 'active', governingToday: '2026-06-03' })).kind === 'not-joined');
  check('CORR-001 UI: ended-pending has no Join even with no episode',
    participationViewFor(detail({ status: 'ended', governingToday: '2026-06-10' })).kind === 'read-only');
  check('CORR-001 UI: finalized is read-only',
    participationViewFor(detail({ status: 'ended', finalized: true, governingToday: '2026-06-10' })).kind === 'read-only');
}

// ─── G-1 Collective derivation ──────────────────────────────────────────────
console.log('G-1 collective frozen derivation');
{
  const reached = collectiveFinalResultFor(detail({
    challengeType: 'collective',
    status: 'ended',
    finalized: true,
    finalizedAt: '2026-06-10T12:00:00.000Z',
    goalValue: 200,
    goalUnit: 'reps',
    collectiveTotal: 220,
    collectiveGoalReached: true,
    finalResult: {
      finalizedAt: '2026-06-10T12:00:00.000Z', configVersion: 1, finalizationVersion: 'ebc04/v2',
      engineVersion: 'v2', scoringVersion: 'computeActivityScore/v1',
      result: {
        collective_total: 220, collective_goal_reached: true,
        goal_completed_at: '2026-06-04T09:00:00.000Z', completions_count: 3,
      },
    },
    myParticipation: participation({ progress: { cumulativeTotal: 70 }, final: { completed: true, completedAt: null, daysCompleted: 0, bestStreak: 0, finalStreak: 0, finalPosition: null, finalizedAt: '2026-06-10T12:00:00.000Z' } }),
  }));
  check('overshoot preserved: 220/200 = 110%',
    reached.total === 220 && reached.percent === 110 && reached.overshoot === 20 && reached.remaining === 0);
  check('reached + goal-crossing instant from frozen truth',
    reached.goalReached === true && reached.goalCompletedAt === '2026-06-04T09:00:00.000Z');
  check('own contribution + share from reads (70/220)',
    reached.ownContribution === 70 && reached.ownShare !== null
    && Math.abs(reached.ownShare - 70 / 220) < 1e-12);

  const missed = collectiveFinalResultFor(detail({
    challengeType: 'collective', status: 'ended', finalized: true,
    goalValue: 100, goalUnit: 'reps', collectiveTotal: 40, collectiveGoalReached: false,
    finalResult: {
      finalizedAt: '2026-06-10T12:00:00.000Z', configVersion: 1, finalizationVersion: 'ebc04/v2',
      engineVersion: 'v2', scoringVersion: 'computeActivityScore/v1',
      result: { collective_total: 40, collective_goal_reached: false, goal_completed_at: null, completions_count: 0 },
    },
  }));
  check('missed goal reports actual total/percent (no cap, no failure)',
    missed.total === 40 && missed.percent === 40 && missed.goalReached === false
    && missed.goalCompletedAt === null && missed.overshoot === null);
}

// ─── G-1 Streak frozen Final Streak ─────────────────────────────────────────
console.log('G-1 streak frozen Final Streak');
{
  const view = streakFinalResultFor(detail({
    challengeType: 'streak', status: 'ended', finalized: true,
    finalizedAt: '2026-06-10T12:00:00.000Z',
    config: {
      version: 1, period: { startDate: '2026-06-01', endDate: '2026-06-05' },
      requiredConsecutiveDays: 3,
      activities: [{ canonicalKey: 'push-up', activityVariant: null, activityKind: 'fitness', targetValue: 20, unit: 'reps', position: 0 }],
    },
    myParticipation: participation({
      // The live row contradicts the sealed final on purpose.
      progress: { currentStreak: 3, bestStreak: 3, daysCompleted: 3, completionStatus: 'completed' },
      final: {
        completed: true, completedAt: '2026-06-10T12:00:00.000Z', daysCompleted: 3,
        bestStreak: 3, finalStreak: 0, finalPosition: null, finalizedAt: '2026-06-10T12:00:00.000Z',
      },
    }),
  }));
  check('finalStreak comes from frozen authority (0), not live currentStreak (3)',
    view.finalStreak === 0 && view.bestStreak === 3 && view.daysCompleted === 3);
  check('terminal completion from frozen truth', view.completed === true);
  check('period denominator is inclusive period (5)', view.periodDays === 5);
  check('streak period day list is inclusive + ordered',
    streakPeriodDays('2026-06-01', '2026-06-05').join(',') === '2026-06-01,2026-06-02,2026-06-03,2026-06-04,2026-06-05'
    && inclusivePeriodDays('2026-06-01', '2026-06-01') === 1
    && inclusivePeriodDays('nope', '2026-06-05') === null);
}

// ─── G-1 Race frozen positions throughput ───────────────────────────────────
console.log('G-1 race frozen positions');
{
  const view = competitiveFinalResultFor(detail({
    challengeType: 'competitive', status: 'ended', finalized: true,
    finalizedAt: '2026-07-10T12:00:00.000Z',
    config: {
      version: 1, period: { startDate: '2026-06-01', endDate: '2026-06-30' },
      requiredConsecutiveDays: null,
      activities: [{ canonicalKey: 'push-up', activityVariant: null, activityKind: 'fitness', targetValue: 10, unit: 'reps', position: 0 }],
    },
    myParticipation: participation({
      progress: { cumulativeTotal: 10, completionStatus: 'completed', finalPosition: 1 },
      final: { completed: true, completedAt: '2026-06-02T10:00:00.000Z', daysCompleted: 0, bestStreak: 0, finalStreak: 0, finalPosition: 1, finalizedAt: '2026-07-10T12:00:00.000Z' },
    }),
  }));
  check('position is frozen passthrough (1)', view.position === 1 && view.finished === true);
  check('own total/target from reads', view.ownTotal === 10 && view.target === 10);

  const entries: V2LeaderboardEntry[] = [
    { memberId: 'a', participationId: 'p-a', totalPoints: 10, cumulativeTotal: 10, logsAccepted: 1, completionStatus: 'completed', completedAt: '2026-06-02T10:00:00Z', position: 1 },
    { memberId: 'b', participationId: 'p-b', totalPoints: 10, cumulativeTotal: 10, logsAccepted: 1, completionStatus: 'completed', completedAt: '2026-06-02T10:00:00Z', position: 1 },
    { memberId: 'c', participationId: 'p-c', totalPoints: 10, cumulativeTotal: 10, logsAccepted: 1, completionStatus: 'completed', completedAt: '2026-06-02T11:00:00Z', position: 3 },
    { memberId: 'd', participationId: 'p-d', totalPoints: 4, cumulativeTotal: 4, logsAccepted: 1, completionStatus: 'in_progress', completedAt: null, position: null },
  ];
  const split = raceStandingsFor(entries);
  check('standings split + N-of-M from entries (3 of 4)',
    split.finished.length === 3 && split.progressing.length === 1
    && split.finishedCount === 3 && split.participantCount === 4);
  check('server order preserved, ties stay 1,1,3',
    split.finished.map((e) => e.position).join(',') === '1,1,3');
  check('non-finisher keeps actual progress (4) and no position',
    split.progressing[0].position === null && split.progressing[0].cumulativeTotal === 4);
}

// ─── CORR-001 finalized-source fail-closed (no live substitution) ───────────
console.log('CORR-001 finalized-source fail-closed');
{
  // A finalized detail whose frozen result is absent must NEVER fall back to
  // the mutable live-derived values (the ITR-001 divergence attack).
  const noFrozen = detail({
    challengeType: 'collective', status: 'ended', finalized: true,
    finalizedAt: '2026-06-10T12:00:00.000Z', finalResult: null,
    goalValue: 100, goalUnit: 'reps', collectiveTotal: 999, collectiveGoalReached: true,
  });
  const collective = collectiveFinalResultFor(noFrozen);
  check('collective: missing frozen total does not substitute live 999',
    collective.total === null && collective.goalReached === null
    && collective.hasFinalTruth === false && collective.percent === null);

  const race = competitiveFinalResultFor(detail({
    challengeType: 'competitive', status: 'ended', finalized: true,
    finalizedAt: '2026-07-10T12:00:00.000Z', finalResult: null,
    config: {
      version: 1, period: { startDate: '2026-06-01', endDate: '2026-06-30' },
      requiredConsecutiveDays: null,
      activities: [{ canonicalKey: 'push-up', activityVariant: null, activityKind: 'fitness', targetValue: 10, unit: 'reps', position: 0 }],
    },
    myParticipation: participation({
      progress: { cumulativeTotal: 999, completionStatus: 'completed', finalPosition: 1 },
      final: null,
    }),
  }));
  check('race: missing frozen final does not present live completion/position as final',
    race.finished === null && race.position === null && race.hasFinalTruth === false);

  const streak = streakFinalResultFor(detail({
    challengeType: 'streak', status: 'ended', finalized: true,
    finalizedAt: '2026-06-10T12:00:00.000Z', finalResult: null,
    config: {
      version: 1, period: { startDate: '2026-06-01', endDate: '2026-06-05' },
      requiredConsecutiveDays: 3,
      activities: [{ canonicalKey: 'push-up', activityVariant: null, activityKind: 'fitness', targetValue: 20, unit: 'reps', position: 0 }],
    },
    myParticipation: participation({
      progress: { currentStreak: 3, bestStreak: 3, daysCompleted: 3, completionStatus: 'completed' },
      final: null,
    }),
  }));
  check('streak: missing frozen final does not substitute live streak/days',
    streak.daysCompleted === null && streak.bestStreak === null
    && streak.finalStreak === null && streak.hasFinalTruth === false);
}

// ─── G-3 finalized standings lifecycle (real QueryClient) ───────────────────
console.log('G-3 finalized standings lifecycle');
{
  check('S3d enablement: finalized competitive only',
    finalizedStandingsEnabledForS3d('competitive', true) === true
    && finalizedStandingsEnabledForS3d('competitive', false) === false
    && finalizedStandingsEnabledForS3d('collective', true) === false
    && finalizedStandingsEnabledForS3d('streak', true) === false);
  async function callsFor(challengeType: string, finalized: boolean): Promise<number> {
    let calls = 0;
    const client = new QueryClient();
    if (finalizedStandingsEnabledForS3d(challengeType, finalized)) {
      await client.fetchQuery({
        queryKey: v2ChallengeLeaderboardKey('challenge-1', 'uid-1'),
        queryFn: async () => { calls += 1; return { challengeId: 'challenge-1', challengeType, entries: [] }; },
        staleTime: 10 * 1000,
      });
    }
    return calls;
  }
  check('finalized competitive reads frozen standings once', (await callsFor('competitive', true)) === 1);
  check('unfinalized competitive does not run the S3d query', (await callsFor('competitive', false)) === 0);
  check('non-competitive never runs the S3d query', (await callsFor('collective', true)) === 0);
}

// ─── G-4 / G-5 static boundary + vocabulary ─────────────────────────────────
console.log('G-4/G-5 static boundaries');
const resultsViewSrc = read('src/v2/challenges/resultsView.ts');
const endStateSrc = read('src/v2/challenges/challengeEndState.ts');
const routerSrc = read('src/v2/challenges/V2ChallengeResults.tsx');
const pendingSrc = read('src/v2/challenges/V2ResultsPendingCard.tsx');
const collectiveSrc = read('src/v2/challenges/V2FinalizedCollectiveResult.tsx');
const competitiveSrc = read('src/v2/challenges/V2FinalizedCompetitiveResult.tsx');
const streakSrc = read('src/v2/challenges/V2FinalizedStreakResult.tsx');
const hookSrc = read('src/v2/challenges/useResults.ts');
const screenSrc = read('src/v2/challenges/V2CreatedChallengeScreen.tsx');
const s3dSources = [resultsViewSrc, endStateSrc, routerSrc, pendingSrc, collectiveSrc, competitiveSrc, streakSrc, hookSrc];

// Proof finalStreak comes from frozen truth, never the live currentStreak.
const resultsViewCode = stripComments(resultsViewSrc);
check('resultsView never reads the live currentStreak for the final result',
  !/currentStreak/.test(resultsViewCode) && /finalStreak: final \? final\.finalStreak/.test(resultsViewCode));
check('streak component renders the frozen finalStreak',
  streakSrc.includes('view.finalStreak'));
// Proof Race consumes PR #41 member-scoped frozen identity.
check('race result position is frozen passthrough (never computed)',
  /position: final \? final\.finalPosition :/.test(resultsViewCode)
  && !/computeFinishingPositions|FinishingPositions/.test(resultsViewCode));
check('no client ranking / no cross-episode aggregation in S3d results',
  s3dSources.every((src) => !/computeFinishingPositions|\.sort\(\(a, b\) => a\.position|memberFinishingPositions/.test(src)));
check('no manufactured truth in S3d files (no setQueryData)',
  s3dSources.every((src) => !/setQueryData/.test(stripComments(src))));
check('S3d standings read is refetch-only via the canonical hook',
  hookSrc.includes('getCompetitiveLeaderboardV2') && hookSrc.includes('v2ChallengeLeaderboardKey'));

// G-4: S3c boundary preserved — no S3d vocabulary in S3c-guarded files.
const s3cGuarded = [
  'src/v2/challenges/progressView.ts',
  'src/v2/challenges/V2CollectiveProgress.tsx',
  'src/v2/challenges/V2CompetitiveProgress.tsx',
  'src/v2/challenges/V2StreakProgress.tsx',
  'src/v2/challenges/V2ProgressSection.tsx',
  'src/v2/challenges/V2ChallengeHero.tsx',
  'src/v2/challenges/V2CreatedChallengeScreen.tsx',
];
const s3dVocab = /finalResult|finalPosition|winner|podium|recognition|award/i;
for (const path of s3cGuarded) {
  const src = read(path).replace(/contributorsCarryNoRanking[\s\S]*?\n\}/, '');
  check(`S3c file free of S3d vocabulary: ${path.split('/').pop()}`, !s3dVocab.test(src));
}
check('S3c live surface still unmounts once finalized (unchanged)',
  read('src/v2/challenges/V2CompetitiveProgress.tsx').includes('if (detail.finalized) return null'));
check('detail routes the progress slot via the S3d end-state',
  screenSrc.includes('endStateFor(challenge)')
  && screenSrc.includes('loggingAvailableForEndState(endState)')
  && screenSrc.includes('participationMutableForEndState(endState)')
  && screenSrc.includes('<V2ChallengeResults')
  && screenSrc.includes('<V2ProgressSection'));
check('neutral pending state uses the approved transitional copy',
  pendingSrc.includes('Challenge ended') && pendingSrc.includes('Final results are being confirmed'));
check('type-specific finalized routing present',
  routerSrc.includes('V2FinalizedCollectiveResult')
  && routerSrc.includes('V2FinalizedCompetitiveResult')
  && routerSrc.includes('V2FinalizedStreakResult')
  && routerSrc.includes("endState === 'ended-pending'")
  && routerSrc.includes('V2ResultsPendingCard'));

// G-5: no failure/winner/podium/recognition vocabulary in S3d user copy.
const s3dCopy = [
  collectiveSrc, competitiveSrc, streakSrc, pendingSrc, routerSrc,
].map(stripComments).join('\n');
check('no failure/winner/podium/recognition vocabulary in S3d copy',
  !/winner|podium|champion|gold medal|silver medal|bronze|recognition|badge|\baward|\bfailed\b|\bloser\b|unsuccessful|top contributor|\bMVP\b|run again/i.test(s3dCopy));
check('no backend terminology in S3d copy',
  !/terminal truth|frozen result|finalized collective state|sealed authority/i.test(s3dCopy));
check('no permanence promise in S3d copy',
  !/can never change|cannot be changed|never change/i.test(s3dCopy));
check('CORR-001 participant copy: no server-technical final-position wording',
  !/Challenge server/i.test(stripComments(competitiveSrc)));

// ─── G-5 V1 boundary is owned by test:v2-experience-boundary ─────────────────
console.log('boundary note');
check('no V1 imports in S3d sources',
  s3dSources.every((src) => !/from ['"][^'"]*features\/Challenges|from ['"][^'"]*utils\/competitiveFinishing|firestore/i.test(src)));

if (failures > 0) {
  console.error(`\nS3d results guards: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\nS3d results guards: PASS');
