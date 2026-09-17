/**
 * TIIZI S2-G — Group establishment boundary guards (run: npm run test:s2g-group-establishment).
 *
 * The web app has no unit-test runner; like the other guard scripts this
 * file runs pure-contract assertions plus static no-leak proofs over the
 * minimum V2 Group establishment slice:
 *
 * - draft validation is UX completeness only (server stays authority);
 * - member-facing stewardship language is singular "Accountable Steward";
 * - the read contract is the SAME `GET /v1/memberships/me` the Challenge
 *   journey consumes — no second Group integration mechanism;
 * - establishment submits only name + optional description through
 *   `POST /v1/groups`; no client-generated owner/steward or actor identity;
 * - no direct Firestore write and no direct PostgreSQL access from V2;
 * - no hard-coded preview Group;
 * - src/v2/groups/** imports no frozen V1 Group experience;
 * - V1 stays frozen and PF-05 experience code stays unreferenced.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EMPTY_GROUP_DRAFT,
  groupRoleLabel,
  isCreateGroupDraftSubmittable,
  toCreateGroupInput,
  validateCreateGroupDraft,
} from '../src/v2/groups/groupDraft.js';

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

const groupFiles = walk('src/v2/groups').filter((path) => /\.(ts|tsx)$/.test(path));
const groupSources = groupFiles.map((path) => ({ path, source: read(path) }));
const anyGroupSource = groupSources.map((entry) => entry.source).join('\n');

// ─── 1. Pure draft contract ──────────────────────────────────────────────
console.log('draft contract');
check('empty draft is not submittable', isCreateGroupDraftSubmittable(EMPTY_GROUP_DRAFT) === false);
check('whitespace-only name is not submittable',
  isCreateGroupDraftSubmittable({ name: '   ', description: '' }) === false);
check('a name alone is submittable',
  isCreateGroupDraftSubmittable({ name: 'Runners', description: '' }) === true);
check('name is required as the only hard field',
  validateCreateGroupDraft({ name: '', description: 'has description' })
    .some((issue) => issue.code === 'name_required' && issue.field === 'name'));
check('over-long name flagged',
  validateCreateGroupDraft({ name: 'x'.repeat(201), description: '' })
    .some((issue) => issue.code === 'name_too_long'));
check('over-long description flagged',
  validateCreateGroupDraft({ name: 'ok', description: 'x'.repeat(2001) })
    .some((issue) => issue.code === 'description_too_long'));
check('empty description is omitted from the transport input',
  JSON.stringify(toCreateGroupInput({ name: '  Runners  ', description: '   ' })) === '{"name":"Runners"}');
check('name and description are trimmed on the way out',
  JSON.stringify(toCreateGroupInput({ name: ' Runners ', description: ' dawn ' }))
    === '{"name":"Runners","description":"dawn"}');
check('owner/admin map to singular Accountable Steward',
  groupRoleLabel('owner') === 'Accountable Steward' && groupRoleLabel('admin') === 'Accountable Steward');
check('other roles map to Member', groupRoleLabel('member') === 'Member');

// ─── 2. Read contract is the SAME as the Challenge journey ───────────────
console.log('read contract');
const hooks = read('src/v2/groups/useV2Groups.ts');
const membershipsApi = read('src/api/membershipsApi.ts');
check('groups hook uses the shared memberships client', hooks.includes('fetchMyMemberships'));
check('the shared client reads GET /v1/memberships/me', membershipsApi.includes('/v1/memberships/me'));
check('no groups hook invents a second Group read path',
  !/\/v1\/groups(\?|'|"|\s*`)/.test(hooks));

// ─── 3. Establishment path ───────────────────────────────────────────────
console.log('establishment path');
const groupsApi = read('src/api/groupsApi.ts');

/** Extract the first balanced `{...}` object literal following a marker. */
function objectAfter(source: string, marker: string): string {
  const start = source.indexOf(marker);
  if (start < 0) return '';
  const braceStart = source.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(braceStart, i + 1);
    }
  }
  return '';
}

const createBody = objectAfter(groupsApi, 'body: {');
check('client posts to POST /v1/groups', /['"]\/v1\/groups['"]/.test(groupsApi) && groupsApi.includes("method: 'POST'"));
check('create body carries only name/description',
  createBody.includes('name,') && createBody.includes('description')
  && !/\b(ownerId|role|status|userId|memberId|created_by)\b/.test(createBody),
  createBody);
check('no client-generated owner/steward authority',
  !/\bownerId\b/.test(groupsApi) && !/\brole\b/.test(createBody) && !/\bstatus\b/.test(createBody));
check('no client-controlled actor identity',
  !/\buserId\b|\bmemberId\b|created_by/.test(groupsApi));
check('no client writes persistence directly',
  !/firestore|firebase\/|firebase-admin|lib\/firebase/.test(groupsApi));

// ─── 4. No direct Firestore / PostgreSQL from V2 Group code ──────────────
console.log('persistence boundary');
for (const { path, source } of groupSources) {
  check(`${path}: no Firestore write/runtime import`,
    !/firebase(\/|['"])|firebase-admin|lib\/firebase|addDoc\(|setDoc\(|updateDoc\(|deleteDoc\(|writeBatch|runTransaction/.test(source));
  check(`${path}: no direct PostgreSQL access`,
    !/from ['"]pg['"]|DATABASE_URL|new Pool|\.query\(/.test(source));
}

// ─── 5. No hard-coded preview Group ──────────────────────────────────────
console.log('no manufactured Group');
check('no S2b/preview Group fixture identifiers',
  !/s2b-preview-group|Founder Preview Group|PREVIEW_GROUP/i.test(anyGroupSource));
check('no seeded/mock Group list in the surface',
  !/INITIAL_GROUPS|mockGroups|seedGroup/i.test(anyGroupSource));

// ─── 6. V2 Group code imports no frozen V1 experience ────────────────────
console.log('V1 boundary');
const FORBIDDEN_V1 = [
  'src/features/Groups',
  'src/features/Home',
  'src/features/Profile',
  'src/features/Onboarding',
  'src/features/Auth',
  'src/features/Challenges/V2',
  'src/services/groupService',
  'src/services/adminGroupService',
  'src/hooks/useGroups',
  'src/hooks/useActiveGroup',
  'src/hooks/useGroupInvites',
  'src/components/Layout',
];
const v1Violations = groupSources.flatMap(({ path, source }) => {
  const imports = [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map((m) => m[1]);
  const resolved = imports.map((spec) => {
    const clean = spec.replace(/\.(js|ts|tsx)$/, '');
    return clean.startsWith('..') ? `src/v2/groups/${clean}`.replace(/\/[^/]+$/, '') : clean;
  });
  return FORBIDDEN_V1.filter((frozen) => imports.some((spec) => spec.includes(frozen)
    || resolved.some((r) => r.includes(frozen))))
    .map((frozen) => `${path}::${frozen}`);
});
check('src/v2/groups imports no frozen V1 experience', v1Violations.length === 0,
  v1Violations.join(', '));
check('no V1 BottomNav in V2 Group code', !/\bBottomNav\b/.test(anyGroupSource));
check('no /app/ route strings in V2 Group code',
  !anyGroupSource.includes('"/app/') && !anyGroupSource.includes("'/app/"));
check('no frozen V1 journey/gate identifiers',
  !/\b(RequireGroupRoute|RequireOnboardedRoute|AdminRoute|LoginScreen)\b/.test(anyGroupSource));
check('PF-05 experience code is unreferenced',
  !/V2CreateChallengeWizard|V2ChallengesScreen|CreateChallengeWizard/.test(anyGroupSource));

// ─── 7. Routes are wired to the real surfaces ────────────────────────────
console.log('routes');
const routes = read('src/v2/routes.tsx');
check('groups route renders the real Groups screen', routes.includes('<V2GroupsScreen />'));
check('groups/new route renders the Create Group screen', routes.includes('<V2CreateGroupScreen />'));
check('groups placeholder removed from member pages',
  !read('src/v2/member/memberPages.tsx').includes('V2GroupsPage'));

// ─── 8. No internal identifiers rendered ─────────────────────────────────
console.log('no internal identifiers');
const groupsScreen = read('src/v2/groups/V2GroupsScreen.tsx');
const createScreen = read('src/v2/groups/V2CreateGroupScreen.tsx');
check('Groups screen never renders legacy ids', !groupsScreen.includes('legacyId'));
check('Create screen never renders legacy ids', !createScreen.includes('legacyId'));
check('Groups screen renders the stewardship label, not raw role codes',
  groupsScreen.includes('groupRoleLabel('));
check('no raw internal state codes rendered',
  !/>\s*'?(active|pending|joined)'?\s*</.test(groupsScreen));

if (failures > 0) {
  console.error(`\nS2-G group establishment guards: ${failures} failure(s).`);
  process.exit(1);
}
console.log('\nS2-G group establishment guards: all passing.');
