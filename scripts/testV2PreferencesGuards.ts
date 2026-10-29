/**
 * TIIZI-FER-P1B-001 — Interests & Goals frontend guards
 * (run: npm run test:v2-preferences). Server/DB behaviour is covered by
 * api/test/memberPreferences.test.ts.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryClient } from '@tanstack/react-query';
import { resolveV2NextPath } from '../src/v2/auth/v2NextPath';
import {
  PREFERENCES_DISCOVERY_PATH,
  afterPreferencesPath,
  atLimit,
  groupInterestsByDomain,
  sameSelection,
  toggleSelection,
} from '../src/v2/preferences/preferencesView';
import { removeV2MemberPreferences, v2MemberPreferencesKey } from '../src/v2/preferences/preferencesQuery';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) console.log(`  ok: ${name}`);
  else { failures += 1; console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`); }
}

console.log('A. selection bounds (UX; server and database re-prove them)');
let sel: string[] = [];
for (const id of ['a', 'b', 'c', 'd', 'e']) sel = toggleSelection(sel, id, 5);
check('five Interests can be chosen', sel.length === 5 && atLimit(sel, 5));
check('a sixth is refused', toggleSelection(sel, 'f', 5).length === 5 && !toggleSelection(sel, 'f', 5).includes('f'));
check('removing frees a slot', toggleSelection(sel, 'c', 5).length === 4 && !atLimit(toggleSelection(sel, 'c', 5), 5));
let goals: string[] = [];
for (const id of ['x', 'y', 'z']) goals = toggleSelection(goals, id, 3);
check('three Goals can be chosen and a fourth is refused', goals.length === 3 && toggleSelection(goals, 'w', 3).length === 3);
check('an empty selection is representable', toggleSelection(['a'], 'a', 5).length === 0);
check('selection equality is order-insensitive', sameSelection(['a', 'b'], ['b', 'a']) && !sameSelection(['a'], ['a', 'b']) && sameSelection([], []));
check('Interests group by domain in vocabulary order',
  JSON.stringify(groupInterestsByDomain([
    { id: '1', label: 'A', domain: 'Fitness' }, { id: '2', label: 'B', domain: 'Wellness' }, { id: '3', label: 'C', domain: 'Fitness' },
  ]).map((g) => [g.domain, g.items.map((i) => i.id)])) === JSON.stringify([['Fitness', ['1', '3']], ['Wellness', ['2']]]));

console.log('B. registration → preferences → discovery handoff');
check('default landing continues to discovery', afterPreferencesPath('/v2/today') === PREFERENCES_DISCOVERY_PATH && PREFERENCES_DISCOVERY_PATH === '/v2/groups?tab=discover');
check('an explicit requested page is preserved as the return path', afterPreferencesPath('/v2/groups/abc') === '/v2/groups/abc');
check('hostile return paths fall back safely', resolveV2NextPath('https://evil.example/v2/today') === '/v2/today' && resolveV2NextPath('/app/home') === '/v2/today');
const groupsScreen = read('src/v2/groups/V2GroupsScreen.tsx');
check('Groups opens on the Discover tab for ?tab=discover', /searchParams\.get\('tab'\) === 'discover'/.test(groupsScreen));

console.log('C. account isolation and cache');
const qc = new QueryClient();
qc.setQueryData(v2MemberPreferencesKey('uid-a'), { interestIds: ['strength'] });
qc.setQueryData(v2MemberPreferencesKey('uid-b'), { interestIds: ['sleep_rest'] });
await removeV2MemberPreferences(qc, 'uid-a');
check('removing one member\'s preferences leaves another member\'s untouched',
  qc.getQueryData(v2MemberPreferencesKey('uid-a')) === undefined && !!qc.getQueryData(v2MemberPreferencesKey('uid-b')));
check('the member uid is part of the cache key', v2MemberPreferencesKey('u')[1] === 'u');
const routes = read('src/v2/routes.tsx');
check('account switch removes the previous member\'s preferences', /removeV2MemberPreferences\(queryClient, priorUid\)/.test(routes));
check('sign-out clears the whole query cache', /queryClient\.clear\(\)/.test(read('src/v2/profile/useV2SignOut.ts')));
const hook = read('src/v2/preferences/usePreferences.ts');
check('a save writes only the signed-in member\'s cache slot', /if \(uid\) queryClient\.setQueryData\(v2MemberPreferencesKey\(uid\), saved\)/.test(hook));

console.log('D. transport and persistence');
const api = read('src/api/preferencesApi.ts');
check('uses PUT/GET /me/preferences and never sends a member id', /apiPath\('\/me\/preferences'\)/.test(api) && /method: 'PUT'/.test(api) && !/memberId|uid|email/i.test(api.replace(/^\s*\*.*$/gm, '')));
const prefFiles = ['src/v2/preferences/usePreferences.ts', 'src/v2/preferences/V2PreferencesSetupScreen.tsx', 'src/v2/preferences/ProfilePreferencesSection.tsx', 'src/v2/preferences/PreferencePickers.tsx', 'src/api/preferencesApi.ts'].map(read).join('\n');
check('no Firebase/Firestore/localStorage persistence of preferences', !/firestore|firebase\/|localStorage|indexedDB/i.test(prefFiles));

console.log('E. optional, never a gate');
const prompt = read('src/v2/preferences/V2PreferencesPrompt.tsx');
check('prompt redirects at most once per session and never once decided',
  /alreadyPrompted\(uid\)/.test(prompt) && /markPrompted\(uid\)/.test(prompt) && /data\.interestsDecided && data\.goalsDecided/.test(prompt));
check('prompt fails open (no redirect without a successful read) and exempts the Operator console',
  /if \(!uid \|\| !data\) return;/.test(prompt) && /\/v2\/operator/.test(prompt));
check('prompt is a null-rendering component, not a route guard', /return null;/.test(prompt) && !/<Navigate\b/.test(prompt));
const setup = read('src/v2/preferences/V2PreferencesSetupScreen.tsx');
check('Interests and Goals are separate, independently skippable steps', /Skip for now/.test(setup) && /step === 'interests'|isInterests/.test(setup) && /goalsDecided/.test(setup) && /interestsDecided/.test(setup));
check('skip records an empty decision but never erases an already-decided selection',
  /chosen === null && data\.interestsDecided/.test(setup) && /chosen === null && data\.goalsDecided/.test(setup) && /chosen \?\? \[\]/.test(setup));
check('load failure still lets the member continue', /Continue without choosing/.test(setup));
check('Continue needs a choice; skipping needs none', /selected\.length === 0/.test(setup));
check('no preference value is read by any eligibility, join or participation code',
  !/preferences|interestIds|goalIds/i.test(read('src/v2/challenges/V2ParticipationSection.tsx') + read('src/v2/groups/V2GroupInvitePanel.tsx')));

console.log('F. Profile editing');
const section = read('src/v2/preferences/ProfilePreferencesSection.tsx');
check('Profile can save, clear all, and re-edit from server state', /Save/.test(section) && /Clear all/.test(section) && /setInterests\(data\.interestIds\)/.test(section));
check('Profile seeds the editor once per member and never wipes a save confirmation or unsaved edits', /seededFor\.current === uid/.test(section) && !/setMessage\(null\);\s*\}, \[uid, data\?/.test(section) && !/eslint-disable/.test(section));
check('Profile saves only the side(s) that changed (never records an untouched side as decided)', /change\.interestIds = nextInterests/.test(section) && /change\.goalIds = nextGoals/.test(section) && /!sameSelection\(nextInterests, data\.interestIds\)/.test(section));
check('Profile uses the same pickers as onboarding', /InterestsPicker/.test(section) && /GoalsPicker/.test(section) && /InterestsPicker/.test(setup));
const profile = read('src/v2/profile/V2ProfileScreen.tsx');
check('Profile renders the section in its agreed slot (before Support Tiizi and the journey)',
  profile.indexOf('<ProfilePreferencesSection') > 0 && profile.indexOf('<ProfilePreferencesSection') < profile.indexOf('data-profile-slot="support-tiizi"') && profile.indexOf('data-profile-slot="support-tiizi"') < profile.indexOf('My Tiizi Journey'));
check('Support Tiizi is the P8a navigation card; no Interests & Goals dev marker remains', /data-profile-slot="support-tiizi"/.test(profile) && /<V2SupportTiiziCard \/>/.test(profile) && !/slot="interests-goals"/.test(profile));
check('no member-facing "coming soon" wording', !/coming soon/i.test(prefFiles + profile));
const pickers = read('src/v2/preferences/PreferencePickers.tsx');
check('chips are accessible toggle buttons and the limit is explained', /aria-pressed/.test(pickers) && /remove one to choose another/.test(pickers) && /aria-live="polite"/.test(pickers));

if (failures > 0) { console.error(`\nP1b preferences guards: ${failures} failure(s).`); process.exit(1); }
console.log('\nP1b preferences guards: all passing.');
