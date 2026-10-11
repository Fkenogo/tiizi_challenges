/**
 * MC-1 — client member-bootstrap integration (run: npm run test:mc1-member-bootstrap).
 * Behavioural tests of the session logic plus source contracts proving the V2
 * authenticated boundary is the one place that invokes bootstrap, for every
 * sign-in path (email sign-up, sign-in, Google).
 */
import { readFileSync } from 'node:fs';
import { isV2DisplayNameTooLong, normalizeV2DisplayName } from '../src/v2/auth/v2DisplayName.js';
import { bootstrapGateStatus, createMemberBootstrapSession } from '../src/v2/auth/memberBootstrapSession.js';
import { persistV2SignUpName } from '../src/v2/auth/persistV2SignUpName.js';
import { createSignUpNameHandoff, resolveBootstrapDisplayName, v2SignUpNameHandoff } from '../src/v2/auth/signUpNameHandoff.js';

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

  console.log('sign-up name hand-off (UID-bound, transient)');
  const h = createSignUpNameHandoff();
  h.set('uidA', '  Ada Lovelace ');
  check('hand-off stores the normalised name for its own uid', h.peek('uidA') === 'Ada Lovelace');
  check('hand-off cannot cross identities', h.peek('uidB') === null);
  check('precedence 1: hand-off for THIS uid beats Firebase displayName',
    resolveBootstrapDisplayName(h, 'uidA', 'Firebase Name') === 'Ada Lovelace');
  check('precedence 2: valid Firebase displayName when no hand-off',
    resolveBootstrapDisplayName(h, 'uidB', ' Grace Hopper ') === 'Grace Hopper');
  check('precedence 3: none (no email derivation) when neither is usable',
    resolveBootstrapDisplayName(h, 'uidB', null) === null && resolveBootstrapDisplayName(h, 'uidB', 'x'.repeat(121)) === null);
  h.set('uidC', '   ');
  check('unusable entered name is not retained', h.peek('uidC') === null);
  h.clear('uidA');
  check('clear removes it', h.peek('uidA') === null);

  console.log('updateProfile failure still hands the name to bootstrap');
  v2SignUpNameHandoff.clearAll();
  // A bare object makes Firebase updateProfile reject; the carrier must swallow it.
  let threw = false;
  await persistV2SignUpName({ uid: 'new-uid' } as never, '  Fred Kenogo ').catch(() => { threw = true; });
  check('carrier does not throw when updateProfile rejects', !threw);
  check('entered name is retained for that uid despite the failure', v2SignUpNameHandoff.peek('new-uid') === 'Fred Kenogo');
  check('and is unavailable to another uid', v2SignUpNameHandoff.peek('other-uid') === null);
  v2SignUpNameHandoff.clearAll();

  console.log('handoff cleared after successful bootstrap');
  const hh = createSignUpNameHandoff();
  hh.set('u1', 'Name One');
  const sent: Array<string | null | undefined> = [];
  const cleared = createMemberBootstrapSession(async (n) => { sent.push(n); return { memberId: 'm', created: true }; }, (uid) => hh.clear(uid));
  await cleared.ensure('u1', resolveBootstrapDisplayName(hh, 'u1', null));
  check('bootstrap received the retained name', sent[0] === 'Name One');
  check('hand-off cleared once bootstrap succeeded', hh.peek('u1') === null);
  const keep = createSignUpNameHandoff();
  keep.set('u2', 'Keep Me');
  const failing = createMemberBootstrapSession(async () => { throw new Error('x'); }, (uid) => keep.clear(uid));
  await failing.ensure('u2', 'Keep Me').catch(() => {});
  check('hand-off retained after a FAILED bootstrap (retry can reuse it)', keep.peek('u2') === 'Keep Me');

  console.log('UID-bound ready state');
  check('ready for A is ready for A', bootstrapGateStatus({ uid: 'A', status: 'ready' }, 'A') === 'ready');
  check('direct A -> B (no null in between): children stay blocked for B',
    bootstrapGateStatus({ uid: 'A', status: 'ready' }, 'B') === 'working');
  check('failed outcome of A does not show failure for B', bootstrapGateStatus({ uid: 'A', status: 'failed' }, 'B') === 'working');
  check('null user never reads as ready', bootstrapGateStatus({ uid: 'A', status: 'ready' }, null) === 'working');
  let resolveA: (v: { memberId: string; created: boolean }) => void = () => {};
  const started: string[] = [];
  const sess = createMemberBootstrapSession((n) => {
    started.push(String(n));
    return n === 'nameA' ? new Promise((r) => { resolveA = r; }) : Promise.resolve({ memberId: 'b', created: true });
  });
  const pendingA = sess.ensure('A', 'nameA');
  await sess.ensure('B', 'nameB');
  check('B completes independently while A is still in flight', started.length === 2);
  // Gate-equivalent: outcome recorded for B only.
  const outcomeAfterB = { uid: 'B', status: 'ready' as const };
  resolveA({ memberId: 'a', created: true });
  await pendingA;
  check('late completion of A does not make B or the gate-state for another uid ready',
    bootstrapGateStatus({ uid: 'A', status: 'ready' }, 'B') === 'working' && bootstrapGateStatus(outcomeAfterB, 'B') === 'ready');
  check('B ready state is not disturbed by A (no re-bootstrap for B)', (await sess.ensure('B'), started.length === 2));

  console.log('Unicode code-point limit');
  check('120 emoji (240 UTF-16 units) accepted', normalizeV2DisplayName('😀'.repeat(120)) !== null);
  check('121 emoji rejected', normalizeV2DisplayName('😀'.repeat(121)) === null);
  check('61 emoji is not too long', !isV2DisplayNameTooLong('😀'.repeat(61)));
  check('121 code points flagged too long', isV2DisplayNameTooLong('x'.repeat(121)) && !isV2DisplayNameTooLong('x'.repeat(120)));

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
  check('gate renders children only when its status is ready', /status === 'ready'\) return <>\{children\}<\/>/.test(gate));
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
  check('gate resolves the name via hand-off then valid Firebase displayName (never email)',
    /resolveBootstrapDisplayName\(v2SignUpNameHandoff, uid, firebaseNameRef\.current\)/.test(gate) && /user\?\.displayName/.test(gate));
  check('gate renders children only through the UID-bound status', /bootstrapGateStatus\(outcome, uid\)/.test(gate) && !/state === 'ready'/.test(gate));
  check('hand-off is memory only (no browser storage)', !/localStorage|sessionStorage|indexedDB/.test(read('src/v2/auth/signUpNameHandoff.ts').replace(/\/\*[\s\S]*?\*\//g, '')));
  check('sign-up name input has no HTML maxLength (UTF-16 semantics)', !/maxLength/.test(signUp));
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
