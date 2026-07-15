/**
 * Runtime regression tests (not source regex) for the group-taxonomy
 * consolidation and the buildGroupDefaults metadata-forwarding fix.
 *
 * (getOnboardingPath's legacy-completion-precedence fix is covered by an
 * order-sensitive regex assertion in testOnboardingGuards.ts instead of a
 * runtime import here, because useProfileSetup.ts transitively imports the
 * Firebase client SDK, which reads import.meta.env — a Vite-only feature
 * that plain tsx does not populate, so importing it outside a Vite build
 * throws. buildGroupDefaults/groupOptions/groupOptionLabels have no such
 * dependency, so they're tested directly here.)
 *
 * Run: npx tsx scripts/testGroupTaxonomyAndOnboardingRuntime.ts
 */
import * as assert from 'node:assert/strict';
import { buildGroupDefaults } from '../src/utils/groupLifecycle';
import { GROUP_GOALS, GROUP_TYPES } from '../src/features/Groups/groupOptions';
import { getGroupGoalLabel, getGroupTypeLabel } from '../src/features/Groups/groupOptionLabels';
import { normalizeGroupGoalId, normalizeGroupGoals } from '../src/features/Groups/groupGoalNormalization';
import { isValidGroupDraft, MIN_GROUP_DESCRIPTION_LENGTH, MIN_GROUP_NAME_LENGTH } from '../src/features/Groups/groupValidation';
import { DEFAULT_GROUP_RULES, getCustomGroupRules, INITIAL_SELECTED_RULES, isDuplicateGroupRule } from '../src/features/Groups/groupRules';
import { isGroupMetadataMateriallyIncomplete } from '../src/features/Groups/groupMetadataCompleteness';

// ── buildGroupDefaults must not choke on omitted coverImageUrl (Firestore addDoc rejects literal undefined) ──

const defaults = buildGroupDefaults({
  name: 'Test Group',
  description: 'Test description',
  ownerId: 'owner-1',
  inviteCode: 'TEST-1234',
});
assert.ok(!('coverImageUrl' in defaults), 'buildGroupDefaults must omit coverImageUrl entirely when not provided, never set it to literal undefined');
assert.equal(defaults.status, 'active');

const defaultsWithCover = buildGroupDefaults({
  name: 'Test Group',
  description: 'Test description',
  ownerId: 'owner-1',
  inviteCode: 'TEST-1234',
  coverImageUrl: 'https://example.com/cover.png',
});
assert.equal(defaultsWithCover.coverImageUrl, 'https://example.com/cover.png', 'buildGroupDefaults must preserve coverImageUrl when provided');

// buildGroupDefaults must NOT silently accept/forward metadata fields — those
// are the caller's (groupService.createGroup's) responsibility to spread on
// top of the result. This guards against the exact regression that was found:
// passing groupType etc. into buildGroupDefaults silently dropped them because
// its GroupDefaultsInput type doesn't declare them.
assert.ok(
  !('groupType' in (buildGroupDefaults({ name: 'x', description: 'y', ownerId: 'z', inviteCode: 'W' } as any))),
  'buildGroupDefaults must never itself produce a groupType field — that would mask the metadata-forwarding regression if reintroduced',
);

// ── Canonical taxonomy: every GROUP_GOALS/GROUP_TYPES id resolves to its own label (no raw ids leak through the display helpers) ──

for (const goal of GROUP_GOALS) {
  assert.equal(getGroupGoalLabel(goal.id), goal.label, `getGroupGoalLabel(${goal.id}) must resolve to canonical label`);
}
for (const type of GROUP_TYPES) {
  assert.equal(getGroupTypeLabel(type.id), type.label, `getGroupTypeLabel(${type.id}) must resolve to canonical label`);
}

// Legacy literal-label groupGoals values (written by the old CreateGroupScreen
// before canonical ids existed) must still display as themselves, unchanged.
for (const legacyLiteral of ['Keep Fit Together', 'Stay Consistent', 'Train for an Event', 'Family / Friends Accountability']) {
  assert.equal(getGroupGoalLabel(legacyLiteral), legacyLiteral, `Legacy literal groupGoals value "${legacyLiteral}" must still display unchanged`);
}

// ── Legacy groupGoals normalization (Edit hydration must map literals to canonical ids) ──

const LEGACY_TO_CANONICAL: Record<string, string> = {
  'Keep Fit Together': 'keep-fit-together',
  'Lose Weight': 'weightloss',
  'Build Strength': 'strength',
  'Improve Mental Health': 'mental-health',
  'Stay Consistent': 'consistency',
  'Train for an Event': 'athletic-performance',
  'Support a Cause': 'charity',
  'Build Workplace Wellness': 'workplace-wellness',
  'Family / Friends Accountability': 'family-accountability',
  Other: 'other',
};
for (const [legacy, canonical] of Object.entries(LEGACY_TO_CANONICAL)) {
  assert.equal(normalizeGroupGoalId(legacy), canonical, `normalizeGroupGoalId must map legacy literal "${legacy}" to canonical id "${canonical}"`);
}
// Canonical ids and unrecognized values must pass through unchanged (no destructive normalization).
for (const goal of GROUP_GOALS) {
  assert.equal(normalizeGroupGoalId(goal.id), goal.id, `normalizeGroupGoalId must not alter an already-canonical id (${goal.id})`);
}
assert.equal(normalizeGroupGoalId('some-unrecognized-value'), 'some-unrecognized-value', 'normalizeGroupGoalId must preserve unrecognized values rather than destroying them');

// A document mixing a legacy literal and its equivalent canonical id must de-duplicate on normalization
// (guards against editing-and-saving a legacy document ever producing duplicate equivalent goal entries).
assert.deepEqual(
  normalizeGroupGoals(['Keep Fit Together', 'keep-fit-together', 'Lose Weight']),
  ['keep-fit-together', 'weightloss'],
  'normalizeGroupGoals must de-duplicate a legacy literal and its canonical id equivalent',
);
assert.deepEqual(
  normalizeGroupGoals([]),
  [],
  'normalizeGroupGoals must handle an empty array (group with no goals) without error',
);

// ── Create/Edit validation parity ──

assert.equal(isValidGroupDraft('ab', 'a valid enough description'), false, `a name shorter than ${MIN_GROUP_NAME_LENGTH} characters must be rejected`);
assert.equal(isValidGroupDraft('Valid Name', 'short'), false, `a description shorter than ${MIN_GROUP_DESCRIPTION_LENGTH} characters must be rejected`);
assert.equal(isValidGroupDraft('Valid Name', 'a valid enough description'), true, 'a name and description meeting both minimums must be accepted');
assert.equal(isValidGroupDraft('', ''), false, 'an entirely empty draft must be rejected');

// ── Owner-only materially-incomplete metadata prompt rule ──

assert.equal(
  isGroupMetadataMateriallyIncomplete({}),
  true,
  'a group with no groupType and no activities/wellness/goals at all must be considered materially incomplete',
);
assert.equal(
  isGroupMetadataMateriallyIncomplete({ groupType: 'fitness' }),
  false,
  'a group with only groupType set must NOT be considered materially incomplete (it has a stated focus)',
);
assert.equal(
  isGroupMetadataMateriallyIncomplete({ activityInterests: ['running'] }),
  false,
  'a group with only activities set (no groupType) must NOT be considered materially incomplete',
);
assert.equal(
  isGroupMetadataMateriallyIncomplete({ groupType: 'fitness', activityInterests: ['running'], wellnessTopics: ['sleep'], groupGoals: ['strength'] }),
  false,
  'a fully-described group must NOT be considered materially incomplete',
);
assert.equal(
  isGroupMetadataMateriallyIncomplete({ activityInterests: [], wellnessTopics: [], groupGoals: [] }),
  true,
  'a group with only empty arrays and no groupType must be considered materially incomplete',
);

// ── Shared Create/Edit community rules module ──

// The canonical list must be the union of both screens' original 12
// distinct rule strings (no renaming, no semantic merging).
for (const rule of [
  'Be respectful', 'No spam', 'Encourage others', 'Log honestly', 'Keep health information private', 'No unsafe advice',
  'Be respectful and supportive', 'No spam or self-promotion', 'Keep activity logs honest', 'Support fellow members', 'Stay on topic', 'Have fun and stay consistent',
]) {
  assert.ok(DEFAULT_GROUP_RULES.includes(rule as any), `DEFAULT_GROUP_RULES must include the original rule "${rule}"`);
}
assert.equal(DEFAULT_GROUP_RULES.length, 12, 'DEFAULT_GROUP_RULES must be exactly the union of both screens\' original 12 rules, with no renaming/merging');
assert.equal(INITIAL_SELECTED_RULES.length, 3, 'CreateGroupScreen\'s initial preselected rule count must remain 3');

// An existing non-canonical (owner-typed custom) rule must remain visible and removable, not silently dropped.
assert.deepEqual(
  getCustomGroupRules(['Be respectful', 'No pets allowed in group photos']),
  ['No pets allowed in group photos'],
  'getCustomGroupRules must surface a rule that is not part of the canonical list',
);
assert.deepEqual(
  getCustomGroupRules(['Be respectful', 'No spam']),
  [],
  'getCustomGroupRules must return nothing when every existing rule is already canonical',
);

// Duplicate-rule policy is case-insensitive and trim-based.
assert.equal(isDuplicateGroupRule('be RESPECTFUL', ['Be respectful']), true, 'isDuplicateGroupRule must treat case-differing text as a duplicate');
assert.equal(isDuplicateGroupRule('  No spam  ', ['No spam']), true, 'isDuplicateGroupRule must treat whitespace-differing text as a duplicate');
assert.equal(isDuplicateGroupRule('A brand new rule', ['Be respectful']), false, 'isDuplicateGroupRule must not flag a genuinely new rule as a duplicate');

console.log('✅ All group taxonomy and onboarding runtime regression tests passed.');
