/**
 * S3a Groups zero-state guards
 * (run: npm run test:s3a-groups-zero-state).
 *
 * TIIZI-S3A-FOUNDER-PREVIEW-CORR-001: the Founder preview failure was a
 * runtime defect (a superseded preview served the screen and rejected the
 * session token), NOT a broken read contract. These guards lock the
 * contract behaviorally against the REAL view model so the valid
 * zero-membership state can never silently become an error again:
 *
 *   A. authenticated zero-membership read renders EMPTY (never ERROR);
 *   B. the empty state targets the EXISTING governed Group-creation
 *      route (/v2/groups/new) — no second creation experience;
 *   C. genuine request failure still renders ERROR (no masking);
 *   D. existing memberships render LIST with the server's own rows
 *      (nothing invented client-side);
 *   E. loading/disabled queries never present error or empty states;
 *   F. the view manufactures no Group/Challenge/participation state;
 *   G. the screen binds the view model (no forked branch logic).
 */
import { readFileSync } from 'node:fs';
import {
  groupsViewFor,
  V2_GROUPS_NEW_PATH,
} from '../src/v2/groups/groupsView.js';
import type { ApiMembership } from '../src/api/membershipsApi.js';

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok: ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const read = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function membership(overrides: Partial<ApiMembership> = {}): ApiMembership {
  return {
    groupId: '33333333-3333-4333-8333-333333333333',
    role: 'owner',
    status: 'active',
    joinedAt: '2026-09-18T12:00:00.000Z',
    group: {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Karura Sunrise Runners',
      description: '',
      isPrivate: false,
    },
    ...overrides,
  };
}

// A. Authenticated zero-membership read → honest EMPTY, never ERROR.
const empty = groupsViewFor({ isLoading: false, isError: false, isSuccess: true, memberships: [] });
check('zero memberships renders empty (not error)', empty.kind === 'empty', JSON.stringify(empty.kind));
const undefinedOnSuccess = groupsViewFor({
  isLoading: false,
  isError: false,
  isSuccess: true,
  memberships: undefined,
});
check('missing memberships array still renders empty', undefinedOnSuccess.kind === 'empty');

// B. Empty state targets the EXISTING governed creation route.
check('creation CTA targets governed /v2/groups/new', V2_GROUPS_NEW_PATH === '/v2/groups/new', V2_GROUPS_NEW_PATH);
const routes = read('src/v2/routes.tsx');
check(
  'governed route mounts groups/new',
  routes.includes('path="groups/new"') && routes.includes('V2CreateGroupScreen'),
);
const screen = read('src/v2/groups/V2GroupsScreen.tsx');
check('screen navigates empty CTA through the shared route constant', screen.includes('navigate(V2_GROUPS_NEW_PATH)'));
check('screen creates no Group inline (no second creation experience)', !/createGroup\s*\(/.test(screen));

// C. Genuine failure still renders ERROR (never masked as empty/list).
const failed = groupsViewFor({ isLoading: false, isError: true, isSuccess: false, memberships: undefined });
check('request failure renders error', failed.kind === 'error');
const failedWithStale = groupsViewFor({ isLoading: false, isError: true, isSuccess: false, memberships: [membership()] });
check('failure with stale rows still renders error', failedWithStale.kind === 'error');

// D. Existing memberships render LIST with the server rows, unmodified.
const mine = [membership(), membership({ groupId: '44444444-4444-4444-8444-444444444444' })];
const listed = groupsViewFor({ isLoading: false, isError: false, isSuccess: true, memberships: mine });
check('existing memberships render list', listed.kind === 'list');
if (listed.kind === 'list') {
  check('list passes server rows through unchanged', JSON.stringify(listed.memberships) === JSON.stringify(mine));
}

// E. Loading/disabled queries never present error or empty states.
const loading = groupsViewFor({ isLoading: true, isError: false, isSuccess: false, memberships: undefined });
check('loading renders loading', loading.kind === 'loading');
const idle = groupsViewFor({ isLoading: false, isError: false, isSuccess: false, memberships: undefined });
check('disabled query stays idle (renders nothing)', idle.kind === 'idle');

// F. The view manufactures no product state and touches no participation.
const viewSource = read('src/v2/groups/groupsView.ts');
check('view imports membership types only (no stores/mutations)', !/import[^;]*(Store|Mutation|useMutation|participation|challenge|groupCreation)/i.test(viewSource));
check(
  'view outputs carry only the query rows (no invented groups)',
  (() => {
    const out = groupsViewFor({ isLoading: false, isError: false, isSuccess: true, memberships: [] });
    return out.kind === 'empty' && !('memberships' in out);
  })(),
);
// G. The screen binds the single view model (no forked branch logic).
check('screen classifies through groupsViewFor', screen.includes('groupsViewFor('));
check('screen has no parallel isSuccess-length branches', !/groups\.isSuccess && (memberships|groups\.data)/.test(screen));
check('screen keeps the error copy + retry', screen.includes('We could not load your Groups') && screen.includes('groups.refetch()'));

if (failures > 0) {
  console.error(`\nS3a Groups zero-state guards: ${failures} failure(s).`);
  process.exit(1);
}
console.log('\nS3a Groups zero-state guards: all passing.');
