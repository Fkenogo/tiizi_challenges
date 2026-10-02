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
 *   F. the screen renders no deferred/unsupported capability.
 */
import { readFileSync } from 'node:fs';
import {
  challengeTypeLabel,
  formatAmount,
  formatGoverningDay,
  governingDayFor,
  greetingFor,
  isTodayEmpty,
  opportunityAction,
  progressPercent,
  raceActivitySummary,
  requirementProgress,
  serverHour,
  togetherSummary,
  upcomingSummary,
} from '../src/v2/today/todayView.js';
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
  screen.includes('Nothing needs you today') && screen.includes("navigate('/v2/challenges')"),
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

if (failures > 0) {
  console.error(`\nS5b Today experience guards: ${failures} failure(s).`);
  process.exitCode = 1;
} else {
  console.log('\nS5b Today experience guards: all passing.');
}
