/**
 * TIIZI S1 CORR-001 — focused V2 auth return-path tests
 * (run: npm run test:v2-auth-returns).
 *
 * The V2 sign-in/sign-up experience must return the member to the
 * requested V2 route and must never emit a V1 return path. These
 * pure-contract tests pin resolveV2NextPath behaviour.
 */
import { resolveV2NextPath, V2_DEFAULT_NEXT, v2NextQuery } from '../src/v2/auth/v2NextPath.js';

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ok: ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('V2 return-path resolution');

check('empty next falls back to V2 Today', resolveV2NextPath(null) === V2_DEFAULT_NEXT);
check('undefined next falls back to V2 Today', resolveV2NextPath(undefined) === V2_DEFAULT_NEXT);
check('V2 Today passes through', resolveV2NextPath('/v2/today') === '/v2/today');
check('V2 deep route passes through', resolveV2NextPath('/v2/challenges') === '/v2/challenges');
check('V2 route with query passes through', resolveV2NextPath('/v2/groups?tab=invites') === '/v2/groups?tab=invites');
check('V2 operator route passes through', resolveV2NextPath('/v2/operator/overview') === '/v2/operator/overview');

console.log('V1 return paths rejected');
for (const hostile of [
  '/app/login',
  '/app/login?next=%2Fv2%2Ftoday',
  '/app/signup',
  '/app/home',
  '/app/onboarding/intro',
  '/app/groups',
]) {
  check(`rejected: ${hostile}`, resolveV2NextPath(hostile) === V2_DEFAULT_NEXT);
}

console.log('open-redirect shapes rejected');
for (const hostile of [
  'https://evil.example/v2/today',
  '//evil.example/v2/today',
  'javascript:alert(1)',
  '/\\evil',
  '/v2\\today',
  '%2Fapp%2Flogin',
  '/other',
  '/',
  '',
]) {
  check(`rejected: ${hostile || '(empty)'}`, resolveV2NextPath(hostile) === V2_DEFAULT_NEXT);
}

console.log('bare /v2 normalises to V2 Today');
check('bare /v2', resolveV2NextPath('/v2') === V2_DEFAULT_NEXT);

console.log('auth-screen link helper');
check('default next emits no query', v2NextQuery(V2_DEFAULT_NEXT) === '');
check('deep next is encoded once', v2NextQuery('/v2/groups?tab=invites') === '?next=%2Fv2%2Fgroups%3Ftab%3Dinvites');

if (failures > 0) {
  console.error(`\nV2 auth return-path tests: ${failures} failure(s).`);
  process.exit(1);
}
console.log('\nV2 auth return-path tests: all passing.');
