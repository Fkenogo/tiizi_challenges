/**
 * TIIZI-FER-P1P2-CLOSE-001 — Founder preview triage guards
 * (run: npm run test:v2-triage). Steward-name authorization/projection is proven
 * against PostgreSQL in api/test/s4cDiscoveryInvitations.test.ts.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
let failures = 0;
function check(name: string, ok: boolean) {
  if (ok) console.log(`  ok: ${name}`);
  else { failures += 1; console.error(`  FAIL: ${name}`); }
}

console.log('B1. the site root enters V2; explicit legacy routes stay registered');
const app = read('src/App.tsx');
check('root redirects to /v2 (V2 owns welcome/sign-in/Today entry)', /<Route path="\/" element=\{<Navigate to="\/v2" replace \/>\} \/>/.test(app));
check('root no longer redirects to the legacy /app/welcome', !/path="\/" element=\{<Navigate to="\/app\/welcome"/.test(app));
check('explicit legacy /app/welcome, /app/login and /app/signup routes are untouched',
  /path="\/app\/welcome"/.test(app) && /path="\/app\/login"/.test(app) && /path="\/app\/signup"/.test(app));

console.log('B2. steward sees the requester name from the identity projection');
const reads = read('api/src/groupReads.ts');
check('pending read joins the members identity projection, not a new store', /JOIN members m ON m\.member_id = gm\.member_id/.test(reads) && /m\.display_name/.test(reads));
check('pending read stays steward-only and Group-scoped', /steward_required/.test(reads) && /gm\.group_id=\$1 AND gm\.status='pending'/.test(reads));
check('no email or auth subject is selected for applicants', !/m\.(email|auth_subject)/.test(reads.slice(reads.indexOf('listPendingApplications'))));
const pending = read('src/v2/groups/V2PendingApplications.tsx');
check('UI shows the name with a safe fallback', /applicant\.displayName \?\? 'Tiizi member'/.test(pending));

console.log('B3. new-member Challenges landing keeps Explore on the first screen');
const list = read('src/v2/challenges/V2ChallengeListScreen.tsx');
const empty = list.slice(list.indexOf('No Challenges yet') - 120, list.indexOf('No Challenges yet') + 260);
check('empty state is compact and does not repeat Create Challenge', /compact/.test(empty) && !/action=/.test(empty));
check('Create Challenge stays available in the header; Explore and the list are preserved', /action=\{createAction\}/.test(list) && /<V2ExploreChallenges \/>/.test(list));

console.log('B5. every successful sign-out path ends this member\'s return context');
const gate = read('src/v2/auth/V2MemberBootstrapGate.tsx');
const signIn = read('src/v2/auth/V2SignInPage.tsx');
const flow = read('src/v2/auth/v2SignUpFlow.ts');
check('shared helper runs the cleanup only after logout resolves', flow.indexOf('await logout()') < flow.indexOf('afterSignOut?.()'));
check('bootstrap-failure sign-out clears this uid\'s return context', /signOutThenClearHandoff\(logout, v2SignUpNameHandoff, \(\) => clearChallengeIntent\(uid \?\? undefined\)\)/.test(gate));
check('switch-account sign-out clears this uid\'s return context', /signOutThenClearHandoff\(logout, v2SignUpNameHandoff, \(\) => clearChallengeIntent\(user\?\.uid\)\)/.test(signIn));

if (failures > 0) { console.error(`\nFounder preview triage guards: ${failures} failure(s).`); process.exit(1); }
console.log('\nFounder preview triage guards: all passing.');
