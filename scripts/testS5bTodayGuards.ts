/**
 * S5b Today Experience Assembly guards
 * (run: `npm run test:s5b-today`).
 *
 * Locks the S5b assembly contract behaviourally against the REAL view helpers
 * and the REAL client module, so the Today experience cannot silently start
 * deriving domain truth, inventing capability, or leaving the V2 boundary.
 *
 *   A. greeting and date context come from the SERVER projection clock, never
 *      the device clock;
 *   B. the empty state is driven by authoritative absence, not by a placeholder;
 *   C. Together/Race/Streak progress is rendered as served, with no client
 *      ranking, unit summing, or streak computation;
 *   D. opportunities never offer an unconditional Join action
 *      (`joinability: 'not_asserted'`);
 *   E. the screen consumes only the `/api` namespace and only V2 routes, and
 *      the placeholder engineering copy is gone;
 *   F. the screen renders no deferred/unsupported capability;
 *   G. growing sections stay concise (first two served items, server order
 *      preserved) behind an accessible View more / Show less toggle, while
 *      Do today is never limited;
 *   H. the shared activity-logging sheet stays phone-safe (presentation only;
 *      the governed application authority is untouched);
 *   I. the zero state offers governed Challenge and Group discovery;
 *   J. Your Challenges never immediately repeats a Challenge already
 *      represented in Do today (order preserved, limit applied after
 *      deduplication, projection never mutated).
 */
import { readFileSync } from 'node:fs';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import {
  challengeTypeLabel,
  formatAmount,
  formatGoverningDay,
  governingDayFor,
  greetingFor,
  isTodayEmpty,
  hasOtherParticipation,
  joinsAnyChallenge,
  NO_PARTICIPATION_COPY,
  noParticipationKind,
  opportunityAction,
  orderRequiredToday,
  presentedJoinedChallenges,
  progressPercent,
  raceActivitySummary,
  requirementProgress,
  serverHour,
  streakReminder,
  todayBlockingError,
  togetherSummary,
  TODAY_SECTION_LIMIT,
  upcomingSummary,
  visibleSectionItems,
} from '../src/v2/today/todayView.js';
import { todayLoggingOpen } from '../src/v2/today/todayLogging.js';
import { refreshAfterAcceptedLog } from '../src/v2/challenges/refreshAfterAcceptedLog.js';
import { v2TodayKey } from '../src/v2/today/todayQueryKeys.js';
import type { V2ChallengeDetail } from '../src/api/v2ChallengeApi.js';
import type {
  V2TodayJoinedChallenge,
  V2TodayProjection,
  V2TodayRequiredChallenge,
} from '../src/api/todayApi.js';

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok: ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL: ${name}${detail ? `\n      ${detail}` : ''}`);
  }
}

const read = (path: string): string => readFileSync(path, 'utf8');

/**
 * Strip block and line comments so boundary assertions inspect CODE. Without
 * this, a docstring that *states* a capability is omitted would be read as
 * rendering it — the opposite of the intent.
 */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// ---------------------------------------------------------------------------
// Fixtures — shaped exactly like the S5a `GET /api/today` projection.
// ---------------------------------------------------------------------------

function requiredChallenge(overrides: Partial<V2TodayRequiredChallenge> = {}): V2TodayRequiredChallenge {
  return {
    challengeId: 'c-streak',
    title: 'Morning Movement',
    challengeType: 'streak',
    group: { groupId: 'g-1', name: 'Sunrise Circle' },
    lifecycleState: 'active',
    governingToday: '2026-09-15',
    timezone: 'Africa/Nairobi',
    detailPath: '/v2/challenges/c-streak',
    requirements: [
      { activity: 'fitness:push-up', label: 'Push-ups', targetValue: 20, unit: 'reps', state: 'completed' },
      { activity: 'fitness:plank', label: 'Plank', targetValue: 60, unit: 'seconds', state: 'pending' },
    ],
    streak: {
      currentStreak: 4,
      bestStreak: 9,
      daysCompleted: 12,
      lastCompletedDay: '2026-09-14',
      completionStatus: 'in_progress',
      dayState: { complete: false, activities: ['fitness:push-up'] },
    },
    ...overrides,
  };
}

function projection(overrides: Partial<V2TodayProjection> = {}): V2TodayProjection {
  return {
    todayContext: {
      // 07:15 UTC deliberately differs from any plausible device-local hour.
      serverNow: '2026-09-15T07:15:00.000Z',
      activeChallengeCount: 1,
      timezoneContexts: [{ challengeId: 'c-streak', timezone: 'Africa/Nairobi', governingToday: '2026-09-15' }],
    },
    requiredToday: [requiredChallenge()],
    joinedChallengeProgress: [],
    groupChallengeOpportunities: [],
    upcoming: [],
    finalizedResults: [],
    unsupportedSections: {
      invitations: { available: false, disposition: 'deferred' },
      communityMoments: { available: false, disposition: 'deferred' },
      notifications: { available: false, disposition: 'deferred' },
    },
    projection: { authority: 'existing_challenge_reads', countdown: 'omitted_boundary_equivalence_unproven' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// A. Server-derived greeting and date context (never the device clock)
// ---------------------------------------------------------------------------

check(
  'A1 greeting derives the time of day from the SERVER clock, not the device clock',
  serverHour('2026-09-15T07:15:00.000Z', 'UTC') === 7
    && greetingFor('2026-09-15T07:15:00.000Z', 'UTC') === 'Good morning'
    && greetingFor('2026-09-15T13:00:00.000Z', 'UTC') === 'Good afternoon'
    && greetingFor('2026-09-15T21:00:00.000Z', 'UTC') === 'Good evening',
);
check(
  'A2 greeting resolves the hour in the authoritative Challenge timezone',
  // 05:00Z is 08:00 in Africa/Nairobi (UTC+3) → morning regardless of browser tz.
  serverHour('2026-09-15T05:00:00.000Z', 'Africa/Nairobi') === 8,
);
check(
  'A3 greeting uses the member first name only when supplied',
  greetingFor('2026-09-15T09:00:00.000Z', 'UTC', 'Amara Okoye') === 'Good morning, Amara'
    && greetingFor('2026-09-15T09:00:00.000Z', 'UTC', null) === 'Good morning',
);
check(
  'A4 an unparseable server instant never yields a device-derived greeting',
  serverHour('not-a-date', 'UTC') === 0,
);
check(
  'A5 governing day comes from the projection timezone context',
  governingDayFor(projection()) === '2026-09-15',
);
check(
  'A6 governing day falls back to the first projected Challenge, never to today',
  governingDayFor(projection({
    todayContext: { serverNow: '2026-09-15T07:15:00.000Z', activeChallengeCount: 1, timezoneContexts: [] },
  })) === '2026-09-15'
    && governingDayFor(projection({
      todayContext: { serverNow: '2026-09-15T07:15:00.000Z', activeChallengeCount: 0, timezoneContexts: [] },
      requiredToday: [],
    })) === null,
);
check(
  'A7 governing day renders as a friendly label',
  formatGoverningDay('2026-09-15').includes('September') && formatGoverningDay('2026-09-15').length > 5,
);

// ---------------------------------------------------------------------------
// B. Empty state is authoritative absence, not a placeholder
// ---------------------------------------------------------------------------

check(
  'B1 a fully populated projection is not empty',
  !isTodayEmpty(projection()),
);
check(
  'B2 a zero-state member projection is empty',
  isTodayEmpty(projection({
    requiredToday: [],
    joinedChallengeProgress: [],
    groupChallengeOpportunities: [],
    upcoming: [],
    finalizedResults: [],
  })),
);
check(
  'B3 any single authoritative section prevents the empty state',
  !isTodayEmpty(projection({ requiredToday: [], upcoming: [{
    challengeId: 'c-1', title: 'Autumn Push', kind: 'starts', lifecycleDate: '2026-09-18',
    timezone: 'UTC', detailPath: '/v2/challenges/c-1',
  }] })),
);

// ---------------------------------------------------------------------------
// C. Type-specific progress rendered as served (no client domain derivation)
// ---------------------------------------------------------------------------

const together: V2TodayJoinedChallenge = {
  challengeId: 'c-together', title: '1000 km Together', challengeType: 'collective',
  group: { groupId: 'g-1', name: 'Sunrise Circle' }, lifecycleState: 'active',
  governingToday: '2026-09-15', timezone: 'UTC', startDate: '2026-09-01', endDate: '2026-09-30',
  detailPath: '/v2/challenges/c-together',
  progress: { groupTotal: 620, target: 1000, unit: 'kilometres', goalReached: false, memberContribution: 85 },
};
check(
  'C1 Together summary shows the shared total against the shared goal',
  togetherSummary(together as Extract<V2TodayJoinedChallenge, { challengeType: 'collective' }>) === '620 kilometres of 1,000 kilometres',
);
check(
  'C2 progress percent clamps the BAR only; values stay exact',
  progressPercent(620, 1000) === 62 && progressPercent(1400, 1000) === 100 && progressPercent(10, null) === 0,
);
check(
  'C3 Race progress is own-progress per Activity against its own target',
  raceActivitySummary({ memberProgress: 42, targetValue: 100, unit: 'kilometres' }) === '42 kilometres of 100 kilometres',
);
check(
  'C4 requirement progress counts the served completed/pending states',
  requirementProgress(requiredChallenge()).completed === 1
    && requirementProgress(requiredChallenge()).total === 2
    && requirementProgress(requiredChallenge()).allComplete === false,
);
check(
  'C5 requirement progress reports allComplete only when every requirement is completed',
  requirementProgress(requiredChallenge({
    requirements: [
      { activity: 'a', targetValue: 1, unit: 'reps', state: 'completed' },
      { activity: 'b', targetValue: 1, unit: 'reps', state: 'completed' },
    ],
  })).allComplete === true,
);
check(
  'C6 member-facing Challenge type vocabulary is Together / Race / Streak',
  challengeTypeLabel('collective') === 'Together'
    && challengeTypeLabel('competitive') === 'Race'
    && challengeTypeLabel('streak') === 'Streak',
);
check(
  'C7 amounts render as served, with a dash when the authority supplies none',
  formatAmount(1000, 'kilometres') === '1,000 kilometres' && formatAmount(null, 'reps') === '—',
);
check(
  'C8 upcoming boundary copy is authoritative kind + date, with no invented countdown',
  upcomingSummary({ kind: 'starts', lifecycleDate: '2026-09-18' }).startsWith('Starts ')
    && upcomingSummary({ kind: 'ends', lifecycleDate: '2026-09-28' }).startsWith('Ends '),
);

// ---------------------------------------------------------------------------
// D. Opportunities never offer an unconditional Join
// ---------------------------------------------------------------------------

check(
  "D1 a not_asserted opportunity yields discovery, never an asserted join",
  opportunityAction('not_asserted') === 'discovery',
);
let threw = false;
try {
  // @ts-expect-error — deliberately violating the contract type.
  opportunityAction('joinable');
} catch {
  threw = true;
}
check('D2 any asserted joinability is rejected outright (fail closed)', threw);

// ---------------------------------------------------------------------------
// E./F. Screen boundaries: /api only, V2 routes only, no fabricated capability
// ---------------------------------------------------------------------------

const screenSource = read('src/v2/today/V2TodayScreen.tsx');
const screen = code(screenSource);
const client = code(read('src/api/todayApi.ts'));
const view = code(read('src/v2/today/todayView.ts'));
const hook = code(read('src/v2/today/useV2Today.ts'));
const routes = read('src/v2/routes.tsx');
const memberPages = read('src/v2/member/memberPages.tsx');
const sources = [screen, client, view, hook];

check(
  'E1 Today consumes the canonical /api namespace through the shared client',
  client.includes('API_PREFIX') && client.includes('${API_PREFIX}/today')
    && sources.every((s) => !/['"`]\/v1\//.test(s)),
);
check(
  'E2 no Today source references an archived /app/* route',
  sources.every((s) => !/['"`]\/app\//.test(s)),
);
check(
  'E3 Today imports no archived Product V1 module',
  !/from '.*features\//.test(screen) && !/from '.*features\//.test(hook),
);
check(
  'E4 Today derives no device-clock Challenge day',
  !/new Date\(\)\.(get|to)/.test(screen) && !/Date\.now\(\)/.test(screen),
);
check(
  'E5 Today defines no streak, ranking, points, or scoring computation',
  !/\b(currentStreak|bestStreak)\s*[-+*/]/.test(view)
    && !/sort\(.*position/i.test(view)
    && !/\b(points|score|rank)\s*=/i.test(view),
);
check(
  'E6 the Today route renders the real screen, and the placeholder is gone',
  routes.includes("path=\"today\" element={<V2TodayScreen />}")
    && !routes.includes('V2TodayPage')
    && !memberPages.includes('V2TodayPage')
    && !memberPages.includes('Today read models (S5)'),
);
check(
  'E7 no engineering placeholder copy remains in the Today surface',
  !sources.some((s) => s.includes('Next: Today')) && !screen.includes('nextSlice'),
);
check(
  'E8 deferred/unsupported capability is never rendered as product UI',
  !/unsupportedSections/.test(screen)
    && !/communityMoments/.test(screen)
    && !/\b(Recognition|Kudos|Feed|donation|payment)\b/.test(screen),
);
check(
  'E9 the zero state uses product copy and routes to the real Challenges surface',
  screen.includes('Ready to get moving?')
    && screen.includes('Join a Challenge to start tracking activities and progress here.')
    && screen.includes("onNavigate('/v2/challenges')"),
);
check(
  'F1 only current V2 routes are navigated to',
  (screen.match(/navigate\(['"`][^'"`]+['"`]\)/g) ?? [])
    .every((call) => call.includes('/v2/')),
);
check(
  'F2 Challenge links use the projection-supplied detailPath, never a rebuilt path',
  screen.includes('navigate(challenge.detailPath)')
    && screen.includes('navigate(opportunity.detailPath)')
    && screen.includes('navigate(item.detailPath)')
    && screen.includes('navigate(result.detailPath)'),
);
check(
  'F3 the Today read is member-scoped and disabled until signed in',
  hook.includes('useAuth') && hook.includes('enabled: !!user') && hook.includes('v2TodayKey(user?.uid)'),
);

// ---------------------------------------------------------------------------
// G. Progressive disclosure: concise sections, server order preserved
// ---------------------------------------------------------------------------

check(
  'G1 the initial presentation limit is two items per growing section',
  TODAY_SECTION_LIMIT === 2,
);
check(
  'G2 a collapsed section presents the first two served items in server order',
  JSON.stringify(visibleSectionItems(['a', 'b', 'c', 'd'], false)) === JSON.stringify(['a', 'b']),
);
check(
  'G3 an expanded section exposes every served item in server order',
  JSON.stringify(visibleSectionItems(['a', 'b', 'c', 'd'], true)) === JSON.stringify(['a', 'b', 'c', 'd']),
);
check(
  'G4 short sections render whole with no redundant toggle state',
  visibleSectionItems(['a'], false).length === 1
    && visibleSectionItems([], false).length === 0
    && visibleSectionItems(['a', 'b'], false).length === 2,
);
check(
  'G5 the screen limits only the growing sections through the shared helper, never Do today',
  screen.includes('visibleSectionItems(presentedChallenges')
    && screen.includes('visibleSectionItems(projection.groupChallengeOpportunities')
    && screen.includes('visibleSectionItems(projection.upcoming')
    && screen.includes('requiredOrdered.map')
    && screen.includes('orderRequiredToday(projection.requiredToday)')
    && !/visibleSectionItems\(requiredOrdered/.test(screen)
    && !/visibleSectionItems\(projection\.requiredToday/.test(screen)
    && !/visibleSectionItems\(projection\.joinedChallengeProgress/.test(screen),
);
check(
  'G6 View more / Show less is an accessible inline toggle with honest counts',
  screen.includes('aria-expanded={expanded}')
    && screen.includes('View more')
    && screen.includes('Show less')
    && !/\.sort\(/.test(screen)
    && !/\.reverse\(\)/.test(screen),
);

// ---------------------------------------------------------------------------
// H. Activity logging sheet stays phone-safe (presentation only)
// ---------------------------------------------------------------------------

const primitives = code(read('src/v2/components/V2Primitives.tsx'));
const loggingSection = code(read('src/v2/challenges/V2LoggingSection.tsx'));

check(
  'H1 the shared sheet constrains panel height and scrolls instead of overflowing',
  primitives.includes('max-h-[') && primitives.includes('overflow-y-auto'),
);
check(
  'H2 the sheet respects the phone safe area and phone-first padding',
  primitives.includes('safe-area-inset-bottom') && primitives.includes('sm:p-5'),
);
check(
  'H3 the logging form wraps long activity names and keeps inputs in-viewport',
  loggingSection.includes('break-words') && loggingSection.includes('max-w-full'),
);
check(
  'H4 the logging authority path is untouched by the presentation correction',
  loggingSection.includes('buildS3bActivityPayload')
    && loggingSection.includes('useLogActivityV2')
    && loggingSection.includes('deriveSubmitKey'),
);
check(
  'H5 logging opts into the focused sheet variant while other consumers keep the default',
  loggingSection.includes('title="Log activity" variant="focused"')
    && primitives.includes("variant = 'default'")
    && primitives.includes("variant === 'default' ? 'max-w-3xl' : 'max-w-md'"),
);
check(
  'H6 the focused member variant keeps the panel viewport-contained and internally scrollable',
  primitives.includes('max-h-[92dvh]')
    && primitives.includes('overflow-y-auto')
    && primitives.includes('max-w-md'),
);
check(
  'H7 form and Recorded state share the same focused sheet wrapper',
  /<V2Sheet[^>]*title="Log activity" variant="focused">[\s\S]*?<V2LogActivityForm/.test(loggingSection)
    && loggingSection.includes("'Recorded.'"),
);
check(
  'H8 the mobile log action fills its available width and input fields remain shrinkable',
  loggingSection.includes('[&>button]:w-full sm:[&>button]:w-auto')
    && loggingSection.includes('min-w-0 max-w-full'),
);
const nonLoggingSheetFiles = [
  'src/v2/member/MemberShell.tsx',
  'src/v2/challenges/V2ChallengeHero.tsx',
  'src/v2/challenges/V2ParticipationSection.tsx',
  'src/v2/groups/V2HostedChallengeCard.tsx',
  'src/v2/groups/V2GroupHomeScreen.tsx',
];
const nonLoggingSheets = nonLoggingSheetFiles.map((path) => code(read(path))).join('\n');
check(
  'H9 focused logging uses a strong blurred backdrop without changing default sheet backdrops',
  primitives.includes("variant === 'focused' ? 'bg-slate-950/75 backdrop-blur-sm' : 'bg-slate-900/40'")
    && loggingSection.includes('variant="focused"'),
);
check(
  'H10 focused mode traps keyboard focus, locks page scrolling, and supports Escape dismissal',
  primitives.includes("document.body.style.overflow = 'hidden'")
    && primitives.includes("event.key === 'Escape'")
    && /event\.key (?:===|!==) 'Tab'/.test(primitives)
    && primitives.includes('focusin'),
);
check(
  'H11 modal semantics and full-screen overlay prevent background interaction',
  primitives.includes('fixed inset-0 z-50')
    && primitives.includes('aria-modal="true"')
    && primitives.includes('aria-hidden="true"'),
);
check(
  'H12 focused activity modal retains bounded mobile width and internal vertical scrolling',
  primitives.includes("variant === 'default' ? 'max-w-3xl' : 'max-w-md'")
    && primitives.includes('max-h-[92dvh]')
    && primitives.includes('overflow-y-auto')
    && primitives.includes('safe-area-inset-bottom'),
);
check(
  'H13 unrelated V2Sheet consumers do not opt into logging-specific focused presentation',
  (nonLoggingSheets.match(/<V2Sheet/g) ?? []).length === 4 // P1a removed the member-shell account sheet (6 -> 5); P5 made the Challenge description inline (5 -> 4)
    // P4: only the Group About sheet (long, scrolling reference content needing a fixed Close) opts in.
    && (nonLoggingSheets.match(/variant="focused"/g) ?? []).length === 1
    && code(read('src/v2/groups/V2GroupHomeScreen.tsx')).includes('title="About this Group" variant="focused"'),
);
check(
  'H14 focused sheets keep Close visible while their content scrolls independently',
  primitives.includes("focused ? 'flex flex-col overflow-hidden' : 'overflow-y-auto overscroll-contain'")
    && primitives.includes("focused ? 'shrink-0' : ''")
    && primitives.includes("focused ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain' : ''"),
);

// ---------------------------------------------------------------------------
// I. Zero state offers governed discovery (Challenge + Group)
// ---------------------------------------------------------------------------

check(
  'I1 the zero state keeps Find a Challenge and adds Find a Group on real routes',
  screen.includes("onNavigate('/v2/challenges')") && screen.includes("onNavigate('/v2/groups')")
    && screen.includes('Find a Challenge') && screen.includes('Find a Group'),
);
check(
  'I2 the new-member headline and supporting copy use the Founder-approved wording',
  screen.includes('title="Ready to get moving?"')
    && screen.includes('message="Join a Challenge to start tracking activities and progress here."')
    && !screenSource.includes('Nothing needs you today'),
);
check(
  'I3 no governing date means the active Challenge count renders without an orphan separator',
  /\{governingDay && \([\s\S]*?formatGoverningDay\(governingDay\)[\s\S]*?text-slate-300">•<\/span>[\s\S]*?\)\}/.test(screen),
);
const emptyStateStart = screen.indexOf('{isTodayEmpty(projection) ? (');
const emptyStateEnd = screen.indexOf(') : (', emptyStateStart);
const emptyStateBranch = screen.slice(emptyStateStart, emptyStateEnd);
check(
  'I4 the empty branch contains only truthful copy and discovery actions, with no projected activity content',
  emptyStateStart >= 0 && emptyStateEnd > emptyStateStart
    && emptyStateBranch.includes('<NoParticipationState')
    && /function NoParticipationState[\s\S]*?<V2EmptyState/.test(screen)
    && !/projection\.(requiredToday|joinedChallengeProgress|groupChallengeOpportunities|upcoming|finalizedResults)/.test(emptyStateBranch)
    && !/recommended|suggested|sample Challenge|fake progress/i.test(emptyStateBranch),
);

// ---------------------------------------------------------------------------
// J. Presentation deduplication: no immediate repeat of Do today in
//    Your Challenges (Founder Review Correction 001A)
// ---------------------------------------------------------------------------

function joinedChallenge(challengeId: string): V2TodayJoinedChallenge {
  return {
    challengeId, title: challengeId, challengeType: 'collective',
    group: { groupId: 'g-1', name: 'Sunrise Circle' }, lifecycleState: 'active',
    governingToday: '2026-09-15', timezone: 'UTC', startDate: '2026-09-01', endDate: '2026-09-30',
    detailPath: `/v2/challenges/${challengeId}`,
    progress: { groupTotal: 1, target: 10, unit: 'reps', goalReached: false, memberContribution: 1 },
  };
}

const dedupFixture = {
  requiredToday: [requiredChallenge({ challengeId: 'A' })],
  joinedChallengeProgress: ['A', 'B', 'C', 'D'].map(joinedChallenge),
};
const presentedIds = presentedJoinedChallenges(dedupFixture).map((c) => c.challengeId);

check(
  'J1 a Challenge in both requiredToday and joinedChallengeProgress is presented only once (Do today)',
  JSON.stringify(presentedIds) === JSON.stringify(['B', 'C', 'D']),
);
check(
  'J2 remaining Your Challenges preserve their relative server order',
  presentedIds[0] === 'B' && presentedIds[1] === 'C' && presentedIds[2] === 'D',
);
check(
  'J3 the limit of 2 applies AFTER deduplication (collapsed B,C; expanded B,C,D)',
  JSON.stringify(visibleSectionItems(presentedJoinedChallenges(dedupFixture), false).map((c) => c.challengeId)) === JSON.stringify(['B', 'C'])
    && JSON.stringify(visibleSectionItems(presentedJoinedChallenges(dedupFixture), true).map((c) => c.challengeId)) === JSON.stringify(['B', 'C', 'D']),
);
check(
  'J4 a joined Streak absent from requiredToday remains eligible in Your Challenges',
  presentedJoinedChallenges({
    requiredToday: [requiredChallenge({ challengeId: 'A' })],
    joinedChallengeProgress: [{
      ...joinedChallenge('S'),
      challengeType: 'streak' as const,
      progress: { currentStreak: 3, bestStreak: 5, daysCompleted: 7, completionStatus: 'in_progress' as const },
    }],
  }).map((c) => c.challengeId).join(',') === 'S',
);
check(
  'J5 Your Challenges disappears when deduplication leaves no items',
  presentedJoinedChallenges({
    requiredToday: [requiredChallenge({ challengeId: 'A' })],
    joinedChallengeProgress: [joinedChallenge('A')],
  }).length === 0
    && screen.includes('presentedChallenges.length > 0')
    && !/projection\.joinedChallengeProgress\.length > 0/.test(screen),
);
check(
  'J6 the projection arrays are not mutated by presentation deduplication',
  (() => {
    const before = JSON.stringify(dedupFixture);
    presentedJoinedChallenges(dedupFixture);
    return JSON.stringify(dedupFixture) === before;
  })(),
);


// ---------------------------------------------------------------------------
// K. TIIZI-FER-P3-001 — Today recovery
// ---------------------------------------------------------------------------
const allDone = (id: string) => requiredChallenge({ challengeId: id, requirements: [
  { activity: 'wellness:a', label: 'A', targetValue: 1, unit: 'completion', state: 'completed' },
] });
const pendingOne = (id: string) => requiredChallenge({ challengeId: id });
const ids = (list: readonly V2TodayRequiredChallenge[]) => list.map((c) => c.challengeId).join(',');

check('K1 pending Streak actions come first; completed after; server order kept within each group',
  ids(orderRequiredToday([allDone('d1'), pendingOne('p1'), allDone('d2'), pendingOne('p2')])) === 'p1,p2,d1,d2');
check('K2 zero, one and three Streaks due order without loss or invention',
  ids(orderRequiredToday([])) === '' && ids(orderRequiredToday([pendingOne('p1')])) === 'p1'
  && ids(orderRequiredToday([pendingOne('a'), pendingOne('b'), pendingOne('c')])) === 'a,b,c');
check('K3 ordering never mutates the served projection',
  (() => { const input = [allDone('d'), pendingOne('p')]; const before = JSON.stringify(input); orderRequiredToday(input); return JSON.stringify(input) === before; })());
check('K4 no Streak means no reminder', streakReminder([]) === null);
check('K5 one pending Streak: compact "needs you" reminder', streakReminder([pendingOne('p')])?.text === '1 Streak needs you today.' && streakReminder([pendingOne('p')])?.tone === 'pending');
check('K6a every Streak pending reads plainly (no "3 of 3")', streakReminder([pendingOne('a'), pendingOne('b'), pendingOne('c')])?.text === '3 Streaks need you today.');
check('K6 three Streaks, one done: concise summary from served states only',
  streakReminder([pendingOne('p1'), allDone('d'), pendingOne('p2')])?.text === '2 of 3 Streaks need you today.');
check('K7 all Streaks completed today: completion acknowledgement',
  streakReminder([allDone('d1')])?.tone === 'done' && streakReminder([allDone('d1'), allDone('d2')])?.text === 'All 2 Streaks are done for today.');
const facts = (over: Partial<Parameters<typeof noParticipationKind>[0]> = {}) => ({
  groupCount: 1, challengeList: [] as Array<{ myParticipation: { status: string } | null }>, hasOpportunities: false,
  hasPendingGroupApplication: false, projectionShowsParticipation: false, ...over,
});
const notJoined = { myParticipation: null };
const joinedActive = { myParticipation: { status: 'active' } };
check('K8 empty-state kind follows real membership and Challenge facts only',
  noParticipationKind(facts({ groupCount: null })) === 'unknown'
  && noParticipationKind(facts({ groupCount: 0 })) === 'no-group'
  && noParticipationKind(facts({ groupCount: 2, hasOpportunities: true, challengeList: [notJoined] })) === 'group-with-challenges'
  && noParticipationKind(facts()) === 'group-without-challenges');
check('K9 the differentiated states (three empty + joined-not-live + no-live-challenges) have distinct copy and never promise payment or recommendations',
  new Set(Object.values(NO_PARTICIPATION_COPY).map((c) => c.title)).size === 5
  && !/recommended|suggested|payment|donat|coming soon/i.test(JSON.stringify(NO_PARTICIPATION_COPY)));
check('K10 an unknown membership count shows the generic Founder-approved zero state, never a guess', screen.includes("kind === 'unknown'") && screen.includes('Ready to get moving?'));

const loggingHook = read('src/v2/challenges/useChallengeCreation.ts');
const logHookBody = loggingHook.slice(loggingHook.indexOf('export function useLogActivityV2'), loggingHook.indexOf('export function useChallengeContributorsV2'));
check('K11 Today reuses the existing Log Activity dialog and the existing Challenge detail read (no second logging path)',
  screen.includes("import { V2LogActivityDialog } from '../challenges/V2LoggingSection'")
  && screen.includes('useChallengeDetailV2(challengeId)') && /<V2LogActivityDialog detail=\{data\}/.test(screen)
  && !/logChallengeActivityV2|useLogActivityV2|buildS3bActivityPayload|newClientKey|loggingIntent|\/activity`/.test(screen));
check('K12 an accepted log refreshes Challenge reads and Today through the non-throwing helper (no client patching)',
  /refreshAfterAcceptedLog\(queryClient, user\?\.uid, variables\.challengeId\)/.test(logHookBody) && !/setQueryData/.test(logHookBody)
  && !/Promise\.all\(/.test(logHookBody));
check('K13 Log activity is offered for pending Streaks and ongoing Together/Race/Streak cards; completed Streaks acknowledge instead',
  /allComplete \? \([\s\S]*?View Challenge[\s\S]*?\) : \([\s\S]*?onClick=\{onLog\}>Log activity/.test(screen)
  && /<V2Button onClick=\{onLog\}>Log activity<\/V2Button>/.test(screen) && screen.includes('✓ Done for today'));
check('K14 the ongoing section is titled "Your Ongoing Challenges" and keeps its own empty state', (screen.match(/Your Ongoing Challenges/g) ?? []).length === 2 && !/>\s*Your Challenges\s*</.test(screen));
check('K15 the existing logging form still guards double submission (disabled while pending, same-facts retry reuses the key)',
  /disabled=\{pending\}/.test(read('src/v2/challenges/V2LoggingSection.tsx')) && /pending=\{log\.isPending\}/.test(read('src/v2/challenges/V2LoggingSection.tsx')));
check('K16 the Today screen derives no due/missed/completed state of its own',
  !/dayState|lastCompletedDay|completionStatus\s*===\s*'(due|missed)'/.test(screen.slice(screen.indexOf('export function V2TodayScreen'), screen.indexOf('function TodayLogActivity'))));


const upcomingItem = (id: string) => ({ challengeId: id, title: 'Starts tomorrow', kind: 'starts' as const, lifecycleDate: '2026-09-16', timezone: 'Africa/Nairobi', detailPath: `/v2/challenges/${id}` });
check('K17 a member who joined a not-yet-started Challenge (only under upcoming) counts as participating — never told they have none',
  hasOtherParticipation({ upcoming: [upcomingItem('u1')], finalizedResults: [], groupChallengeOpportunities: [] }) === true);
check('K18 an upcoming item that is merely a Group opportunity is not participation',
  hasOtherParticipation({ upcoming: [upcomingItem('o1')], finalizedResults: [], groupChallengeOpportunities: [{ challengeId: 'o1' } as never] }) === false);
check('K19 finalized results count as participation; an empty projection does not',
  hasOtherParticipation({ upcoming: [], finalizedResults: [{ challengeId: 'f', title: 'T', finalized: true, detailPath: '/v2/challenges/f' }], groupChallengeOpportunities: [] }) === true
  && hasOtherParticipation({ upcoming: [], finalizedResults: [], groupChallengeOpportunities: [] }) === false);
check('K20 a pending Group application is not reported as "no Group"',
  noParticipationKind(facts({ groupCount: 0, hasPendingGroupApplication: true })) === 'unknown');
check('K21 Today offers the logging form only when the fresh detail passes the shared gate, otherwise a read-only message',
  /todayLoggingOpen\(data\)/.test(screen) && screen.includes("Logging isn&apos;t open for this Challenge right now"));
check('K22 participation unseen by the projection (joined-upcoming, finalized) is counted before any "no Challenges" message',
  noParticipationKind(facts({ projectionShowsParticipation: true, challengeList: [] })) === 'joined-not-live' && /projectionShowsParticipation: hasOtherParticipation\(projection\)/.test(screen));
check('K23 a Challenge beyond the horizon or ended-not-finalized still counts as participation (own list, active participation)',
  joinsAnyChallenge([joinedActive]) === true && joinsAnyChallenge([notJoined, { myParticipation: { status: 'withdrawn' } }]) === false && joinsAnyChallenge([]) === false);
check('K26 Today reads Challenge facts from the existing authorized list and keeps the opened logging form for the life of the sheet',
  /useChallengeListV2\(\)/.test(screen) && /challengeList: challengeList\.data\?\.challenges/.test(screen)
  && /offered\.current = true/.test(screen) && /loggable \|\| offered\.current/.test(screen));

// ---------------------------------------------------------------------------
// L. TIIZI-FER-P3-CORR-001 — CORR-A: Challenge absence is established only by the authorized Challenge read
// ---------------------------------------------------------------------------
check('L1 a Group with only future (not joined) Challenges is "Pick a Challenge", never "no Challenges"',
  noParticipationKind(facts({ hasOpportunities: true, challengeList: [notJoined] })) === 'group-with-challenges');
check('L2 a Group with only finalized/ended Challenges (none joined, none open) gets neutral wording, never an absence claim',
  noParticipationKind(facts({ hasOpportunities: false, challengeList: [notJoined, notJoined] })) === 'no-live-challenges'
  && !/no Challenges/i.test(NO_PARTICIPATION_COPY['no-live-challenges'].title + NO_PARTICIPATION_COPY['no-live-challenges'].message));
check('L3 a Group with a joined Challenge that is not live today is "Nothing to log today"',
  noParticipationKind(facts({ challengeList: [joinedActive] })) === 'joined-not-live');
check('L4 a Group genuinely without Challenges (authorized list loaded and empty) asserts the absence',
  noParticipationKind(facts({ groupCount: 2, challengeList: [] })) === 'group-without-challenges');
check('L5 a Group with available Challenges not joined offers to pick one',
  noParticipationKind(facts({ hasOpportunities: true, challengeList: [notJoined, joinedActive].slice(0, 1) })) === 'group-with-challenges');
check('L6 an unknown or failed Challenge read (undefined) never produces a false absence claim — generic state',
  noParticipationKind(facts({ challengeList: undefined })) === 'unknown' && noParticipationKind(facts({ challengeList: undefined, groupCount: 0 })) === 'unknown'
  && !/No Challenges/.test(JSON.stringify(Object.entries(NO_PARTICIPATION_COPY).filter(([k]) => k !== 'group-without-challenges'))));
check('L7 the absence copy is used for no other kind', Object.entries(NO_PARTICIPATION_COPY).filter(([, c]) => /No Challenges/.test(c.title)).map(([k]) => k).join() === 'group-without-challenges');

// ---------------------------------------------------------------------------
// M. CORR-B — an accepted log is never undone by a failing read-model refresh
// ---------------------------------------------------------------------------
const failingToday = async () => { throw new Error('Today refresh failed'); };
{
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const key = v2TodayKey('u1');
  qc.setQueryData(key, { projection: 'last-good' });
  const observer = new QueryObserver(qc, { queryKey: key, queryFn: failingToday, retry: false, staleTime: 0 });
  const unsubscribe = observer.subscribe(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 20)); // the initial (stale) fetch fails once
  const outcome = await refreshAfterAcceptedLog(qc, 'u1', '11111111-1111-4111-8111-111111111111').then((r) => ({ threw: false, ...r }), () => ({ threw: true, refreshed: false }));
  await new Promise((resolve) => setTimeout(resolve, 20));
  const state = observer.getCurrentResult();
  unsubscribe();
  check('M1 accepted POST then FAILING Today refetch: the post-accept refresh never throws (the accepted outcome stays accepted)', outcome.threw === false);
  check('M2 the failed refresh leaves Today in error WITH the last projection retained', state.isError === true && (state.data as { projection: string } | undefined)?.projection === 'last-good');
  check('M3 that state is NOT a blocking error, so the screen (and any open logging sheet with its accepted result and key) stays mounted',
    todayBlockingError({ isError: state.isError, data: state.data }) === false && todayBlockingError({ isError: true, data: undefined }) === true && todayBlockingError({ isError: false, data: undefined }) === false);
}
{
  const throwing = { invalidateQueries: async () => { throw new Error('invalidate rejected'); } } as unknown as QueryClient;
  const r = await refreshAfterAcceptedLog(throwing, 'u1', '11111111-1111-4111-8111-111111111111').then((x) => ({ threw: false, refreshed: x.refreshed }), () => ({ threw: true, refreshed: true }));
  check('M4 even a REJECTING invalidation cannot fail an accepted log; it only reports refreshed:false', r.threw === false && r.refreshed === false);
}
check('M5 the screen shows a separate refresh notice whose retry RE-READS Today (refetch), not the submission',
  /today\.isError && \(/.test(screen) && /We couldn&apos;t refresh your day/.test(screen) && /onClick=\{\(\) => void today\.refetch\(\)\}/.test(screen) && /todayBlockingError\(today\)/.test(screen)
  && !/mutate|mutateAsync|useLogActivityV2/.test(screen));
check('M7 the accepted outcome is reported immediately: the mutation never awaits the read-model refresh',
  /void refreshAfterAcceptedLog\(/.test(logHookBody) && !/await refreshAfterAcceptedLog/.test(logHookBody) && !/onSuccess: async/.test(logHookBody));
check('M6 refresh code patches nothing and creates no second mutation or submission key',
  !/setQueryData|useMutation|newClientKey|clientKey/.test(read('src/v2/challenges/refreshAfterAcceptedLog.ts')));

// ---------------------------------------------------------------------------
// N. CORR-C — a fresh detail that no longer permits logging never opens a blank form
// ---------------------------------------------------------------------------
const baseDetail = (over: Partial<V2ChallengeDetail>): V2ChallengeDetail => ({
  challengeId: '11111111-1111-4111-8111-111111111111', groupId: '22222222-2222-4222-8222-222222222222', title: 'T', description: '',
  challengeType: 'collective', status: 'active', startDate: '2026-09-10', endDate: '2026-09-30', timezone: 'Africa/Nairobi',
  governingToday: '2026-09-15', finalized: false, currentConfigVersion: 1, goalValue: null, goalUnit: null, collectiveTotal: 0,
  collectiveGoalReached: false, completionsCount: 0, instructions: '', activatedAt: null, endedAt: null,
  myParticipation: { participationId: 'p1', status: 'active', joinedAt: '2026-09-11T00:00:00.000Z', joinedConfigVersion: 1, progress: {} },
  config: { version: 1, period: { startDate: '2026-09-10', endDate: '2026-09-30' }, requiredConsecutiveDays: null, activities: [
    { canonicalKey: 'push-up', activityVariant: null, activityKind: 'fitness', metric: 'COUNT', targetValue: 20, unit: 'reps' },
  ] },
  ...over,
} as unknown as V2ChallengeDetail);
check('N1 a live Challenge with an active participation and configured activities opens the form', todayLoggingOpen(baseDetail({})) === true);
check('N2 an ended Challenge does not', todayLoggingOpen(baseDetail({ status: 'ended' })) === false);
check('N3 a window-expired but unprocessed Challenge (governing day past the end) does not', todayLoggingOpen(baseDetail({ governingToday: '2026-10-02' })) === false);
check('N4 a finalized Challenge does not', todayLoggingOpen(baseDetail({ finalized: true })) === false);
check('N5 a withdrawn member does not', todayLoggingOpen(baseDetail({ myParticipation: { participationId: 'p1', status: 'withdrawn', joinedAt: '2026-09-11T00:00:00.000Z', joinedConfigVersion: 1, progress: {} } as never })) === false);
check('N6 a member with no participation (or removed) does not',
  todayLoggingOpen(baseDetail({ myParticipation: null })) === false
  && todayLoggingOpen(baseDetail({ myParticipation: { participationId: 'p1', status: 'removed', joinedAt: '2026-09-11T00:00:00.000Z', joinedConfigVersion: 1, progress: {} } as never })) === false);
check('N7 the read-only branch submits nothing and keeps the Challenge reachable (Close; the card still links to the Challenge)',
  /Logging isn&apos;t open for this Challenge right now/.test(screen) && /<V2Button onClick=\{onClose\}>Close<\/V2Button>/.test(screen)
  && !/useLogActivityV2|mutateAsync/.test(screen.slice(screen.indexOf('function TodayLogActivity'), screen.indexOf('/** The three differentiated'))));

if (failures > 0) {
  console.error(`\nS5b Today experience guards: ${failures} failure(s).`);
  process.exitCode = 1;
} else {
  console.log('\nS5b Today experience guards: all passing.');
}
