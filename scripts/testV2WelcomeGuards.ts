/**
 * TIIZI-FER-P1A-001 — public welcome + full Profile guards
 * (run: npm run test:v2-welcome).
 *
 * A. exactly four Founder-specified slides, no migration/third-party narrative;
 * B. device-scoped seen state is safe with unavailable/throwing storage;
 * C. the welcome is public (outside V2ProtectedScope), makes no data calls,
 *    offers Skip + Sign up + Sign in, keyboard/reduced-motion/ARIA support;
 * D. the auth entry lands unseen visitors on the welcome and seen ones on sign-in;
 * E. avatar → Profile; Profile structure/order and preserved working actions;
 * F. sign-out clears the Challenge draft backup;
 * G. nothing from the unmerged PR #107 (JPGs, support email, five-slide flow).
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WELCOME_PATH, WELCOME_SLIDES } from '../src/v2/welcome/welcomeContent';
import {
  WELCOME_SEEN_KEY,
  clampSlide,
  hasSeenWelcome,
  markWelcomeSeen,
  resetWelcomeMemoryForTests,
  slideFromScroll,
  type WelcomeStorage,
} from '../src/v2/welcome/welcomeState';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) console.log(`  ok: ${name}`);
  else { failures += 1; console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`); }
}
function walk(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((n) => {
    const rel = join(dir, n);
    return statSync(join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

console.log('A. slides');
check('exactly four slides', WELCOME_SLIDES.length === 4);
check('slide titles are the Founder-specified four',
  JSON.stringify(WELCOME_SLIDES.map((s) => s.title)) === JSON.stringify([
    'Move better, together', 'Find your people', 'Take on a Challenge', 'Every effort counts']));
check('slide 3 explains Together, Race and Streak',
  /Together/.test(WELCOME_SLIDES[2].body) && /Race/.test(WELCOME_SLIDES[2].body) && /Streak/.test(WELCOME_SLIDES[2].body));
check('slide 4 covers logging, progress and encouragement',
  /Log/.test(WELCOME_SLIDES[3].body) && /progress/.test(WELCOME_SLIDES[3].body) && /cheer/.test(WELCOME_SLIDES[3].body));
const copy = JSON.stringify(WELCOME_SLIDES);
check('no WhatsApp / migration / V1 narrative', !/whatsapp|migrat|v1|legacy/i.test(copy));
check('welcome path is /v2/welcome', WELCOME_PATH === '/v2/welcome');

console.log('B. seen state');
class Mem implements WelcomeStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
}
resetWelcomeMemoryForTests();
const mem = new Mem();
check('unseen by default', hasSeenWelcome(mem) === false);
markWelcomeSeen(mem);
check('mark persists to the device storage', mem.getItem(WELCOME_SEEN_KEY) === '1');
resetWelcomeMemoryForTests();
check('seen is read back from storage', hasSeenWelcome(mem) === true);
const throwing: WelcomeStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
resetWelcomeMemoryForTests();
check('throwing storage never breaks reads', hasSeenWelcome(throwing) === false);
check('throwing storage never breaks writes', (() => { try { markWelcomeSeen(throwing); return true; } catch { return false; } })());
check('in-memory fallback keeps the page session consistent', hasSeenWelcome(throwing) === true);
resetWelcomeMemoryForTests();
check('null storage is tolerated', hasSeenWelcome(null) === false && (() => { markWelcomeSeen(null); return hasSeenWelcome(null); })());
resetWelcomeMemoryForTests();
check('the key is device-scoped (no member identity in it)', !/uid|member|user/i.test(WELCOME_SEEN_KEY));
check('slide arithmetic clamps', clampSlide(-3, 4) === 0 && clampSlide(9, 4) === 3 && clampSlide(1.6, 4) === 2);
check('scroll position maps to a slide', slideFromScroll(0, 300, 4) === 0 && slideFromScroll(610, 300, 4) === 2 && slideFromScroll(5000, 300, 4) === 3 && slideFromScroll(10, 0, 4) === 0);

console.log('C. public route and page');
const routes = read('src/v2/routes.tsx');
const page = read('src/v2/welcome/V2WelcomeSlides.tsx');
check('welcome route exists', routes.includes('path="welcome"') && routes.includes('V2WelcomeSlides'));
check('welcome route is public (declared before the protected scope)',
  routes.indexOf('path="welcome"') < routes.indexOf('element={<V2ProtectedScope'));
check('page makes no data/API/query calls', !/fetch\(|useQuery|useMutation|queryClient|api\/|Firestore|firebase\/firestore/i.test(page));
check('page has Skip (Close for members), Sign up and Sign in exits', /Skip/.test(page) && /Create an account/.test(page) && /Sign in/.test(page) && /\/v2\/sign-up/.test(page) && /\/v2\/sign-in/.test(page));
check('Skip leads to Sign up for visitors', /navigate\(member \? '\/v2\/profile' : signUpPath\)/.test(page));
check('return path is preserved through the exits', /v2NextQuery\(next\)/.test(page) && /resolveV2NextPath/.test(page));
check('swipe is native scroll-snap', /snap-x/.test(page) && /snap-mandatory/.test(page));
check('keyboard: arrows/Home/End', /ArrowRight/.test(page) && /ArrowLeft/.test(page) && /Home/.test(page) && /End/.test(page));
check('reduced motion respected', /prefers-reduced-motion/.test(page) && /motion-safe:/.test(page));
check('accessible carousel semantics + live region', /aria-roledescription="carousel"/.test(page) && /aria-live="polite"/.test(page) && /aria-current/.test(page));
check('no permanent product promises in Profile entry cards', !/always will be|only ever|never limit/i.test(read('src/v2/profile/V2ProfileScreen.tsx')));
check('single page h1; slide titles are h2', (page.match(/<h1/g) ?? []).length === 1 && /<h2[^>]*>\{slide\.title\}/.test(page));
check('scroller is a named group', /role="group"\s+aria-label="Welcome slides/.test(page));
check('programmatic scroll ignores intermediate positions', /scrollTarget/.test(page) && /releaseScrollTarget/.test(page) && /if \(here !== scrollTarget\.current\) return;/.test(page));
check('focus moves to the primary exit when Next is replaced', /primaryExitRef\.current\?\.focus\(\)/.test(page));
check('neutral state until the local session check is ready (no visitor-exit flash for members)', /if \(!isReady\) return/.test(page));
check('seen state recorded on exits', (page.match(/markWelcomeSeen\(/g) ?? []).length >= 4);
check('artwork is inline SVG authored in-repo (no image files, no new dependency)',
  !/<img\b|\.jpg|\.png|\.webp/.test(page + read('src/v2/welcome/WelcomeArt.tsx')) && /<svg/.test(read('src/v2/welcome/WelcomeArt.tsx')));
check('no V1 imports in the welcome module',
  !walk('src/v2/welcome').some((f) => /from '\.\.\/\.\.\/(features|services|components\/(Auth|Mobile))\//.test(read(f)) && !/ProtectedRoute/.test(f)));
check('frozen V1 identifiers are not used', !/\b(WelcomeScreen|OnboardingSlides|LoginScreen|SignupScreen)\b/.test(page));

console.log('D. auth entry');
const guard = read('src/v2/auth/V2AuthGuard.tsx');
check('unseen visitors land on the welcome, seen on sign-in', /hasSeenWelcome\(\)/.test(guard) && /V2_WELCOME_PATH/.test(guard) && /V2_SIGN_IN_PATH/.test(guard));
check('Operator review keeps its direct sign-in entry', /startsWith\('\/v2\/operator'\)/.test(guard));
check('guard keeps the configurable loginPath override', guard.includes('loginPath'));

console.log('E. avatar and Profile');
const shell = read('src/v2/member/MemberShell.tsx');
const profile = read('src/v2/profile/V2ProfileScreen.tsx');
check('avatar navigates straight to /v2/profile', /onOpen=\{\(\) => navigate\('\/v2\/profile'\)\}/.test(shell));
check('the fragmented account sheet is gone', !/<V2Sheet|ACCOUNT\b/.test(shell));
const order = ['Display name', 'Email', 'slot="interests-goals"', 'slot="support-tiizi"', 'My Tiizi Journey', 'Account &amp; preferences', 'Help &amp; guide']
  .map((label) => profile.indexOf(label));
check('Profile keeps the agreed section order (incomplete sections hold their final slots)', order.every((i, n) => i >= 0 && (n === 0 || i > order[n - 1])), JSON.stringify(order));
check('Profile keeps display-name edit, read-only email, Groups and Challenges',
  /startEditing/.test(profile) && /saveDisplayName/.test(profile) && /user\?\.email/.test(profile) && /Show more Groups/.test(profile) && /ChallengeGroup/.test(profile));
check('Profile offers Sign out, Activity Guide and How Tiizi works', /Sign out/.test(profile) && /navigate\('\/v2\/guide'\)/.test(profile) && /How Tiizi works/.test(profile) && /WELCOME_PATH/.test(profile));
check('no downstream functionality leaked into P1a (no upload, payment, preference controls)',
  !/type="file"|mailto:|tel:|wa\.me|paystack|<select|type="checkbox"/i.test(profile));
check('no member-facing "coming soon" / later-availability wording on Profile or welcome',
  !/coming soon|arrives with a later|later update|wider launch/i.test(profile + page + read('src/v2/welcome/welcomeContent.ts')));
check('unimplemented sections render nothing to members: dev-only marker gated by import.meta.env.DEV',
  /function DevPackageStatus[\s\S]*?if \(!import\.meta\.env\.DEV\) return null;/.test(profile));
check('dev marker has no actions or inputs (no fake editing, donation, upload or payment)',
  !/<(button|V2Button|Link|input|form|a)\b/.test(profile.slice(profile.indexOf('function DevPackageStatus'), profile.indexOf('function SectionLabel'))));
check('no member-facing Interests/Goals or Support heading until implemented',
  !/<h2[^>]*>\s*(Interests|Support Tiizi)/.test(profile));

console.log('F. sign-out clears the draft backup');
const signOut = read('src/v2/profile/useV2SignOut.ts');
check('sign-out clears this member\'s Challenge draft only after logout succeeds',
  /clearChallengeDraft\(uid\)/.test(signOut) && signOut.indexOf('await logout()') < signOut.indexOf('clearChallengeDraft(uid)') && /const uid = user\?\.uid/.test(signOut));
check('shared query cache is still cleared', /queryClient\.clear\(\)/.test(signOut));

console.log('G. nothing imported from unmerged PR #107');
check('no public/onboarding images', !existsSync(join(root, 'public/onboarding')));
check('no unconfirmed support email anywhere in src/v2', !walk('src/v2').some((f) => /support@tiizichallenges/.test(read(f))));
check('no five-slide orientation flow or post-auth first-run gate',
  !existsSync(join(root, 'src/v2/onboarding')) && !/V2FirstRunGate|orientation/i.test(routes));

if (failures > 0) { console.error(`\nP1a welcome/profile guards: ${failures} failure(s).`); process.exit(1); }
console.log('\nP1a welcome/profile guards: all passing.');
