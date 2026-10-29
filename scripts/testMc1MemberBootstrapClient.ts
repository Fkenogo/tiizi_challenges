/**
 * MC-1 — client member-bootstrap integration (run: npm run test:mc1-member-bootstrap).
 * Behavioural tests of the session / hand-off / identity-binding logic plus
 * source contracts proving the V2 authenticated boundary is the one place that
 * invokes bootstrap, and that archived Product V1 is untouched.
 */
import { readFileSync } from 'node:fs';
import { BootstrapIdentityMismatchError, bootstrapCapturedUser, type CapturedFirebaseUser } from '../src/v2/auth/bootstrapCapturedUser.js';
import { bootstrapGateStatus, createMemberBootstrapSession } from '../src/v2/auth/memberBootstrapSession.js';
import {
  createSignUpNameHandoff,
  resolveBootstrapDisplayName,
  SIGN_UP_NAME_HANDOFF_KEY,
  type HandoffStorage,
} from '../src/v2/auth/signUpNameHandoff.js';
import { isV2DisplayNameTooLong, normalizeV2DisplayName } from '../src/v2/auth/v2DisplayName.js';
import { InvalidSignUpNameError, runV2EmailSignUp, signOutThenClearHandoff } from '../src/v2/auth/v2SignUpFlow.js';

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok: ${name}`);
  else { failures += 1; console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`); }
}
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const ok = (id = 'm', created = true) => async () => ({ memberId: id, created });
const fakeStore = (): HandoffStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: (k) => { data.delete(k); } };
};

async function main() {
  console.log('bootstrap session behaviour');
  let calls = 0;
  const sess = createMemberBootstrapSession();
  const run = async () => { calls += 1; return { memberId: 'm1', created: true }; };
  await Promise.all([sess.ensure('uid-1', run), sess.ensure('uid-1', run), sess.ensure('uid-1', run)]);
  check('concurrent ensure for one uid shares one bootstrap call', calls === 1, `calls=${calls}`);
  await sess.ensure('uid-1', run);
  check('a bootstrapped uid does not call again', calls === 1);
  await sess.ensure('uid-2', run);
  check('a different uid bootstraps separately', calls === 2);
  let attempts = 0;
  const flaky = createMemberBootstrapSession();
  const flakyRun = async () => { attempts += 1; if (attempts === 1) throw new Error('down'); return { memberId: 'm', created: false }; };
  let failed = false;
  await flaky.ensure('uid', flakyRun).catch(() => { failed = true; });
  check('failure rejects (fail closed) and is not auto-retried', failed && attempts === 1);
  await flaky.ensure('uid', flakyRun);
  check('explicit retry re-attempts and can succeed', attempts === 2);

  console.log('V2 display-name normalisation (mirrors API bound)');
  check('trims and preserves Unicode', normalizeV2DisplayName('  Wanjiru Müller 李 ') === 'Wanjiru Müller 李');
  check('empty / whitespace / null / undefined omitted',
    normalizeV2DisplayName('   ') === null && normalizeV2DisplayName(null) === null && normalizeV2DisplayName(undefined) === null);
  check('120 code points kept, 121 omitted', normalizeV2DisplayName('x'.repeat(120)) !== null && normalizeV2DisplayName('x'.repeat(121)) === null);
  check('120 emoji (240 UTF-16 units) accepted, 121 rejected',
    normalizeV2DisplayName('😀'.repeat(120)) !== null && normalizeV2DisplayName('😀'.repeat(121)) === null);
  check('61 emoji not too long; 121 code points flagged', !isV2DisplayNameTooLong('😀'.repeat(61)) && isV2DisplayNameTooLong('x'.repeat(121)));
  check('control characters omitted', normalizeV2DisplayName('a\u0000b') === null && normalizeV2DisplayName('a\nb') === null);

  console.log('sign-up name hand-off (UID-bound, transient)');
  const h = createSignUpNameHandoff(null);
  h.set('uidA', '  Ada Lovelace ');
  check('stores the normalised name for its own uid', h.peek('uidA') === 'Ada Lovelace');
  check('cannot cross identities', h.peek('uidB') === null);
  check('precedence 1: hand-off for THIS uid beats Firebase displayName', resolveBootstrapDisplayName(h, 'uidA', 'Firebase Name') === 'Ada Lovelace');
  check('precedence 2: valid Firebase displayName when no hand-off', resolveBootstrapDisplayName(h, 'uidB', ' Grace Hopper ') === 'Grace Hopper');
  check('precedence 3: none (no email derivation)', resolveBootstrapDisplayName(h, 'uidB', null) === null && resolveBootstrapDisplayName(h, 'uidB', 'x'.repeat(121)) === null);
  h.set('uidC', '   ');
  check('unusable entered name is not retained', h.peek('uidC') === null);

  console.log('reload-safe hand-off (session storage, injectable)');
  const store = fakeStore();
  createSignUpNameHandoff(store).set('uidR', '  Reload Me ');
  const afterReload = createSignUpNameHandoff(store);
  check('survives recreation of the module within the same session', afterReload.peek('uidR') === 'Reload Me');
  check('UID A hand-off cannot be read by UID B after reload', afterReload.peek('uidB') === null);
  check('stored record holds only uid + normalised name',
    JSON.stringify(JSON.parse(store.data.get(SIGN_UP_NAME_HANDOFF_KEY) ?? '{}')) === JSON.stringify({ uid: 'uidR', name: 'Reload Me' }));
  afterReload.clear('uidB');
  check('clearing another uid keeps this uid\'s hand-off', afterReload.peek('uidR') === 'Reload Me');
  afterReload.clear('uidR');
  check('successful-bootstrap clear removes the stored record', store.data.size === 0);
  for (const bad of ['not json', '{"uid":"u","name":""}', '{"uid":7,"name":"x"}', JSON.stringify({ uid: 'u', name: 'x'.repeat(121) }), 'null', '[]']) {
    const bs = fakeStore();
    bs.data.set(SIGN_UP_NAME_HANDOFF_KEY, bad);
    check(`corrupt stored hand-off fails closed and is dropped: ${bad.slice(0, 24)}`, createSignUpNameHandoff(bs).peek('u') === null && bs.data.size === 0);
  }
  const throwing: HandoffStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  const ht = createSignUpNameHandoff(throwing);
  ht.set('uidT', 'Blocked Storage');
  check('unavailable storage degrades to the in-memory mirror', ht.peek('uidT') === 'Blocked Storage');

  console.log('V2 account creation: name recorded BEFORE any fallible follow-up');
  {
    const hs = fakeStore();
    const handoff = createSignUpNameHandoff(hs);
    const order: string[] = [];
    const user = await runV2EmailSignUp(
      {
        createUser: async () => { order.push('create'); return { uid: 'NEW' }; },
        updateProfile: async () => { order.push(`update(handoff=${handoff.peek('NEW')})`); throw new Error('profile update down'); },
        handoff,
      },
      '  Fred Kenogo ', 'fred@example.com', 'secret1',
    );
    check('returns the created user even when updateProfile rejects', user.uid === 'NEW');
    check('hand-off recorded after create and BEFORE updateProfile', order.join('>') === 'create>update(handoff=Fred Kenogo)', order.join('>'));
    // Legacy shared-signup profile-cache failure cannot matter: the V2 flow never calls it.
    check('name reaches bootstrap after updateProfile failure + reload-equivalent',
      resolveBootstrapDisplayName(createSignUpNameHandoff(hs), 'NEW', null) === 'Fred Kenogo');
    let createdCalled = false;
    const bad = await runV2EmailSignUp(
      { createUser: async () => { createdCalled = true; return { uid: 'X' }; }, updateProfile: async () => {}, handoff },
      '   ', 'a@b.co', 'secret1',
    ).catch((e) => e);
    check('invalid name rejects BEFORE any account is created', bad instanceof InvalidSignUpNameError && !createdCalled);
    const handoff2 = createSignUpNameHandoff(null);
    const failedCreate = await runV2EmailSignUp(
      { createUser: async () => { throw new Error('auth/email-already-in-use'); }, updateProfile: async () => {}, handoff: handoff2 },
      'Name', 'a@b.co', 'secret1',
    ).catch((e) => e);
    check('account-creation failure records nothing', failedCreate instanceof Error && handoff2.peek('NEW') === null);
  }

  console.log('identity-bound bootstrap: token and name from ONE captured user');
  {
    const handoff = createSignUpNameHandoff(null);
    handoff.set('A', 'Name Of A');
    const sent: Array<{ token: string; name: string | null }> = [];
    const send = async (token: string, name: string | null) => { sent.push({ token, name }); return { memberId: 'm', created: true }; };
    const userA: CapturedFirebaseUser = { uid: 'A', displayName: null, getIdToken: async () => 'token-A' };
    const res = await bootstrapCapturedUser({ user: userA, expectedUid: 'A', currentUid: () => 'A', handoff, send });
    check('A: sends A\'s token with A\'s hand-off name', res.created && sent.length === 1 && sent[0].token === 'token-A' && sent[0].name === 'Name Of A');

    sent.length = 0;
    const r1 = await bootstrapCapturedUser({ user: userA, expectedUid: 'A', currentUid: () => 'B', handoff, send }).catch((e) => e);
    check('global user already B before request: aborts, nothing sent', r1 instanceof BootstrapIdentityMismatchError && sent.length === 0);

    let live: string | null = 'A';
    const slowA: CapturedFirebaseUser = { uid: 'A', displayName: null, getIdToken: async () => { live = 'B'; return 'token-A'; } };
    const r2 = await bootstrapCapturedUser({ user: slowA, expectedUid: 'A', currentUid: () => live, handoff, send }).catch((e) => e);
    check('A -> B switch while the token is fetched: aborts, A\'s name never sent with any token', r2 instanceof BootstrapIdentityMismatchError && sent.length === 0);

    const wrong: CapturedFirebaseUser = { uid: 'B', displayName: 'B Name', getIdToken: async () => 'token-B' };
    const r3 = await bootstrapCapturedUser({ user: wrong, expectedUid: 'A', currentUid: () => 'A', handoff, send }).catch((e) => e);
    check('captured user uid != gate uid: aborts (fail closed)', r3 instanceof BootstrapIdentityMismatchError && sent.length === 0);

    const userB: CapturedFirebaseUser = { uid: 'B', displayName: null, getIdToken: async () => 'token-B' };
    await bootstrapCapturedUser({ user: userB, expectedUid: 'B', currentUid: () => 'B', handoff, send });
    check('B never receives A\'s name and A\'s token is never used for B',
      sent.length === 1 && sent[0].token === 'token-B' && sent[0].name === null);
  }

  console.log('sign-out cleanup only after success');
  {
    const handoff = createSignUpNameHandoff(fakeStore());
    handoff.set('U', 'Keep Until Signed Out');
    await signOutThenClearHandoff(async () => {}, handoff);
    check('successful logout clears the hand-off', handoff.peek('U') === null);
    handoff.set('U', 'Keep Until Signed Out');
    const err = await signOutThenClearHandoff(async () => { throw new Error('network'); }, handoff).catch((e) => e);
    check('failed logout rejects and PRESERVES the hand-off', err instanceof Error && handoff.peek('U') === 'Keep Until Signed Out');
    const sentNames: Array<string | null> = [];
    const userU: CapturedFirebaseUser = { uid: 'U', displayName: null, getIdToken: async () => 'token-U' };
    await bootstrapCapturedUser({ user: userU, expectedUid: 'U', currentUid: () => 'U', handoff, send: async (_t, n) => { sentNames.push(n); return { memberId: 'm', created: true }; } });
    let ran = 0;
    await signOutThenClearHandoff(async () => {}, handoff, () => { ran += 1; });
    await signOutThenClearHandoff(async () => { throw new Error('network'); }, handoff, () => { ran += 1; }).catch(() => undefined);
    check('after-sign-out cleanup runs on successful logout only', ran === 1);
    handoff.set('U', 'Keep Until Signed Out');
    check('retry after failed logout still resends the same name', sentNames[0] === 'Keep Until Signed Out');
  }

  console.log('handoff cleared after successful bootstrap / retained after failure');
  {
    const hh = createSignUpNameHandoff(fakeStore());
    hh.set('u1', 'Name One');
    const s1 = createMemberBootstrapSession((uid) => hh.clear(uid));
    await s1.ensure('u1', ok());
    check('hand-off cleared once bootstrap succeeded', hh.peek('u1') === null);
    const keep = createSignUpNameHandoff(fakeStore());
    keep.set('u2', 'Keep Me');
    const s2 = createMemberBootstrapSession((uid) => keep.clear(uid));
    await s2.ensure('u2', async () => { throw new Error('x'); }).catch(() => {});
    check('failed bootstrap retains the hand-off for explicit retry', keep.peek('u2') === 'Keep Me');
  }

  console.log('UID-bound ready state');
  check('ready for A is ready for A', bootstrapGateStatus({ uid: 'A', status: 'ready' }, 'A') === 'ready');
  check('direct A -> B (no null): children blocked for B', bootstrapGateStatus({ uid: 'A', status: 'ready' }, 'B') === 'working');
  check('A\'s failure does not show failure for B', bootstrapGateStatus({ uid: 'A', status: 'failed' }, 'B') === 'working');
  check('null user never reads as ready', bootstrapGateStatus({ uid: 'A', status: 'ready' }, null) === 'working');
  {
    let resolveA: (v: { memberId: string; created: boolean }) => void = () => {};
    const s = createMemberBootstrapSession();
    const pendingA = s.ensure('A', () => new Promise((r) => { resolveA = r; }));
    await s.ensure('B', ok('b'));
    resolveA({ memberId: 'a', created: true });
    await pendingA;
    check('late completion of A cannot mark B ready in the gate',
      bootstrapGateStatus({ uid: 'A', status: 'ready' }, 'B') === 'working' && bootstrapGateStatus({ uid: 'B', status: 'ready' }, 'B') === 'ready');
  }

  console.log('source contracts');
  const guard = read('src/v2/auth/V2AuthGuard.tsx');
  check('V2 authenticated boundary wraps children in the bootstrap gate', /<V2MemberBootstrapGate>\{children\}<\/V2MemberBootstrapGate>/.test(guard));
  const signUp = read('src/v2/auth/V2SignUpPage.tsx');
  const signIn = read('src/v2/auth/V2SignInPage.tsx');
  const gate = read('src/v2/auth/V2MemberBootstrapGate.tsx');
  check('auth pages do not call bootstrap or the members API themselves', !/bootstrapMember|members\/bootstrap/.test(signUp + signIn));
  check('V2 sign-up uses the V2-only flow, not the shared AuthContext.signup',
    /v2EmailSignUp\(name, email\.trim\(\), password\)/.test(signUp) && !/\bsignup\b/.test(stripComments(signUp)));
  const emailSignUp = stripComments(read('src/v2/auth/v2EmailSignUp.ts'));
  check('V2 sign-up creates the Firebase account directly and does not use the legacy profile cache',
    /createUserWithEmailAndPassword\(auth/.test(emailSignUp) && !/localStorage|AuthContext|useAuth/.test(emailSignUp));
  const flow = stripComments(read('src/v2/auth/v2SignUpFlow.ts'));
  check('flow never references email as a name source', !/email\.split|@/.test(flow.replace(/email: string/g, '')));
  check('gate renders children only through the UID-bound status', /bootstrapGateStatus\(outcome, uid\)/.test(gate) && !/state === 'ready'/.test(gate));
  check('gate sends a token from the captured user, not auth.currentUser.getIdToken',
    /bootstrapCapturedUser\(/.test(gate) && /send: bootstrapMemberWithToken/.test(gate) && !/auth\.currentUser\??\.getIdToken/.test(gate));
  check('captured-user bootstrap gets the token from the captured user only',
    /user\.getIdToken\(\)/.test(read('src/v2/auth/bootstrapCapturedUser.ts')) && !/auth\.currentUser/.test(stripComments(read('src/v2/auth/bootstrapCapturedUser.ts'))));
  check('gate sign-out and switch-account clear the hand-off only via signOutThenClearHandoff',
    /signOutThenClearHandoff\(logout, v2SignUpNameHandoff[,)]/.test(gate) && /signOutThenClearHandoff\(logout, v2SignUpNameHandoff[,)]/.test(signIn)
    && !/clearAll\(\); *(void )?logout|clearAll\(\);\s*await logout/.test(gate + signIn));
  check('gate offers a user-initiated retry and sign-out; no automatic retry timers',
    /Try again/.test(gate) && /Sign out/.test(gate) && !/setTimeout|setInterval/.test(gate));
  check('hand-off uses sessionStorage only (never localStorage / indexedDB)',
    /sessionStorage/.test(read('src/v2/auth/signUpNameHandoff.ts')) && !/localStorage|indexedDB/.test(stripComments(read('src/v2/auth/signUpNameHandoff.ts'))));
  check('sign-up name input has no HTML maxLength (UTF-16 semantics)', !/maxLength/.test(signUp));
  const api = read('src/api/memberBootstrapApi.ts');
  check('client composes the path through apiPath, POSTs, binds an explicit token; body carries only displayName',
    /apiPath\('\/members\/bootstrap'\)/.test(api) && /method: 'POST'/.test(api) && /bearerToken: token/.test(api)
    && /body: \{ displayName: name \}/.test(api) && !/auth\.currentUser/.test(stripComments(api)));
  const client = read('src/api/apiClient.ts');
  check('apiClient uses an explicit bearerToken when supplied, else unchanged auth.currentUser behaviour',
    /init\?\.bearerToken \?\? \(await auth\.currentUser\?\.getIdToken\(\)\)/.test(client));
  check('no /v1 target', !/\/v1/.test(api));

  console.log('V1 freeze');
  const v1Signup = read('src/features/Auth/SignupScreen.tsx');
  check('archived V1 SignupScreen carries no MC-1 behaviour', !/updateProfile|bootstrap|persistV2|v2EmailSignUp|src\/v2|\.\.\/v2/i.test(v1Signup));
  const shared = read('src/context/AuthContext.tsx');
  check('shared AuthContext has no MC-1 behaviour (no updateProfile, no bootstrap, no V2 import)',
    !/updateProfile|bootstrapMember|members\/bootstrap|\/v2\//.test(shared));

  if (failures > 0) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
  console.log('\nAll MC-1 client checks passed');
}
void main();
