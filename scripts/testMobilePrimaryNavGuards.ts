/**
 * TIIZI-MOBILE-PRIMARY-NAV-CORR-001 — mobile primary navigation guard
 * (run: npm run test:mobile-primary-nav).
 *
 * The web app has no rendered-component test runner; like the other guard
 * scripts this file proves the responsive-shell contract statically, and the
 * rendered behaviour is proven separately in a real browser (mobile widths).
 *
 * Proves:
 * A. desktop primary navigation (Today / Challenges / Groups) still renders;
 * B. mobile has a discoverable primary navigation (bottom member bar) that
 *    exposes Today, Challenges and Groups;
 * C. the active destination is represented in both navigations;
 * D. navigation destinations are exactly /v2/today, /v2/challenges, /v2/groups;
 * E. mobile navigation does not depend on any public/Cloudflare URL;
 * F. authenticated landing behaviour is unchanged (index -> today, guarded);
 * G. no product routes were added by this correction;
 * H. root cause is closed: the Firebase emulator banner (fixed bottom,
 *    z-index 10000) can no longer be injected to occlude the mobile nav.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ok: ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const shell = read('src/v2/member/MemberShell.tsx');
const routes = read('src/v2/routes.tsx');
const emulators = read('src/lib/firebaseEmulators.ts');

// ─── A. Desktop primary navigation still renders ──────────────────────────
console.log('A. desktop primary navigation');
check('desktop primary nav element exists', shell.includes('aria-label="Primary"'));
check('desktop primary nav is md:flex (shown from tablet up)', /hidden[^"]*md:flex/.test(shell));
check('desktop primary nav maps the PRIMARY items', /PRIMARY\.map/.test(shell));

// ─── B. Mobile discoverable primary navigation ────────────────────────────
console.log('B. mobile primary navigation');
check('mobile member nav element exists', shell.includes('aria-label="Member"'));
check('mobile member nav is md:hidden (shown on phones)', /md:hidden/.test(shell));
check('mobile member nav is fixed to the bottom', /fixed[^"]*bottom-0/.test(shell));
check('mobile member nav maps the PRIMARY items', /\[\.\.\.PRIMARY/.test(shell));
for (const [label, to] of [['Today', '/v2/today'], ['Challenges', '/v2/challenges'], ['Groups', '/v2/groups']] as const) {
  check(`mobile primary item present: ${label}`, shell.includes(`to: '${to}'`) && shell.includes(`key: '${label.toLowerCase()}'`));
}

// ─── C. Active state represented ──────────────────────────────────────────
console.log('C. active state');
const isActiveCount = (shell.match(/isActive/g) ?? []).length;
check('NavLink isActive used by both navigations (>= 3 usages)', isActiveCount >= 3, `found ${isActiveCount}`);
check('mobile active indicator bar uses isActive', /isActive \? 'bg-primary'/.test(shell));

// ─── D. Destinations are correct and bounded ──────────────────────────────
console.log('D. destinations');
for (const to of ['/v2/today', '/v2/challenges', '/v2/groups']) {
  check(`route target ${to} defined`, shell.includes(`'${to}'`));
}

// ─── E. No public/Cloudflare dependency in the shell ──────────────────────
console.log('E. no public URL dependency');
check('shell has no trycloudflare reference', !/trycloudflare/i.test(shell));
check('shell has no absolute origin (http/https) literal', !/https?:\/\//.test(shell));
check('shell has no hardcoded localhost', !/localhost|127\.0\.0\.1/.test(shell));

// ─── F. Authenticated landing behaviour unchanged ─────────────────────────
console.log('F. authenticated landing');
check('member index redirects to today', /<Route index element=\{<Navigate to="today" replace \/>\}/.test(routes));
check('member routes wrapped by authenticated scope', routes.includes('V2Authenticated'));
check('member routes wrapped by member shell', routes.includes('<V2MemberShell />'));

// ─── G. No new product routes introduced ──────────────────────────────────
console.log('G. route surface unchanged');
const memberBlock = routes.split('<V2MemberShell />}>')[1]?.split('<Route path="operator"')[0] ?? '';
const memberPaths = [...memberBlock.matchAll(/<Route path="([^"]+)" element=\{<(V2[A-Za-z]+)/g)].map((m) => `${m[1]}:${m[2]}`);
const expectedMember = [
  'today:V2TodayPage',
  'challenges:V2ChallengeListScreen',
  'challenges/new:V2ChallengeCreationWizard',
  'challenges/:challengeId:V2CreatedChallengeScreen',
  'groups:V2GroupsScreen',
  'groups/new:V2CreateGroupScreen',
  'guide:V2GuidePage',
  'profile:V2ProfilePage',
  'notifications:V2NotificationsPage',
];
check(
  'member route set is exactly the known nine (no additions)',
  JSON.stringify(memberPaths) === JSON.stringify(expectedMember),
  JSON.stringify(memberPaths),
);

// ─── H. Root cause closed: emulator banner cannot occlude the nav ─────────
console.log('H. root cause (emulator banner) closed');
check(
  'connectAuthEmulator disables the SDK warning banner',
  /connectAuthEmulator\(\s*auth,\s*AUTH_EMULATOR_URL,\s*\{\s*disableWarnings:\s*true\s*\}\s*\)/.test(emulators),
);

if (failures > 0) {
  console.error(`\nMobile primary navigation guard: ${failures} failure(s).`);
  process.exit(1);
}
console.log('\nMobile primary navigation guard: all passing.');
