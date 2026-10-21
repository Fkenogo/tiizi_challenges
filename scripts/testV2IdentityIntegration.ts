/**
 * MC-2C-2 — identity integration, account-switch isolation and profile
 * presentation guards (run: `npm run test:v2-identity`).
 *
 * Behavioural where the risk is cache/ownership state, static where the risk
 * is a boundary regression:
 *
 *   A. the identity query key is UID-scoped and the selected projection
 *      carries no summary pages;
 *   B. an account switch drops the previous member's slot and leaves the next
 *      member's slot untouched;
 *   C. late reads and late writes from a superseded identity are rejected;
 *   D. sign-out clears identity and Today caches before Firebase sign-out;
 *   E. a successful save updates the shared identity immediately and
 *      invalidates it so the server re-proves the name;
 *   F. an uncertain save reconciles from a canonical read without claiming
 *      success, and preserves already-loaded summary pages;
 *   G. Today and the member shell consume the canonical identity instead of
 *      the legacy AuthContext profile cache;
 *   H. no V1 legal dependency, invented legal text, or media capability is
 *      introduced.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../src/api/apiError.js';
import type { V2Profile } from '../src/api/profileApi.js';
import {
  clearV2MemberIdentity,
  invalidateV2MemberIdentity,
  readV2MemberIdentity,
  removeV2MemberIdentity,
  selectV2MemberIdentity,
  setV2MemberIdentity,
  v2MemberIdentityKey,
  V2_MEMBER_IDENTITY_SCOPE,
} from '../src/v2/profile/memberIdentityQuery.js';
import {
  isUncertainProfileWriteFailure,
  ProfileSaveUncertainError,
  profileResponseIsCurrent,
  reconcileProfileIdentity,
  writeOwnedV2MemberIdentity,
} from '../src/v2/profile/profileWriteState.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');
const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok: ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const UID_A = 'uid-member-a';
const UID_B = 'uid-member-b';

function profileFor(uid: string, displayName: string): V2Profile {
  return {
    memberId: `member-${uid}`,
    displayName,
    profileImage: { status: 'not_configured' },
    groups: {
      count: 2,
      items: [
        { groupId: 'g-1', name: 'Sunrise Circle', role: 'owner', status: 'active', joinedAt: '2026-10-01T08:00:00.000000Z' },
      ],
      nextCursor: 'groups-page-2',
    },
    challenges: {
      activeCount: 1,
      historyCount: 0,
      totalCount: 1,
      items: [
        {
          challengeId: 'c-1',
          participationId: 'p-1',
          title: 'Morning Movement',
          status: 'active',
          bucket: 'active',
          joinedAt: '2026-10-01T08:00:00.000000Z',
          exitedAt: null,
        },
      ],
      nextCursor: 'challenges-page-2',
    },
  };
}

const client = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: Infinity } },
});

console.log('UID-scoped identity key and projection');
check('scope is explicit', V2_MEMBER_IDENTITY_SCOPE === 'v2-member-identity');
check('key carries the uid', v2MemberIdentityKey(UID_A)[1] === UID_A);
check('different members use different keys', v2MemberIdentityKey(UID_A).join('|') !== v2MemberIdentityKey(UID_B).join('|'));
check('signed-out key is not a member key', v2MemberIdentityKey(undefined)[1] === undefined);
const selected = selectV2MemberIdentity(profileFor(UID_A, 'Ada Lovelace'));
check('projection exposes identity only', Object.keys(selected).sort().join(',') === 'displayName,memberId,profileImage');
check('projection never exposes summary pages', !('groups' in selected) && !('challenges' in selected));
check('projection never exposes email', !('email' in selected));

console.log('account-switch cache isolation');
setV2MemberIdentity(client, UID_A, profileFor(UID_A, 'Ada Lovelace'));
setV2MemberIdentity(client, UID_B, profileFor(UID_B, 'Bola Adeyemi'));
check('member A reads A', readV2MemberIdentity(client, UID_A)?.displayName === 'Ada Lovelace');
check('member B reads B', readV2MemberIdentity(client, UID_B)?.displayName === 'Bola Adeyemi');
check('signed-out read returns nothing', readV2MemberIdentity(client, undefined) === undefined);
await removeV2MemberIdentity(client, UID_A);
check('leaving A drops A', readV2MemberIdentity(client, UID_A) === undefined);
check('leaving A leaves B intact', readV2MemberIdentity(client, UID_B)?.displayName === 'Bola Adeyemi');
setV2MemberIdentity(client, undefined, profileFor(UID_A, 'Ignored'));
check('writing without a uid is a no-op', client.getQueryData(v2MemberIdentityKey(undefined)) === undefined);

console.log('late responses from a previous identity');
check(
  'current response is owned',
  profileResponseIsCurrent({ responseUid: UID_A, activeUid: UID_A, responseSeq: 4, activeSeq: 4 }),
);
check(
  'response for A is rejected while B is active',
  !profileResponseIsCurrent({ responseUid: UID_A, activeUid: UID_B, responseSeq: 4, activeSeq: 4 }),
);
check(
  'superseded request sequence is rejected',
  !profileResponseIsCurrent({ responseUid: UID_A, activeUid: UID_A, responseSeq: 4, activeSeq: 5 }),
);
check(
  'signed-out response is rejected',
  !profileResponseIsCurrent({ responseUid: UID_A, activeUid: null, responseSeq: 4, activeSeq: 5 }),
);

setV2MemberIdentity(client, UID_B, profileFor(UID_B, 'Bola Adeyemi'));
const lateWrite = writeOwnedV2MemberIdentity(client, {
  responseUid: UID_A,
  activeUid: UID_B,
  responseSeq: 3,
  activeSeq: 4,
  profile: profileFor(UID_A, 'Late Ada'),
});
check('late A write is refused', lateWrite === null);
check('late A write cannot recreate A', readV2MemberIdentity(client, UID_A) === undefined);
check('late A write cannot rename B', readV2MemberIdentity(client, UID_B)?.displayName === 'Bola Adeyemi');

const ownedWrite = writeOwnedV2MemberIdentity(client, {
  responseUid: UID_A,
  activeUid: UID_A,
  responseSeq: 7,
  activeSeq: 7,
  profile: profileFor(UID_A, 'Ada B Lovelace'),
});
check('owned write is applied', ownedWrite?.displayName === 'Ada B Lovelace');
check('owned write lands in the member slot', readV2MemberIdentity(client, UID_A)?.displayName === 'Ada B Lovelace');

console.log('sign-out and in-flight work');
await clearV2MemberIdentity(client);
check('sign-out clears member A', readV2MemberIdentity(client, UID_A) === undefined);
check('sign-out clears member B', readV2MemberIdentity(client, UID_B) === undefined);

let transportCalls = 0;
const inflight = client.fetchQuery({
  queryKey: v2MemberIdentityKey(UID_A),
  queryFn: () =>
    new Promise<V2Profile>((resolve) => {
      transportCalls += 1;
      setTimeout(() => resolve(profileFor(UID_A, 'In flight Ada')), 5);
    }),
});
await removeV2MemberIdentity(client, UID_A);
await inflight.catch(() => undefined);
await new Promise((resolve) => setTimeout(resolve, 15));
check('removal cancels the in-flight identity read', readV2MemberIdentity(client, UID_A) === undefined);
check('removal does not keep stale data', client.getQueryData(v2MemberIdentityKey(UID_A)) === undefined);

console.log('switch back to a previous member');
transportCalls = 0;
const refetched = await client.fetchQuery({
  queryKey: v2MemberIdentityKey(UID_A),
  queryFn: async () => {
    transportCalls += 1;
    return profileFor(UID_A, 'Ada Again');
  },
  staleTime: 30_000,
});
check('a cleared member is fetched again', transportCalls === 1);
check('the fresh read is owned by A', refetched.displayName === 'Ada Again');
check('the fresh read is readable', readV2MemberIdentity(client, UID_A)?.displayName === 'Ada Again');

console.log('post-save cache update');
setV2MemberIdentity(client, UID_A, profileFor(UID_A, 'Ada Saved'));
check('identity consumers see the saved name immediately', readV2MemberIdentity(client, UID_A)?.displayName === 'Ada Saved');
await invalidateV2MemberIdentity(client, UID_A);
check('save invalidates the identity slot', client.getQueryState(v2MemberIdentityKey(UID_A))?.isInvalidated === true);

console.log('uncertain write reconciliation');
check('500 is uncertain', isUncertainProfileWriteFailure(new ApiError(500, 'profile_summary_unavailable', 'x')));
check('503 is uncertain', isUncertainProfileWriteFailure(new ApiError(503, 'api_unreachable', 'x')));
check('408 is uncertain', isUncertainProfileWriteFailure(new ApiError(408, 'timeout', 'x')));
check('network failure is uncertain', isUncertainProfileWriteFailure(new TypeError('Failed to fetch')));
check('400 is definitive', !isUncertainProfileWriteFailure(new ApiError(400, 'invalid_display_name', 'x')));
check('401 is definitive', !isUncertainProfileWriteFailure(new ApiError(401, 'unauthenticated', 'x')));
check('429 is definitive', !isUncertainProfileWriteFailure(new ApiError(429, 'rate_limited', 'x')));

const loadedWithPages = profileFor(UID_A, 'Old Name');
const canonicalAfterUncertain = profileFor(UID_A, 'Canonical Name');
canonicalAfterUncertain.groups = { count: 1, items: [], nextCursor: null };
canonicalAfterUncertain.challenges = { activeCount: 0, historyCount: 0, totalCount: 0, items: [], nextCursor: null };
const reconciled = await reconcileProfileIdentity({
  current: loadedWithPages,
  readCanonical: async () => canonicalAfterUncertain,
});
check('canonical server name wins after an uncertain save', reconciled.displayName === 'Canonical Name');
check('loaded Group rows survive reconciliation', reconciled.groups.items.length === 1);
check('Group continuation survives reconciliation', reconciled.groups.nextCursor === 'groups-page-2');
check('loaded Challenge episodes survive reconciliation', reconciled.challenges.items.length === 1);
check('Challenge continuation survives reconciliation', reconciled.challenges.nextCursor === 'challenges-page-2');

const canonicalOnly = await reconcileProfileIdentity({
  current: null,
  readCanonical: async () => canonicalAfterUncertain,
});
check('reconciliation without loaded state returns canonical', canonicalOnly.displayName === 'Canonical Name');

const uncertainSuccess = new ProfileSaveUncertainError(new ApiError(500, 'x', 'x'), true);
const uncertainUnreconciled = new ProfileSaveUncertainError(new TypeError('offline'), false);
check('reconciled uncertain error is explicit', uncertainSuccess.reconciled === true);
check('unreconciled uncertain error stays honest', uncertainUnreconciled.reconciled === false);
check('uncertain error is an Error', uncertainSuccess instanceof Error);

console.log('consumer migration and boundaries');
const today = code(read('src/v2/today/V2TodayScreen.tsx'));
check('Today uses the canonical identity hook', today.includes('useV2MemberIdentity'));
check('Today no longer greets from AuthContext.profile', !/profile\??\.displayName/.test(today) && !/useAuth/.test(today));

const shell = code(read('src/v2/member/MemberShell.tsx'));
check('member shell reads the canonical identity', shell.includes('useV2MemberIdentity'));
check('member shell presents the canonical name', shell.includes('identity.displayName'));
check('member shell no longer hardcodes the trigger name', !/name="Member"/.test(shell));
check('member shell reads email from Firebase user', shell.includes('user?.email'));
check('member shell offers sign-out', shell.includes('Sign out') && shell.includes('useV2SignOut'));
check('member shell does not read the legacy cache', !/tiizi_profile/.test(shell));

const profileScreen = code(read('src/v2/profile/V2ProfileScreen.tsx'));
check(
  'an account switch resets the editor and ignores stale feedback',
  profileScreen.includes('uidRef') && profileScreen.includes('setEditing(false)')
    && profileScreen.includes('uidRef.current !== uidAtSubmit'),
);

const routes = code(read('src/v2/routes.tsx'));
check('route scope clears the previous member identity', routes.includes('removeV2MemberIdentity') && routes.includes('priorUid'));

const signOut = code(read('src/v2/profile/useV2SignOut.ts'));
const clearIndex = signOut.indexOf('clearV2MemberIdentity');
const logoutIndex = signOut.indexOf('await logout()');
check('sign-out clears identity before Firebase sign-out', clearIndex >= 0 && logoutIndex > clearIndex);
check('sign-out also drops Today', signOut.includes('V2_TODAY_SCOPE'));

const profileHook = code(read('src/v2/profile/useV2Profile.ts'));
check('save goes through owned identity writes', profileHook.includes('writeOwnedV2MemberIdentity'));
check('uncertain save reconciles rather than asserting failure', profileHook.includes('reconcileProfileIdentity'));
check(
  'a superseded save cannot release the newer save lock',
  profileHook.includes('saveSeq') && profileHook.includes('savingRef'),
);
check('no storage persistence in identity code', !/localStorage|sessionStorage|indexedDB/i.test(
  code(read('src/v2/profile/memberIdentityQuery.ts')) + code(read('src/v2/profile/useV2MemberIdentity.ts')),
));

const identity = code(read('src/v2/profile/memberIdentityQuery.ts'));
check('identity transport is the governed /api client', identity.includes('fetchV2Profile') && !/\/v1/.test(identity));
check('identity carries no email', !/\bemail\b/i.test(identity));
check('identity carries no legal reference', !/terms|privacy|legal/i.test(identity));
check('identity carries no media upload', !/upload|type=["']file["']/i.test(identity));

const signUp = code(read('src/v2/auth/V2SignUpPage.tsx'));
check('V2 sign-up no longer links to V1 legal routes', !/\/terms|\/privacy/.test(signUp));
check('V2 sign-up states the legal dependency honestly', signUp.includes('not published yet'));
check('V2 sign-up invents no legal wording', !/agree to our/i.test(signUp));

if (failures > 0) {
  console.error(`\n${failures} identity integration guard(s) failed.`);
  process.exit(1);
}
console.log('\nAll identity integration guards passed.');
