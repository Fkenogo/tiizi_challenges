/**
 * V2 Experience Recovery 001 guards (run: npm run test:v2-orientation).
 *
 * Covers the first-run orientation (welcome + community entry), the
 * per-device seen-state and first-run decision, returning-member route
 * preservation, the always-available skip, the Support Tiizi information
 * journey (Profile card, account entry, screen), the absence of any payment
 * execution or fundraising claim, and the mobile (~390px) layout contract.
 *
 * Like the other V2 guard scripts it runs pure-contract assertions, renders
 * the stateless screens to static markup, and adds static source proofs.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import {
  ORIENTATION_PATHS,
  ORIENTATION_SLIDES,
} from '../src/v2/onboarding/orientationContent.js';
import {
  firstRunDecision,
  hasSeenOrientation,
  markOrientationSeen,
  orientationSeenKey,
  resetOrientationSessionForTests,
  type OrientationStorage,
} from '../src/v2/onboarding/orientationState.js';
import {
  SUPPORT_CONTACT_EMAIL,
  SUPPORT_HEADLINE,
  SUPPORT_PATH,
  SUPPORT_PROFILE_CARD,
  SUPPORT_SECTIONS,
  SUPPORT_STATUS,
} from '../src/v2/support/supportContent.js';
import { V2SupportTiiziScreen } from '../src/v2/support/V2SupportTiiziScreen.js';
import { V2SupportTiiziCard } from '../src/v2/support/V2SupportTiiziCard.js';

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

function memoryStorage(): OrientationStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const throwingStorage: OrientationStorage = {
  getItem() {
    throw new Error('storage blocked');
  },
  setItem() {
    throw new Error('storage blocked');
  },
};

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(createElement(StaticRouter, { location: '/v2/profile' }, element));
}

// ─── 1. Seen-state ─────────────────────────────────────────────────────────
console.log('1. Orientation seen-state');
{
  resetOrientationSessionForTests();
  const storage = memoryStorage();
  check('unseen by default', !hasSeenOrientation('uid-a', storage));
  markOrientationSeen('uid-a', storage);
  check('seen after mark', hasSeenOrientation('uid-a', storage));
  check('per-member: another uid stays unseen', !hasSeenOrientation('uid-b', storage));
  check('key is namespaced and per uid', orientationSeenKey('uid-a').endsWith(':uid-a') && orientationSeenKey('uid-a').startsWith('tiizi.v2.orientation.'));
  check('stored value is a flag, never member data', storage.data.get(orientationSeenKey('uid-a')) === '1');

  resetOrientationSessionForTests();
  check('unavailable storage reads as unseen without throwing', !hasSeenOrientation('uid-c', throwingStorage));
  markOrientationSeen('uid-c', throwingStorage);
  check('blocked storage cannot loop: session flag still marks seen', hasSeenOrientation('uid-c', throwingStorage));
  resetOrientationSessionForTests();
  check('null storage tolerated', !hasSeenOrientation('uid-d', null));
}

// ─── 2. First-run decision ─────────────────────────────────────────────────
console.log('2. First-run decision (new vs returning members)');
{
  check('new member: no Groups, unseen → orientation', firstRunDecision({ seen: false, groupsStatus: 'ready', groupCount: 0 }) === 'show-orientation');
  check('skipped/seen member → Today', firstRunDecision({ seen: true, groupsStatus: 'ready', groupCount: 0 }) === 'show-today');
  check('returning member with any Group is never interrupted', firstRunDecision({ seen: false, groupsStatus: 'ready', groupCount: 1 }) === 'show-today');
  check('waits (no flash/redirect) while memberships load', firstRunDecision({ seen: false, groupsStatus: 'loading', groupCount: 0 }) === 'wait');
  check('fails open to Today when memberships cannot be read', firstRunDecision({ seen: false, groupsStatus: 'error', groupCount: 0 }) === 'show-today');
}

// ─── 3. Orientation content ────────────────────────────────────────────────
console.log('3. Orientation content');
{
  check('five steps from the approved design exports', ORIENTATION_SLIDES.length === 5);
  check('step order: welcome, community, challenges, activity, begin', ORIENTATION_SLIDES.map((s) => s.id).join(',') === 'welcome,community,challenges,activity,begin');
  check('every step has a title, body and image', ORIENTATION_SLIDES.every((s) => s.title && s.body.length > 20 && s.image.startsWith('/onboarding/')));
  const corpus = ORIENTATION_SLIDES.map((s) => `${s.title} ${s.body}`).join(' ');
  check('explains Groups, Challenges and logging activities', /Group/.test(corpus) && /Challenge/.test(corpus) && /Log/i.test(corpus) && /activity/i.test(corpus));
  check('uses V2 Challenge type names', /Together/.test(corpus) && /Race/.test(corpus) && /Streak/.test(corpus));
  check('states joining a Group never joins a Challenge automatically', /never joins you to a Challenge/.test(corpus));
  check('mentions the invite code on the community and final steps', /invite code/i.test(ORIENTATION_SLIDES[1].body) && /invite code/i.test(ORIENTATION_SLIDES[4].body));
  check('no payment, reward, recognition or goal claims in orientation copy', !/(\$|KES|USD|M-?Pesa|donat|pay(ment)?\b|reward|prize|badge|kudos|award|goal|recommend)/i.test(corpus), corpus);
  check('every exit target is a V2 route', Object.values(ORIENTATION_PATHS).every((p) => p.startsWith('/v2/')) && !JSON.stringify(ORIENTATION_PATHS).includes('/app/'));
  const assets = ORIENTATION_SLIDES.map((s) => join(root, 'public', s.image));
  check('image assets exist and are compact (<200KB each)', assets.every((p) => {
    try {
      const size = readFileSync(p).length;
      return size > 10_000 && size < 200_000;
    } catch {
      return false;
    }
  }));
}

// ─── 4. Orientation screen + routing (static proofs) ───────────────────────
console.log('4. Orientation screen and routing');
{
  const screen = read('src/v2/onboarding/V2OrientationScreen.tsx');
  const gate = read('src/v2/onboarding/V2FirstRunGate.tsx');
  const routes = read('src/v2/routes.tsx');
  const groups = read('src/v2/groups/V2GroupsScreen.tsx');
  const today = read('src/v2/today/V2TodayScreen.tsx');
  check('Skip intro control on the stepped slides', /Skip intro/.test(screen));
  check('Next and Back controls', />\s*Next\s*</.test(screen) && />\s*Back\s*</.test(screen));
  check('final step exposes the existing invite-code panel', /V2GroupInvitePanel/.test(screen) && /onOpen=/.test(screen));
  check('final step offers Find a Group, Create a Group and Go to Today', /Find a Group/.test(screen) && /Create a Group/.test(screen) && /Go to Today/.test(screen));
  check('every exit records the seen-state', /markOrientationSeen\(user\.uid\)/.test(screen) && /const leave = /.test(screen));
  check('screen never joins a Group itself (no join hook)', !/useJoinGroup|joinGroup|fetch\(|apiRequest/.test(screen));
  check('screen creates no backend record (no mutation hooks)', !/useMutation|useQuery/.test(screen));
  check('screen uses the shell-free mobile canvas (max-w-md)', /max-w-md/.test(screen) && /min-h-\[100dvh\]/.test(screen));
  check('tap targets are at least 44px', /min-h-12/.test(screen) && /min-h-11/.test(screen));
  check('headings receive focus on step change', /headingRef\.current\?\.focus\(\)/.test(screen) && /aria-live="polite"/.test(screen));
  check('first-run gate reads only the membership query', /useV2Groups\(\)/.test(gate) && !/useMutation/.test(gate));
  check('gate redirects with replace to /v2/welcome', /<Navigate to=\{ORIENTATION_PATHS\.welcome\} replace \/>/.test(gate));
  check('welcome route is registered inside the authenticated scope, outside the member shell', routes.indexOf('path="welcome"') > routes.indexOf('<V2ProtectedScope />') && routes.indexOf('path="welcome"') < routes.indexOf('<V2MemberShell />'));
  check('only the Today route is wrapped by the first-run gate', (routes.match(/<V2FirstRunGate>/g) ?? []).length === 1 && /<Route element=\{<V2TodayGate \/>\}>\s*<Route path="today" element=\{<V2TodayScreen \/>\} \/>\s*<\/Route>/.test(routes));
  check('other routes (groups, challenges, profile) are not gated', !/path="groups"[^\n]*V2FirstRunGate/.test(routes) && !/path="challenges"[^\n]*V2FirstRunGate/.test(routes) && !/path="profile"[^\n]*V2FirstRunGate/.test(routes));
  check('Find a Group opens Discover via ?tab=discover', /searchParams\.get\('tab'\) === 'discover'/.test(groups) && ORIENTATION_PATHS.discover === '/v2/groups?tab=discover');
  check('Today empty state offers a way back to How Tiizi works', /How Tiizi works/.test(today) && /\/v2\/welcome/.test(today));
}

// ─── 5. Support Tiizi ──────────────────────────────────────────────────────
console.log('5. Support Tiizi information journey');
{
  const screenHtml = render(createElement(V2SupportTiiziScreen));
  const cardHtml = render(createElement(V2SupportTiiziCard));
  const shell = read('src/v2/member/MemberShell.tsx');
  const profile = read('src/v2/profile/V2ProfileScreen.tsx');
  const routes = read('src/v2/routes.tsx');
  const supportSources = [
    read('src/v2/support/supportContent.ts'),
    read('src/v2/support/V2SupportTiiziScreen.tsx'),
    read('src/v2/support/V2SupportTiiziCard.tsx'),
  ].join('\n');
  const text = screenHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const cardText = cardHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  check('screen states Tiizi is free to use', /free to use/i.test(text));
  check('screen states support is voluntary', /voluntary/i.test(text));
  check('screen states it never affects membership, participation, progress, ranking or results', /never affects Group membership, Challenge participation, progress, ranking or results/.test(text));
  check('screen separates platform support from supporting a cause', /Separate from supporting a cause/.test(text) && /distinct from any cause/.test(text));
  check('screen is honest that contributions are not open yet', text.includes(SUPPORT_STATUS.title) && /nothing to pay/i.test(text));
  check('screen gives a clear next step (email contact)', screenHtml.includes(`href="mailto:${SUPPORT_CONTACT_EMAIL}"`));
  check('screen has a way back to Profile', /Back to Profile/.test(text));
  check('all four approved statements are present as sections', SUPPORT_SECTIONS.length === 4);
  check('headline present', text.includes(SUPPORT_HEADLINE.title));

  check('Profile card renders title, summary and action', cardText.includes(SUPPORT_PROFILE_CARD.title) && cardText.includes(SUPPORT_PROFILE_CARD.action) && /never affects your Groups, Challenges, progress or results/.test(cardText));
  check('Profile renders the Support Tiizi card', /<V2SupportTiiziCard \/>/.test(profile) && /from '\.\.\/support\/V2SupportTiiziCard'/.test(profile));
  check('account sheet offers Support Tiizi and How Tiizi works', /'\/v2\/support'/.test(shell) && /'\/v2\/welcome'/.test(shell));
  check('support route registered inside the member shell', routes.indexOf('path="support"') > routes.indexOf('<V2MemberShell />') && routes.indexOf('path="support"') < routes.indexOf('path="operator"'));
  check('support path constant is a V2 route', SUPPORT_PATH === '/v2/support');

  // No payment execution / fundraising claims anywhere in the Support surface.
  const forbiddenRendered = /(\$\s?\d|\bKES\b|\bUSD\b|M-?Pesa|mobile money|card number|checkout|Donate Now|donation|raised|goal of|\d+\s?%|of \$|progress meter|transaction|receipt|invoice|pledge)/i;
  check('rendered Support screen has no amounts, totals, meters or payment wording', !forbiddenRendered.test(text), text.match(forbiddenRendered)?.[0] ?? '');
  check('rendered Profile card has no amounts or payment wording', !forbiddenRendered.test(cardText));
  check('Support surface has no form, input or payment control', !/<form|<input|<textarea|type="submit"/.test(screenHtml + cardHtml));
  check('Support source performs no request and imports no payment/donation module', !/(fetch\(|apiRequest|useMutation|useQuery|donationService|DonateScreen|stripe|paystack|flutterwave|mpesa|firestore)/i.test(supportSources));
  check('Support source never routes into V1', !/\/app\//.test(supportSources));
  check('no copied reference fundraising figures', !/7,?500|10,?000|75%/.test(supportSources));
}

// ─── 6. Mobile layout contract (~390px) ────────────────────────────────────
console.log('6. Mobile layout contract');
{
  const screen = read('src/v2/onboarding/V2OrientationScreen.tsx');
  const support = read('src/v2/support/V2SupportTiiziScreen.tsx');
  check('orientation canvas is single-column and bounded to mobile width', /max-w-md/.test(screen) && !/grid-cols-[2-9]/.test(screen) && !/min-w-\[/.test(screen));
  check('support screen uses the shared mobile page container', /V2Page/.test(support) && !/min-w-\[/.test(support));
  check('support email wraps instead of overflowing', /break-all/.test(support));
}

if (failures > 0) {
  console.error(`\nV2 experience recovery guards: ${failures} FAILED`);
  process.exit(1);
}
console.log('\nV2 experience recovery guards: all passing');
