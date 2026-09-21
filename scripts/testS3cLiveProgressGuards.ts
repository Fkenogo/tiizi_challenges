/**
 * S3c live progress / type-state guards (run: npm run test:s3c-live-progress).
 *
 * TIIZI-S3C-LIVE-PROGRESS-001: the V2 Challenge detail binds authoritative
 * progress reads per type — no second scoring engine, no client ranking,
 * no device-clock day, no S3d results. Proves (runtime/behavioral first;
 * source-string only for non-existence claims, as in S3a/S3b):
 *
 *   1. collective percent/remaining/own-share derive from projected reads
 *      (overshoot preserved; null-safe at zero total / missing goal);
 *   2. contributor payloads carry no ranking vocabulary (position/rank/
 *      winner/podium absent by construction);
 *   3. competitive positions are server-read passthrough (never computed);
 *      finishers split from still-progressing; N-of-M counts;
 *   4. streak day comes ONLY from the server-projected governingToday
 *      (progressView never touches the device clock); requirements map to
 *      Done/Pending from dayStates;
 *   5. no S3d experience (finals, winners, podiums, recognition, Run Again);
 *   6. no deferred scope (donations/support/media/Kudos) in S3c files;
 *   7. no manufactured canonical progress in cache (no setQueryData);
 *   8. accepted S3b activity invalidates the S3c families through the same
 *      canonical contract (contributors + leaderboard + legacy leaderboard).
 */
import { readFileSync } from 'node:fs';
import { QueryClient } from '@tanstack/react-query';
import type {
  V2ChallengeContributors,
  V2ChallengeDetail,
  V2LeaderboardEntry,
} from '../src/api/v2ChallengeApi.js';
import {
  collectiveProgressFor,
  competitiveLeaderboardEnabledForS3c,
  competitiveProgressFor,
  contributorsCarryNoRanking,
  isOwnBoardEntry,
  isOwnContributor,
  raceBoardFor,
  streakProgressFor,
} from '../src/v2/challenges/progressView.js';
import {
  invalidateV2ChallengeReads,
  v2ChallengeContributorsKey,
  v2ChallengeDetailKey,
  v2ChallengeLeaderboardKey,
  v2ChallengeListKey,
} from '../src/v2/challenges/challengeQueryKeys.js';

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok: ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const read = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function detail(overrides: Partial<V2ChallengeDetail>): V2ChallengeDetail {
  return {
    challengeId: '11111111-1111-4111-8111-111111111111',
    groupId: '22222222-2222-4222-8222-222222222222',
    title: 'Test Challenge',
    description: '',
    challengeType: 'collective',
    status: 'active',
    startDate: '2026-09-17',
    endDate: '2026-09-30',
    timezone: 'Africa/Nairobi',
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
    governingToday: '2026-09-19',
    serverNow: '2026-09-19T06:00:00.000Z',
    config: {
      version: 1,
      period: { startDate: '2026-09-17', endDate: '2026-09-30' },
      requiredConsecutiveDays: null,
      activities: [],
    },
    ...overrides,
  } as V2ChallengeDetail;
}

function activeProgress(overrides = {}, participationId = '33333333-3333-4333-8333-333333333333') {
  return {
    participationId,
    status: 'active',
    joinedAt: '2026-09-18T00:00:00.000Z',
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
      ...overrides,
    },
  } as V2ChallengeDetail['myParticipation'];
}

// ─── 1. Collective derivation ────────────────────────────────────────────
console.log('collective derivation');
{
  const d = detail({
    goalValue: 100,
    goalUnit: 'reps',
    collectiveTotal: 130,
    collectiveGoalReached: true,
    completionsCount: 2,
    myParticipation: activeProgress({ cumulativeTotal: 60 }),
  });
  const view = collectiveProgressFor(d);
  check('percent preserves overshoot (130%)', view.percent === 130);
  check('remaining floors at zero once reached', view.remaining === 0);
  check('goal/unit pass through', view.goal === 100 && view.unit === 'reps');
  check('goal-reached + completions surface', view.goalReached && view.completionsCount === 2);
  check('own contribution + share (60/130)', view.ownContribution === 60
    && view.ownShare !== null && Math.abs(view.ownShare - 60 / 130) < 1e-12);
  check('joined flag true for active episode', view.hasJoined === true);

  const zero = detail({ goalValue: 100, goalUnit: 'reps', collectiveTotal: 0 });
  const zeroView = collectiveProgressFor(zero);
  check('zero total: percent 0, remaining full, own share null',
    zeroView.percent === 0 && zeroView.remaining === 100 && zeroView.ownShare === null);
  check('zero total: not joined without episode', zeroView.hasJoined === false);

  const goalless = detail({ collectiveTotal: 40 });
  const goallessView = collectiveProgressFor(goalless);
  check('missing goal: percent/remaining null (never invented)',
    goallessView.percent === null && goallessView.remaining === null);
}

// ─── 2. Contributor non-ranking ──────────────────────────────────────────
console.log('contributor non-ranking');
{
  const rollup: V2ChallengeContributors = {
    challengeId: '11111111-1111-4111-8111-111111111111',
    challengeType: 'collective',
    collectiveTotal: 130,
    goalValue: 100,
    goalUnit: 'reps',
    contributors: [
      {
        memberId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        participationId: '33333333-3333-4333-8333-333333333333',
        participationStatus: 'active',
        contributionTotal: 60,
        share: 60 / 130,
        logsAccepted: 2,
      },
      {
        memberId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        participationId: '44444444-4444-4444-8444-444444444444',
        participationStatus: 'active',
        contributionTotal: 70,
        share: 70 / 130,
        logsAccepted: 1,
      },
    ],
  };
  check('contributors carry no ranking vocabulary', contributorsCarryNoRanking(rollup));
  const d = detail({ myParticipation: activeProgress({}) });
  check('own contributor matches by participationId (no identity mapping)',
    isOwnContributor(rollup.contributors[0], d)
    && !isOwnContributor(rollup.contributors[1], d));
}

// ─── 3. Competitive server positions ─────────────────────────────────────
console.log('competitive server positions');
{
  const entries: V2LeaderboardEntry[] = [
    {
      memberId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      participationId: '33333333-3333-4333-8333-333333333333',
      totalPoints: 100,
      cumulativeTotal: 50,
      logsAccepted: 1,
      completionStatus: 'completed',
      completedAt: '2026-09-18T10:00:00.000Z',
      position: 1,
    },
    {
      memberId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      participationId: '44444444-4444-4444-8444-444444444444',
      totalPoints: 100,
      cumulativeTotal: 50,
      logsAccepted: 1,
      completionStatus: 'completed',
      completedAt: '2026-09-18T10:00:00.000Z',
      position: 1,
    },
    {
      memberId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      participationId: '55555555-5555-4555-8555-555555555555',
      totalPoints: 20,
      cumulativeTotal: 10,
      logsAccepted: 1,
      completionStatus: 'in_progress',
      completedAt: null,
      position: null,
    },
  ];
  const d = detail({
    challengeType: 'competitive',
    myParticipation: activeProgress({ cumulativeTotal: 50, completionStatus: 'completed', completedAt: '2026-09-18T10:00:00.000Z' }),
    config: {
      version: 1,
      period: { startDate: '2026-09-17', endDate: '2026-09-30' },
      requiredConsecutiveDays: null,
      activities: [{ canonicalKey: 'push-up', activityVariant: null, activityKind: 'fitness', targetValue: 50, unit: 'reps', position: 0 }],
    },
  });
  const view = competitiveProgressFor(d, entries);
  check('own total/target/percent from reads', view.ownTotal === 50 && view.target === 50 && view.percent === 100);
  check('position is server passthrough (1)', view.position === 1);
  check('qualified from completionStatus', view.qualified === true);

  const open = detail({
    challengeType: 'competitive',
    myParticipation: activeProgress(
      { cumulativeTotal: 10 },
      '99999999-9999-4999-8999-999999999999',
    ),
    config: d.config,
  });
  const openView = competitiveProgressFor(open, entries);
  check('unplaced member has null position (never computed)', openView.position === null);

  const split = raceBoardFor(entries);
  check('finishers split from progressing with N-of-M',
    split.finished.length === 2 && split.progressing.length === 1
    && split.finishedCount === 2 && split.participantCount === 3);
  check('own board row matches by participationId',
    isOwnBoardEntry(entries[0], d) && !isOwnBoardEntry(entries[2], d));
}

// ─── 3b. CORR-001 Blocker 2: finalized gating ─────────────────────────────
console.log('finalized gating (CORR-001 Blocker 2)');
{
  check('live competitive + unfinalized enables the S3c query',
    competitiveLeaderboardEnabledForS3c('competitive', false) === true);
  check('finalized disables the S3c query (frozen truth is S3d-owned)',
    competitiveLeaderboardEnabledForS3c('competitive', true) === false);
  check('other families never enable the leaderboard seam',
    competitiveLeaderboardEnabledForS3c('collective', false) === false
    && competitiveLeaderboardEnabledForS3c('streak', false) === false
    && competitiveLeaderboardEnabledForS3c(undefined, false) === false);
}

// ─── 4. Streak server day ────────────────────────────────────────────────
console.log('streak server day');
{
  const d = detail({
    challengeType: 'streak',
    timezone: 'Africa/Nairobi',
    governingToday: '2026-09-19',
    myParticipation: activeProgress({
      currentStreak: 2,
      bestStreak: 2,
      daysCompleted: 2,
      dayStates: { '2026-09-19': { complete: false, activities: ['push-up::'] } },
    }),
    config: {
      version: 1,
      period: { startDate: '2026-09-17', endDate: '2026-09-30' },
      requiredConsecutiveDays: 7,
      activities: [
        { canonicalKey: 'push-up', activityVariant: null, activityKind: 'fitness', targetValue: 10, unit: 'reps', position: 0 },
        { canonicalKey: 'bodyweight-squat', activityVariant: null, activityKind: 'fitness', targetValue: 10, unit: 'reps', position: 1 },
      ],
    },
  });
  const view = streakProgressFor(d);
  check('governing day taken from the read (not the device)',
    view.governingToday === '2026-09-19' && view.timezone === 'Africa/Nairobi');
  check('current/best/days surface', view.currentStreak === 2 && view.bestStreak === 2 && view.daysCompleted === 2);
  check('today open (partial requirements)', view.todayComplete === false);
  check('requirements map to Done/Pending from dayStates',
    view.requirements.length === 2
    && view.requirements[0].doneToday === true
    && view.requirements[1].doneToday === false);
}

// ─── 5/6/7. Static boundary proofs ───────────────────────────────────────
console.log('static boundaries');
const viewSrc = read('src/v2/challenges/progressView.ts');
const collectiveSrc = read('src/v2/challenges/V2CollectiveProgress.tsx');
const competitiveSrc = read('src/v2/challenges/V2CompetitiveProgress.tsx');
const streakSrc = read('src/v2/challenges/V2StreakProgress.tsx');
const sectionSrc = read('src/v2/challenges/V2ProgressSection.tsx');
const hookSrc = read('src/v2/challenges/useChallengeCreation.ts');
const screenSrc = read('src/v2/challenges/V2CreatedChallengeScreen.tsx');
const s3cSources = [viewSrc, collectiveSrc, competitiveSrc, streakSrc, sectionSrc];

check('view never touches the device clock for the Challenge day',
  !/new Date\(|Date\.now\(|Intl\.DateTimeFormat|getDate\(|getDay\(/.test(viewSrc));
check('view never computes positions (reads them only)',
  !/computeFinishingPositions/.test(viewSrc) && /\.position \?\? null/.test(viewSrc));
// The contributorsCarryNoRanking helper names the forbidden keys in its
// negative assertion — strip exactly that block before proving no other
// S3c line introduces S3d vocabulary.
const viewSrcStripped = viewSrc.replace(/export function contributorsCarryNoRanking[\s\S]*?\n\}/, '');
check('no S3d results assembly in S3c files',
  !/finalResult|finalPosition|winner|Winner|podium|Podium|recognition|Recognition|award|Award|Run Again|runAgain/i.test(viewSrcStripped)
  && [collectiveSrc, competitiveSrc, streakSrc, sectionSrc].every((src) => !/finalResult|finalPosition|winner|Winner|podium|Podium|recognition|Recognition|award|Award|Run Again|runAgain/i.test(src)));
check('no deferred scope in S3c files',
  s3cSources.every((src) => !/donation|Donation|pledge|escrow|M-Pesa|support tiizi|Support Tiizi|social cause|Social Cause|kudos|Kudos|cover|Cover|image_url/i.test(src)));
check('no manufactured canonical progress in S3c files',
  s3cSources.every((src) => !/setQueryData|computeActivityScore/.test(src)));
check('no client ranking engine in S3c files',
  s3cSources.every((src) => !/computeFinishingPositions|\.sort\(\(a, b\) => a\.position/.test(src)));
check('detail assembles hero → live progress → supporting info (no permanent logging form)',
  screenSrc.includes('<V2ChallengeHero')
    && screenSrc.includes('<V2ProgressSection')
    && screenSrc.includes('<V2ParticipationSection')
    && screenSrc.includes('What counts')
    && screenSrc.indexOf('<V2ChallengeHero') < screenSrc.indexOf('<V2ProgressSection')
    && screenSrc.indexOf('<V2ProgressSection') < screenSrc.indexOf('<V2ParticipationSection')
    && screenSrc.indexOf('<V2ParticipationSection') < screenSrc.indexOf('What counts')
    && !screenSrc.includes('<V2LoggingSection'));
check('finalized competitive unmounts the S3c live surface (no final-as-live)',
  competitiveSrc.includes('if (detail.finalized) return null'));
check('leaderboard hook gates on the S3c enablement (finalized disables fetch)',
  hookSrc.includes('competitiveLeaderboardEnabledForS3c')
  && hookSrc.includes('finalized'));

// ─── 7b. CORR-002 experience-reference alignment (static) ─────────────────
console.log('corr-002 experience alignment');
const heroSrc = read('src/v2/challenges/V2ChallengeHero.tsx');
const dialogSrc = read('src/v2/challenges/V2LoggingSection.tsx');
const namesSrc = read('src/v2/challenges/activityNames.tsx');
const corr002Sources = [viewSrc, collectiveSrc, competitiveSrc, streakSrc, sectionSrc, heroSrc, screenSrc];
check('hero consolidates identity for all three types (badge/title/host/schedule/purpose/CTA)',
  heroSrc.includes('challengeTypeLabel(detail.challengeType)')
    && heroSrc.includes('Hosted by')
    && heroSrc.includes('formatDayRange')
    && heroSrc.includes('timezoneLabel')
    && heroSrc.includes('Log activity')
    && heroSrc.includes('onLogActivity'));
check('hero imagery is a bounded CSS fallback (no fabricated media state)',
  !/<img|image_url|coverImage/.test(heroSrc)
    && heroSrc.includes('NO governed image/media field'));
check('Log Activity is a CTA opening the overlay (form absent while closed)',
  screenSrc.includes('setLogOpen(true)')
    && screenSrc.includes('<V2LogActivityDialog')
    && screenSrc.includes('open={logOpen}')
    && dialogSrc.includes('V2LogActivityDialog')
    && dialogSrc.includes('V2LogActivityForm')
    && dialogSrc.includes('V2Sheet')
    && !screenSrc.includes('V2LogActivityForm'));
check('overlay reuses the governed logging path (same seam, same invalidation)',
  dialogSrc.includes('useLogActivityV2')
    && dialogSrc.includes('buildS3bActivityPayload')
    && dialogSrc.includes('deriveSubmitKey')
    && !/setQueryData|computeActivityScore/.test(dialogSrc));
check('participant language replaces backend labels',
  !/Live race state|LIVE RACE STATE/.test(competitiveSrc)
    && competitiveSrc.includes('Race progress')
    && collectiveSrc.includes('Group progress')
    && !/Live shared progress/.test(collectiveSrc)
    && !/} time/.test(streakSrc));
check('governed activity names resolve everywhere codes leaked',
  dialogSrc.includes('useActivityDisplayNames')
    && dialogSrc.includes('resolvedChoiceOptionLabel')
    && streakSrc.includes('useActivityDisplayNames')
    && streakSrc.includes('resolveActivityDisplayName')
    && namesSrc.includes('fetchKnowledgeByCode')
    && namesSrc.includes('fetchKnowledgeById'));
check('no hard-coded code-to-name mapping (names resolve from Knowledge)',
  !/Push-Up|Breathing Practice|Community Walk|FIT STR|WEL MND|FIT CRD/.test(namesSrc)
    && !/Push-Up|Breathing Practice|Community Walk|FIT STR|WEL MND|FIT CRD/.test(dialogSrc)
    && !/Push-Up|Breathing Practice|Community Walk|FIT STR|WEL MND|FIT CRD/.test(streakSrc));
check('no S3d/deferred vocabulary in the CORR-002 assembly',
  corr002Sources.every((src) => !/finalResult|finalPosition|winner|Winner|podium|Podium|recognition|Recognition|Run Again|runAgain/i.test(src.replace(/contributorsCarryNoRanking[\s\S]*?\n\}/, '')))
  && corr002Sources.every((src) => !/donation|Donation|pledge|escrow|M-Pesa|support tiizi|Support Tiizi|social cause|Social Cause|kudos|Kudos|cover|Cover|image_url/.test(src)));

// ─── 7c. CORR-003 leave interaction (static) ────────────────────────────
console.log('corr-003 leave interaction');
const participationSrc = read('src/v2/challenges/V2ParticipationSection.tsx');
check('active participant sees Leave Challenge as a secondary hero action',
  heroSrc.includes('showLeave')
    && heroSrc.includes('onLeave')
    && heroSrc.includes('Leave Challenge')
    && screenSrc.includes('showLeave={joined}')
    && screenSrc.includes('onLeave={() => setLeaveOpen(true)}'));
check('hero Leave stays subordinate to the primary Log Activity CTA',
  heroSrc.includes('+ Log activity')
    && heroSrc.indexOf('+ Log activity') < heroSrc.indexOf('Leave Challenge'));
check('permanent Taking Part card is not rendered for active participants',
  participationSrc.includes("if (view.kind === 'joined') return null")
    && !/You are taking part in this Challenge\.<\/p>/.test(participationSrc));
check('initial Leave selection only opens confirmation (no mutation in hero)',
  !/mutateAsync|withdrawChallengeV2|useWithdrawChallengeV2/.test(heroSrc)
    && screenSrc.includes('<V2LeaveChallengeDialog'));
check('confirmation dialog explains leave + kept history with stay/leave actions',
  participationSrc.includes('V2LeaveChallengeDialog')
    && participationSrc.includes('Leaving ends your current participation')
    && participationSrc.includes('history will be kept')
    && participationSrc.includes('Stay in Challenge'));
check('cancellation performs no mutation (Stay only closes)',
  participationSrc.includes('onClick={onClose}'));
check('confirmation invokes the governed leave path exactly once',
  participationSrc.includes('useWithdrawChallengeV2')
    && (participationSrc.match(/withdraw\.mutateAsync\(detail\.challengeId\)/g) ?? []).length === 1
    && participationSrc.includes('disabled={withdraw.isPending}'));
check('leave converges through the canonical refetch contract',
  read('src/v2/challenges/useChallengeCreation.ts').includes('invalidateV2ChallengeReads'));
check('Log Activity CTA and type progress remain intact',
  screenSrc.includes('onLogActivity={() => setLogOpen(true)}')
    && screenSrc.includes('<V2ProgressSection'));

// ─── 8. Cache coherence for S3c families (runtime) ───────────────────────
console.log('s3c cache coherence');
async function cacheProof(): Promise<void> {
  const client = new QueryClient();
  const uidA = 'member-uid-a';
  const uidB = 'member-uid-b';
  const challengeId = '11111111-1111-4111-8111-111111111111';
  const server = async () => ({ ok: true });
  await client.prefetchQuery({ queryKey: v2ChallengeListKey(uidA), queryFn: server, staleTime: 30 * 1000 });
  await client.prefetchQuery({
    queryKey: v2ChallengeDetailKey(challengeId, uidA), queryFn: server, staleTime: 10 * 1000,
  });
  await client.prefetchQuery({
    queryKey: v2ChallengeContributorsKey(challengeId, uidA), queryFn: server, staleTime: 10 * 1000,
  });
  await client.prefetchQuery({
    queryKey: v2ChallengeLeaderboardKey(challengeId, uidA), queryFn: server, staleTime: 10 * 1000,
  });
  await client.prefetchQuery({
    queryKey: ['v2-leaderboard', challengeId, uidA], queryFn: server, staleTime: 30 * 1000,
  });
  await client.prefetchQuery({ queryKey: v2ChallengeListKey(uidB), queryFn: server, staleTime: 30 * 1000 });
  // The S3b log-success boundary converges S3c through the same contract:
  await invalidateV2ChallengeReads(client, uidA, challengeId);
  check('accepted activity marks own detail stale',
    client.getQueryState(v2ChallengeDetailKey(challengeId, uidA))?.isInvalidated === true);
  check('accepted activity marks contributors stale',
    client.getQueryState(v2ChallengeContributorsKey(challengeId, uidA))?.isInvalidated === true);
  check('accepted activity marks canonical leaderboard stale',
    client.getQueryState(v2ChallengeLeaderboardKey(challengeId, uidA))?.isInvalidated === true);
  check('accepted activity marks legacy leaderboard stale',
    client.getQueryState(['v2-leaderboard', challengeId, uidA])?.isInvalidated === true);
  check('per-user isolation preserved after acceptance',
    client.getQueryState(v2ChallengeListKey(uidB))?.isInvalidated !== true);
  check('hooks invalidate only via the shared contract',
    hookSrc.includes('invalidateV2ChallengeReads')
    && !/invalidateQueries\(\{\s*queryKey:\s*\['v2-challenge/.test(hookSrc));
}

await cacheProof();

if (failures > 0) {
  console.error(`\nS3c live progress guards: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\nS3c live progress guards: PASS');
