/**
 * MC-1 — client member-bootstrap integration (run: npm run test:mc1-member-bootstrap).
 * Behavioural tests of the session logic plus source contracts proving the V2
 * authenticated boundary is the one place that invokes bootstrap, for every
 * sign-in path (email sign-up, sign-in, Google).
 */
import { readFileSync } from 'node:fs';
import { normalizeV2DisplayName } from '../src/v2/auth/v2DisplayName.js';
import { createMemberBootstrapSession } from '../src/v2/auth/memberBootstrapSession.js';

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok: ${name}`);
  else { failures += 1; console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`); }
}
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

async function main() {
  console.log('bootstrap session behaviour');
  let calls = 0;
  const ok = createMemberBootstrapSession(async () => { calls += 1; return { memberId: 'm1', created: true }; });
  await Promise.all([ok.ensure('uid-1'), ok.ensure('uid-1'), ok.ensure('uid-1')]);
  check('concurrent ensure shares one bootstrap call', calls === 1, `calls=${calls}`);
  await ok.ensure('uid-1');
  check('returning to a bootstrapped subject does not call again', calls === 1);
  await ok.ensure('uid-2');
  check('a different subject bootstraps separately', calls === 2);

  let attempts = 0;
  const flaky = createMemberBootstrapSession(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('down');
    return { memberId: 'm', created: false };
  });
  const names: Array<string | null | undefined> = [];
  const named = createMemberBootstrapSession(async (n) => { names.push(n); return { memberId: 'm', created: true }; });
  await named.ensure('u', 'Fred Kenogo');
  check('session forwards the display name to the bootstrap call', names[0] === 'Fred Kenogo');

  let failed = false;
  await flaky.ensure('uid').catch(() => { failed = true; });
  check('failure rejects (fail closed, not treated as provisioned)', failed);
  check('failure is not auto-retried', attempts === 1);
  await flaky.ensure('uid');
  check('explicit retry re-attempts and can succeed', attempts === 2);

  console.log('V2 display-name normalisation (mirrors API bound)');
  check('trims and preserves Unicode', normalizeV2DisplayName('  Wanjiru Müller 李 ') === 'Wanjiru Müller 李');
  check('empty / whitespace / null / undefined are omitted',
    normalizeV2DisplayName('   ') === null && normalizeV2DisplayName(null) === null && normalizeV2DisplayName(undefined) === null);
  check('121 code points omitted, 120 kept',
    normalizeV2DisplayName('x'.repeat(121)) === null && normalizeV2DisplayName('x'.repeat(120)) === 'x'.repeat(120));
  check('astral code points counted as one each', normalizeV2DisplayName('😀'.repeat(120)) !== null && normalizeV2DisplayName('😀'.repeat(121)) === null);
  check('control characters omitted', normalizeV2DisplayName('a\u0000b') === null && normalizeV2DisplayName('a\nb') === null);

  console.log('source contracts');
  const guard = read('src/v2/auth/V2AuthGuard.tsx');
  check('V2 authenticated boundary wraps children in the bootstrap gate',
    /<V2MemberBootstrapGate>\{children\}<\/V2MemberBootstrapGate>/.test(guard));
  const signUp = read('src/v2/auth/V2SignUpPage.tsx');
  const signIn = read('src/v2/auth/V2SignInPage.tsx');
  check('sign-up, sign-in and Google share the one gate (pages navigate into V2Authenticated)',
    /navigate\(next/.test(signUp) && /loginWithGoogle/.test(signUp) && /loginWithGoogle/.test(signIn));
  check('auth pages do not call bootstrap or the members API themselves',
    !/bootstrapMember|members\/bootstrap/.test(signUp + signIn));
  const gate = read('src/v2/auth/V2MemberBootstrapGate.tsx');
  check('gate renders children only after ready', /state === 'ready'\) return <>\{children\}<\/>/.test(gate));
  check('gate offers a user-initiated retry and sign-out', /Try again/.test(gate) && /Sign out/.test(gate));
  check('gate has no automatic retry timers', !/setTimeout|setInterval/.test(gate));
  const api = read('src/api/memberBootstrapApi.ts');
  check('client composes the path through apiPath and POSTs; body carries only displayName',
    /apiPath\('\/members\/bootstrap'\)/.test(api) && /method: 'POST'/.test(api)
    && /body: \{ displayName: name \}/.test(api) && !/uid|memberId|role/i.test(api.replace(/memberId: string/, '')));
  check('gate sends the Firebase user displayName, not the fallback profile',
    /user\?\.displayName/.test(gate) && !/profile\./.test(gate) && !/useAuth\(\)[^;]*profile/.test(gate));
  const carrier = read('src/v2/auth/persistV2SignUpName.ts');
  check('V2-only carrier owns the Firebase updateProfile of the entered name',
    /updateProfile\(user, \{ displayName \}\)/.test(carrier) && /normalizeV2DisplayName\(enteredName\)/.test(carrier));
  check('V2 sign-up page invokes the carrier after account creation, before navigating',
    signUp.indexOf('await signup(') < signUp.indexOf('persistV2SignUpName(auth.currentUser')
    && signUp.indexOf('persistV2SignUpName(auth.currentUser') < signUp.indexOf('navigate(next);'));
  check('carrier never derives from email', !/email/i.test(carrier.replace(/\/\*[\s\S]*?\*\//g, '')));
  check('gate normalises Firebase displayName so an unusable value cannot block bootstrap',
    /normalizeV2DisplayName\(user\?\.displayName\)/.test(gate));
  console.log('V1 freeze');
  const v1Signup = read('src/features/Auth/SignupScreen.tsx');
  check('archived V1 SignupScreen carries no MC-1 behaviour',
    !/updateProfile|bootstrap|persistV2|src\/v2|\.\.\/v2/i.test(v1Signup));
  const shared = read('src/context/AuthContext.tsx');
  check('shared AuthContext has no MC-1 display-name persistence (updateProfile)', !/updateProfile/.test(shared));
  check('shared AuthContext has no import of V2 modules', !/\/v2\//.test(shared));
  check('sign-up page does not enter the shell before sign-up completes', /isAuthenticated && !working/.test(signUp));
  check('no /v1 target', !/\/v1/.test(api));
  const authCtx = read('src/context/AuthContext.tsx');
  check('shared AuthContext does not call bootstrap itself', !/bootstrapMember|members\/bootstrap/.test(authCtx));

  if (failures > 0) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
  console.log('\nAll MC-1 client checks passed');
}
void main();
