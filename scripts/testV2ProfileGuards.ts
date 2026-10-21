/**
 * MC-2C-1 — Profile experience guards
 * (run: `npm run test:v2-profile`).
 *
 * Locks the slice behaviourally where the logic is pure, and statically where
 * the risk is a boundary regression:
 *
 *   A. initials are a presentation fallback derived from the current name,
 *      never a stored identity, and render nothing when there is no name;
 *   B. display-name validation mirrors the server bound (trimmed, 1–120 code
 *      points, no control characters) without inventing a content policy;
 *   C. Challenge episodes are grouped by the server's derived bucket only,
 *      keyed by participationId, with withdrawal + rejoin preserved;
 *   D. the client talks only to `/api/me`, sends only `{ displayName }`, and
 *      carries no email, legal URLs, V1 path, or media/upload capability;
 *   E. the screen reads email from Firebase `user.email` only — never from
 *      `AuthContext.profile` and never from the API response;
 *   F. Profile state is not persisted and this slice introduces no shared
 *      React Query cache (UID-scoped caching is MC-2C-2);
 *   G. `/v2/profile` is wired to the real screen, not the placeholder.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { V2Profile, V2ProfileChallengeItem } from '../src/api/profileApi.js';
import {
  bucketProfileChallenges,
  challengeStatusLabel,
  displayNameLength,
  groupRoleLabel,
  initialsFor,
  mergeProfileIdentity,
  PROFILE_DISPLAY_NAME_MAX,
  validateDisplayName,
} from '../src/v2/profile/profileView.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');

/** Comment-stripped source: honest prose must not trip capability checks. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok: ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function challenge(overrides: Partial<V2ProfileChallengeItem> = {}): V2ProfileChallengeItem {
  return {
    challengeId: 'c-1',
    participationId: 'p-1',
    title: 'Morning Movement',
    status: 'active',
    bucket: 'active',
    joinedAt: '2026-10-01T08:00:00.000000Z',
    exitedAt: null,
    ...overrides,
  };
}

function profile(overrides: Partial<V2Profile> = {}): V2Profile {
  return {
    memberId: 'm-1',
    displayName: 'Ada Lovelace',
    profileImage: { status: 'not_configured' },
    groups: {
      count: 3,
      items: [
        { groupId: 'g-1', name: 'Sunrise Circle', role: 'owner', status: 'active', joinedAt: '2026-10-01T08:00:00.000000Z' },
        { groupId: 'g-2', name: 'Evening Walkers', role: 'member', status: 'active', joinedAt: '2026-10-02T08:00:00.000000Z' },
      ],
      nextCursor: 'groups-page-2',
    },
    challenges: {
      activeCount: 2,
      historyCount: 1,
      totalCount: 3,
      items: [challenge(), challenge({ participationId: 'p-2', bucket: 'history', status: 'withdrawn' })],
      nextCursor: 'challenges-page-2',
    },
    ...overrides,
  };
}

// ─── A. Initials fallback ─────────────────────────────────────────────────
console.log('initials fallback');
check('first and last word initials', initialsFor('Ada Lovelace') === 'AL');
check('single word initial', initialsFor('Ada') === 'A');
check('trims surrounding whitespace', initialsFor('  grace   hopper  ') === 'GH');
check('no name renders no initial', initialsFor(null) === '' && initialsFor('   ') === '');
check('unicode code point safe', initialsFor('Élodie Ñoño') === 'ÉÑ');

// ─── B. Display-name validation ───────────────────────────────────────────
console.log('display-name validation');
const valid = validateDisplayName('  Ada Lovelace  ');
check('trims before validating', valid.ok && valid.value === 'Ada Lovelace');
check('empty rejected', validateDisplayName('   ').ok === false);
check('control characters rejected', validateDisplayName('Ada\u0000Lovelace').ok === false);
check(
  '120 code points accepted',
  validateDisplayName('😀'.repeat(PROFILE_DISPLAY_NAME_MAX)).ok === true,
);
check(
  '121 code points rejected (not UTF-16 units)',
  validateDisplayName('😀'.repeat(PROFILE_DISPLAY_NAME_MAX + 1)).ok === false,
);
check('no invented content policy beyond controls', validateDisplayName('Ada_99!').ok === true);
const decomposed = 'e\u0301'.repeat(120);
const normalisedName = validateDisplayName(decomposed);
check(
  'NFC-normalises before counting (canonically equivalent name accepted)',
  normalisedName.ok && Array.from(normalisedName.value).length === 120,
);
check('returns the normalised value for submission', normalisedName.value === 'é'.repeat(120));
check('length helper uses the same normalisation', displayNameLength(decomposed) === 120);

// ─── C. Participation identity + buckets ──────────────────────────────────
console.log('participation identity and buckets');
const episodes = [
  challenge({ participationId: 'p-1', bucket: 'active' }),
  challenge({ participationId: 'p-2', bucket: 'history', status: 'withdrawn' }),
  challenge({ participationId: 'p-3', bucket: 'history', status: 'active' }),
  challenge({ participationId: 'p-4', bucket: 'active' }),
];
const bucketed = bucketProfileChallenges(episodes);
check('server order preserved in active', bucketed.active.map((i) => i.participationId).join(',') === 'p-1,p-4');
check('server order preserved in history', bucketed.history.map((i) => i.participationId).join(',') === 'p-2,p-3');
check('no episode is duplicated across buckets', bucketed.active.length + bucketed.history.length === episodes.length);

const rejoin = bucketProfileChallenges([
  challenge({ participationId: 'p-1', bucket: 'history', status: 'withdrawn' }),
  challenge({ participationId: 'p-2', bucket: 'active' }),
]);
check(
  'withdrawal and rejoin of one Challenge stay distinct episodes',
  rejoin.history.length === 1 && rejoin.active.length === 1,
  'dedupe by challengeId would collapse these',
);
check(
  'a rejoin is keyed by participationId, not challengeId',
  rejoin.active[0].challengeId === rejoin.history[0].challengeId &&
    rejoin.active[0].participationId !== rejoin.history[0].participationId,
);

check('active participation presents Active', challengeStatusLabel(challenge()) === 'Active');
check(
  'active participation in a finalized Challenge presents Finished',
  challengeStatusLabel(challenge({ bucket: 'history', status: 'active' })) === 'Finished',
);
check('withdrawn presents Withdrawn', challengeStatusLabel(challenge({ bucket: 'history', status: 'withdrawn' })) === 'Withdrawn');
check('removed presents Removed', challengeStatusLabel(challenge({ bucket: 'history', status: 'removed' })) === 'Removed');
check('owner is presented as Steward', groupRoleLabel('owner') === 'Steward');
check('admin is presented as Admin', groupRoleLabel('admin') === 'Admin');
check('member is presented as Member', groupRoleLabel('member') === 'Member');

console.log('identity merge preserves loaded pages');
const beforeEdit = profile();
const afterEdit = profile({
  displayName: 'Ada B Lovelace',
  groups: { count: 3, items: [beforeEdit.groups.items[0]], nextCursor: null },
  challenges: { activeCount: 2, historyCount: 1, totalCount: 3, items: [], nextCursor: null },
});
const merged = mergeProfileIdentity(beforeEdit, afterEdit);
check('canonical server name wins', merged.displayName === 'Ada B Lovelace');
check('loaded Group rows are preserved', merged.groups.items.length === 2);
check('Group continuation is preserved', merged.groups.nextCursor === 'groups-page-2');
check('loaded Challenge episodes are preserved', merged.challenges.items.length === 2);
check('Challenge continuation is preserved', merged.challenges.nextCursor === 'challenges-page-2');

// ─── D. API client boundaries ─────────────────────────────────────────────
console.log('api client boundaries');
const api = code(read('src/api/profileApi.ts'));
check('uses the canonical api client', /from '\.\/apiClient'/.test(api) && /apiPath\(/.test(api));
check('targets /api/me only', api.includes('apiPath(`/me') && !/\/v1/.test(api));
check('has independent group pagination', api.includes('groupsCursor') && api.includes('groupsLimit'));
check('has independent challenge pagination', api.includes('challengesCursor') && api.includes('challengesLimit'));
check('PATCH body is exactly { displayName }', /body:\s*\{\s*displayName\s*\}/.test(api));
check('no email field is sent or read', !/\bemail\b/i.test(api));
check('no legal URL or text', !/terms|privacy|legal/i.test(api));
check('carries participationId', api.includes('participationId'));
check('carries server-derived bucket', api.includes("bucket: V2ProfileChallengeBucket")
  || api.includes('bucket: V2ProfileChallengeBucket'));

// ─── E. Screen boundaries ─────────────────────────────────────────────────
console.log('screen boundaries');
const screen = code(read('src/v2/profile/V2ProfileScreen.tsx'));
check('email comes from Firebase user', screen.includes('user?.email'));
check('never reads AuthContext.profile.email', !/profile\??\.email/.test(screen));
check('never imports AuthContext directly', !/AuthContext/.test(screen));
check('does not import the legacy profile cache', !/tiizi_profile/.test(screen));
check('no upload or media control', !/type=["']file["']|upload|media_assets/i.test(screen));
check('no V1 or legal routes', !/\/app\/|\/v1|\/terms|\/privacy/i.test(screen));
check('challenge rows keyed by participationId', screen.includes('key={item.participationId}'));
check('name edits submit through the hook', screen.includes('saveDisplayName'));
check('does not claim a failed save means nothing changed', /may already be updated/.test(screen));
check('name input has no UTF-16 maxLength attribute', !/maxLength=/.test(screen));
check('name length is enforced in code points', screen.includes('displayNameLength(value) > PROFILE_DISPLAY_NAME_MAX'));

// ─── F. No persistence / no shared cache in this slice ────────────────────
console.log('cache and persistence boundary');
const hook = code(read('src/v2/profile/useV2Profile.ts'));
check('no localStorage/sessionStorage/IndexedDB', !/localStorage|sessionStorage|indexedDB/i.test(hook + screen));
check('no React Query cache in MC-2C-1', !/tanstack\/react-query/.test(hook + screen));
check('resets identity-scoped state on uid change', hook.includes('[uid]') && hook.includes('activeUid'));
check('discards late reads from a previous identity', hook.includes('requestSeq'));
check(
  'page reads are superseded by reloads and saves',
  (hook.match(/requestSeq\.current !== seq/g) ?? []).length >= 6,
);

// ─── G. Route wiring ──────────────────────────────────────────────────────
console.log('route wiring');
const routes = code(read('src/v2/routes.tsx'));
check('profile route renders the real screen', /path="profile"\s+element=\{<V2ProfileScreen\s*\/>\}/.test(routes));
check('placeholder profile page is gone', !/V2ProfilePage/.test(routes)
  && !/V2ProfilePage/.test(code(read('src/v2/member/memberPages.tsx'))));

if (failures > 0) {
  console.error(`\n${failures} Profile guard(s) failed.`);
  process.exit(1);
}
console.log('\nAll Profile guards passed.');
