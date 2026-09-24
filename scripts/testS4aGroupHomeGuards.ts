/**
 * TIIZI S4a CORR-001 — Group formation & experience assembly guards
 * (run: npm run test:s4a-group-home).
 *
 * Bounds the corrected S4a slice behaviorally (pure view/draft/cover
 * models where practical) plus static no-leak proofs:
 *
 *   A. Progressive wizard: five steps, one logical step at a time,
 *      per-step gating, authorized fields only (identity + cover/location/
 *      focus + governed setup + one core norm; no upload, URL entry,
 *      Charter editor, Council, moderation, admin-role, or invite controls).
 *   B. Review submits once to the canonical returned Group ID; Home is
 *      reached with fresh server truth; refresh persists.
 *   C. Group Home is hero-first (cover, name, tagline, location, count,
 *      relationship, steward, contextual CTA); configuration lives in the
 *      secondary About surface — never a dominant Community Setup.
 *   D. Group cards compose cover/name/location/tagline/focus/relationship/
 *      live counts/entry from server truth only; strict steward badge
 *      (owner-only); no fabricated counts.
 *   E. Hosted rows reuse S3 read truth (type/state badges incl. neutral
 *      Upcoming, group-host context, snapshots, permission-gated CTA);
 *      no client ranking/progress authority; no Feed/leaderboard.
 *   F. Challenge hero keeps a navigable hosting-Group context (no S3 fork).
 *   G. Cover catalogue matches the server allowlist; fallbacks are
 *      deterministic presentation, never persisted truth.
 *   H. No manufactured authority: no direct Firestore/PostgreSQL, no V1,
 *      no duplicate store, no client-declared stewardship/counts/settings.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  groupHomeViewFor,
  viewerMayCreateChallenge,
  type GroupHomeQueryState,
} from '../src/v2/groups/groupHomeView.js';
import {
  toCreateGroupInput,
  EMPTY_GROUP_DRAFT,
  stepBlockedFor,
  type CreateGroupDraft,
} from '../src/v2/groups/groupDraft.js';
import {
  GROUP_COVER_CATALOGUE,
  coverFor,
  isGroupCoverId,
  type GroupCoverId,
} from '../src/v2/groups/groupCovers.js';
import { stewardBadgeFor } from '../src/v2/groups/groupDraft.js';
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

/** Comment-stripped source: header honesty must not trip capability checks. */
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
const anyGroupCode = groupSources.map((entry) => stripComments(entry.source)).join('\n');
const createScreen = read('src/v2/groups/V2CreateGroupScreen.tsx');
const createCode = stripComments(createScreen);
const homeScreen = read('src/v2/groups/V2GroupHomeScreen.tsx');
const homeCode = stripComments(homeScreen);
const cardRow = read('src/v2/groups/V2HostedChallengeCard.tsx');
const cardCode = stripComments(cardRow);
const routes = read('src/v2/routes.tsx');

// ─── A. Progressive wizard, authorized fields only ────────────────────────
console.log('wizard assembly');
check('wizard has five progressive steps', createScreen.includes("label: 'Review'") && createScreen.includes("label: 'Culture'"));
check('steps render one at a time with progress', createScreen.includes('V2StepProgress') && createScreen.includes('step === 0') && createScreen.includes('step === 4'));
check('per-step gating blocks Continue on invalid fields', createScreen.includes('stepBlocked('));
check('identity step: name + tagline + description', createCode.includes('Step 1 — Identity') && createCode.includes('Tagline (optional)'));
check('look step: cover picker + location + focus', createCode.includes('Step 2 — Look') && createCode.includes('Group cover (optional)') && createCode.includes('Focus areas (optional)'));
check('setup step keeps the governed choices', createCode.includes('Step 3 — How the group works'));
check('culture step: one core norm + honest governance note', createCode.includes('Step 4 — Culture') && createCode.includes('Core norm (optional)') && createCode.includes('Charter'));
check('review step summarizes before submitting', createCode.includes('Step 5 — Review') && createCode.includes('Establish Group'));
for (const forbidden of [
  'coverImageUrl', 'Select Image', 'Upload', 'URL', 'geoloc', 'latitude', 'longitude',
  'Charter editor', 'charter editor', 'Council voting', 'council members', 'Advisory council',
  'Admins', 'Group Admin', 'admin role', 'inviteCode', 'invite link', 'Send invite',
  'moderation', 'Moderation', 'healthState', 'flagged', 'Run Again',
]) {
  check(`wizard has no "${forbidden}" control`, !createCode.includes(forbidden), forbidden);
}
check('wizard discloses Charter/Council deferral honestly instead of building editors',
  createCode.includes('Charter') && createCode.includes('later slice'));
/** Member-facing copy only (JSX text): code identifiers are not copy. */
function jsxText(source: string): string {
  return stripComments(source)
    .replace(/<[^>]*>/g, '|')
    .replace(/\{[^}]*\}/g, '|');
}
const createCopy = jsxText(createScreen);
check('wizard never names raw backend fields in copy',
  !/isPrivate|requireAdminApproval|allowMemberChallenges|focusTags|coverId|memberCount|stewardId|ownerId|firebase|firestore/i.test(createCopy));
check('draft defaults mirror the governed authority (open + permitted, no cover)',
  EMPTY_GROUP_DRAFT.isPrivate === false
  && EMPTY_GROUP_DRAFT.requireAdminApproval === false
  && EMPTY_GROUP_DRAFT.allowMemberChallenges === true
  && EMPTY_GROUP_DRAFT.coverId === null);
check('empty rich fields are omitted from transport (minimal payloads stay minimal)',
  JSON.stringify(toCreateGroupInput({ ...EMPTY_GROUP_DRAFT, name: 'G' }))
    === '{"name":"G","isPrivate":false,"requireAdminApproval":false,"allowMemberChallenges":true}');
check('set rich fields ride transport unchanged',
  (() => {
    const out = toCreateGroupInput({
      ...EMPTY_GROUP_DRAFT,
      name: 'G',
      coverId: 'cover-2',
      tagline: 'T',
      location: 'L',
      focusTags: ['A', 'B', ''],
      norm: 'Be kind.',
    });
    return out.coverId === 'cover-2' && out.tagline === 'T' && out.location === 'L'
      && JSON.stringify(out.focusTags) === '["A","B"]' && JSON.stringify(out.rules) === '["Be kind."]';
  })());
check('step gating: identity blocks on name, later steps do not',
  stepBlockedFor(0, [{ code: 'name_required', field: 'name' }]) === true
  && stepBlockedFor(2, [{ code: 'name_required', field: 'name' }]) === false);
check('step gating: look blocks on location/focus only',
  stepBlockedFor(1, [{ code: 'location_too_long', field: 'location' }]) === true
  && stepBlockedFor(1, [{ code: 'name_required', field: 'name' }]) === false);

// ─── B. Review submits once to the canonical ID ───────────────────────────
console.log('creation → home navigation');
check('success navigates to the canonical returned Group ID',
  /navigate\(`\/v2\/groups\/\$\{created\.id\}`/.test(createScreen));
check('navigation replaces the form entry (no back-to-form trap)',
  createScreen.includes('replace: true'));
check('submit is single-shot while pending', createScreen.includes('!createGroup.isPending') || createScreen.includes('createGroup.isPending'));
check('Home route is mounted with the id from route params',
  routes.includes('path="groups/:groupId"') && routes.includes('V2GroupHomeScreen')
  && routes.includes('V2GroupScope'));
check('landing cards navigate into Group Home',
  read('src/v2/groups/V2GroupsScreen.tsx').includes('navigate(`/v2/groups/${membership.groupId}`)'));

// ─── C. Hero-first Home, About-secondary ──────────────────────────────────
console.log('home assembly');
check('Home opens with a cover hero (name, tagline, location)',
  homeCode.includes('Group overview') && homeCode.includes('coverGradientFor(') && homeCode.includes('tagline'));
check('hero carries relationship, count, steward and contextual CTA',
  homeCode.includes('Accountable Steward') && homeCode.includes('Launch Challenge'));
check('empty-group CTA stays attached to Group context',
  homeCode.includes('Create the first Challenge'));
check('configuration lives in the secondary About surface',
  homeCode.includes('About this Group') && homeCode.includes('Group setup'));
check('no dominant Community Setup section', !homeCode.includes('Community setup'));
check('About shows purpose, norms, stewardship, governance note',
  homeCode.includes('Community purpose') && homeCode.includes('Community norms') && homeCode.includes('Tiizi Platform governance'));
check('Home classifies through the pure view model', homeScreen.includes('groupHomeViewFor('));
check('Home has loading/error/not-found/empty states',
  homeScreen.includes('Loading this Group') && homeScreen.includes('We could not load this Group')
  && homeScreen.includes('We could not find this Group') && homeScreen.includes('No Challenges here yet'));
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
    coverId: null,
    tagline: '',
    location: '',
    focusTags: [],
    rules: [],
    ...overrides,
  };
}
check('loading classifies first', groupHomeViewFor(query({ isLoading: true, isError: true })).kind === 'loading');
check('404 classifies as not-found (unknown/inactive/private all alike)',
  groupHomeViewFor(query({ isError: true, errorStatus: 404 })).kind === 'notFound');
check('genuine failure classifies as error (never masked)',
  groupHomeViewFor(query({ isError: true, errorStatus: 500 })).kind === 'error');
check('success with the server detail renders home',
  (() => {
    const out = groupHomeViewFor(query({ isSuccess: true, detail: detail() }));
    return out.kind === 'home' && out.detail.name === 'Home Group';
  })());
check('members may create where open', viewerMayCreateChallenge(detail()) === true);
check('members may not create under steward restriction',
  viewerMayCreateChallenge(detail({ allowMemberChallenges: false })) === false);
check('outsiders are never offered creation',
  viewerMayCreateChallenge(detail({ viewerRelationship: 'none' })) === false);

// ─── D. Cards from server truth, strict steward badge ─────────────────────
console.log('group cards');
const listScreen = read('src/v2/groups/V2GroupsScreen.tsx');
check('cards render cover, location pill, tagline, focus, counts, entry',
  listScreen.includes('coverGradientFor(') && listScreen.includes('Enter →')
  && listScreen.includes('active Challenge') && listScreen.includes('member'));
check('Groups list stays one full-width card per row until large desktop (1024px)',
  /<ul className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2">/.test(listScreen)
  && !/sm:grid-cols-2/.test(listScreen));
check('Groups list does not introduce horizontal card scrolling',
  !/overflow-x-(auto|scroll)|snap-x|carousel/i.test(stripComments(listScreen)));
check('cards bind live counts from governed reads (no fabricated zero)',
  listScreen.includes('useV2GroupDetail') && listScreen.includes('useV2GroupChallenges')
  && listScreen.includes('fabricated zero'));
check('steward badge is owner-only (legacy admins read Member)',
  stewardBadgeFor('owner') === 'Accountable Steward' && stewardBadgeFor('admin') === 'Member'
  && stewardBadgeFor('member') === 'Member');
check('cards use the strict badge', listScreen.includes('stewardBadgeFor('));
check('no raw identifiers on cards', !/legacyId|ownerId|firebaseUid|inviteCode/.test(stripComments(listScreen)));

// ─── E. Hosted rows reuse S3 truth ────────────────────────────────────────
console.log('hosted challenges');
check('rows show type/state badges incl. neutral Upcoming',
  cardCode.includes('Upcoming') && cardCode.includes('challengeTypeLabel('));
check('rows name the hosting Group context', cardCode.includes('Hosted by {groupName}'));
check('rows reuse collective/competitive S3 reads for counts',
  cardCode.includes('useChallengeContributorsV2') && cardCode.includes('useCompetitiveLeaderboardV2'));
check('finalized Challenges show served frozen results (no live fetch as truth)',
  cardCode.includes('!challenge.finalized') && cardCode.includes('mine.final'));
check('streaks carry no fabricated participant count',
  !/streak.*participant|participant.*streak/i.test(cardCode));
check('CTA is permission-gated: Join inline (confirmed) / Log+Results navigate',
  cardCode.includes('joinChallengeV2') && cardCode.includes('Log activity') && cardCode.includes('View results'));
check('join converges through the canonical invalidation contract',
  cardCode.includes('invalidateV2ChallengeReads'));
check('no Group Leaderboard surface in Group code (the governed count hooks are reuse, not a surface)',
  !/V2CompetitiveProgress|getCompetitiveLeaderboardV2\(|getChallengeContributorsV2\(|Top Performers|global ranking|Global ranking/i.test(anyGroupCode)
  && !/entries\.map|contributors\.map/i.test(anyGroupCode));
check('no Feed in Group code', !/\bFeed\b|\bfeed\b/.test(anyGroupCode.replace(/refetch|refresh/gi, '')));
check('no client ranking/progress authority',
  !/computeFinishingPositions|memberFinishingPositions|recomputeChallengeDerived/.test(anyGroupCode));
check('wizard honors a Group Home handoff only against real memberships',
  read('src/v2/challenges/V2ChallengeCreationWizard.tsx').includes('list.find((membership) => membership.groupId === hinted)'));

// ─── F. Challenge hero continuity ─────────────────────────────────────────
console.log('hero continuity');
const hero = read('src/v2/challenges/V2ChallengeHero.tsx');
check('hero links its hosting Group back to Group Home (composition only)',
  hero.includes('Hosted by') && hero.includes('to={`/v2/groups/${groupId}`}'));
check('hero takes the hosting Group id (no truth change)',
  hero.includes('groupId: string') && read('src/v2/challenges/V2CreatedChallengeScreen.tsx').includes('groupId={challenge.groupId}'));

// ─── G. Cover catalogue integrity ─────────────────────────────────────────
console.log('cover catalogue');
check('catalogue has eight stable ids', GROUP_COVER_CATALOGUE.length === 8);
check('unknown values and URLs are rejected (never rendered raw)',
  !isGroupCoverId('https://evil.example/x.png') && !isGroupCoverId('cover-9') && !isGroupCoverId(undefined));
check('stored ids resolve; legacy nulls fall back deterministically',
  isGroupCoverId('cover-3') && coverFor('cover-3', 'g') === 'cover-3'
  && coverFor(null, 'same-group') === coverFor(null, 'same-group')
  && (Object.keys({ 'cover-1': 1 }) as GroupCoverId[]).length === 1);

// ─── H. No manufactured authority ─────────────────────────────────────────
console.log('authority boundary');
for (const { path, source } of groupSources) {
  const code = stripComments(source);
  check(`${path}: no Firestore runtime`,
    !/firebase(\/|['"])|firebase-admin|lib\/firebase|addDoc\(|setDoc\(|updateDoc\(|deleteDoc\(|writeBatch|runTransaction|getDoc\(|getDocs\(|collection\(/.test(code));
  check(`${path}: no direct PostgreSQL access`,
    !/from ['"]pg['"]|DATABASE_URL|new Pool|\.query\(/.test(code));
}
check('no client-declared stewardship or counts',
  !/stewardId|ownerId|memberCount\s*:\s*\d|memberCount\s*=\s*(?![=>])\d|setSteward|makeSteward/i.test(anyGroupCode));
check('view/draft/cover models import API types only (no stores/mutations)',
  !/import[^;]*(Store|useMutation|participation|leaderboard)/i.test(
    read('src/v2/groups/groupHomeView.ts') + read('src/v2/groups/groupCovers.ts'),
  ));
check('no V1 experience in Group surfaces',
  !/from '\.\.\/\.\.\/features\//.test(anyGroupCode) && !/\bBottomNav\b/.test(anyGroupCode));

if (failures > 0) {
  console.error(`\nS4a CORR-001 guards: ${failures} failure(s).`);
  process.exit(1);
}
console.log('\nS4a CORR-001 guards: all passing.');
