/**
 * Phase 19A-10M — Guard tests for ShareScreen achievement copy refactor.
 *
 * Root causes fixed:
 * 1. Share text was generic invite copy ("Join me...") — now achievement-based.
 * 2. ChallengeCompletedScreen passed only challengeId/groupId to /app/share —
 *    now passes type, lastValue, lastUnit, myProgress, totalTarget, rank,
 *    teamTotal, teamTarget, streak, totalDays per challenge type.
 * 3. ShareScreen had no access to activity value, type, or progress — now reads
 *    enriched URL params and builds type-specific copy.
 * 4. Preview card was a plain text bubble — now a structured achievement card
 *    with type icon, metrics, and Tiizi branding.
 * 5. WhatsApp text was invite copy — now achievement copy.
 *
 * Image sharing: deferred. html-to-image / dom-to-image add 80–200 KB to the
 * bundle, have known mobile Safari rendering issues, and require CORS-safe
 * asset serving. Text-rich achievement sharing covers the pilot use case.
 * Image share is tracked as a post-pilot follow-up.
 *
 * Run: npx tsx scripts/testShareScreenGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const screen = read('src/features/Share/ShareScreen.tsx');
const completedScreen = read('src/features/Challenges/ChallengeCompletedScreen.tsx');
const workoutLoggedScreen = read('src/features/Workouts/WorkoutLoggedScreen.tsx');

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Share text must NOT contain raw IDs
// ─────────────────────────────────────────────────────────────────────────────
assert.doesNotMatch(screen, /Challenge:\s*\$\{challengeId\}/, 'SHARE: Must NOT embed raw challengeId in share text');
assert.doesNotMatch(screen, /Group:\s*\$\{groupId\}/, 'SHARE: Must NOT embed raw groupId in share text');

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Share text is achievement-based, not generic invite
// ─────────────────────────────────────────────────────────────────────────────
assert.doesNotMatch(
  screen,
  /Join me and stay consistent together/,
  'SHARE: Must NOT use generic invite copy "Join me and stay consistent together"',
);
assert.match(
  screen,
  /I just logged|I just added|Day \$\{streak\} completed|contributing/i,
  'SHARE: Share text must be achievement-based (logged value, day, or contribution)',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Competitive share includes personal progress + rank
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /challengeType === 'competitive'/,
  'SHARE: Must branch on challengeType === "competitive"',
);
assert.match(
  screen,
  /myProgress/,
  'SHARE: Competitive share must reference myProgress for personal progress line',
);
assert.match(
  screen,
  /rank/,
  'SHARE: Competitive share must reference rank',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Collective share includes team progress
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /challengeType === 'collective'/,
  'SHARE: Must branch on challengeType === "collective"',
);
assert.match(
  screen,
  /teamTotal/,
  'SHARE: Collective share must reference teamTotal for team progress line',
);
assert.match(
  screen,
  /Every contribution counts/,
  'SHARE: Collective share must include motivational team line',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Streak share includes current streak / days remaining
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /challengeType === 'streak'/,
  'SHARE: Must branch on challengeType === "streak"',
);
assert.match(
  screen,
  /streak/,
  'SHARE: Streak share must reference streak count',
);
assert.match(
  screen,
  /daysRemaining/,
  'SHARE: Streak share must reference daysRemaining',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Fallback share text is value-forward, not invite
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /I just logged.*Tiizi|I'm making progress.*Tiizi/s,
  'SHARE: Fallback text must be progress-forward, not an invite',
);
assert.doesNotMatch(
  screen,
  /Join me/,
  'SHARE: Fallback must NOT use "Join me" invite language',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: WhatsApp uses same achievement shareText (not separate invite string)
// ─────────────────────────────────────────────────────────────────────────────
assert.match(screen, /wa\.me/, 'SHARE: Must include WhatsApp share link');
assert.match(screen, /encodeURIComponent\(shareText\)/, 'SHARE: WhatsApp must encode the same shareText, not a separate invite');

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Web Share API present
// ─────────────────────────────────────────────────────────────────────────────
assert.match(screen, /navigator\.share/, 'SHARE: Must attempt navigator.share (Web Share API)');

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Copy fallback present
// ─────────────────────────────────────────────────────────────────────────────
assert.match(screen, /navigator\.clipboard\.writeText/, 'SHARE: Copy Text fallback must be present');

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Open Challenge routes to actual challenge detail, not template gallery
// ─────────────────────────────────────────────────────────────────────────────
assert.doesNotMatch(screen, /\/app\/challenges\/preview/, 'SHARE: Must NOT route to /app/challenges/preview (template gallery)');
assert.match(screen, /\/app\/challenge\/\$\{challengeId\}/, 'SHARE: Open Challenge must route to /app/challenge/:challengeId');

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Rich preview card present with type-specific metrics
// ─────────────────────────────────────────────────────────────────────────────
assert.match(screen, /tiizi\.app/, 'SHARE: Preview card must include Tiizi branding footer');
assert.match(screen, /Just logged|Just added/, 'SHARE: Preview card must label the just-logged value');
assert.match(screen, /TypeIcon|Trophy.*Users.*Flame|Flame.*Trophy|Users.*Trophy/s, 'SHARE: Preview card must render a type-specific icon');

// ─────────────────────────────────────────────────────────────────────────────
// RULE: ChallengeCompletedScreen passes enriched params for each type
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  completedScreen,
  /collectiveShare/,
  'COMPLETED: Must define collectiveShare URL with enriched params',
);
assert.match(
  completedScreen,
  /competitiveShare/,
  'COMPLETED: Must define competitiveShare URL with enriched params',
);
assert.match(
  completedScreen,
  /streakShare/,
  'COMPLETED: Must define streakShare URL with enriched params',
);
assert.match(
  completedScreen,
  /type=collective|&type=competitive|&type=streak/,
  'COMPLETED: Enriched share URLs must include &type= param',
);
assert.match(
  completedScreen,
  /lastValue=|lastUnit=/,
  'COMPLETED: Enriched share URLs must include lastValue/lastUnit params',
);
assert.match(
  completedScreen,
  /teamTotal=|teamTarget=/,
  'COMPLETED: Collective share URL must include teamTotal/teamTarget params',
);
assert.match(
  completedScreen,
  /myProgress=|totalTarget=/,
  'COMPLETED: Competitive share URL must include myProgress/totalTarget params',
);
assert.match(
  completedScreen,
  /streak=\$\{currentStreak\}|streak=\$\{streak\}/,
  'COMPLETED: Streak share URL must pass current streak value',
);

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE: share text composition — in-memory simulation
// ─────────────────────────────────────────────────────────────────────────────
{
  function buildShareText(opts: {
    challengeType: string;
    challengeName: string;
    lastValue: number;
    lastUnit: string;
    myProgress: number;
    totalTarget: number;
    unit: string;
    rank: number | null;
    teamTotal: number;
    teamTarget: number;
    streak: number;
    daysRemaining: number | null;
  }): string {
    const { challengeType, challengeName: name, lastValue, lastUnit, myProgress, totalTarget, unit, rank, teamTotal, teamTarget, streak, daysRemaining } = opts;
    const valueStr = lastValue > 0 ? `${lastValue.toLocaleString()} ${lastUnit}`.trim() : null;

    if (challengeType === 'competitive') {
      const progressLine = myProgress > 0 && totalTarget > 0
        ? `\nCurrent progress: ${myProgress.toLocaleString()} / ${totalTarget.toLocaleString()} ${unit}`.trimEnd()
        : myProgress > 0 ? `\nCurrent progress: ${myProgress.toLocaleString()} ${unit}`.trimEnd() : '';
      const rankLine = rank ? `\nRank: #${rank}. 💪` : ' 💪';
      const loggedLine = valueStr ? `I just logged ${valueStr} in ${name} on Tiizi.` : `I'm competing in ${name} on Tiizi.`;
      return `${loggedLine}${progressLine}${rankLine}\n#Tiizi`;
    }
    if (challengeType === 'collective') {
      const loggedLine = valueStr ? `I just added ${valueStr} to ${name} on Tiizi.` : `I contributed to ${name} on Tiizi.`;
      const teamLine = teamTotal > 0 && teamTarget > 0
        ? `\nTeam progress: ${teamTotal.toLocaleString()} / ${teamTarget.toLocaleString()} ${unit}`.trimEnd()
        : teamTotal > 0 ? `\nTeam progress: ${teamTotal.toLocaleString()} ${unit}`.trimEnd() : '';
      return `${loggedLine}${teamLine}\nEvery contribution counts. 🔥\n#Tiizi`;
    }
    if (challengeType === 'streak') {
      const dayLine = streak > 0 ? `Day ${streak} completed in ${name} on Tiizi.` : `I'm on a streak in ${name} on Tiizi.`;
      const streakLine = streak > 0 ? `\nCurrent streak: ${streak} day${streak !== 1 ? 's' : ''}.` : '';
      const remainLine = daysRemaining !== null && daysRemaining > 0 ? `\n${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} to go. 🔥` : daysRemaining === 0 ? '\nStreak complete! 🎉' : ' 🔥';
      return `${dayLine}${streakLine}${remainLine}\n#Tiizi`;
    }
    if (valueStr) return `I just logged ${valueStr} in ${name} on Tiizi. 💪\n#Tiizi`;
    return `I'm making progress in ${name} on Tiizi. 💪\n#Tiizi`;
  }

  // Competitive
  const competitive = buildShareText({ challengeType: 'competitive', challengeName: '7-Day Step Sprint', lastValue: 18200, lastUnit: 'steps', myProgress: 30200, totalTarget: 80000, unit: 'steps', rank: 1, teamTotal: 0, teamTarget: 0, streak: 0, daysRemaining: null });
  assert.ok(competitive.includes('I just logged 18,200 steps'), `FIXTURE competitive: must include logged value. Got: ${competitive}`);
  assert.ok(competitive.includes('30,200 / 80,000 steps'), `FIXTURE competitive: must include progress. Got: ${competitive}`);
  assert.ok(competitive.includes('Rank: #1'), `FIXTURE competitive: must include rank. Got: ${competitive}`);
  assert.ok(competitive.includes('#Tiizi'), `FIXTURE competitive: must include #Tiizi. Got: ${competitive}`);
  assert.ok(!competitive.includes('Join me'), `FIXTURE competitive: must NOT say "Join me". Got: ${competitive}`);

  // Collective
  const collective = buildShareText({ challengeType: 'collective', challengeName: '500k 7-Day March', lastValue: 15500, lastUnit: 'steps', myProgress: 0, totalTarget: 0, unit: 'steps', rank: null, teamTotal: 77600, teamTarget: 500000, streak: 0, daysRemaining: null });
  assert.ok(collective.includes('I just added 15,500 steps'), `FIXTURE collective: must include added value. Got: ${collective}`);
  assert.ok(collective.includes('77,600 / 500,000 steps'), `FIXTURE collective: must include team progress. Got: ${collective}`);
  assert.ok(collective.includes('Every contribution counts'), `FIXTURE collective: must include team motivational line. Got: ${collective}`);
  assert.ok(!collective.includes('Join me'), `FIXTURE collective: must NOT say "Join me". Got: ${collective}`);

  // Streak - ongoing
  const streak = buildShareText({ challengeType: 'streak', challengeName: '7-Day Push-Up Streak', lastValue: 0, lastUnit: '', myProgress: 0, totalTarget: 0, unit: '', rank: null, teamTotal: 0, teamTarget: 0, streak: 1, daysRemaining: 6 });
  assert.ok(streak.includes('Day 1 completed'), `FIXTURE streak: must say "Day 1 completed". Got: ${streak}`);
  assert.ok(streak.includes('Current streak: 1 day'), `FIXTURE streak (singular): must say "1 day". Got: ${streak}`);
  assert.ok(streak.includes('6 days to go'), `FIXTURE streak: must include "6 days to go". Got: ${streak}`);

  // Streak - complete
  const streakDone = buildShareText({ challengeType: 'streak', challengeName: '7-Day Push-Up Streak', lastValue: 0, lastUnit: '', myProgress: 0, totalTarget: 0, unit: '', rank: null, teamTotal: 0, teamTarget: 0, streak: 7, daysRemaining: 0 });
  assert.ok(streakDone.includes('Streak complete'), `FIXTURE streak done: must say "Streak complete". Got: ${streakDone}`);

  // Fallback with value
  const fallback = buildShareText({ challengeType: '', challengeName: 'My Challenge', lastValue: 5000, lastUnit: 'reps', myProgress: 0, totalTarget: 0, unit: '', rank: null, teamTotal: 0, teamTarget: 0, streak: 0, daysRemaining: null });
  assert.ok(fallback.includes('I just logged 5,000 reps'), `FIXTURE fallback: must include value. Got: ${fallback}`);
  assert.ok(!fallback.includes('Join me'), `FIXTURE fallback: must NOT say "Join me". Got: ${fallback}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE: WorkoutLoggedScreen passes lastValue/lastUnit to completion path
// (fixes wellness log gap — wellnessLogs collection is not queried by
//  useChallengeWorkouts, so passing the value as a URL param is the only
//  reliable way to surface it on the recap screen)
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  workoutLoggedScreen,
  /lastValue=\$\{value\}/,
  'WORKOUT_LOGGED: toCompletionPath must pass lastValue=${value} param to ChallengeCompletedScreen',
);
assert.match(
  workoutLoggedScreen,
  /lastUnit=.*encodeURIComponent\(unit\)|lastUnit=.*\$\{encodeURIComponent\(unit\)\}/,
  'WORKOUT_LOGGED: toCompletionPath must pass lastUnit=encodeURIComponent(unit) param to ChallengeCompletedScreen',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: ChallengeCompletedScreen reads sessionLastValue from URL params
// and uses it as the primary source for justLoggedValue and share URLs
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  completedScreen,
  /sessionLastValue/,
  'COMPLETED: Must read sessionLastValue from URL params to support wellness logs',
);
assert.match(
  completedScreen,
  /resolvedLastValue/,
  'COMPLETED: Must derive resolvedLastValue (sessionLastValue ?? lastLoggedWorkout?.value) for share URLs',
);
assert.match(
  completedScreen,
  /sessionLastValue !== null.*lastLoggedWorkout|lastLoggedWorkout.*sessionLastValue !== null/s,
  'COMPLETED: justLoggedValue must prefer sessionLastValue over lastLoggedWorkout',
);

console.log('✅ All Phase 19A-10M share screen guards passed.');
