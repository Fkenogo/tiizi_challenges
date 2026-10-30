/**
 * TIIZI-FER-P4-001 — Group Details and Settings guards (run: npm run test:v2-group-details).
 * Q7-dependent culture additions ("what we avoid", creator-defined expectation)
 * are deliberately NOT built and are asserted absent here.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { establishedLabel, memberCountLabel, standaloneStewardLabel } from '../src/v2/groups/groupAboutView';
import { groupProvenanceView } from '../src/v2/groups/groupProvenanceView';
import {
  addCustomInterest, customInterests, interestIssue, interestVocabulary, toggleInterest,
} from '../src/v2/groups/groupInterests';
import { GROUP_FOCUS_AREAS } from '../src/v2/groups/groupFocusAreas';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
let failures = 0;
function check(name: string, ok: boolean) {
  if (ok) console.log(`  ok: ${name}`);
  else { failures += 1; console.error(`  FAIL: ${name}`); }
}
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';

console.log('A. About facts are never fabricated');
check('established date formats a valid timestamp', establishedLabel('2026-03-05T10:00:00.000Z') === '5 March 2026');
check('missing/invalid createdAt shows nothing', establishedLabel(null) === null && establishedLabel('') === null && establishedLabel('not-a-date') === null);
check('member count pluralises and hides when unknown', memberCountLabel(1) === '1 member' && memberCountLabel(8) === '8 members' && memberCountLabel(null) === null && memberCountLabel(undefined) === null);
const unrecorded = groupProvenanceView({ originalCreator: null, steward: { memberId: B } }, { memberId: B, displayName: 'Amani' }, A);
check('legacy Group: creator stays "Not recorded"; Steward name shown separately, never as creator',
  unrecorded?.creatorLabel === 'Not recorded' && standaloneStewardLabel({ steward: { memberId: B } }, { displayName: 'Amani' }, unrecorded, A) === 'Amani');
const distinct = groupProvenanceView({ originalCreator: { memberId: A, displayName: 'Wanjiru' }, steward: { memberId: B } }, { memberId: B, displayName: 'Amani' }, null);
check('creator ≠ Steward: provenance already shows both, no duplicate Steward row',
  distinct?.showSteward === true && standaloneStewardLabel({ steward: { memberId: B } }, { displayName: 'Amani' }, distinct, null) === null);
check('unauthorized viewers (no provenance) get no names', standaloneStewardLabel({ steward: { memberId: B } }, null, null, null) === null);
check('Steward with no visible name uses the neutral label; viewer reads "You"',
  standaloneStewardLabel({ steward: { memberId: B } }, { displayName: null }, unrecorded, A) === 'The Accountable Steward'
  && standaloneStewardLabel({ steward: { memberId: B } }, null, unrecorded, B) === 'You');

console.log('B. Group Interests selection follows the existing contract');
const vocab = interestVocabulary();
check('vocabulary is the governed Wizard list (12) and server options are used when loaded',
  vocab.length === 12 && vocab.length === GROUP_FOCUS_AREAS.length
  && interestVocabulary([{ domain: 'Fitness', label: 'X' }]).length === 1);
check('toggle adds and removes', JSON.stringify(toggleInterest(['Strength'], 'Sleep & Rest')) === '["Strength","Sleep & Rest"]' && toggleInterest(['Strength'], 'Strength').length === 0);
check('saved custom Interest is preserved and recognised', JSON.stringify(customInterests(['Strength', 'Trail Walks'], vocab)) === '["Trail Walks"]');
check('only one other Interest, case-insensitive duplicates ignored, trimmed to 30',
  addCustomInterest(['Trail Walks'], 'Another', vocab).length === 1
  && addCustomInterest(['Strength'], 'strength', vocab).length === 1
  && addCustomInterest([], '  Hiking  ', vocab)[0] === 'Hiking'
  && addCustomInterest([], 'x'.repeat(50), vocab)[0].length === 30);
check('typing a listed Interest in any case selects the listed one, not a custom copy',
  JSON.stringify(addCustomInterest([], 'strength', vocab)) === '["Strength"]' && customInterests(addCustomInterest([], 'strength', vocab), vocab).length === 0);
check('re-toggling a chip (new order) is not a change; legacy stays savable',
  interestIssue(['b', 'a'], ['a', 'b'], vocab) === null);
check('Enter in the Other input adds it instead of submitting the form', read('src/v2/groups/GroupInterestsPicker.tsx').includes("event.key !== 'Enter'"));
check('untouched legacy selection stays savable (even >1 custom)', interestIssue(['a', 'b'], ['a', 'b'], vocab) === null);
check('changed selection enforces 13 cap, one custom, 30 chars, distinct',
  interestIssue(Array.from({ length: 14 }, (_, i) => `t${i}`), [], vocab) !== null
  && interestIssue(['a', 'b'], [], vocab) === 'too_many_custom'
  && interestIssue(['x'.repeat(31)], [], vocab) === 'too_long'
  && interestIssue(['Strength', 'strength'], [], vocab) === 'duplicate'
  && interestIssue(['Strength', 'Trail Walks'], [], vocab) === null);

console.log('C. Wiring, sizing and boundaries');
const home = read('src/v2/groups/V2GroupHomeScreen.tsx');
const settings = read('src/v2/groups/V2GroupSettingsScreen.tsx');
const sheet = read('src/v2/components/V2Primitives.tsx');
check('About uses the existing focused V2Sheet variant (inner scroll, scroll lock, focus trap)', /<V2Sheet open=\{aboutOpen\}[^>]*variant="focused"/.test(home));
check('no nested max-height scroller inside About and no duplicate focus/key handlers', !/max-h-\[72dvh\]/.test(home) && !home.includes("addEventListener('keydown'"));
check('focused sheet panel is a bounded flex column with a fixed header and scrolling body',
  /focused \? 'flex flex-col overflow-hidden'/.test(sheet) && /shrink-0/.test(sheet) && /min-h-0 flex-1 overflow-y-auto/.test(sheet) && /max-h-\[92dvh\]/.test(sheet));
check('About shows Established, Members, Group Interests, Goals, norms, creator/Steward and setup',
  ['Established', 'Group Interests', 'Group Goals', 'Community norms', 'Original creator', 'Group setup'].every(t => home.includes(t)));
check('Settings uses the shared picker, useV2GroupOptions and member copy "Group Interests"',
  settings.includes('GroupInterestsPicker') && settings.includes('useV2GroupOptions') && !/Focus Areas/.test(settings));
check('Settings keeps the focusTags save contract', settings.includes('focusTags, coverId, isPrivate'));
check('Q7 gate: no "what we avoid" vocabulary or creator-defined expectation was added',
  !/what we avoid|creatorExpectation|negativeNorm|avoidNorm/i.test(home + settings + read('src/v2/groups/groupDraft.ts') + read('src/v2/groups/groupInterests.ts')));

if (failures > 0) { console.error(`\nGroup Details/Settings guards: ${failures} failure(s).`); process.exit(1); }
console.log('\nGroup Details/Settings guards: all passing.');
