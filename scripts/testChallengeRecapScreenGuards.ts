/**
 * Phase 19A-10M — Guard tests for ChallengeCompletedScreen recap refactor.
 *
 * Root causes fixed:
 * 1. All v2 types showed "Points" — removed.
 * 2. Headings were hardcoded "Complete!" even for ongoing challenges — now dynamic.
 * 3. Streak showed "Missed Days" and "0% Consistency" on day 1 — now guarded by daysElapsed.
 * 4. Streak showed rank/points in the days grid — both removed.
 * 5. Collective showed "Your Share" as 0% when no contribution yet — now hidden if 0.
 * 6. Competitive hero showed total cumulative progress ("Overall Progress") — now shows
 *    most-recent logged value ("Just logged") from lastLoggedWorkout, with fallback to
 *    cumulativeLoggedValue labeled "Progress".
 * 7. Competitive per-activity breakdown section (repeated progress bars) removed — total
 *    progress is already shown in the Current Standing card.
 * 8. Streak subline used hardcoded "30-Day Sprint" title fallback — now uses totalDays
 *    derived from challenge.durationDays or startDate/endDate: "Day N of M done. Keep going."
 * 9. title fallback was '30-Day Sprint' — replaced with challenge?.name || 'this challenge'.
 *
 * Run: npx tsx scripts/testChallengeRecapScreenGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const screen = read('src/features/Challenges/ChallengeCompletedScreen.tsx');

// ─────────────────────────────────────────────────────────────────────────────
// RULE: No "Points" label in v2 sections
// ─────────────────────────────────────────────────────────────────────────────
assert.doesNotMatch(
  screen,
  />Points<\/p>\s*<p[^>]*>\s*\{membership\?\.totalPoints/,
  'RECAP: v2 recap must NOT render a Points stat cell using membership.totalPoints',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Dynamic headings — isOngoing drives header copy
// ─────────────────────────────────────────────────────────────────────────────
assert.match(screen, /isOngoing/, 'RECAP: Screen must compute isOngoing to drive dynamic headings');
assert.match(screen, /isChallengeOngoing/, 'RECAP: Must use isChallengeOngoing from challengeLifecycle');
assert.match(
  screen,
  /isOngoing.*?Your Progress|Your Progress.*?isOngoing/s,
  'RECAP: Competitive header must say "Your Progress" when ongoing',
);
assert.match(
  screen,
  /isOngoing.*?Your progress|Your progress.*?isOngoing/s,
  'RECAP: Heading must reference "Your progress so far" for ongoing state',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Both collective and competitive heroes show "Just logged" value
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /lastLoggedWorkout|justLoggedValue/,
  'RECAP: Heroes must use lastLoggedWorkout / justLoggedValue for "Just logged" display',
);
assert.match(
  screen,
  /Just logged/,
  'RECAP: Hero must label the most-recent value as "Just logged"',
);
assert.doesNotMatch(
  screen,
  /Overall Progress/,
  'RECAP: Competitive hero must NOT label the hero as "Overall Progress"',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Collective hero — justLoggedValue as primary metric; no "Team Goal" / "Collective" pill / percentage
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /justLoggedValue/,
  'RECAP: Collective hero must use justLoggedValue as the primary displayed metric',
);
assert.doesNotMatch(
  screen,
  />\s*\{groupPct\}%\s*<\/div>\s*<p[^>]*>\s*Team Goal/s,
  'RECAP: Collective hero must NOT render "{groupPct}% / Team Goal" as the primary hero metric',
);
assert.doesNotMatch(
  screen,
  /font-black text-white">\s*\n?\s*Collective\s*\n?\s*<\/div>/,
  'RECAP: Collective hero must NOT render a "Collective" type pill inside the hero circle',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Competitive — per-activity breakdown section (repeated progress bars) removed
// ─────────────────────────────────────────────────────────────────────────────
assert.doesNotMatch(
  screen,
  /competitiveActivities\.map\(/,
  'RECAP: Competitive per-activity breakdown section must be removed — progress bars repeat cumulative data already in Standing card',
);
assert.doesNotMatch(
  screen,
  /Per-activity breakdown/,
  'RECAP: "Per-activity breakdown" comment must be removed along with its section',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Competitive — Standing card still renders rank and cumulative progress
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /Current Standing|Final Results/,
  'RECAP: Competitive Standing card section header must still be present',
);
assert.match(
  screen,
  /cumulativeLoggedValue\.toLocaleString\(\)/,
  'RECAP: Competitive Standing card must still render cumulativeLoggedValue as total progress',
);
assert.match(
  screen,
  /myRank/,
  'RECAP: Competitive Standing card must still render rank',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Streak — missed days guarded by daysElapsed > 1
// ─────────────────────────────────────────────────────────────────────────────
assert.match(screen, /daysElapsed/, 'RECAP: Streak must compute daysElapsed since challenge start');
assert.match(screen, /daysElapsed > 1/, 'RECAP: Missed days section must only render when daysElapsed > 1');
assert.doesNotMatch(
  screen,
  /missedDays\s*=\s*Math\.max\(0,\s*totalDays\s*-\s*uniqueDays\)/,
  'RECAP: missedDays must NOT be computed as (totalDays - uniqueDays) — wrong on day 1',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Streak — consistency % guarded (only shown when daysElapsed > 0)
// ─────────────────────────────────────────────────────────────────────────────
assert.match(screen, /consistencyScore\s*!==\s*null/, 'RECAP: Consistency score must be null-guarded');
assert.match(screen, /daysElapsed > 0/, 'RECAP: Consistency score must only compute when daysElapsed > 0');

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Collective hero shows "Just logged" value — no "Team Goal", no percentage, no pill
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /Just logged/,
  'RECAP: Collective hero must show "Just logged" label for the activity value',
);
// justLoggedValue is the primary branch — Team Goal and Collective pill are gone entirely.
assert.match(
  screen,
  /justLoggedValue[\s\S]*?Just logged/,
  'RECAP: Collective hero must render justLoggedValue in the primary branch with "Just logged" label',
);
// "Team Goal Achieved!" is still used as headerLabel (fine), but must not appear
// as a <p> label inside the hero circle metric area.
assert.doesNotMatch(
  screen,
  /<p[^>]*>\s*Team Goal\s*<\/p>/,
  'RECAP: Collective hero must NOT render "Team Goal" as a <p> metric label — it was replaced by justLoggedValue / "Just logged"',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Collective Team Progress card still shows team total and percentage
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /Team Progress|Final Team Progress/,
  'RECAP: Collective Team Progress card section header must remain',
);
assert.match(
  screen,
  /groupCurrentTotal\.toLocaleString\(\)/,
  'RECAP: Collective Team Progress card must still render groupCurrentTotal',
);
assert.match(
  screen,
  /groupPct/,
  'RECAP: Collective Team Progress card must still render groupPct',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Collective — "Your Share" only shown when myContributionPct > 0
// ─────────────────────────────────────────────────────────────────────────────
assert.match(screen, /myContributionPct > 0/, 'RECAP: Collective "Your Share" must be gated by myContributionPct > 0');

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Share Achievement button present on all v2 types (collective, competitive, streak)
// ─────────────────────────────────────────────────────────────────────────────
const shareButtonMatches = (screen.match(/Share Achievement/g) ?? []).length;
assert.ok(
  shareButtonMatches >= 3,
  `RECAP: Share Achievement button must appear at least 3 times (one per v2 type), got ${shareButtonMatches}`,
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: isChallengeOngoing is imported
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /import.*isChallengeOngoing.*challengeLifecycle/,
  'RECAP: isChallengeOngoing must be imported from challengeLifecycle',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: No hardcoded "30-Day Sprint" fallback anywhere in the file
// ─────────────────────────────────────────────────────────────────────────────
assert.doesNotMatch(
  screen,
  /30-Day Sprint/,
  'RECAP: Must NOT contain hardcoded "30-Day Sprint" — title must come from challenge data or safe fallback',
);
assert.doesNotMatch(
  screen,
  /'30-Day'/,
  'RECAP: Must NOT contain hardcoded "30-Day" string literal as a fallback',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: title fallback uses challenge?.name, not a hardcoded challenge name
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /challenge\?\.name/,
  'RECAP: title fallback must reference challenge?.name so actual challenge name is used',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Streak subline uses totalDays for "Day N of M" copy, not title
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /durationLabel|of \$\{totalDays\}/,
  'RECAP: Streak ongoing subline must use totalDays to form "Day N of M done" — not title string',
);
assert.match(
  screen,
  /Keep going\./,
  'RECAP: Streak ongoing subline must end with "Keep going."',
);
assert.doesNotMatch(
  screen,
  /Day \$\{currentStreak\} done on the \$\{title\}/,
  'RECAP: Streak subline must NOT use "done on the ${title}" — causes "30-Day Sprint" bleed',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: totalDays prefers challenge.durationDays when available
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /challenge\.durationDays/,
  'RECAP: totalDays must check challenge.durationDays first before computing from dates',
);

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE: streak copy logic — in-memory simulation
// ─────────────────────────────────────────────────────────────────────────────
{
  function buildStreakSubline(isOngoing: boolean, currentStreak: number, totalDays: number, title: string): string {
    const durationLabel = totalDays > 0 ? ` of ${totalDays}` : '';
    if (isOngoing) return `Day ${currentStreak}${durationLabel} done. Keep going.`;
    if (totalDays > 0) return `You completed ${totalDays} days of the streak. Well done.`;
    return `You showed up. That's what the ${title} was about.`;
  }

  // 7-day streak, day 2, ongoing
  assert.equal(
    buildStreakSubline(true, 2, 7, '7-Day Push-Up Streak'),
    'Day 2 of 7 done. Keep going.',
    'FIXTURE: 7-day streak ongoing must say "Day 2 of 7 done. Keep going."',
  );
  // 14-day streak, day 5, ongoing
  assert.equal(
    buildStreakSubline(true, 5, 14, '14-Day Run Streak'),
    'Day 5 of 14 done. Keep going.',
    'FIXTURE: 14-day streak ongoing must say "Day 5 of 14 done. Keep going."',
  );
  // 30-day streak, completed
  assert.equal(
    buildStreakSubline(false, 30, 30, '30-Day Sprint'),
    'You completed 30 days of the streak. Well done.',
    'FIXTURE: 30-day completed streak must say "You completed 30 days of the streak. Well done."',
  );
  // No duration known (fallback)
  assert.equal(
    buildStreakSubline(false, 7, 0, 'My Streak'),
    "You showed up. That's what the My Streak was about.",
    'FIXTURE: When totalDays is 0, completed subline falls back to title-based copy',
  );
  // Must NOT contain "30-Day Sprint" when title is "7-Day Push-Up Streak"
  const result = buildStreakSubline(true, 2, 7, '7-Day Push-Up Streak');
  assert.ok(!result.includes('30-Day Sprint'), 'FIXTURE: subline must not bleed in "30-Day Sprint"');
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Collective and streak sections intact (regression check)
// ─────────────────────────────────────────────────────────────────────────────
assert.match(screen, /Team Progress|Team Goal Achieved/, 'RECAP: Collective section must still render');
assert.match(screen, /Streak in Progress|Streak Complete/, 'RECAP: Streak section must still render');
assert.match(screen, /groupPct/, 'RECAP: Collective team progress percentage must still be used');
assert.match(screen, /currentStreak/, 'RECAP: Streak section must still reference currentStreak');

// ─────────────────────────────────────────────────────────────────────────────
// RULE: RecapNavActions shared component exists (DRY across all 3 v2 variants)
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /RecapNavActions/,
  'NAV: RecapNavActions component must exist to share nav layout across all v2 recap variants',
);
assert.match(
  screen,
  /function RecapNavActions/,
  'NAV: RecapNavActions must be defined as a function component',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Share Achievement remains the primary CTA (st-btn-primary)
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /st-btn-primary[\s\S]{0,60}Share Achievement/,
  'NAV: Share Achievement must use st-btn-primary (primary orange button)',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: View Leaderboard is an outlined secondary button (not st-btn-secondary)
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /View Leaderboard/,
  'NAV: View Leaderboard button must be present',
);
assert.doesNotMatch(
  screen,
  /st-btn-secondary[\s\S]{0,40}View Leaderboard|View Leaderboard[\s\S]{0,40}st-btn-secondary/s,
  'NAV: View Leaderboard must NOT use st-btn-secondary — must use outlined secondary styles',
);
// The border and bg-white classes live in the shared secondaryClass constant.
// Verify the constant's value contains both, then verify View Leaderboard uses it.
assert.match(
  screen,
  /secondaryClass[\s\S]{0,150}border/,
  'NAV: secondaryClass must include a border class (used by View Leaderboard and Back to Group buttons)',
);
assert.match(
  screen,
  /secondaryClass[\s\S]{0,150}bg-white/,
  'NAV: secondaryClass must include bg-white',
);
assert.match(
  screen,
  /className=\{secondaryClass\}[\s\S]{0,200}View Leaderboard/s,
  'NAV: View Leaderboard button must apply secondaryClass',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Back to Group is an outlined secondary button alongside Leaderboard
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /Back to Group/,
  'NAV: Back to Group button must be present',
);
assert.doesNotMatch(
  screen,
  /st-btn-secondary[\s\S]{0,40}Back to Group|Back to Group[\s\S]{0,40}st-btn-secondary/s,
  'NAV: Back to Group must NOT use st-btn-secondary — must use outlined secondary styles',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Leaderboard and Back to Group share same button class (equal widths)
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /grid-cols-2[\s\S]{0,200}View Leaderboard[\s\S]{0,200}Back to Group/s,
  'NAV: View Leaderboard and Back to Group must sit in a grid-cols-2 layout (equal widths, side-by-side)',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Go to Home is a tertiary text action (not a full button)
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /Go to Home/,
  'NAV: Go to Home must be present',
);
assert.doesNotMatch(
  screen,
  /st-btn-primary[\s\S]{0,40}Go to Home|Go to Home[\s\S]{0,40}st-btn-primary/s,
  'NAV: Go to Home must NOT use st-btn-primary',
);
assert.doesNotMatch(
  screen,
  /st-btn-secondary[\s\S]{0,40}Go to Home|Go to Home[\s\S]{0,40}st-btn-secondary/s,
  'NAV: Go to Home must NOT use st-btn-secondary — must be a muted tertiary text action',
);
// Go to Home lives inside RecapNavActions and uses text-slate-400 on its button className
assert.match(
  screen,
  /text-slate-400 active:opacity-60[\s\S]{0,200}Go to Home/s,
  'NAV: Go to Home must use muted slate text (tertiary style)',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Icons — Trophy for Leaderboard, Users for Back to Group, Home for Go to Home
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /Trophy[\s\S]{0,200}View Leaderboard/s,
  'NAV: Trophy icon must accompany View Leaderboard',
);
assert.match(
  screen,
  /Users[\s\S]{0,200}Back to Group/s,
  'NAV: Users icon must accompany Back to Group',
);
assert.match(
  screen,
  /Home[\s\S]{0,200}Go to Home/s,
  'NAV: Home icon must accompany Go to Home',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: All three v2 variants use RecapNavActions (no duplicate nav code)
// ─────────────────────────────────────────────────────────────────────────────
const recapNavMatches = (screen.match(/RecapNavActions/g) ?? []).length;
assert.ok(
  recapNavMatches >= 4,
  `NAV: RecapNavActions must appear at least 4 times (1 definition + 3 variant usages), got ${recapNavMatches}`,
);

console.log('✅ All Phase 19A-10M challenge recap screen guards passed.');
