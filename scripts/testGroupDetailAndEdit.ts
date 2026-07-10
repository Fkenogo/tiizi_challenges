/**
 * Phase 18I-6T + Follow-up — Group Detail (compact summary + modal) + Edit Group + Discovery Filters.
 * Run: npx tsx scripts/testGroupDetailAndEdit.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const groupService    = read('src/services/groupService.ts');
const useGroups       = read('src/hooks/useGroups.ts');
const groupDetail     = read('src/features/Groups/GroupDetailScreen.tsx');
const groupSharedHeader = read('src/features/Groups/components/GroupSharedHeader.tsx');
// GroupDetailScreen's compact summary strip (description, created date, View/Edit links)
// now renders via the shared GroupSharedHeader component (post header-unification refactor).
const groupDetailCombined = groupDetail + '\n' + groupSharedHeader;
const groupDetailsModal = read('src/features/Groups/components/GroupDetailsModal.tsx');
const editGroup       = read('src/features/Groups/EditGroupScreen.tsx');
const groupsScreen    = read('src/features/Groups/GroupsScreen.tsx');
const appTsx          = read('src/App.tsx');

// ── UpdateGroupInput type defined and exported ────────────────────────────────
assert.match(groupService, /UpdateGroupInput/, 'groupService must define UpdateGroupInput');
assert.match(groupService, /export.*UpdateGroupInput|export type UpdateGroupInput/, 'UpdateGroupInput must be exported');
assert.match(groupService, /async updateGroup\(groupId.*UpdateGroupInput/, 'updateGroup method must accept UpdateGroupInput');
assert.match(groupService, /updatedAt.*new Date\(\)\.toISOString\(\)/, 'updateGroup must set updatedAt timestamp');

// ── useUpdateGroup hook ───────────────────────────────────────────────────────
assert.match(useGroups, /useUpdateGroup/, 'useGroups must export useUpdateGroup');
assert.match(useGroups, /groupService\.updateGroup/, 'useUpdateGroup must call groupService.updateGroup');
assert.match(useGroups, /invalidateQueries.*group/, 'useUpdateGroup must invalidate group queries on success');
assert.match(useGroups, /UpdateGroupInput/, 'useGroups must import UpdateGroupInput');

// ── EditGroupScreen exists with required sections ─────────────────────────────
assert.match(editGroup, /EditGroupScreen/, 'EditGroupScreen component must exist');
assert.match(editGroup, /useUpdateGroup/, 'EditGroupScreen must use useUpdateGroup hook');
assert.match(editGroup, /GROUP_TYPES/, 'EditGroupScreen must include GROUP_TYPES');
assert.match(editGroup, /LOCATION_SCOPES/, 'EditGroupScreen must include LOCATION_SCOPES');
assert.match(editGroup, /isPrivate/, 'EditGroupScreen must have isPrivate toggle');
assert.match(editGroup, /allowMemberChallenges/, 'EditGroupScreen must have allowMemberChallenges toggle');
assert.match(editGroup, /requireAdminApproval/, 'EditGroupScreen must have requireAdminApproval toggle');
assert.match(editGroup, /Community Rules/, 'EditGroupScreen must have Community Rules section');
assert.match(editGroup, /ownerId.*user.*uid|user.*uid.*ownerId/, 'EditGroupScreen must check owner authorisation');
assert.match(editGroup, /handleSave|onSave|mutateAsync/, 'EditGroupScreen must have a save action');
assert.match(editGroup, /coverImageUrl|Camera/, 'EditGroupScreen must allow cover photo change');

// ── Route registered in App.tsx ───────────────────────────────────────────────
assert.match(appTsx, /\/app\/group\/:id\/edit.*EditGroupScreen|EditGroupScreen.*\/app\/group\/:id\/edit/, 'App.tsx must register /app/group/:id/edit route');
assert.match(appTsx, /EditGroupScreen/, 'App.tsx must import or reference EditGroupScreen');

// ── GroupDetailScreen: compact summary — no full metadata dump ────────────────
// The main page must NOT render the full interests/topics/goals/rules lists inline.
// Those belong exclusively in GroupDetailsModal.
assert.doesNotMatch(
  groupDetail,
  /activityInterests.*\.map|wellnessTopics.*\.map|groupGoals.*\.map|groupRules.*\.map/,
  'GroupDetailScreen must NOT render full metadata lists inline — move them to GroupDetailsModal',
);

// Compact summary fields present
// (updated Phase 1 guard triage: these render via the shared GroupSharedHeader component now,
// not inline in GroupDetailScreen — checked against the combined source below)
assert.match(groupDetailCombined, /line-clamp-1|line-clamp-2|description.*preview|description.*line-clamp/, 'GroupDetailScreen (via GroupSharedHeader) must show a description preview');
// KNOWN GAP (Phase 1 guard triage, deferred to Phase 4 UI cleanup — see docs/reports/pre-beta-phase-1-guard-triage.md):
// the groupType quick tag was present in the compact summary before the header-unification
// refactor and is no longer rendered there (it still appears on GroupsScreen cards and inside
// GroupDetailsModal's full "Type" row). Left asserted-and-failing intentionally so this guard
// keeps flagging the gap until a product decision restores it or formally drops the requirement.
assert.match(groupDetailCombined, /group\.groupType/, 'GroupDetailScreen (via GroupSharedHeader) compact summary must reference groupType for quick tag — KNOWN GAP, see Phase 1 guard triage report');
assert.match(groupDetailCombined, /Group since|createdAt/, 'GroupDetailScreen (via GroupSharedHeader) compact summary must show created date');
assert.match(groupDetailCombined, /View Group Details/, 'GroupDetailScreen (via GroupSharedHeader) must have a "View Group Details" link/button');

// Edit Group gated to owner — must check ownerId
assert.match(groupDetailCombined, /Edit Group/, 'GroupDetailScreen (via GroupSharedHeader) must show Edit Group button label');
assert.match(groupDetail, /ownerId.*user\?\.uid|group\?\.ownerId.*uid/, 'GroupDetailScreen must gate Edit Group to owner');
assert.match(groupDetail, /\/app\/group\/.*\/edit/, 'GroupDetailScreen Edit Group must navigate to edit route');

// Modal wired
assert.match(groupDetail, /GroupDetailsModal/, 'GroupDetailScreen must render GroupDetailsModal');
assert.match(groupDetail, /showDetails|setShowDetails/, 'GroupDetailScreen must have showDetails state to control modal');

// ── GroupDetailsModal: full metadata in sections ──────────────────────────────
assert.match(groupDetailsModal, /GroupDetailsModal/, 'GroupDetailsModal component must exist');
assert.match(groupDetailsModal, /About|Focus Areas|Rules & Privacy/, 'GroupDetailsModal must have labelled sections');
assert.match(groupDetailsModal, /activityInterests/, 'GroupDetailsModal must display activityInterests');
assert.match(groupDetailsModal, /wellnessTopics/, 'GroupDetailsModal must display wellnessTopics');
assert.match(groupDetailsModal, /groupGoals/, 'GroupDetailsModal must display groupGoals');
assert.match(groupDetailsModal, /groupRules/, 'GroupDetailsModal must display groupRules');
assert.match(groupDetailsModal, /allowMemberChallenges/, 'GroupDetailsModal must display allowMemberChallenges');
assert.match(groupDetailsModal, /requireAdminApproval/, 'GroupDetailsModal must display requireAdminApproval');
// Legacy groups: must handle empty fields without crashing
assert.match(groupDetailsModal, /hasAbout|hasFocus|hasRules|No additional details/, 'GroupDetailsModal must handle empty/legacy groups gracefully');

// ── Discover filter chips in GroupsScreen ─────────────────────────────────────
assert.match(groupsScreen, /discoverFilter/, 'GroupsScreen must have discoverFilter state');
assert.match(groupsScreen, /fitness.*Fitness|Fitness.*fitness/, 'GroupsScreen must have a Fitness filter chip');
assert.match(groupsScreen, /wellness.*Wellness|Wellness.*wellness/, 'GroupsScreen must have a Wellness filter chip');
assert.match(groupsScreen, /cause-based|Cause-based/, 'GroupsScreen must have a Cause-based filter chip');
assert.match(groupsScreen, /community.*Community|Community.*community/, 'GroupsScreen must have a Community filter chip');
assert.match(groupsScreen, /group\.groupType.*discoverFilter|discoverFilter.*group\.groupType/, 'GroupsScreen must filter by groupType using discoverFilter');

console.log('✅ All Group Detail and Edit guards passed.');
