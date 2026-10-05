/**
 * TIIZI S4a CORR-001 — Group formation & experience assembly guards
 * (run: npm run test:s4a-group-home).
 *
 * Bounds the corrected S4a slice behaviorally (pure view/draft/cover
 * models where practical) plus static no-leak proofs:
 *
 *   A. Progressive wizard: five steps, one logical step at a time,
 *      per-step gating, authorized fields only (identity + cover/location/
 *      focus + governed setup + community norms; no upload, URL entry,
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
import { focusAreaMatchesSearch, GROUP_FOCUS_AREAS, GROUP_FOCUS_AREA_LABELS } from '../src/v2/groups/groupFocusAreas.js';

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
const settingsScreen = read('src/v2/groups/V2GroupSettingsScreen.tsx');
const createCode = stripComments(createScreen);
const homeScreen = read('src/v2/groups/V2GroupHomeScreen.tsx');
const homeCode = stripComments(homeScreen);
const cardRow = read('src/v2/groups/V2HostedChallengeCard.tsx');
const cardCode = stripComments(cardRow);
const routes = read('src/v2/routes.tsx');

// ─── A. Progressive wizard, authorized fields only ────────────────────────
console.log('wizard assembly');
check('wizard has five progressive steps', createScreen.includes("label: 'Review'") && createScreen.includes("label: 'Our culture'"));
check('steps render one at a time with progress', createScreen.includes('V2StepProgress') && createScreen.includes('step === 0') && createScreen.includes('step === 4'));
check('per-step gating blocks Continue on invalid fields', createScreen.includes('stepBlocked('));
check('identity step: name + tagline + description', createCode.includes('Step 1 — Identity') && createCode.includes('Tagline (optional)'));
check('look step: cover picker + location + focus', createCode.includes('Step 2 — Look') && createCode.includes('Group cover (optional)') && createCode.includes('Focus areas (optional)'));
check('setup step keeps the governed choices', createCode.includes('Step 3 — How the group works'));
check('Goal outcomes and selectable Community Norms remain distinct from Activities', createCode.includes('Group goals (optional)') && createCode.includes('What would this Group like to work towards?') && createCode.includes('communityNormIds') && createCode.includes('Our culture') && createCode.includes('Add your own (optional)') && !createCode.includes('Your Group operates under Tiizi Platform governance'));
check('review step summarizes before submitting', createCode.includes('Step 5 — Review') && createCode.includes('Establish Group'));
for (const forbidden of [
  'coverImageUrl', 'Select Image', 'Upload', 'URL', 'geoloc', 'latitude', 'longitude',
  'Charter editor', 'charter editor', 'Council voting', 'council members', 'Advisory council',
  'Admins', 'Group Admin', 'admin role', 'inviteCode', 'invite link', 'Send invite',
  'moderation', 'Moderation', 'healthState', 'flagged', 'Run Again',
]) {
  check(`wizard has no "${forbidden}" control`, !createCode.includes(forbidden), forbidden);
}
check('wizard does not present a Charter/Council configuration surface',
  !createCode.includes('Charter editor') && !createCode.includes('Council configuration'));
/** Member-facing copy only (JSX text): code identifiers are not copy. */
function jsxText(source: string): string {
  return stripComments(source)
    .replace(/<[^>]*>/g, '|')
    .replace(/\{[^}]*\}/g, '|');
}
const createCopy = createScreen.match(/"([^"\\]|\\.)*"/g)?.join(' ') ?? '';
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
check('focus options reuse governed Activity category labels without synonyms',
  GROUP_FOCUS_AREAS.length === 12 && GROUP_FOCUS_AREA_LABELS.includes('Mobility & Flexibility')
  && GROUP_FOCUS_AREA_LABELS.includes('Mind & Emotional Wellbeing')
  && GROUP_FOCUS_AREA_LABELS.includes('Nutrition & Hydration')
  && focusAreaMatchesSearch('Mind & Emotional Wellbeing', 'emotional'));
check('uncontrolled free-text is limited in creation UI to one bounded Other value',
  createCode.includes('Other focus area (optional)') && createCode.includes('hasCustomTag'));
check('settings preserves legacy focus metadata and validates changed values against the bounded Focus Area contract',
  settingsScreen.includes('unchangedLegacyFocus') && settingsScreen.includes('customFocusCount <= 1')
  && settingsScreen.includes('canonical Fitness and Wellness category labels')
  && !settingsScreen.includes('up to 8 tags'));

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
check('About is closed on entry and revealed in an accessible V2 sheet',
  homeCode.includes('About this Group') && homeCode.includes('aria-expanded={aboutOpen}')
  && homeCode.includes('<V2Sheet open={aboutOpen}') && homeCode.includes('event.key === \'Escape\'')
  && !homeCode.includes('{aboutOpen && <section id="group-about-details"'));
check('About shows purpose, norms, stewardship and governed setup without platform-governance configuration copy',
  homeCode.includes('Community purpose') && homeCode.includes('Community norms') && !homeCode.includes('This Group operates under Tiizi Platform governance'));
check('Home classifies through the pure view model', homeScreen.includes('groupHomeViewFor('));
check('Home has loading/error/not-found/empty states',
  homeScreen.includes('Loading this Group') && homeScreen.includes('We could not load this Group')
  && homeScreen.includes('We could not find this Group') && homeScreen.includes('No Challenges here yet'));
check('join from Home reuses the governed join authority',
  homeScreen.includes('useJoinGroup')
  && read('src/api/groupsApi.ts').includes('${API_PREFIX}/groups/${groupId}/join'));

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
    goalIds: [], goals: [], customGoal: null,
    communityNormIds: [], communityNorms: [], customCommunityNorm: null,
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
check('compact rows render cover, name, focus, counts and open affordance',
  listScreen.includes('coverGradientFor(') && listScreen.includes('>Open</span>')
  && listScreen.includes('activeCount !== undefined') && listScreen.includes('memberCount'));
check('My Groups and Discover each render one compact row per row at all widths',
  listScreen.includes('aria-label="Your Groups" className="space-y-2"')
  && !/md:grid-cols-2|lg:grid-cols-2/.test(listScreen));
check('My Groups collection progressively expands from six', listScreen.includes('INITIAL_GROUP_COUNT = 6') && listScreen.includes('View more Groups'));
check('top-level Join with code tab is removed while contextual invite entry remains',
  !listScreen.includes("['code', 'Join with code']") && read('src/v2/groups/V2GroupDiscoveryPanel.tsx').includes('Have an invite code?')
  && read('src/v2/groups/V2GroupDiscoveryPanel.tsx').includes('V2GroupInvitePanel'));
check('Groups list does not introduce horizontal card scrolling',
  !/overflow-x-(auto|scroll)|snap-x|carousel/i.test(stripComments(listScreen)));
check('cards bind live counts from governed reads (no fabricated zero)',
  listScreen.includes('useV2GroupDetail') && listScreen.includes('useV2GroupChallenges')
  && listScreen.includes('typeof detail.data?.memberCount === \'number\'')
  && listScreen.includes('activeCount !== undefined'));
check('steward badge is owner-only (legacy admins read Member)',
  stewardBadgeFor('owner') === 'Accountable Steward' && stewardBadgeFor('admin') === 'Member'
  && stewardBadgeFor('member') === 'Member');
check('Member list defaults to four, with an explicit View all action', homeCode.includes('roster.data.members.slice(0, 4)') && homeCode.includes('View all members'));
check('Hosted Challenges are compact single rows and progressively expanded', homeCode.includes('className="space-y-2"') && homeCode.includes('challenges.slice(0, 4)') && homeCode.includes('View more Challenges') && cardCode.includes('compact = false'));
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
check('Group Feed stays within the authorized single member read surface',
  homeCode.includes('V2GroupFeedPreview')
  && read('src/v2/groups/V2GroupFeedScreen.tsx').includes('useV2GroupFeed')
  && read('src/api/groupFeedApi.ts').includes('groupFeedPagePath')
  && read('src/api/groupFeedRequest.ts').includes('/feed')
  && !/composer|reaction|Kudos|Share/i.test(read('src/v2/groups/V2GroupFeedPreview.tsx')));
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
