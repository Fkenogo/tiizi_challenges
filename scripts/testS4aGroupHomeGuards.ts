/**
 * TIIZI S4a — Group Home / comprehensive creation guards
 * (run: npm run test:s4a-group-home).
 *
 * Bounds the S4a product slice behaviorally (pure view models where
 * practical) plus static no-leak proofs over the new Group experience:
 *
 *   A. Groups → Create Group exposes only authorized fields (identity +
 *      the three governed Community Setup choices; no media, location,
 *      tagline, rules, Charter, Council, admin-role, or invite controls).
 *   B. Successful creation routes to the canonical returned Group ID
 *      (`/v2/groups/:groupId`) — never left on the form, never only the list.
 *   C. Group Home binds API/read truth (detail + hosted scope) with
 *      loading / error / not-found / empty states and refetch convergence.
 *   D. Hosted-Challenge rows reuse the existing Challenge presentation and
 *      navigate the existing Challenge routes (no second Challenge engine,
 *      no Group Leaderboard, no Feed).
 *   E. Refresh-safe, no manufactured authority: no direct Firestore or
 *      PostgreSQL access, no V1 fallback, no duplicate Group store, no
 *      client-declared stewardship/counts/settings.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  groupHomeViewFor,
  viewerMayCreateChallenge,
  type GroupHomeQueryState,
} from '../src/v2/groups/groupHomeView.js';
import { toCreateGroupInput, EMPTY_GROUP_DRAFT } from '../src/v2/groups/groupDraft.js';
import type { V2GroupDetail } from '../src/api/groupsApi.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok: ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function walk(dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = join(dir, entry.name);
    return entry.isDirectory() ? walk(rel) : [rel];
  });
}

/**
 * Forbidden-capability checks run on comment-stripped sources: header
 * comments honestly name what is NOT offered (media, Feed, Leaderboard…),
 * and that documentation must not trip the guards. A real control lives in
 * code, never in a comment.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('//');
      return idx < 0 ? line : line.slice(0, idx);
    })
    .join('\n');
}

const groupFiles = walk('src/v2/groups').filter((path) => /\.(ts|tsx)$/.test(path));
const groupSources = groupFiles.map((path) => ({ path, source: read(path) }));
const anyGroupSource = groupSources.map((entry) => entry.source).join('\n');
const anyGroupCode = groupSources.map((entry) => stripComments(entry.source)).join('\n');
const createScreen = read('src/v2/groups/V2CreateGroupScreen.tsx');
const createCode = stripComments(createScreen);
const homeScreen = read('src/v2/groups/V2GroupHomeScreen.tsx');
const homeCode = stripComments(homeScreen);
const homeView = read('src/v2/groups/groupHomeView.ts');
const routes = read('src/v2/routes.tsx');

// ─── A. Creation exposes only authorized fields ───────────────────────────
console.log('creation fields');
check('creation has the Identity section', createScreen.includes('Section 1 — Identity'));
check('creation has the Community Setup section', createScreen.includes('Section 2 — Community setup'));
for (const label of ['Discoverable', 'Private', 'Join directly', 'Requires approval', 'Members can create', 'Steward creates']) {
  check(`creation offers member-worded choice "${label}"`, createScreen.includes(label));
}
check('creation never names raw backend fields',
  !/isPrivate|requireAdminApproval|allowMemberChallenges/.test(
    createCode.replace(/draft\.(isPrivate|requireAdminApproval|allowMemberChallenges)/g, '')
      .replace(/setDraft\(\(current\) => \(\{\s*\.\.\.current,\s*(isPrivate|requireAdminApproval|allowMemberChallenges)/g, ''),
  ));
for (const forbidden of [
  'coverImageUrl', 'Select Image', 'Upload', 'location', 'Location', 'tagline', 'Tagline',
  'rules', 'Rules', 'Charter', 'charter', 'Council', 'council', 'Admins', 'Group Admin',
  'admin role', 'Admin role', 'inviteCode',
  'invite link', 'Invite link', 'Send invite', 'Invite members', 'moderation', 'Moderation',
]) {
  check(`creation has no "${forbidden}" control`, !createCode.includes(forbidden), forbidden);
}
check('creation has no Invite CTA (plain-language "invited" copy is fine)',
  !/Invite Group|Invite to|Invite member|onInvite|>Invite</.test(createCode));
check('creation submits the governed flags through the shared draft contract',
  createScreen.includes('toCreateGroupInput(draft)') && createScreen.includes('useCreateGroup()'));
check('draft defaults mirror the governed authority (open + permitted)',
  EMPTY_GROUP_DRAFT.isPrivate === false
  && EMPTY_GROUP_DRAFT.requireAdminApproval === false
  && EMPTY_GROUP_DRAFT.allowMemberChallenges === true);
check('transport carries the governed flags',
  JSON.stringify(toCreateGroupInput({ ...EMPTY_GROUP_DRAFT, name: 'G' }))
    .includes('"allowMemberChallenges":true'));

// ─── B. Creation routes to the persisted Group Home ───────────────────────
console.log('creation → home navigation');
check('success navigates to the canonical returned Group ID',
  /navigate\(`\/v2\/groups\/\$\{created\.id\}`/.test(createScreen));
check('navigation replaces the form entry (no back-to-form trap)',
  createScreen.includes('replace: true'));
check('Home route is mounted with the id from route params',
  routes.includes('path="groups/:groupId"') && routes.includes('V2GroupHomeScreen')
  && routes.includes('V2GroupScope'));
check('landing cards navigate into Group Home',
  read('src/v2/groups/V2GroupsScreen.tsx').includes('navigate(`/v2/groups/${membership.groupId}`)'));

// ─── C. Home binds read truth with honest states ──────────────────────────
console.log('home read binding');
check('Home reads the canonical detail contract', homeScreen.includes('useV2GroupDetail'));
check('Home reads the governed hosted scope', homeScreen.includes('useV2GroupChallenges'));
check('Home classifies through the pure view model', homeScreen.includes('groupHomeViewFor('));
check('Home has loading state', homeScreen.includes('Loading this Group'));
check('Home has error state with retry', homeScreen.includes('We could not load this Group'));
check('Home has not-found state with a way back', homeScreen.includes('We could not find this Group'));
check('Home has hosted empty state', homeScreen.includes('No Challenges here yet'));
check('join from Home reuses the governed join authority',
  homeScreen.includes('useJoinGroup') && read('src/api/groupsApi.ts').includes('/v1/groups/${groupId}/join'));

function query(overrides: Partial<GroupHomeQueryState>): GroupHomeQueryState {
  return { isLoading: false, isError: false, isSuccess: false, detail: undefined, ...overrides };
}
function detail(overrides: Partial<V2GroupDetail> = {}): V2GroupDetail {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    name: 'Home Group',
    description: '',
    isPrivate: false,
    requireAdminApproval: false,
    allowMemberChallenges: true,
    memberCount: 3,
    steward: { memberId: '66666666-6666-4666-8666-666666666666' },
    viewerMembership: { status: 'active', role: 'member' },
    viewerRelationship: 'member',
    createdAt: '2026-09-23T10:00:00.000Z',
    ...overrides,
  };
}
check('loading classifies first', groupHomeViewFor(query({ isLoading: true, isError: true })).kind === 'loading');
check('404 classifies as not-found (unknown/inactive/private all alike)',
  groupHomeViewFor(query({ isError: true, errorStatus: 404 })).kind === 'notFound');
check('genuine failure classifies as error (never masked)',
  groupHomeViewFor(query({ isError: true, errorStatus: 500 })).kind === 'error');
check('success without detail is an error, never a blank home',
  groupHomeViewFor(query({ isSuccess: true })).kind === 'error');
check('success with the server detail renders home',
  (() => {
    const out = groupHomeViewFor(query({ isSuccess: true, detail: detail() }));
    return out.kind === 'home' && out.detail.name === 'Home Group';
  })());
check('members may create where open', viewerMayCreateChallenge(detail()) === true);
check('members may not create under steward restriction',
  viewerMayCreateChallenge(detail({ allowMemberChallenges: false })) === false);
check('stewards may create under steward restriction',
  viewerMayCreateChallenge(detail({ allowMemberChallenges: false, viewerRelationship: 'steward' })) === true);
check('outsiders are never offered creation',
  viewerMayCreateChallenge(detail({ viewerRelationship: 'none' })) === false
  && viewerMayCreateChallenge(detail({ viewerRelationship: 'pending' })) === false);

// ─── D. Hosted Challenges reuse existing Truth ────────────────────────────
console.log('hosted challenges');
check('rows reuse the shared participation/end-state presentation',
  homeScreen.includes('participationLabel(') && homeScreen.includes('endStateFor(')
  && homeScreen.includes('statusTone('));
check('rows navigate the existing Challenge detail route',
  homeScreen.includes('`/v2/challenges/${challengeId}`'));
check('empty state links creation with the Group context preserved',
  homeScreen.includes("state: { groupId: view.detail.id }")
  && homeScreen.includes("'/v2/challenges/new'"));
check('no Group Leaderboard in Group code',
  !/leaderboard|Leaderboard|Top Performers|global ranking|Global ranking/i.test(anyGroupCode));
check('no Feed in Group code', !/\bFeed\b|\bfeed\b/.test(anyGroupCode.replace(/refetch|refresh/gi, '')));
check('creation CTA is permission-gated by the server projection',
  homeScreen.includes('viewerMayCreateChallenge('));

// ─── E. No manufactured authority ─────────────────────────────────────────
console.log('authority boundary');
for (const { path, source } of groupSources) {
  check(`${path}: no Firestore runtime`,
    !/firebase(\/|['"])|firebase-admin|lib\/firebase|addDoc\(|setDoc\(|updateDoc\(|deleteDoc\(|writeBatch|runTransaction|getDoc\(|getDocs\(|collection\(/.test(source));
  check(`${path}: no direct PostgreSQL access`,
    !/from ['"]pg['"]|DATABASE_URL|new Pool|\.query\(/.test(source));
}
check('no client-declared stewardship or counts',
  !/stewardId|ownerId|memberCount\s*:\s*\d|memberCount\s*=\s*(?![=>])\d|setSteward|makeSteward/i.test(anyGroupCode));
check('view model imports API types only (no stores/mutations)',
  !/import[^;]*(Store|useMutation|participation|leaderboard)/i.test(homeView));
check('no V1 experience in Group Home',
  !/from '\.\.\/\.\.\/features\//.test(homeCode) && !/\bBottomNav\b/.test(homeCode));
check('wizard honors a Group Home handoff only against real memberships',
  read('src/v2/challenges/V2ChallengeCreationWizard.tsx').includes('location.state')
  && read('src/v2/challenges/V2ChallengeCreationWizard.tsx').includes('list.find((membership) => membership.groupId === hinted)'));

if (failures > 0) {
  console.error(`\nS4a Group Home guards: ${failures} failure(s).`);
  process.exit(1);
}
console.log('\nS4a Group Home guards: all passing.');
