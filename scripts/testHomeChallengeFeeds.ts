import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const challengeService = readFileSync('src/services/challengeService.ts', 'utf8');
const homeScreen = readFileSync('src/features/Home/HomeScreen.tsx', 'utf8');
const homeHook = readFileSync('src/features/Home/useHomeScreen.ts', 'utf8');
const challengeDetail = readFileSync('src/features/Challenges/ChallengeDetailScreen.tsx', 'utf8');
const useWorkouts = readFileSync('src/hooks/useWorkouts.ts', 'utf8');

// ── Phase 12B: Challenge discovery scalability guards ──────────────────────

// Guard: no unbounded groups collection scan in challenge discovery.
// The old pattern was: getDocs(collection(db, 'groups')), — a bare collection read.
// The replacement is a scoped where('isPrivate', '==', false) query, so the
// bare comma-terminated form must not appear outside comments.
{
  const lines = challengeService.split('\n');
  const unboundedLines = lines.filter(
    (line) => /getDocs\(collection\(db,\s*'groups'\)\)/.test(line) && !line.trimStart().startsWith('//')
  );
  assert(
    unboundedLines.length === 0,
    `challengeService must not contain a bare getDocs(collection(db, 'groups')) call — found on lines: ${unboundedLines.join(' | ')}`,
  );
}

// Guard: public group discovery uses a scoped isPrivate query
assert(
  challengeService.includes("where('isPrivate', '==', false)"),
  'challengeService.getVisibleChallengesForUser must use where(isPrivate == false) for public group discovery',
);

// Guard: user group membership lookup remains scoped to userId
assert(
  challengeService.includes("where('userId', '==', userId)"),
  'challengeService must scope groupMembers query to the requesting userId',
);

// ── Existing guards ────────────────────────────────────────────────────────

// Guard: home screen must render active challenges section
assert(
  homeScreen.includes('activeChallenges') || homeScreen.includes('challenge'),
  'HomeScreen must reference challenges',
);

// Guard: home hook must fetch challenges
assert(
  homeHook.includes('challenge') || homeHook.includes('Challenge'),
  'useHomeScreen must fetch challenge data',
);

// Guard: hook must not over-fetch (no unbounded queries)
assert(
  !homeHook.includes('getChallenges()') || homeHook.includes('limit') || homeHook.includes('maxResults'),
  'useHomeScreen must use bounded challenge queries',
);

// Guard: participant count must fallback to challenge.participantCount, not hardcode 0
assert(
  challengeDetail.includes('resolvedChallenge.participantCount'),
  'ChallengeDetailScreen must fallback to challenge.participantCount for participants',
);

// Guard: participant display must use || not ?? so 0 triggers fallback
assert(
  challengeDetail.includes('uniqueParticipants || resolvedChallenge.participantCount'),
  'ChallengeDetailScreen participant display must use || fallback (not ?? 0)',
);

// Guard: myLogs and totalLogs must be separate (not aliased to same source)
assert(
  useWorkouts.includes('myLogs') && useWorkouts.includes('totalLogs'),
  'useChallengeProgress must compute myLogs and totalLogs separately',
);

// Guard: myLogs must be sourced from activitiesCompleted on the membership doc,
// which is incremented by both workoutService and wellnessLogService. This ensures
// wellness challenge logs are counted without a separate wellnessLogs collection query.
assert(
  useWorkouts.includes('activitiesCompleted') && useWorkouts.includes('myLogs') && useWorkouts.includes('myDoc'),
  'useChallengeProgress must derive myLogs from membership activitiesCompleted (covers both workout and wellness challenges)',
);

// Guard: challengeMembers activitiesCompleted used for totalLogs aggregate
assert(
  useWorkouts.includes('activitiesCompleted'),
  'useChallengeProgress must use activitiesCompleted from challengeMembers for totalLogs',
);

// Guard: completed/expired challenge hides Join CTA for non-members
assert(
  challengeDetail.includes('challengeIsOver') && challengeDetail.includes('This challenge has ended'),
  'ChallengeDetailScreen must show ended message instead of Join for expired non-members',
);

// Guard: activity target display includes a cadence label (v2 uses targetType —
// 'daily'/'weekly'/'monthly'/'cumulative' — via targetLabel(); the legacy
// 'frequency' field/freqLabel variable was removed in Phase 5).
assert(
  challengeDetail.includes('targetLabel') && challengeDetail.includes('targetType'),
  'ChallengeDetailScreen activity list must render a cadence label via targetLabel()/targetType',
);

// ── Phase 18I-6I: My Challenges relevance sort ────────────────────────────

{
  // Guard: My Challenges are sorted by lastActivityAt (Tier 1) before no-activity challenges (Tier 2)
  assert(
    homeHook.includes('lastActivityAt') && homeHook.includes('endDate'),
    'useHomeScreen myChallenges sort must use lastActivityAt (Tier 1) and endDate (Tier 2 fallback)',
  );

  // Guard: Tier 2 challenges sorted by endDate asc (earliest deadline first)
  assert(
    homeHook.includes('Date.parse(a.endDate) - Date.parse(b.endDate)'),
    'useHomeScreen Tier-2 unlogged challenges must sort by endDate asc',
  );

  // Guard: My Challenges limit is 10
  assert(
    homeHook.includes('.slice(0, 10)'),
    'useHomeScreen must limit ongoingMemberChallenges to 10',
  );

  // Guard: My Challenges sort uses membershipSummaries.get() for lastActivityAt (no new Firestore read)
  assert(
    homeHook.includes("membershipSummaries.get(") && homeHook.includes('lastActivityAt'),
    'useHomeScreen must derive lastActivityAt from membershipSummaries (no new Firestore read)',
  );
}

// ── Phase 18I-6I: Most Active section ────────────────────────────────────

{
  // Guard: Home reads challengeActivitySummaries for Most Active ranking. Phase 6 moved this
  // read into challengeService.getChallengeActivitySummaries() (service-layer cleanup) —
  // checked against the combined source since useHomeScreen.ts now calls the service instead
  // of querying Firestore directly.
  assert(
    homeHook.includes('challengeService.getChallengeActivitySummaries') && challengeService.includes("'challengeActivitySummaries'"),
    'Home (useHomeScreen + challengeService) must read challengeActivitySummaries collection for Most Active ranking',
  );

  // Guard: sorts by totalLogs before participantCount
  assert(
    homeHook.includes('totalLogs') && homeHook.includes('participantCount'),
    'useHomeScreen Most Active must sort by totalLogs then participantCount',
  );

  // Guard: totalLogs sort is primary (appears before participantCount in sort)
  assert(
    (() => {
      const totalLogsIdx = homeHook.indexOf('totalLogs');
      const participantIdx = homeHook.indexOf('participantCount');
      return totalLogsIdx !== -1 && participantIdx !== -1 && totalLogsIdx < participantIdx;
    })(),
    'useHomeScreen Most Active: totalLogs sort must appear before participantCount sort',
  );

  // Guard: Most Active limit is 5
  assert(
    homeHook.includes('.slice(0, 5)'),
    'useHomeScreen must limit mostActiveOngoing to 5',
  );

  // Guard: uses chunked in-query (no unbounded challengeActivitySummaries read).
  // Lives in challengeService.getChallengeActivitySummaries() post Phase 6 service-layer cleanup.
  assert(
    challengeService.includes("documentId(), 'in'") || challengeService.includes('documentId(), "in"'),
    'challengeService challengeActivitySummaries read must use documentId() in-query (chunked, not unbounded)',
  );

  // Guard: missing summary treated as totalLogs = 0 (not excluded).
  // Lives in challengeService.getChallengeActivitySummaries() post Phase 6 service-layer cleanup.
  assert(
    challengeService.includes('totalLogs ?? 0'),
    'challengeService Most Active summaries must treat missing challengeActivitySummaries as totalLogs = 0',
  );

  // Guard: stat label shows "logs" when totalLogs > 0
  assert(
    homeHook.includes('logs'),
    'useHomeScreen Most Active card members label must include "logs" string',
  );

  // Guard: HomeScreen renders "Most Active" section label (not "Most Popular")
  assert(
    homeScreen.includes('Most Active') && !homeScreen.includes('Most Popular'),
    'HomeScreen must render "Most Active" section label, not "Most Popular"',
  );

  // Guard: HomeScreen uses mostActiveOngoing field (not mostPopularOngoing)
  assert(
    homeScreen.includes('mostActiveOngoing') && !homeScreen.includes('mostPopularOngoing'),
    'HomeScreen must reference mostActiveOngoing (renamed from mostPopularOngoing)',
  );

  // Guard: useHomeScreen type uses mostActiveOngoing (not mostPopularOngoing)
  assert(
    homeHook.includes('mostActiveOngoing') && !homeHook.includes('mostPopularOngoing'),
    'useHomeScreen HomeScreenData type must use mostActiveOngoing field name',
  );
}

console.log('✅ testHomeChallengeFeeds: all guards passed');
