/**
 * S2b × S2-G integration guards (run: npm run test:s2b-s2g-integration).
 *
 * Proves the held S2b Challenge Creation slice is aligned onto the accepted
 * S2-G Group Establishment baseline (TIIZI-S2G-ACCEPT-MERGE-001):
 *
 * - S2b preview tooling manufactures NO Group and NO Group membership
 *   (the obsolete `s2b-preview-group` manufacture is gone); the host Group
 *   MUST come from the governed S2-G journey;
 * - S2b Step 2 ("Who is hosting?") reads the member's REAL Groups through
 *   the accepted `GET /v1/memberships/me` contract — wizard → hook →
 *   client → endpoint, no second Group read authority;
 * - a Group established through the S2-G authority is selectable as
 *   Challenge host, and its real governed identity flows into the
 *   `POST /v1/challenges` establishment body;
 * - no Group means no manufacture and no silent substitution: the wizard
 *   blocks with a link to the real S2-G creation journey, and the
 *   establishment contract refuses without a host Group;
 * - the V2 Challenge experience performs no direct Firestore/PostgreSQL
 *   product writes, the V1 boundary holds, S2b invariants hold, and the
 *   Knowledge fixtures remain available without Group state.
 *
 * Static source assertions + pure-contract assertions (React-free draft
 * module). No emulator, database, or network access.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assessVisibleStep,
  createInitialWizardState,
  toEstablishmentBody,
} from '../src/v2/challenges/challengeCreationDraft.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');

/**
 * Strip line/block comments before persistence-boundary matching so
 * contract documentation (which legitimately names the stores it must
 * NOT touch) can never trip a no-direct-access proof. The guarded files
 * contain no `://` inside string literals, so `//` stripping is safe.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');
}

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

const GROUP_ID = '33333333-3333-4333-8333-333333333333';

const seed = stripComments(read('scripts/previewS2bSeed.ts'));
const wizard = read('src/v2/challenges/V2ChallengeCreationWizard.tsx');
const hooks = read('src/v2/challenges/useChallengeCreation.ts');
const membershipsApi = read('src/api/membershipsApi.ts');
const creationApi = read('src/api/challengeCreationApi.ts');
const routes = read('src/v2/routes.tsx');

// ─── A. S2b preview tooling creates no Group ──────────────────────────────
console.log('no preview Group manufacture');
check('seed has no Group insert or legacy Group identifiers',
  !/INSERT INTO groups\b|upsertGroup|s2b-preview-group|PREVIEW_GROUP_LEGACY_ID|Founder Preview Group|seedFirestore/.test(seed));
check('seed performs no Firestore Group write',
  !/getFirestore|collection\('|addDoc\(|setDoc\(|updateDoc\(|deleteDoc\(/.test(seed));

// ─── B. S2b preview tooling creates no Group membership ───────────────────
console.log('no preview membership manufacture');
check('seed has no membership insert',
  !/INSERT INTO group_memberships|upsertMembership|groupMembers\(/.test(seed));
check('seed retains only the member identity link',
  /INSERT INTO members/.test(seed) && /auth_provider/.test(seed));

// ─── C. Step 2 reads real Groups from memberships/me ─────────────────────
console.log('Step 2 membership binding');
check('wizard Step 2 binds the memberships hook', wizard.includes('useV2Memberships'));
check('memberships hook reads the shared client', hooks.includes('fetchMyMemberships'));
check('shared client reads GET /v1/memberships/me', membershipsApi.includes('/v1/memberships/me'));
check('no second Group read authority in the S2b experience',
  !/\/v1\/groups(\?|'|"|\s*`)/.test(wizard) && !/\/v1\/groups(\?|'|"|\s*`)/.test(hooks));

// ─── D. S2-G-established Group is selectable as host ─────────────────────
console.log('real Group hosting');
// The S2-G creation journey must exist so the Founder can establish the host.
check('S2-G creation route present', routes.includes('path="groups/new"')
  && routes.includes('<V2CreateGroupScreen />'));
// A membership returned by the real contract completes the host step and
// its governed identity flows into establishment.
const hosted = {
  ...createInitialWizardState(new Date(2026, 5, 1)),
  challengeType: 'competitive' as const,
  groupId: GROUP_ID,
  groupName: 'Tiizi Founders Fitness Group',
  title: 'June Race',
};
check('host step completes with the real Group identity',
  assessVisibleStep(hosted, 'WHO_IS_HOSTING').complete === true);
check('establishment carries the selected real Group identity',
  toEstablishmentBody(hosted, { activate: true, joinCreator: false }).group_id === GROUP_ID);

// ─── E. No Group means no manufacture, no substitution ───────────────────
console.log('empty hosting blocks honestly');
const unhosted = {
  ...createInitialWizardState(new Date(2026, 5, 1)),
  challengeType: 'competitive' as const,
  groupId: null,
  groupName: null,
  title: 'June Race',
};
check('host step is incomplete without a Group',
  assessVisibleStep(unhosted, 'WHO_IS_HOSTING').complete === false);
let threw = false;
try {
  toEstablishmentBody(unhosted, { activate: true, joinCreator: false });
} catch {
  threw = true;
}
check('establishment refuses without a host Group', threw === true);
check('empty state links the real S2-G creation journey (no "later experience")',
  wizard.includes("navigate('/v2/groups/new')") && wizard.includes('Create a Group')
  && !/arrive in a later experience/.test(wizard));

// ─── F. Challenge creation uses the selected real Group identity ─────────
console.log('establishment authority binding');
check('establishment posts to the governed seam', creationApi.includes("'/v1/challenges'"));
check('selected membership identity is the established host',
  toEstablishmentBody(hosted, { activate: false, joinCreator: false }).group_id === GROUP_ID);

// ─── G. No direct product writes in the V2 Challenge experience ──────────
console.log('persistence boundary');
const challengeFiles = walk('src/v2/challenges').filter((path) => /\.(ts|tsx)$/.test(path));
const challengeSources = challengeFiles.map((path) => ({ path, source: stripComments(read(path)) }));
const clientSources = [creationApi, membershipsApi, read('src/api/v2ChallengeApi.ts')]
  .map(stripComments)
  .join('\n');
for (const { path, source } of challengeSources) {
  check(`${path}: no Firestore write/runtime import`,
    !/\baddDoc\(|\bsetDoc\(|\bupdateDoc\(|\bdeleteDoc\(|from ['"]firebase\/|firebase-admin/.test(source));
  check(`${path}: no direct PostgreSQL access`,
    !/from ['"]pg['"]|DATABASE_URL|new Pool|\.query\(/.test(source));
}
check('S2b api clients: no Firestore write/runtime import',
  !/\baddDoc\(|\bsetDoc\(|\bupdateDoc\(|\bdeleteDoc\(|from ['"]firebase\/|firebase-admin/.test(clientSources));
check('S2b api clients: no direct PostgreSQL access',
  !/from ['"]pg['"]|DATABASE_URL|new Pool|\.query\(/.test(clientSources));

// ─── H. V1 frozen boundary intact ─────────────────────────────────────────
console.log('V1 boundary');
const s2bSources = [...challengeSources.map((entry) => entry.source), creationApi].join('\n');
check('no V1 experience imports in the S2b experience',
  !/features\/Challenges|BottomNav|RequireGroupRoute/.test(s2bSources));
check('no /app/ routes emitted from the S2b experience', !/["'`]\/app\//.test(s2bSources));

// ─── I. S2b challenge invariants intact ───────────────────────────────────
console.log('S2b invariants');
check('creator participation defaults to NOT joining',
  createInitialWizardState(new Date(2026, 5, 1)).creatorJoins === false);
check('wizard uses the S2a preview seam', wizard.includes('previewChallengeDefinition'));
check('preview endpoint is the governed seam', creationApi.includes('/v1/challenge-definitions/preview'));

// ─── J. Knowledge fixtures without Group state ───────────────────────────
console.log('knowledge fixtures');
check('Together/Race/Streak fixtures retained',
  seed.includes('FIT-CRD-001') && seed.includes('FIT-STR-001') && seed.includes('WEL-MND-003'));
check('fixtures are published lifecycle-gated Knowledge',
  seed.includes('setKnowledgeLifecycle') && seed.includes('published'));

if (failures > 0) {
  console.error(`\nS2b/S2-G integration guards: ${failures} failure(s).`);
  process.exit(1);
}
console.log('\nS2b/S2-G integration guards: all passing.');
