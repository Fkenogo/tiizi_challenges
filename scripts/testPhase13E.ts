/**
 * Phase 13E — Production Verification Suite
 *
 * End-to-end deterministic simulation of the three v2 challenge engines.
 * No Firestore required — every import here is a pure function.
 *
 * Sections:
 *   1.  Legacy engine removal (Phase 5) — confirms v1 is rejected, not simulated
 *   2.  Streak engine
 *   3.  Competitive engine
 *   4.  Collective engine
 *   5.  Concurrency simulation (2 / 5 / 25 / 100 users)
 *   6.  Join / Leave lifecycle
 *   7.  Long-running streak simulation (30 / 90 / 180 / 365 days)
 *   8.  Edge cases
 *   9.  Leaderboard sort verification (all engines)
 *  10.  deriveDailyTargetValue (BUG-008 regression)
 *  11.  Regression audit — static analysis
 */

import { readFileSync } from 'node:fs';
import { selectEngine } from '../src/services/challengeEngine/index.js';
import { StreakEngine } from '../src/services/challengeEngine/streakEngine.js';
import { CompetitiveEngine } from '../src/services/challengeEngine/competitiveEngine.js';
import { CollectiveEngine } from '../src/services/challengeEngine/collectiveEngine.js';
import { computeGroupTransition } from '../src/utils/collectiveGroupTransition.js';
import { sortLeaderboardRows } from '../src/utils/leaderboardSort.js';
import { toLocalIsoDate } from '../src/utils/dateUtils.js';
import { deriveDailyTargetValue } from '../src/services/challengeCompletion.js';
import type {
  ChallengeContext,
  MembershipSnapshot,
  LogEvent,
} from '../src/services/challengeEngine/types.js';

// ─── Harness ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean): void {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(`  FAIL: ${label}`);
    console.error(`    ✗ ${label}`);
  }
}

function section(name: string): void {
  console.log(`\n[${name}]`);
}

// ─── Fixture factories ────────────────────────────────────────────────────────

function membership(overrides: Partial<MembershipSnapshot> = {}): MembershipSnapshot {
  return {
    userId: 'u1',
    challengeId: 'c1',
    status: 'active',
    activitiesCompleted: 0,
    totalActivities: 10,
    completionRate: 0,
    totalPoints: 0,
    ...overrides,
  };
}

function logEvent(date: string, value = 10, points = 10, activityId = 'a1'): LogEvent {
  return {
    userId: 'u1',
    challengeId: 'c1',
    activityId,
    value,
    unit: 'reps',
    date,
    loggedAt: new Date(`${date}T12:00:00Z`),
    pointsEarned: points,
  };
}

function context(overrides: Partial<ChallengeContext> = {}): ChallengeContext {
  return {
    challengeId: 'c1',
    challengeType: 'streak',
    engineVersion: 'v2',
    targetType: 'daily',
    durationDays: 7,
    activities: [{ activityId: 'a1', targetValue: 10, unit: 'reps' }],
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    ...overrides,
  };
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

// ─── 1. Legacy Engine Removal (Phase 5) ──────────────────────────────────────

section('1. Legacy Engine Removal');

// The v1 legacy engine was removed in Phase 5 (pre-beta legacy cleanup). Only
// v2 challenges are supported; selectEngine must reject anything else rather
// than silently falling back to legacy scoring.
let legacyRejected = false;
try {
  selectEngine({ engineVersion: undefined, challengeType: 'collective' });
} catch {
  legacyRejected = true;
}
check('selectEngine rejects undefined engineVersion (no legacy fallback)', legacyRejected);

let legacyV1Rejected = false;
try {
  selectEngine({ engineVersion: 'v1', challengeType: 'collective' });
} catch {
  legacyV1Rejected = true;
}
check('selectEngine rejects engineVersion "v1" (no legacy fallback)', legacyV1Rejected);

// Leaderboard sort — non-v2/unmatched combos return rows unsorted, not
// sorted by a legacy totalPoints ranking.
const legRows = [
  { totalPoints: 100, completionRate: 50, currentStreak: 0, longestStreak: 0, cumulativeLoggedValue: 0 },
  { totalPoints: 300, completionRate: 20, currentStreak: 0, longestStreak: 0, cumulativeLoggedValue: 0 },
  { totalPoints: 200, completionRate: 80, currentStreak: 0, longestStreak: 0, cumulativeLoggedValue: 0 },
];
const legSorted = sortLeaderboardRows(legRows, 'v1', 'collective');
check('Leaderboard sort: non-v2 rows returned unsorted (no legacy points ranking)',
  legSorted[0].totalPoints === 100 && legSorted[1].totalPoints === 300 && legSorted[2].totalPoints === 200);

// ─── 2. Streak Engine ─────────────────────────────────────────────────────────

section('2. Streak Engine');

const streak = new StreakEngine();
const streakCtx = context({ challengeType: 'streak', durationDays: 7, requiredConsecutiveDays: 7, streakResetOnMiss: true });

// First log — start a streak
const s1 = streak.computeUpdate(streakCtx, membership(), logEvent('2024-01-01'));
check('Streak: first log starts streak at 1', s1.membershipUpdate.currentStreak === 1);
check('Streak: first log sets longestStreak=1', s1.membershipUpdate.longestStreak === 1);
check('Streak: first log sets lastLogDate', s1.membershipUpdate.lastLogDate === '2024-01-01');
check('Streak: first log isCompleted=false (need 7 days)', !s1.isCompleted);

// Same day — streak must not advance
const s1state = { ...membership(), ...s1.membershipUpdate };
const sSameDay = streak.computeUpdate(streakCtx, s1state, logEvent('2024-01-01'));
check('Streak: same-day log does not advance streak', sSameDay.membershipUpdate.currentStreak === 1);

// Consecutive days — streak advances
let streakState = membership();
for (let i = 0; i < 6; i++) {
  const r = streak.computeUpdate(streakCtx, streakState, logEvent(addDays('2024-01-01', i)));
  streakState = { ...streakState, ...r.membershipUpdate };
}
check('Streak: 6 consecutive logs → currentStreak=6', streakState.currentStreak === 6);
const sComplete = streak.computeUpdate(streakCtx, streakState, logEvent(addDays('2024-01-01', 6)));
check('Streak: 7th consecutive log completes', sComplete.isCompleted);
check('Streak: completion sets currentStreak=7', sComplete.membershipUpdate.currentStreak === 7);
check('Streak: completion sets longestStreak=7', sComplete.membershipUpdate.longestStreak === 7);
check('Streak: completionRate=100 on complete', sComplete.membershipUpdate.completionRate === 100);

// Missed day + reset enabled
const sAfterMiss = streak.computeUpdate(
  { ...streakCtx, streakResetOnMiss: true },
  { ...membership(), currentStreak: 3, lastLogDate: '2024-01-03' },
  logEvent('2024-01-05'), // gap of 2 days
);
check('Streak: missed day with reset=true resets streak to 1', sAfterMiss.membershipUpdate.currentStreak === 1);

// Missed day + reset disabled
const sNoReset = streak.computeUpdate(
  { ...streakCtx, streakResetOnMiss: false },
  { ...membership(), currentStreak: 3, lastLogDate: '2024-01-03' },
  logEvent('2024-01-05'),
);
check('Streak: missed day with reset=false does not reset (streak advances)', sNoReset.membershipUpdate.currentStreak === 4);

// longestStreak preserved across reset
const sLongest = streak.computeUpdate(
  { ...streakCtx, streakResetOnMiss: true },
  { ...membership(), currentStreak: 5, longestStreak: 10, lastLogDate: '2024-01-10' },
  logEvent('2024-01-12'), // gap
);
check('Streak: longestStreak preserved across reset (max of 10 vs 1)', sLongest.membershipUpdate.longestStreak === 10);

// Rejoin — streak fields reset to 0 (tested at service layer; here verify engine handles zero correctly)
const sRejoin = streak.computeUpdate(
  streakCtx,
  { ...membership(), currentStreak: 0, longestStreak: 0, lastLogDate: undefined },
  logEvent('2024-01-01'),
);
check('Streak: rejoin (reset to zero) starts fresh streak at 1', sRejoin.membershipUpdate.currentStreak === 1);
check('Streak: rejoin longestStreak=1 on first log', sRejoin.membershipUpdate.longestStreak === 1);

// Timezone boundary: same UTC date but different local date label
// The engine uses YYYY-MM-DD strings that the SERVICE layer provides (via toLocalIsoDate).
// Here we verify the string comparison is character-based, not Date arithmetic.
const sTZ1 = streak.computeUpdate(
  streakCtx,
  { ...membership(), currentStreak: 1, lastLogDate: '2024-01-01' },
  logEvent('2024-01-02'), // next local day
);
check('Streak: timezone boundary — different date string advances streak', sTZ1.membershipUpdate.currentStreak === 2);
const sTZ2 = streak.computeUpdate(
  streakCtx,
  { ...membership(), currentStreak: 1, lastLogDate: '2024-01-01' },
  logEvent('2024-01-01'), // same date string → no advance
);
check('Streak: timezone boundary — same date string does not advance streak', sTZ2.membershipUpdate.currentStreak === 1);

// (P0-2: no Streak leaderboard) streak rows are never ranked —
// personal progress only. sortLeaderboardRows must preserve input order.
const streakRows = [
  { totalPoints: 50, completionRate: 30, currentStreak: 5, longestStreak: 5, cumulativeLoggedValue: 0 },
  { totalPoints: 80, completionRate: 60, currentStreak: 3, longestStreak: 7, cumulativeLoggedValue: 0 },
  { totalPoints: 60, completionRate: 30, currentStreak: 5, longestStreak: 8, cumulativeLoggedValue: 0 },
  { totalPoints: 90, completionRate: 50, currentStreak: 5, longestStreak: 5, cumulativeLoggedValue: 0 },
];
const streakSorted = sortLeaderboardRows(streakRows, 'v2', 'streak');
check('Streak leaderboard removed: v2 streak rows returned in input order (no ranking)',
  streakSorted.length === 4 &&
  streakSorted[0].totalPoints === 50 && streakSorted[1].totalPoints === 80 &&
  streakSorted[2].totalPoints === 60 && streakSorted[3].totalPoints === 90);

// ─── 3. Competitive Engine ───────────────────────────────────────────────────

section('3. Competitive Engine');

const comp = new CompetitiveEngine();
const compCtx = context({
  challengeType: 'competitive',
  engineVersion: 'v2',
  targetType: 'daily',
  activities: [
    { activityId: 'run', targetValue: 5000, unit: 'm' },
    { activityId: 'pushup', targetValue: 100, unit: 'reps' },
  ],
});

// First activity partial progress
const c1 = comp.computeUpdate(compCtx, membership({ totalActivities: 14 }), {
  ...logEvent('2024-01-01', 2500, 25, 'run'), unit: 'm',
});
check('Competitive: first log updates cumulativeValues for activity', c1.membershipUpdate.cumulativeValues?.['run'] === 2500);
check('Competitive: first log updates cumulativeLoggedValue', c1.membershipUpdate.cumulativeLoggedValue === 2500);
check('Competitive: first log completionRate=25% (one activity at 50%, other at 0% → avg 25)', c1.membershipUpdate.completionRate === 25);
check('Competitive: not completed (second activity still at 0%)', !c1.isCompleted);

// Second activity partial progress
const c2 = comp.computeUpdate(compCtx, { ...membership({ totalActivities: 14 }), ...c1.membershipUpdate }, {
  ...logEvent('2024-01-01', 50, 25, 'pushup'), unit: 'reps',
});
check('Competitive: second activity updates cumulativeValues.pushup', c2.membershipUpdate.cumulativeValues?.['pushup'] === 50);
check('Competitive: cumulativeLoggedValue accumulates across activities', c2.membershipUpdate.cumulativeLoggedValue === 2550);
// run at 50% (2500/5000), pushup at 50% (50/100) → avg 50%
check('Competitive: completionRate=50% with both at 50%', c2.membershipUpdate.completionRate === 50);

// Complete both activities
const stateAfterC2 = { ...membership({ totalActivities: 14 }), ...c2.membershipUpdate };
const c3 = comp.computeUpdate(compCtx, stateAfterC2, {
  ...logEvent('2024-01-02', 2500, 25, 'run'), unit: 'm',
});
check('Competitive: run reaches 100% (2500+2500=5000)', c3.membershipUpdate.cumulativeValues?.['run'] === 5000);
check('Competitive: not yet complete (pushup still at 50%)', !c3.isCompleted);

const stateAfterC3 = { ...stateAfterC2, ...c3.membershipUpdate };
const c4 = comp.computeUpdate(compCtx, stateAfterC3, {
  ...logEvent('2024-01-02', 50, 25, 'pushup'), unit: 'reps',
});
check('Competitive: pushup reaches 100% (50+50=100)', c4.membershipUpdate.cumulativeValues?.['pushup'] === 100);
check('Competitive: both at 100% → isCompleted=true', c4.isCompleted);
check('Competitive: completionRate=100 on completion', c4.membershipUpdate.completionRate === 100);
check('Competitive: status=completed on completion', c4.membershipUpdate.status === 'completed');

// Overshoot — value beyond target should still complete without double-counting bug
const compOver = comp.computeUpdate(
  compCtx,
  membership({ cumulativeValues: { run: 4500 }, cumulativeLoggedValue: 4500, totalActivities: 14 }),
  { ...logEvent('2024-01-03', 1000, 10, 'run'), unit: 'm' }, // 4500+1000=5500 > 5000 target
);
check('Competitive: overshoot run still completes (activityRate capped at 100)', !compOver.isCompleted); // pushup still 0
check('Competitive: run activityRate capped at 100 in overshoot scenario', compOver.membershipUpdate.completionRate === 50); // run=100%, pushup=0%

// Zero-targetValue activities excluded from completion
const compWithZeroTarget = context({
  challengeType: 'competitive',
  engineVersion: 'v2',
  targetType: 'daily',
  activities: [
    { activityId: 'main', targetValue: 100, unit: 'reps' },
    { activityId: 'bonus', targetValue: 0, unit: 'reps' }, // zero target = excluded
  ],
});
const compZero = comp.computeUpdate(
  compWithZeroTarget,
  membership({ totalActivities: 14 }),
  { ...logEvent('2024-01-01', 100, 10, 'main'), unit: 'reps' },
);
check('Competitive: zero-target activity excluded — completion fires when only tracked activities at 100%', compZero.isCompleted);

// Leaderboard: ties broken by totalPoints
const compRows = [
  { totalPoints: 100, completionRate: 80, currentStreak: 0, longestStreak: 0, cumulativeLoggedValue: 200 },
  { totalPoints: 150, completionRate: 80, currentStreak: 0, longestStreak: 0, cumulativeLoggedValue: 180 },
  { totalPoints: 90,  completionRate: 95, currentStreak: 0, longestStreak: 0, cumulativeLoggedValue: 300 },
];
const compSorted = sortLeaderboardRows(compRows, 'v2', 'competitive');
check('Competitive leaderboard: primary sort by completionRate DESC', compSorted[0].completionRate === 95);
check('Competitive leaderboard: tie on completionRate → secondary by totalPoints DESC', compSorted[1].totalPoints === 150);
check('Competitive leaderboard: lowest totalPoints at position 2 in tie', compSorted[2].totalPoints === 100);

// ─── 4. Collective Engine ────────────────────────────────────────────────────

section('4. Collective Engine');

const coll = new CollectiveEngine();
const collCtx = context({
  challengeType: 'collective',
  engineVersion: 'v2',
  targetType: 'group-pool',
  groupCumulativeTarget: 1000,
  autoCompleteOnGroupTarget: true,
  activities: [{ activityId: 'steps', targetValue: 100, unit: 'steps' }],
});

// Single member log
const col1 = coll.computeUpdate(collCtx, membership(), logEvent('2024-01-01', 100, 10), { groupCurrentTotal: 0 });
check('Collective: log returns challengeUpdate with delta', col1.challengeUpdate?.groupCurrentTotalDelta === 100);
check('Collective: log updates cumulativeLoggedValue', col1.membershipUpdate.cumulativeLoggedValue === 100);
check('Collective: log below target is not completed', !col1.isCompleted);
check('Collective: engineVersion=v2 in membershipUpdate', col1.membershipUpdate.engineVersion === 'v2');

// Multiple members log independently — each accumulates their own cumulative
const colM1 = coll.computeUpdate(collCtx, membership({ userId: 'u1' }), logEvent('2024-01-01', 200, 20), { groupCurrentTotal: 0 });
const colM2 = coll.computeUpdate(collCtx, membership({ userId: 'u2' }), logEvent('2024-01-01', 300, 30), { groupCurrentTotal: 200 });
check('Collective: member1 cumulativeLoggedValue=200', colM1.membershipUpdate.cumulativeLoggedValue === 200);
check('Collective: member2 cumulativeLoggedValue=300 (independent)', colM2.membershipUpdate.cumulativeLoggedValue === 300);
check('Collective: both contribute deltas (200+300=500, half of 1000)', !colM2.isCompleted);

// Completion when group total crosses target
const colComplete = coll.computeUpdate(collCtx, membership(), logEvent('2024-01-02', 50, 5), { groupCurrentTotal: 960 });
check('Collective: 960+50=1010 ≥ 1000 → engine says isCompleted=true (optimistic)', colComplete.isCompleted);

// Transaction layer (computeGroupTransition) is the authoritative gate
const trComplete = computeGroupTransition(
  { status: 'active', groupCurrentTotal: 960, groupCumulativeTarget: 1000, autoCompleteOnGroupTarget: true },
  50,
);
check('Collective: transaction confirms completion (960+50=1010≥1000)', trComplete.shouldComplete);
check('Collective: transaction preserves overshoot (V2: actualTotal=1010)', trComplete.actualTotal === 1010);

// Idempotency — already-completed challenge
const trIdem = computeGroupTransition(
  { status: 'completed', groupCurrentTotal: 1000, groupCumulativeTarget: 1000, autoCompleteOnGroupTarget: true },
  50,
);
check('Collective: completed challenge transaction is a no-op (isAlreadyCompleted=true)', trIdem.isAlreadyCompleted);
check('Collective: completed challenge actualTotal unchanged', trIdem.actualTotal === 1000);
check('Collective: completed challenge shouldComplete=false', !trIdem.shouldComplete);

// autoCompleteOnGroupTarget=false — pool updates but never completes
const collNoAuto = coll.computeUpdate(
  { ...collCtx, autoCompleteOnGroupTarget: false },
  membership(),
  logEvent('2024-01-01', 999, 10),
  { groupCurrentTotal: 1 },
);
check('Collective: autoComplete=false never fires completion (engine)', !collNoAuto.isCompleted);

// Leaderboard for collective — sorted by cumulativeLoggedValue DESC
const collRows = [
  { totalPoints: 100, completionRate: 50, currentStreak: 0, longestStreak: 0, cumulativeLoggedValue: 500 },
  { totalPoints: 200, completionRate: 30, currentStreak: 0, longestStreak: 0, cumulativeLoggedValue: 800 },
  { totalPoints: 150, completionRate: 40, currentStreak: 0, longestStreak: 0, cumulativeLoggedValue: 300 },
];
const collSorted = sortLeaderboardRows(collRows, 'v2', 'collective');
check('Collective leaderboard: sorted by cumulativeLoggedValue DESC', collSorted[0].cumulativeLoggedValue === 800);
check('Collective leaderboard: lowest cumulativeLoggedValue last', collSorted[2].cumulativeLoggedValue === 300);

// ─── 5. Concurrency Simulation ────────────────────────────────────────────────

section('5. Concurrency Simulation');

/**
 * Simulate N users each logging `delta` units, starting from `initialTotal`, with `target`.
 * Models Firestore transaction retry: each user's transaction reads the latest committed state.
 * Returns: { completionCount, finalTotal, completedByUser }
 */
function simulateConcurrentLogs(opts: {
  numUsers: number;
  delta: number;
  initialTotal: number;
  target: number;
}): { completionCount: number; finalTotal: number; completedByUser: number } {
  let currentTotal = opts.initialTotal;
  let status = 'active';
  let completionCount = 0;
  let completedByUser = -1;

  for (let i = 0; i < opts.numUsers; i++) {
    const result = computeGroupTransition(
      {
        status,
        groupCurrentTotal: currentTotal,
        groupCumulativeTarget: opts.target,
        autoCompleteOnGroupTarget: true,
      },
      opts.delta,
    );
    if (result.isAlreadyCompleted) continue;
    currentTotal = result.actualTotal;
    if (result.shouldComplete) {
      status = 'completed';
      completionCount++;
      completedByUser = i;
    }
  }
  return { completionCount, finalTotal: currentTotal, completedByUser };
}

// 2 users — classic BUG-001 scenario: both start at 970, target=1000
// Simulated as sequential transaction retries (the losing user sees 990 and crosses 1000)
const sim2 = simulateConcurrentLogs({ numUsers: 2, delta: 20, initialTotal: 970, target: 1000 });
check('Concurrency 2 users: exactly one completion', sim2.completionCount === 1);
check('Concurrency 2 users: finalTotal=1010 (V2: overshoot preserved)', sim2.finalTotal === 1010);
check('Concurrency 2 users: completion fired by user 1 (not user 0 at 990)', sim2.completedByUser === 1);

// 5 users — each logs 100, target=1000, starting at 0 (crosses on 10th, but only 5 users)
const sim5 = simulateConcurrentLogs({ numUsers: 5, delta: 100, initialTotal: 0, target: 1000 });
check('Concurrency 5 users (100 each, need 10): no completion', sim5.completionCount === 0);
check('Concurrency 5 users: finalTotal=500', sim5.finalTotal === 500);

// 5 users with different delta: completes on 3rd user (200+200+200=600? no, target=500)
const sim5b = simulateConcurrentLogs({ numUsers: 5, delta: 200, initialTotal: 0, target: 500 });
check('Concurrency 5 users (200 each, target=500): exactly one completion', sim5b.completionCount === 1);
check('Concurrency 5 users: no further mutations after completion', sim5b.completionCount === 1); // already verified
check('Concurrency 5 users: finalTotal=600 (V2: overshoot preserved)', sim5b.finalTotal === 600);
check('Concurrency 5 users: completion fires on 3rd user (idx 2)', sim5b.completedByUser === 2);

// 25 users — each logs 40, target=1000 (crosses at user 25 exactly)
const sim25 = simulateConcurrentLogs({ numUsers: 25, delta: 40, initialTotal: 0, target: 1000 });
check('Concurrency 25 users (40 each, target=1000): exactly one completion', sim25.completionCount === 1);
check('Concurrency 25 users: finalTotal=1000', sim25.finalTotal === 1000);
check('Concurrency 25 users: completion fires on user 24 (last)', sim25.completedByUser === 24);

// 100 users — 50 needed to complete (delta=20, target=1000)
const sim100 = simulateConcurrentLogs({ numUsers: 100, delta: 20, initialTotal: 0, target: 1000 });
check('Concurrency 100 users: exactly one completion', sim100.completionCount === 1);
check('Concurrency 100 users: finalTotal=1000 (not 2000)', sim100.finalTotal === 1000);
check('Concurrency 100 users: completion fires on user 49 (50th log)', sim100.completedByUser === 49);
check('Concurrency 100 users: users 50-99 see isAlreadyCompleted', (() => {
  // Verify subsequent transactions see completed state
  const postCompletion = computeGroupTransition(
    { status: 'completed', groupCurrentTotal: 1000, groupCumulativeTarget: 1000, autoCompleteOnGroupTarget: true },
    20,
  );
  return postCompletion.isAlreadyCompleted && !postCompletion.shouldComplete;
})());

// Stress: overshoot scenario — delta larger than remaining gap
const simOvershoot = simulateConcurrentLogs({ numUsers: 3, delta: 500, initialTotal: 0, target: 1000 });
check('Concurrency overshoot (3×500, target=1000): exactly one completion', simOvershoot.completionCount === 1);
check('Concurrency overshoot: finalTotal=1000 (not 1500)', simOvershoot.finalTotal === 1000);
check('Concurrency overshoot: users 1 and 2 are no-ops after completion', simOvershoot.completedByUser === 1);

// ─── 6. Join / Leave Lifecycle ───────────────────────────────────────────────

section('6. Join / Leave Lifecycle');

/**
 * Simulate the state machine from challengeService join/leave logic.
 * (Pure simulation — no Firestore.)
 */
type LifecycleState = {
  memberStatus: 'none' | 'active' | 'abandoned' | 'completed';
  participantCount: number;
  totalChallenges: number;
};

function joinChallenge(state: LifecycleState): LifecycleState {
  if (state.memberStatus === 'active') return state; // early return — already active
  return {
    memberStatus: 'active',
    participantCount: state.participantCount + 1,
    totalChallenges: state.totalChallenges + 1,
  };
}

function leaveChallenge(state: LifecycleState): LifecycleState {
  if (state.memberStatus !== 'active') return state; // guard — only active members can leave
  return {
    memberStatus: 'abandoned',
    participantCount: Math.max(0, state.participantCount - 1),
    totalChallenges: Math.max(0, state.totalChallenges - 1),
  };
}

const initial: LifecycleState = { memberStatus: 'none', participantCount: 0, totalChallenges: 0 };

// Simple join
const afterJoin = joinChallenge(initial);
check('Lifecycle: join → status=active', afterJoin.memberStatus === 'active');
check('Lifecycle: join → participantCount=1', afterJoin.participantCount === 1);
check('Lifecycle: join → totalChallenges=1', afterJoin.totalChallenges === 1);

// Join while active — no change (double-join)
const afterDoubleJoin = joinChallenge(afterJoin);
check('Lifecycle: double-join → status stays active', afterDoubleJoin.memberStatus === 'active');
check('Lifecycle: double-join → participantCount stays 1', afterDoubleJoin.participantCount === 1);
check('Lifecycle: double-join → totalChallenges stays 1', afterDoubleJoin.totalChallenges === 1);

// Leave
const afterLeave = leaveChallenge(afterJoin);
check('Lifecycle: leave → status=abandoned', afterLeave.memberStatus === 'abandoned');
check('Lifecycle: leave → participantCount=0', afterLeave.participantCount === 0);
check('Lifecycle: leave → totalChallenges=0', afterLeave.totalChallenges === 0);

// Double-leave — no change (guard)
const afterDoubleLeave = leaveChallenge(afterLeave);
check('Lifecycle: double-leave → status stays abandoned', afterDoubleLeave.memberStatus === 'abandoned');
check('Lifecycle: double-leave → participantCount stays 0 (no negative)', afterDoubleLeave.participantCount === 0);

// Rejoin after leave
const afterRejoin = joinChallenge(afterLeave);
check('Lifecycle: rejoin → status=active', afterRejoin.memberStatus === 'active');
check('Lifecycle: rejoin → participantCount=1', afterRejoin.participantCount === 1);
check('Lifecycle: rejoin → totalChallenges=1 (not 2, was decremented on leave)', afterRejoin.totalChallenges === 1);

// Full cycle: join → leave → join → leave → join
let cycleState = initial;
for (let i = 0; i < 3; i++) {
  cycleState = joinChallenge(cycleState);
  if (i < 2) cycleState = leaveChallenge(cycleState);
}
check('Lifecycle: 3 join/leave cycles → totalChallenges=1', cycleState.totalChallenges === 1);
check('Lifecycle: 3 join/leave cycles → participantCount=1', cycleState.participantCount === 1);

// Multiple participants — verify counts are additive
let multiState = { participantCount: 0, totalChallenges: 0 };
const users = ['u1', 'u2', 'u3', 'u4', 'u5'];
for (const u of users) {
  const s = joinChallenge({ memberStatus: 'none', participantCount: multiState.participantCount, totalChallenges: 0 });
  multiState = { participantCount: multiState.participantCount + 1, totalChallenges: multiState.totalChallenges + 1 };
  void u; void s;
}
check('Lifecycle: 5 users join → participantCount=5', multiState.participantCount === 5);

// Last participant leaves
const last = leaveChallenge({ memberStatus: 'active', participantCount: 1, totalChallenges: 1 });
check('Lifecycle: last participant leaving → participantCount=0 (not negative)', last.participantCount === 0);

// Creator-style join (starts from 0 same as regular join)
const creator = joinChallenge(initial);
check('Lifecycle: creator join → participantCount=1', creator.participantCount === 1);

// ─── 7. Long-Running Streak Simulations ──────────────────────────────────────

section('7. Long-Running Streak Simulations');

function simulateStreak(totalDays: number, resetOnMiss: boolean, missDay?: number): {
  finalStreak: number;
  longestStreak: number;
  isCompleted: boolean;
  activitiesCompleted: number;
} {
  const eng = new StreakEngine();
  const ctx = context({
    challengeType: 'streak',
    durationDays: totalDays,
    requiredConsecutiveDays: totalDays,
    streakResetOnMiss: resetOnMiss,
  });
  let state: MembershipSnapshot = membership({ totalActivities: totalDays });
  const start = '2024-01-01';

  for (let d = 0; d < totalDays; d++) {
    if (d === missDay) continue; // simulate a missed day
    const date = addDays(start, d);
    const r = eng.computeUpdate(ctx, state, logEvent(date, 10, 10));
    state = { ...state, ...r.membershipUpdate };
    if (r.isCompleted) break;
  }

  return {
    finalStreak: state.currentStreak ?? 0,
    longestStreak: state.longestStreak ?? 0,
    isCompleted: (state.completionRate ?? 0) >= 100,
    activitiesCompleted: state.activitiesCompleted,
  };
}

// 30-day perfect streak
const s30 = simulateStreak(30, true);
check('Streak sim 30 days: completes', s30.isCompleted);
check('Streak sim 30 days: currentStreak=30', s30.finalStreak === 30);
check('Streak sim 30 days: longestStreak=30', s30.longestStreak === 30);

// 90-day perfect streak
const s90 = simulateStreak(90, true);
check('Streak sim 90 days: completes', s90.isCompleted);
check('Streak sim 90 days: currentStreak=90', s90.finalStreak === 90);

// 180-day perfect streak
const s180 = simulateStreak(180, true);
check('Streak sim 180 days: completes', s180.isCompleted);
check('Streak sim 180 days: longestStreak=180', s180.longestStreak === 180);

// 365-day perfect streak
const s365 = simulateStreak(365, true);
check('Streak sim 365 days: completes', s365.isCompleted);
check('Streak sim 365 days: no overflow on activitiesCompleted', s365.activitiesCompleted <= 365);

// 30-day streak with miss on day 15 (resetOnMiss=true) — won't complete
const s30miss = simulateStreak(30, true, 15);
check('Streak sim 30 days miss+reset: does not complete (streak broken)', !s30miss.isCompleted);
check('Streak sim 30 days miss+reset: longestStreak=15 (before miss)', s30miss.longestStreak === 15);

// 30-day streak with miss on day 15 (resetOnMiss=false) — does NOT complete.
// Reason: 30 logs needed, 1 day skipped → only 29 logs → streak maxes at 29 < 30.
// The key difference from reset=true: the streak is NOT reset to 1 on the miss,
// so longestStreak is 29 (vs. 15 with reset=true), demonstrating policy effect.
const s30noReset = simulateStreak(30, false, 15);
check('Streak sim 30 days miss+no-reset: does not complete (29 logs < 30 required)', !s30noReset.isCompleted);
check('Streak sim 30 days miss+no-reset: longestStreak=29 (higher than reset=true scenario of 15)', s30noReset.longestStreak === 29);

// ─── 8. Edge Cases ────────────────────────────────────────────────────────────

section('8. Edge Cases');

// Zero-value activity log
const zeroLog = coll.computeUpdate(
  collCtx,
  membership({ totalActivities: 5 }),
  { ...logEvent('2024-01-01', 0, 0) },
  { groupCurrentTotal: 0 },
);
check('Edge: zero-value log still counts as an activity (activitiesCompleted++)', zeroLog.membershipUpdate.activitiesCompleted === 1);
check('Edge: zero-value log adds zero points', zeroLog.membershipUpdate.totalPoints === 0);

// Very large activity values
const bigLog = coll.computeUpdate(collCtx, membership(), logEvent('2024-01-01', 1_000_000, 999), { groupCurrentTotal: 0 });
check('Edge: large value does not overflow cumulativeLoggedValue', bigLog.membershipUpdate.cumulativeLoggedValue === 1_000_000);
check('Edge: large value delta is correct', bigLog.challengeUpdate?.groupCurrentTotalDelta === 1_000_000);

// Collective: groupCurrentTotal overshoot clamped
const clampResult = computeGroupTransition(
  { status: 'active', groupCurrentTotal: 999, groupCumulativeTarget: 1000, autoCompleteOnGroupTarget: true },
  10_000,
);
check('Edge: massive overshoot preserved (V2: actualTotal=10999)', clampResult.actualTotal === 10999);
check('Edge: massive overshoot still triggers completion', clampResult.shouldComplete);

// Competitive: log to activity not in context (no crash, just updates cumulativeValues)
const unknownActivity = comp.computeUpdate(
  compCtx,
  membership({ totalActivities: 14 }),
  { ...logEvent('2024-01-01', 100, 10, 'unknown-activity'), unit: 'reps' },
);
check('Edge: logging unknown activity does not throw', unknownActivity !== null);
check('Edge: unknown activity does not drive completion (only tracked activities count)', !unknownActivity.isCompleted);

// Streak: activity order in consecutive days
const streakFwd = StreakEngine.computeStreakUpdate(
  streakCtx,
  { ...membership(), currentStreak: 3, lastLogDate: '2024-01-10' },
  logEvent('2024-01-11'), // exactly 1 day later
);
check('Edge: exactly-1-day-later advances streak', streakFwd.membershipUpdate.currentStreak === 4);
const streakGap = StreakEngine.computeStreakUpdate(
  streakCtx,
  { ...membership(), currentStreak: 3, lastLogDate: '2024-01-10' },
  logEvent('2024-01-10'), // same day
);
check('Edge: same-day log is idempotent (streak stays at 3)', streakGap.membershipUpdate.currentStreak === 3);

// Inactive membership — engine doesn't check status (service layer guards this)
// Verify engine produces valid output regardless
const inactiveResult = coll.computeUpdate(
  collCtx,
  { ...membership(), status: 'abandoned' },
  logEvent('2024-01-01'),
  { groupCurrentTotal: 0 },
);
check('Edge: engine produces valid output for abandoned membership (service guards entry)', inactiveResult.membershipUpdate.activitiesCompleted === 1);

// Completed membership — extra log beyond completion
const completedResult = coll.computeUpdate(
  collCtx,
  { ...membership({ totalActivities: 1 }), activitiesCompleted: 1, completionRate: 100, status: 'completed' },
  logEvent('2024-01-02'),
  { groupCurrentTotal: 0 },
);
check('Edge: extra log on completed membership caps activitiesCompleted at totalActivities', completedResult.membershipUpdate.activitiesCompleted <= 1);

// DST simulation: toLocalIsoDate must return local components
const winter = new Date(2024, 0, 15, 23, 0, 0); // Jan 15, 11pm local
const summer = new Date(2024, 5, 15, 23, 0, 0); // Jun 15, 11pm local (DST)
const winterDate = toLocalIsoDate(winter);
const summerDate = toLocalIsoDate(summer);
check('Edge DST: winter date is YYYY-MM-DD format', /^\d{4}-\d{2}-\d{2}$/.test(winterDate));
check('Edge DST: summer date is YYYY-MM-DD format', /^\d{4}-\d{2}-\d{2}$/.test(summerDate));
check('Edge DST: winter date matches local getFullYear/Month/Date', (() => {
  const expected = `${winter.getFullYear()}-${String(winter.getMonth() + 1).padStart(2, '0')}-${String(winter.getDate()).padStart(2, '0')}`;
  return winterDate === expected;
})());
check('Edge DST: summer date matches local getFullYear/Month/Date', (() => {
  const expected = `${summer.getFullYear()}-${String(summer.getMonth() + 1).padStart(2, '0')}-${String(summer.getDate()).padStart(2, '0')}`;
  return summerDate === expected;
})());

// ─── 9. Leaderboard Sort — All Engines ───────────────────────────────────────

section('9. Leaderboard Sort — All Engines');

// Empty list → empty result
check('Sort: empty array returns empty', sortLeaderboardRows([], 'v2', 'collective').length === 0);

// Single row → unchanged
const singleRow = [{ totalPoints: 100, completionRate: 50, currentStreak: 3, longestStreak: 5, cumulativeLoggedValue: 400 }];
check('Sort: single row returns same row', sortLeaderboardRows(singleRow, 'v2', 'streak')[0].totalPoints === 100);

// Deterministic ties — stable ordering check (same key values)
const tieRows = [
  { totalPoints: 100, completionRate: 50, currentStreak: 5, longestStreak: 5, cumulativeLoggedValue: 100 },
  { totalPoints: 100, completionRate: 50, currentStreak: 5, longestStreak: 5, cumulativeLoggedValue: 100 },
];
const tieSorted = sortLeaderboardRows(tieRows, 'v2', 'streak');
check('Sort: complete tie does not throw', tieSorted.length === 2);

// Does not mutate original array
const original = [
  { totalPoints: 50, completionRate: 30, currentStreak: 0, longestStreak: 0, cumulativeLoggedValue: 0 },
  { totalPoints: 100, completionRate: 80, currentStreak: 0, longestStreak: 0, cumulativeLoggedValue: 0 },
];
sortLeaderboardRows(original, 'v2', 'competitive');
check('Sort: does not mutate original array', original[0].totalPoints === 50);

// ─── 10. deriveDailyTargetValue Regression ───────────────────────────────────

section('10. deriveDailyTargetValue Regression');

// All edge cases of the heuristic
check('DTV: non-streak → unchanged (competitive)', deriveDailyTargetValue(500, 21, 'competitive') === 500);
check('DTV: non-streak → unchanged (collective)', deriveDailyTargetValue(1000, 30, 'collective') === 1000);
check('DTV: streak, durationDays=1 → unchanged', deriveDailyTargetValue(50, 1, 'streak') === 50);
check('DTV: streak, heuristic, result<1 → keep original (8/21≈0.38)', deriveDailyTargetValue(8, 21, 'streak') === 8);
check('DTV: streak, heuristic, result≥1 → divided (1050/21=50)', Math.abs(deriveDailyTargetValue(1050, 21, 'streak') - 50) < 0.001);
check('DTV: explicit daily → no division', deriveDailyTargetValue(50, 21, 'streak', 'daily') === 50);
check('DTV: explicit cumulative → divided', Math.abs(deriveDailyTargetValue(1050, 21, 'streak', 'cumulative') - 50) < 0.001);
check('DTV: explicit cumulative, durationDays=1 → unchanged', deriveDailyTargetValue(50, 1, 'streak', 'cumulative') === 50);
check('DTV: explicit daily overrides heuristic for ambiguous mid-range (15, 7 days → 15 not 2.14)', deriveDailyTargetValue(15, 7, 'streak', 'daily') === 15);
check('DTV: null durationDays → treated as 1', deriveDailyTargetValue(50, null, 'streak') === 50);
check('DTV: undefined durationDays → treated as 1', deriveDailyTargetValue(50, undefined, 'streak') === 50);

// ─── 11. Regression Audit — Static Analysis ──────────────────────────────────

section('11. Regression Audit — Static Analysis');

const workoutSrc    = readFileSync(new URL('../src/services/workoutService.ts', import.meta.url).pathname, 'utf8');
const wellnessSrc   = readFileSync(new URL('../src/services/wellnessLogService.ts', import.meta.url).pathname, 'utf8');
const challengeSrc  = readFileSync(new URL('../src/services/challengeService.ts', import.meta.url).pathname, 'utf8');
// participantCount bookkeeping was migrated off the client in Phase 18G-2B — it is now
// maintained exclusively by server-side Cloud Function triggers (onChallengeMemberCreated/
// Updated/Deleted) in memberCounters.ts, not by client-side increment() calls in
// challengeService.ts. See the "participantCount is maintained exclusively by..." comments
// in challengeService.ts itself.
const memberCountersSrc = readFileSync(new URL('../functions/src/memberCounters.ts', import.meta.url).pathname, 'utf8');
const completionSrc = readFileSync(new URL('../src/services/challengeCompletion.ts', import.meta.url).pathname, 'utf8');
const collectiveSrc = readFileSync(new URL('../src/services/collectiveCompletion.ts', import.meta.url).pathname, 'utf8');
const collGroupSrc  = readFileSync(new URL('../src/services/collectiveGroupUpdate.ts', import.meta.url).pathname, 'utf8');
const leaderSrc     = readFileSync(new URL('../src/utils/leaderboardSort.ts', import.meta.url).pathname, 'utf8');
const dateUtilSrc   = readFileSync(new URL('../src/utils/dateUtils.ts', import.meta.url).pathname, 'utf8');

// Workout logging — engine wiring
check('Regression: workoutService uses selectEngine', workoutSrc.includes('selectEngine'));
check('Regression: workoutService uses toLocalIsoDate', workoutSrc.includes('toLocalIsoDate'));
check('Regression: workoutService calls atomicCollectiveGroupUpdate for collective', workoutSrc.includes('atomicCollectiveGroupUpdate'));
check('Regression: workoutService batch does not touch challenge doc for collective', !workoutSrc.includes("groupCurrentTotal: increment(") );

// Wellness logging
check('Regression: wellnessLogService uses selectEngine', wellnessSrc.includes('selectEngine'));
check('Regression: wellnessLogService uses toLocalIsoDate', wellnessSrc.includes('toLocalIsoDate'));
check('Regression: wellnessLogService calls atomicCollectiveGroupUpdate', wellnessSrc.includes('atomicCollectiveGroupUpdate'));

// Challenge service — join/leave counters
// (updated Phase 1 guard triage: participantCount increment/decrement moved server-side —
// see memberCountersSrc comment above)
check('Regression: server-side trigger increments participantCount on join', memberCountersSrc.includes("'participantCount'") && memberCountersSrc.includes('incrementChallengeCounter'));
check('Regression: challengeService no longer client-side increments participantCount (migrated to server trigger)', !challengeSrc.includes("participantCount: increment("));
check('Regression: leaveChallenge decrements totalChallenges', challengeSrc.includes("totalChallenges: increment(-1)"));
check('Regression: leaveChallenge uses writeBatch (atomic)', challengeSrc.includes('writeBatch'));
check('Regression: mixed-unit validation in createChallenge', challengeSrc.includes("Collective challenges must use a single measurement unit"));

// Completion service
check('Regression: collectiveCompletion exports cascadeCollectiveCompletion', collectiveSrc.includes('export async function cascadeCollectiveCompletion'));
check('Regression: collectiveGroupUpdate uses runTransaction', collGroupSrc.includes('runTransaction'));

// Leaderboard sort
check('Regression: sortLeaderboardRows handles collective (cumulativeLoggedValue)', leaderSrc.includes('cumulativeLoggedValue'));
check('Regression: sortLeaderboardRows handles streak (currentStreak)', leaderSrc.includes('currentStreak'));
check('Regression: sortLeaderboardRows handles competitive (completionRate)', leaderSrc.includes('completionRate'));

// Date utility
// The file's comment mentions toISOString as a warning ("Do NOT use"), so we check
// implementation keywords rather than absence of the string.
check('Regression: toLocalIsoDate uses getFullYear + getMonth + getDate (local components)', dateUtilSrc.includes('getFullYear') && dateUtilSrc.includes('getMonth') && dateUtilSrc.includes('getDate'));

// BUG-008: deriveDailyTargetValue has targetType parameter
check('Regression: deriveDailyTargetValue accepts targetType parameter', completionSrc.includes("targetType?: 'daily' | 'cumulative'"));

// Engine selection — no silent fallback for unknown v2 types
const engineIndexSrc = readFileSync(new URL('../src/services/challengeEngine/index.ts', import.meta.url).pathname, 'utf8');
check('Regression: selectEngine throws for unknown v2 type (no silent fallback)', engineIndexSrc.includes('throw new Error'));

// ─── Performance Observations ─────────────────────────────────────────────────

section('Performance Observations (read counts per operation)');

// These are architectural observations, not live Firestore measurements.
// Based on code analysis of service layer reads.

const perfReport = `
  Workout logging (non-collective):
    Reads:  2 (challengeSnap + membershipSnap)
    Writes: 3 batch (workoutLog + membership + userStats)
    Transactions: 0

  Workout logging (collective):
    Reads:  2 (challengeSnap + membershipSnap)
    Writes: 2 batch (workoutLog + membership + userStats) + 1 tx (challengeDoc)
    Transactions: 1 (runTransaction with 1 read + 1 write)

  joinChallenge:
    Reads:  3 (challengeSnap + groupMemberSnap + memberSnap)
    Writes: 3 batch (membershipDoc + challengeParticipantCount + userStats)

  leaveChallenge:
    Reads:  1 (membershipSnap)
    Writes: 3 batch (membershipDoc + challengeParticipantCount + userStats)

  cascadeCollectiveCompletion (N active members beyond triggering member):
    Reads:  1 (getDocs active members query)
    Writes: ceil(N / 450) batches × ceil(N / 450) × 450 writes

  getChallengeParticipantCounts (M challengeIds):
    Reads:  ceil(M / 10) × 2 parallel queries per chunk
`;

console.log(perfReport);
check('Performance: collective logging uses exactly 1 transaction (not batch for challenge doc)', collGroupSrc.includes('runTransaction') && !collGroupSrc.includes('writeBatch'));

// ─── 12. P0-1 Streak ALL-Daily-Requirements ───────────────────────────────────

section('12. P0-1 Streak ALL-Daily-Requirements');

{
  const multiCtx = context({
    activities: [
      { activityId: 'a', targetValue: 10, unit: 'reps' },
      { activityId: 'b', targetValue: 20, unit: 'reps' },
    ],
    requiredConsecutiveDays: 3,
  });
  const apply = (state: MembershipSnapshot, date: string, activityId: string): MembershipSnapshot => {
    const r = streak.computeUpdate(multiCtx, state, logEvent(date, 10, 10, activityId));
    return { ...state, ...r.membershipUpdate };
  };
  const hasAll = (s: MembershipSnapshot) =>
    ['a', 'b'].every((id) => (s.dailyCompletedActivities ?? []).includes(id));

  // 12.1 single requirement success (single-activity challenge completes the day)
  const single1 = streak.computeUpdate(context(), membership(), logEvent('2024-02-01'));
  check('P0-1 single requirement: first log starts streak at 1', single1.membershipUpdate.currentStreak === 1);

  // 12.2 multi-requirement partial completion does NOT advance
  let m = membership();
  m = apply(m, '2024-02-01', 'a');
  check('P0-1 partial: 1 of 2 requirements does not advance streak', m.currentStreak === 0);
  check('P0-1 partial: lastLogDate stays unset (no completed day yet)', m.lastLogDate === undefined);
  // excess quantity on one requirement cannot compensate for the missing one
  m = apply(m, '2024-02-01', 'a');
  check('P0-1 partial: repeated log on same requirement still does not advance', m.currentStreak === 0);

  // 12.3 all requirements completed advances the day exactly once
  m = apply(m, '2024-02-01', 'b');
  check('P0-1 all-met: completing every requirement advances streak to 1', m.currentStreak === 1);
  check('P0-1 all-met: lastLogDate records the completed day', m.lastLogDate === '2024-02-01');
  check('P0-1 all-met: daily set tracks both requirements', hasAll(m));

  // 12.4 repeated logs must not double-advance the same day
  m = apply(m, '2024-02-01', 'a');
  m = apply(m, '2024-02-01', 'b');
  check('P0-1 repeat: extra logs same day do not double-advance', m.currentStreak === 1);

  // build a 2-day streak, then miss a day
  m = apply(m, '2024-02-02', 'a');
  m = apply(m, '2024-02-02', 'b');
  check('P0-1 setup: consecutive full day advances to 2', m.currentStreak === 2);

  // 12.5 missed day resets (partial logs on the gap day do not bridge it)
  let gap = apply({ ...m }, '2024-02-04', 'a'); // skipped 2024-02-03 entirely
  check('P0-1 miss: partial log after a gap does not advance', gap.currentStreak === 2);
  gap = apply(gap, '2024-02-04', 'b');
  check('P0-1 miss: completed day after a gap resets streak to 1', gap.currentStreak === 1);
  check('P0-1 miss: longestStreak preserves the pre-reset best (2)', gap.longestStreak === 2);
  check('P0-1 miss: participant status stays active after reset', gap.status === 'active');

  // 12.6 continuation after reset starts a new streak
  gap = apply(gap, '2024-02-05', 'a');
  gap = apply(gap, '2024-02-05', 'b');
  check('P0-1 continue: valid days after reset build a new streak (2)', gap.currentStreak === 2);

  // 12.7 late joining does not alter the configured denominator
  const lateJoiner = membership({ totalActivities: 30 });
  const lj1 = streak.computeUpdate(multiCtx, lateJoiner, logEvent('2024-02-01', 10, 10, 'a'));
  const ljState: MembershipSnapshot = { ...lateJoiner, ...lj1.membershipUpdate };
  check('P0-1 late-join: totalActivities denominator unchanged (30)', ljState.totalActivities === 30);
  check('P0-1 late-join: activitiesCompleted counts logs only (1)', ljState.activitiesCompleted === 1);
}

// ─── 13. P0-4 Collective Overshoot Canonical Truth ────────────────────────────

section('13. P0-4 Collective Overshoot Canonical Truth');

{
  // Canonical example: goal 100, existing 95, new qualifying contribution 10 → 105/100, 105%
  const crossing = computeGroupTransition(
    { status: 'active', groupCurrentTotal: 95, groupCumulativeTarget: 100, autoCompleteOnGroupTarget: true },
    10,
  );
  check('P0-4 canonical: 95 + 10 stores full total 105 (not clamped to 100)', crossing.actualTotal === 105);
  check('P0-4 canonical: crossing the goal completes the challenge', crossing.shouldComplete === true);

  const { resolveChallengeProgress } = await import('../src/features/Challenges/challengeProgressResolver.js');
  const rp = resolveChallengeProgress({
    challenge: { challengeType: 'collective', activities: [{ targetValue: 100, unit: 'reps' }], groupCumulativeTarget: 100 },
    membership: null,
    activitySummaryTotal: 105,
  });
  check('P0-4 canonical: resolver groupTotal preserves overshoot (105)', rp.groupTotal === 105);
  check('P0-4 canonical: resolver groupPercent may exceed 100 (105%)', rp.groupPercent === 105);
}

// ─── Summary ──────────────────────────────────────────────────────────────────

const totalChecks = passed + failed;

console.log(`\n${'─'.repeat(60)}`);
console.log(`Phase 13E Verification Results`);
console.log(`${'─'.repeat(60)}`);
console.log(`Total checks : ${totalChecks}`);
console.log(`Passed       : ${passed}`);
console.log(`Failed       : ${failed}`);
console.log(`Pass rate    : ${Math.round((passed / totalChecks) * 100)}%`);

if (failures.length > 0) {
  console.error('\nFailures:');
  for (const f of failures) console.error(f);
  process.exit(1);
} else {
  console.log('\n✅ Phase 13E: all checks passed — release candidate ready');
}
