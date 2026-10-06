/**
 * TIIZI-MOBILE-PRIMARY-NAV-CORR-001 / CORR-002 — mobile primary navigation guard
 * (run: npm run test:mobile-primary-nav).
 *
 * The web app has no rendered-component test runner; like the other guard
 * scripts this file proves the responsive-shell contract statically, and the
 * rendered behaviour is proven separately in a real browser (mobile widths).
 *
 * Proves:
 * A. desktop primary navigation is exactly Today / Challenges / Groups;
 * B. mobile primary navigation is EXACTLY Today / Challenges / Groups —
 *    Activity Guide and Profile are NOT primary mobile destinations;
 * C. the active destination is represented in both navigations;
 * D. Activity Guide remains reachable as a contextual secondary entry
 *    (Challenges experience + creation activity step) and its route survives;
 * E. mobile navigation does not depend on any public/Cloudflare URL;
 * F. authenticated landing behaviour is unchanged (index -> today, guarded);
 * G. the authenticated V2 member route set is exact, including authorized S4d
 *    Group Settings, with no missing, duplicate, or unauthorized destinations;
 * H. root cause is closed: the Firebase emulator banner (fixed bottom,
 *    z-index 10000) can no longer be injected to occlude the mobile nav.
 *
 * TIIZI — V2 MEMBER SHELL FOUNDER CORRECTION 001 adds:
 * I. the account sheet holds EXACTLY Activity Guide / Profile, with no
 *    Notifications entry and no Operator entry;
 * J. Notifications is reachable only through the header bell -> /v2/notifications;
 * K. the desktop secondary navigation row is gone (no duplicate top area);
 * L. the member shell contains no Operator link/string, while the separate
 *    /v2/operator tree (index -> overview) still exists outside the shell.
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
const listScreen = read('src/v2/challenges/V2ChallengeListScreen.tsx');
const wizard = read('src/v2/challenges/V2ChallengeCreationWizard.tsx');

/** Isolate the mobile member <nav> block. */
const memberNavStart = shell.indexOf('aria-label="Member"');
const memberNavEnd = shell.indexOf('</nav>', memberNavStart);
const memberNav = memberNavStart >= 0 && memberNavEnd >= 0
  ? shell.slice(shell.lastIndexOf('<nav', memberNavStart), memberNavEnd)
  : '';
/** Isolate the desktop primary <nav> block. */
const primaryNavStart = shell.indexOf('aria-label="Primary"');
const primaryNavEnd = shell.indexOf('</nav>', primaryNavStart);
const primaryNav = primaryNavStart >= 0 && primaryNavEnd >= 0
  ? shell.slice(shell.lastIndexOf('<nav', primaryNavStart), primaryNavEnd)
  : '';

/** The PRIMARY destination set (Today / Challenges / Groups). */
const primaryConst = (shell.match(/const PRIMARY = \[([\s\S]*?)\] as const;/) ?? [])[1] ?? '';
const primaryTos = [...primaryConst.matchAll(/to: '([^']+)'/g)].map((m) => m[1]);

// ─── A. Desktop primary navigation = Today / Challenges / Groups ──────────
console.log('A. desktop primary navigation');
check('desktop primary nav element exists', primaryNav !== '');
check('desktop primary nav is md:flex', /hidden[^"]*md:flex/.test(primaryNav));
check('desktop primary nav maps PRIMARY', /PRIMARY\.map/.test(primaryNav));
check('PRIMARY is exactly today/challenges/groups',
  JSON.stringify(primaryTos) === JSON.stringify(['/v2/today', '/v2/challenges', '/v2/groups']),
  JSON.stringify(primaryTos));

// ─── B. Mobile primary navigation = exactly Today / Challenges / Groups ───
console.log('B. mobile primary navigation');
check('mobile member nav element exists', memberNav !== '');
check('mobile member nav is md:hidden', /md:hidden/.test(memberNav));
check('mobile member nav is fixed to the bottom', /fixed[^"]*bottom-0/.test(memberNav));
check('mobile member nav maps PRIMARY', /PRIMARY\.map/.test(memberNav));
check('mobile member nav lays out exactly three columns', /grid-cols-3/.test(memberNav));
check('mobile member nav has NO Activity Guide entry', !/\/v2\/guide/.test(memberNav) && !/shell\.guide/.test(memberNav));
check('mobile member nav has NO Profile / "You" entry', !/\/v2\/profile/.test(memberNav) && !/>\s*You\s*</.test(memberNav));
check('mobile member nav does NOT hardcode a fourth/fifth destination', (memberNav.match(/<NavLink/g) ?? []).length === 1,
  'expected a single PRIMARY.map NavLink renderer');

// ─── C. Active state represented ──────────────────────────────────────────
console.log('C. active state');
check('NavLink isActive used by both navigations', (shell.match(/isActive/g) ?? []).length >= 3);
check('mobile active indicator bar uses isActive', /isActive \? 'bg-primary'/.test(memberNav));

// ─── D. Activity Guide retained as contextual secondary + route survives ──
console.log('D. Activity Guide (contextual secondary, not primary)');
check('Activity Guide route remains defined', /<Route path="guide"/.test(routes) || /path="guide"/.test(routes));
check('Challenges screen exposes a contextual Activity Guide entry', /navigate\('\/v2\/guide'\)/.test(listScreen));
check('Challenges entry is visually subordinate to Create Challenge',
  listScreen.indexOf('Create Challenge') < listScreen.indexOf('/v2/guide'));
check('creation activity step links to the Activity Guide', /to="\/v2\/guide"/.test(wizard));
check('Activity Guide + Profile stay reachable from the member shell (account sheet)',
  /const ACCOUNT = \[([\s\S]*?)\] as const;/.test(shell)
  && ['/v2/guide', '/v2/profile'].every((to) => shell.includes(`'${to}'`)));

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

// ─── G. Exact authorized V2 member route set ──────────────────────────────
// The S4d settings route and S6 Activity Library/Guide are authorized
// additions. Keep the route identity/type set explicit so removal,
// substitution, duplication, and unrelated expansion all fail this guard.
console.log('G. exact authorized member route set');
const memberBlock = routes.split('<V2MemberShell />}>')[1]?.split('<Route path="operator"')[0] ?? '';
const memberPaths = [...memberBlock.matchAll(/<Route path="([^"]+)" element=\{<(V2[A-Za-z]+)/g)].map((m) => `${m[1]}:${m[2]}`);
const expectedMember = [
  'today:V2TodayScreen',
  'challenges:V2ChallengeListScreen',
  'challenges/new:V2ChallengeCreationWizard',
  'challenges/:challengeId:V2CreatedChallengeScreen',
  'groups:V2GroupsScreen',
  'groups/new:V2CreateGroupScreen',
  'groups/:groupId:V2GroupHomeRoute',
  'groups/:groupId/settings:V2GroupHomeRouteSettings',
  'guide:V2ActivityLibraryScreen',
  'guide/:activityId:V2ActivityGuideDetailScreen',
  'profile:V2ProfilePage',
  'notifications:V2NotificationsPage',
];
check('member routes are exactly the approved set including S4d settings and S6 Guide',
  JSON.stringify(memberPaths) === JSON.stringify(expectedMember), JSON.stringify(memberPaths));
check('Group Home route wraps the screen in the contextual group scope',
  routes.includes('V2GroupScope groupId={groupId ?? null}'));

// ─── H. Root cause closed: emulator banner cannot occlude the nav ─────────
console.log('H. root cause (emulator banner) closed');
check('connectAuthEmulator disables the SDK warning banner',
  /connectAuthEmulator\(\s*auth,\s*emulatorUrl,\s*\{\s*disableWarnings:\s*true\s*\}\s*\)/.test(emulators));

// ─── I. Account sheet = exactly Activity Guide / Profile ─────────────────
console.log('I. account sheet contents');
const sheetStart = shell.indexOf('<V2Sheet');
const sheetEnd = shell.indexOf('</V2Sheet>', sheetStart);
const accountSheet = sheetStart >= 0 && sheetEnd >= 0
  ? shell.slice(sheetStart, sheetEnd + '</V2Sheet>'.length)
  : '';
const accountConst = (shell.match(/const ACCOUNT = \[([\s\S]*?)\] as const;/) ?? [])[1] ?? '';
const accountTos = [...accountConst.matchAll(/to: '([^']+)'/g)].map((m) => m[1]);
check('account sheet exists', accountSheet !== '');
check('ACCOUNT destinations are exactly Activity Guide + Profile',
  JSON.stringify(accountTos) === JSON.stringify(['/v2/guide', '/v2/profile']), JSON.stringify(accountTos));
check('account sheet renders the ACCOUNT destinations', /ACCOUNT\.map/.test(accountSheet));
const accountLabelKeys = [...accountConst.matchAll(/labelKey: '([^']+)'/g)].map((m) => m[1]);
check('account sheet labels are exactly Activity Guide + Profile',
  JSON.stringify(accountLabelKeys) === JSON.stringify(['shell.guide', 'shell.profile']),
  JSON.stringify(accountLabelKeys));
check('account sheet renders those labels', /t\(item\.labelKey\)/.test(accountSheet));
check('account sheet has NO Notifications entry',
  !/shell\.notifications/.test(accountSheet) && !/v2\/notifications/.test(accountSheet));
check('account sheet has NO Operator entry', !/operator/i.test(accountSheet));

// ─── J. Notifications reachable only through the header bell ──────────────
console.log('J. notification bell ownership');
check('notification trigger remains in the header', /<V2NotificationTrigger/.test(shell));
check('bell navigates to /v2/notifications',
  /<V2NotificationTrigger[^>]*onOpen=\{\(\) => navigate\('\/v2\/notifications'\)\}/s.test(shell)
  || /onOpen=\{\(\) => navigate\('\/v2\/notifications'\)\}/.test(shell));
check('bell is not part of the account sheet', !/V2NotificationTrigger/.test(accountSheet));

// ─── K. Desktop secondary navigation row removed ─────────────────────────
console.log('K. no desktop secondary navigation row');
check('no SECONDARY constant remains', !/const SECONDARY =/.test(shell));
check('no aria-label="Secondary" region remains', !/aria-label="Secondary"/.test(shell));
check('no secondary row wrapper remains', !shell.includes('border-t border-slate-100 md:block'));
check('header keeps exactly one top row',
  (shell.match(/mx-auto flex h-14 w-full max-w-6xl/g) ?? []).length === 1);

// ─── L. Operator stays outside member navigation ─────────────────────────
console.log('L. Operator boundary');
const jsxStart = shell.indexOf('return (');
const shellJsx = jsxStart >= 0 ? shell.slice(jsxStart) : shell;
check('member shell JSX has no /v2/operator link', !/\/v2\/operator/.test(shellJsx));
check('member shell has no Operator label key', !/shell\.operator/.test(shell));
check('member shell does not compose the Operator shell', !/V2OperatorShell/.test(shell));
check('operator route tree still exists',
  /<Route path="operator" element=\{<V2OperatorShell \/>\}>/.test(routes));
const operatorStart = routes.indexOf('<Route path="operator"');
const operatorBlock = operatorStart >= 0 ? routes.slice(operatorStart) : '';
const memberShellOpen = routes.indexOf('<V2MemberShell />');
const memberShellClose = routes.indexOf('</Route>', memberShellOpen);
check('/v2/operator redirects to overview (index route)',
  /<Route index element=\{<Navigate to="overview" replace \/>\}/.test(operatorBlock));
check('operator overview route is present', /<Route path="overview"/.test(operatorBlock));
check('operator route tree sits outside the member shell block',
  memberShellOpen >= 0 && memberShellClose >= 0 && operatorStart > memberShellClose,
  'operator must remain a sibling route of the member shell, never a child');

if (failures > 0) {
  console.error(`\nMobile primary navigation guard: ${failures} failure(s).`);
  process.exit(1);
}
console.log('\nMobile primary navigation guard: all passing.');
