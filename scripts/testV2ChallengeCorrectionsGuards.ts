/**
 * TIIZI-FER-P5-001 — Challenge experience corrections (run: npm run test:v2-challenge-corrections).
 * Wording/layout only: canonical unit values, scoring, logging and recognition are untouched.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unitLabel, metricLabel, VISIBLE_STEP_META } from '../src/v2/challenges/challengeCreationDraft';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
let failures = 0;
function check(name: string, ok: boolean) {
  if (ok) console.log(`  ok: ${name}`);
  else { failures += 1; console.error(`  FAIL: ${name}`); }
}

console.log('A. member-facing wording');
check('step 3 is "Name & Appearance"', VISIBLE_STEP_META.CHALLENGE_DETAILS.eyebrow === 'Name & Appearance');
check('canonical reps/repetitions units display as "reps"', unitLabel('reps') === 'reps' && unitLabel('repetitions') === 'reps' && metricLabel('repetitions') === 'Reps');
check('other unit labels are unchanged', unitLabel('minutes') === 'minutes' && unitLabel('kilometres') === 'kilometres' && unitLabel('unknown_unit') === 'unknown_unit' && unitLabel(null) === '');
const draft = read('src/v2/challenges/challengeCreationDraft.ts');
check('canonical unit values are not rewritten (still keyed by reps/repetitions)', /reps: 'reps'/.test(draft) && /repetitions: 'reps'/.test(draft) && draft.includes("if (metric === 'repetitions')") === false);

const wizard = read('src/v2/challenges/V2ChallengeCreationWizard.tsx');
console.log('B. hosting Group selector');
check('eligible Groups appear on search focus and refine while typing',
  wizard.includes('onFocus={() => setListOpen(true)}') && wizard.includes("(listOpen || search.trim() !== '') && <ul aria-label=\"Matching host Groups\"") && wizard.includes('const filtered = eligible.filter'));
check('only eligible Groups feed the list (governed filter kept; no new Group source)',
  wizard.includes("membership.group.allowMemberChallenges !== false") && wizard.includes("['owner', 'admin', 'steward']") && wizard.includes('useV2Memberships'));
check('selected Group is preserved and shown', wizard.includes('Selected Group: {state.groupName}'));
check('Support a Cause and Support Tiizi are explained as distinct; no new payment fields',
  wizard.includes('Support a Cause is for a cause this Challenge raises support for. Support Tiizi is separate'));

const hero = read('src/v2/challenges/V2ChallengeHero.tsx');
console.log('C. Challenge Detail');
check('description expands and collapses inline (Read more / Read less, aria-expanded + aria-controls)',
  hero.includes("'Read less'") && hero.includes("'Read more'") && hero.includes('aria-controls="challenge-description"') && !hero.includes('V2Sheet'));
check('actions sit beneath the description (column on mobile, row from sm)',
  hero.indexOf('Read less') < hero.indexOf('+ Log activity') && /flex flex-col gap-2 sm:flex-row sm:items-center/.test(hero) && !/p-5 sm:flex-row/.test(hero));
check('logging and Leave gates are unchanged (still driven by loggable/showLeave props)',
  hero.includes('{(loggable || showLeave) && (') && hero.includes('{loggable && (') && hero.includes('{showLeave && ('));

console.log('D. boundaries');
const changedScope = [hero, wizard, draft].join('\n');
check('no payment/destination/transfer workflow added', !/stripe|mpesa|m-pesa|transfer funds|createPayment/i.test(changedScope));
if (failures > 0) { console.error(`\nChallenge corrections guards: ${failures} failure(s).`); process.exit(1); }
console.log('\nChallenge corrections guards: all passing.');
