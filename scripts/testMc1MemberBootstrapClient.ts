/**
 * MC-1 — client member-bootstrap integration (run: npm run test:mc1-member-bootstrap).
 * Behavioural tests of the session logic plus source contracts proving the V2
 * authenticated boundary is the one place that invokes bootstrap, for every
 * sign-in path (email sign-up, sign-in, Google).
 */
import { readFileSync } from 'node:fs';
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
  let failed = false;
  await flaky.ensure('uid').catch(() => { failed = true; });
  check('failure rejects (fail closed, not treated as provisioned)', failed);
  check('failure is not auto-retried', attempts === 1);
  await flaky.ensure('uid');
  check('explicit retry re-attempts and can succeed', attempts === 2);

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
  check('client composes the path through apiPath and POSTs with no body',
    /apiPath\('\/members\/bootstrap'\)/.test(api) && /method: 'POST'/.test(api) && !/body:/.test(api));
  check('no /v1 target', !/\/v1/.test(api));
  const authCtx = read('src/context/AuthContext.tsx');
  check('shared AuthContext (V1-shared) is untouched by MC-1', !/bootstrap/i.test(authCtx));

  if (failures > 0) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
  console.log('\nAll MC-1 client checks passed');
}
void main();
