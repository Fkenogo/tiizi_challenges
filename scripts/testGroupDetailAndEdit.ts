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
const groupOptionLabels = read('src/features/Groups/groupOptionLabels.ts');
const createGroup     = read('src/features/Groups/CreateGroupScreen.tsx');

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
// Phase 6: groupType quick tag restored to the compact summary (subtle pill next to the
// "Group since" date) — resolves the Phase 1 guard triage KNOWN GAP.
assert.match(groupDetailCombined, /group\.groupType/, 'GroupDetailScreen (via GroupSharedHeader) compact summary must reference groupType for quick tag');
assert.match(groupDetailCombined, /Group since|createdAt/, 'GroupDetailScreen (via GroupSharedHeader) compact summary must show created date');
assert.match(groupDetailCombined, /View Group Details/, 'GroupDetailScreen (via GroupSharedHeader) must have a "View Group Details" link/button');

// Edit Group gated to owner — must check ownerId
// (Phase 6: this gate now lives in GroupSharedHeader post-header-unification refactor,
// same as the other compact-summary fields above — checked against the combined source.)
assert.match(groupDetailCombined, /Edit Group/, 'GroupDetailScreen (via GroupSharedHeader) must show Edit Group button label');
assert.match(groupDetailCombined, /ownerId.*user\?\.uid|group\?\.ownerId.*uid/, 'GroupDetailScreen (via GroupSharedHeader) must gate Edit Group to owner');
assert.match(groupDetailCombined, /\/app\/group\/.*\/edit/, 'GroupDetailScreen (via GroupSharedHeader) Edit Group must navigate to edit route');

// Modal wired (rendered from GroupSharedHeader post-header-unification refactor)
assert.match(groupDetailCombined, /GroupDetailsModal/, 'GroupDetailScreen (via GroupSharedHeader) must render GroupDetailsModal');
assert.match(groupDetailCombined, /showDetails|setShowDetails/, 'GroupDetailScreen (via GroupSharedHeader) must have showDetails state to control modal');

// ── GroupDetailsModal: full metadata in sections ──────────────────────────────
assert.match(groupDetailsModal, /GroupDetailsModal/, 'GroupDetailsModal component must exist');
assert.match(groupDetailsModal, /About|Group Focus|Rules & Privacy/, 'GroupDetailsModal must have labelled sections');
assert.match(groupDetailsModal, /activityInterests/, 'GroupDetailsModal must display activityInterests');
assert.match(groupDetailsModal, /wellnessTopics/, 'GroupDetailsModal must display wellnessTopics');
assert.match(groupDetailsModal, /groupGoals/, 'GroupDetailsModal must display groupGoals');
assert.match(groupDetailsModal, /groupRules/, 'GroupDetailsModal must display groupRules');
assert.match(groupDetailsModal, /allowMemberChallenges/, 'GroupDetailsModal must display allowMemberChallenges');
assert.match(groupDetailsModal, /requireAdminApproval/, 'GroupDetailsModal must display requireAdminApproval');
// Legacy groups: must handle empty fields without crashing
assert.match(groupDetailsModal, /hasAbout|hasGroupFocus|hasInterests|hasRules|No additional details/, 'GroupDetailsModal must handle empty/legacy groups gracefully');

// ── Group Focus Enhancement (Group Type, Scope, Activities, Wellness, Goals) ──

// 1) Group Type displayed in hero/immediate summary (GroupSharedHeader)
assert.match(
  groupSharedHeader,
  /getGroupTypeLabel\(group\.groupType\)/,
  'GroupSharedHeader hero must display Group Type via getGroupTypeLabel (human-readable, not raw group.groupType)',
);

// 2) Scope displayed in hero/immediate summary (GroupSharedHeader)
assert.match(
  groupSharedHeader,
  /getLocationScopeLabel\(group\.locationScope\)/,
  'GroupSharedHeader hero must display Scope via getLocationScopeLabel',
);

// 3-5) Group Details modal supports activities, wellness topics, and group goals as chips
assert.match(groupDetailsModal, /Section title="Activities"/, 'GroupDetailsModal must have an Activities section');
assert.match(groupDetailsModal, /Section title="Wellness Topics"/, 'GroupDetailsModal must have a Wellness Topics section');
assert.match(groupDetailsModal, /Section title="Group Goals"/, 'GroupDetailsModal must have a Group Goals section');
assert.match(groupDetailsModal, /getActivityLabel\(a\)/, 'GroupDetailsModal Activities chips must use getActivityLabel');
assert.match(groupDetailsModal, /getWellnessLabel\(w\)/, 'GroupDetailsModal Wellness Topics chips must use getWellnessLabel');
assert.match(groupDetailsModal, /getGroupGoalLabel\(g\)/, 'GroupDetailsModal Group Goals chips must use getGroupGoalLabel');

// 6) Raw database values are mapped to human-readable labels, not dumped raw
assert.doesNotMatch(
  groupDetailsModal,
  /label=\{a\}|label=\{w\}|label=\{g\}/,
  'GroupDetailsModal must not pass raw activityInterests/wellnessTopics/groupGoals values directly as Chip labels',
);
assert.doesNotMatch(
  groupSharedHeader,
  /\{group\.groupType\}/,
  'GroupSharedHeader must not render the raw group.groupType value directly (must go through getGroupTypeLabel)',
);

// 7) Empty optional sections are conditionally omitted (each new section individually gated)
assert.match(groupDetailsModal, /\{hasGroupFocus && \(/, 'GroupDetailsModal Group Focus section must be conditionally rendered');
assert.match(groupDetailsModal, /\{hasActivities && \(/, 'GroupDetailsModal Activities section must be conditionally rendered');
assert.match(groupDetailsModal, /\{hasWellness && \(/, 'GroupDetailsModal Wellness Topics section must be conditionally rendered');
assert.match(groupDetailsModal, /\{hasGoals && \(/, 'GroupDetailsModal Group Goals section must be conditionally rendered');
assert.doesNotMatch(
  groupSharedHeader,
  /getGroupTypeLabel\(group\.groupType\)\s*\)\s*&&[\s\S]{0,40}undefined/,
  'GroupSharedHeader must not render "undefined" for a missing Group Type',
);

// 8) Existing About section remains (Description, Privacy, Founded, Admin)
assert.match(groupDetailsModal, /Section title="About"/, 'GroupDetailsModal must retain the About section');
assert.match(groupDetailsModal, /label="Description"/, 'About section must retain Description');
assert.match(groupDetailsModal, /label="Privacy"/, 'About section must retain Privacy');
assert.match(groupDetailsModal, /label="Founded"/, 'About section must retain Founded');
assert.match(groupDetailsModal, /label="Admin"/, 'About section must retain Admin');

// 9) Existing Rules & Privacy section remains (Visibility, Approval, Challenges)
assert.match(groupDetailsModal, /Section title="Rules & Privacy"/, 'GroupDetailsModal must retain the Rules & Privacy section');
assert.match(groupDetailsModal, /label="Visibility"/, 'Rules & Privacy section must retain Visibility');
assert.match(groupDetailsModal, /label="Approval"/, 'Rules & Privacy section must retain Approval');
assert.match(groupDetailsModal, /label="Challenges"/, 'Rules & Privacy section must retain Challenges');

// 10) No hardcoded single-group data or document IDs introduced
assert.doesNotMatch(
  groupDetailsModal + groupSharedHeader + groupOptionLabels,
  /groupId\s*===\s*['"][a-zA-Z0-9]{15,}['"]|['"]tiizi-challenges['"].*doc\(|hardcoded.*groupId/i,
  'No hardcoded single-group data or document IDs may be introduced by this enhancement',
);

// 11) Chip containers wrap (flex-wrap) rather than causing page-level horizontal overflow
assert.match(groupDetailsModal, /flex flex-wrap gap-2/, 'GroupDetailsModal chip rows must use flex-wrap (no horizontal overflow)');
assert.doesNotMatch(groupDetailsModal, /overflow-x-scroll|whitespace-nowrap.*Chip/, 'GroupDetailsModal chip rows must not force horizontal scrolling');
assert.match(groupSharedHeader, /flex flex-wrap items-center/, 'GroupSharedHeader hero metadata row must wrap (no horizontal overflow)');

// 12) Existing join, leave, and create-challenge controls remain untouched
assert.match(groupSharedHeader, /Join Group/, 'GroupSharedHeader must retain the Join Group control');
assert.match(groupSharedHeader, /Leave/, 'GroupSharedHeader must retain the Leave control');
assert.match(groupSharedHeader, /Create Challenge/, 'GroupSharedHeader must retain the Create Challenge control');
assert.match(groupSharedHeader, /joinGroup\.mutateAsync/, 'GroupSharedHeader join logic must be unchanged (still calls joinGroup.mutateAsync)');
assert.match(groupSharedHeader, /leaveGroup\.mutateAsync/, 'GroupSharedHeader leave logic must be unchanged (still calls leaveGroup.mutateAsync)');

// 13) Shared option definitions are reused/centralized where appropriate
assert.match(groupOptionLabels, /GROUP_TYPE_LABELS/, 'groupOptionLabels must define GROUP_TYPE_LABELS');
assert.match(groupOptionLabels, /LOCATION_SCOPE_LABELS/, 'groupOptionLabels must define LOCATION_SCOPE_LABELS');
assert.match(groupOptionLabels, /ACTIVITY_LABELS/, 'groupOptionLabels must define ACTIVITY_LABELS');
assert.match(groupOptionLabels, /WELLNESS_LABELS/, 'groupOptionLabels must define WELLNESS_LABELS');
assert.match(groupOptionLabels, /GROUP_GOAL_ID_LABELS/, 'groupOptionLabels must define GROUP_GOAL_ID_LABELS');
assert.match(groupSharedHeader, /from '\.\.\/groupOptionLabels'/, 'GroupSharedHeader must import labels from the shared groupOptionLabels module');
assert.match(groupDetailsModal, /from '\.\.\/groupOptionLabels'/, 'GroupDetailsModal must import labels from the shared groupOptionLabels module');
// GROUP_TYPES/LOCATION_SCOPES/ACTIVITY_OPTIONS/WELLNESS_OPTIONS/GROUP_GOALS
// must come from a single canonical module (groupOptions.ts), imported by
// both Create and Edit — this is what actually prevents future drift,
// rather than each screen defining its own copy.
const groupOptions = read('src/features/Groups/groupOptions.ts');
assert.match(groupOptions, /export const GROUP_TYPES/, 'groupOptions.ts must export canonical GROUP_TYPES');
assert.match(groupOptions, /export const LOCATION_SCOPES/, 'groupOptions.ts must export canonical LOCATION_SCOPES');
assert.match(groupOptions, /export const ACTIVITY_OPTIONS/, 'groupOptions.ts must export canonical ACTIVITY_OPTIONS');
assert.match(groupOptions, /export const WELLNESS_OPTIONS/, 'groupOptions.ts must export canonical WELLNESS_OPTIONS');
assert.match(groupOptions, /export const GROUP_GOALS/, 'groupOptions.ts must export canonical GROUP_GOALS');

for (const identifier of ['GROUP_TYPES', 'LOCATION_SCOPES', 'ACTIVITY_OPTIONS', 'WELLNESS_OPTIONS', 'GROUP_GOALS']) {
  assert.match(
    createGroup,
    new RegExp(`import\\s*\\{[^}]*\\b${identifier}\\b[^}]*\\}\\s*from\\s*'\\./groupOptions'`),
    `CreateGroupScreen must import ${identifier} from the shared groupOptions module (not define its own copy)`,
  );
  assert.match(
    editGroup,
    new RegExp(`import\\s*\\{[^}]*\\b${identifier}\\b[^}]*\\}\\s*from\\s*'\\./groupOptions'`),
    `EditGroupScreen must import ${identifier} from the shared groupOptions module (not define its own copy)`,
  );
}

// groupOptionLabels.ts (the display-label lookup used by Header/Modal) must
// itself derive from the same canonical groupOptions module, not redefine
// its own separate option data.
assert.match(groupOptionLabels, /from '\.\/groupOptions'/, 'groupOptionLabels must derive its label maps from the canonical groupOptions module');

// CreateGroupScreen must persist canonical group goal ids (not literal label
// strings) now that it shares the same taxonomy as EditGroupScreen.
assert.match(createGroup, /toggleGoal\(goal\.id\)/, 'CreateGroupScreen must persist canonical goal ids, not literal label strings');

// 14) Legacy group records with missing optional fields remain safe (no crash, no blank containers)
assert.match(groupDetailsModal, /No additional details for this group/, 'GroupDetailsModal must show a graceful empty state for legacy groups with no metadata at all');
assert.match(groupOptionLabels, /function humanize/, 'groupOptionLabels must have a graceful fallback formatter for unrecognized/legacy values');
assert.doesNotMatch(groupOptionLabels, /return undefined|return 'undefined'/, 'groupOptionLabels helpers must never resolve to the literal "undefined"');

// Accessibility: real button trigger, accessible heading, close button label, decorative icon hidden
assert.match(groupSharedHeader, /<button className="text-\[13px\] font-bold text-primary" onClick=\{\(\) => setShowDetails\(true\)\}>/, '"View Group Details" trigger must remain a real <button>');
assert.match(groupDetailsModal, /aria-labelledby="group-details-modal-heading"/, 'GroupDetailsModal must have an accessible heading reference (aria-labelledby)');
assert.match(groupDetailsModal, /<h2 id="group-details-modal-heading"/, 'GroupDetailsModal heading must be a real heading element');
assert.match(groupDetailsModal, /aria-label="Close group details"/, 'GroupDetailsModal close button must have an accessible label');
assert.match(groupDetailsModal, /aria-hidden="true"/, 'GroupDetailsModal decorative close icon must be hidden from screen readers');
assert.match(groupDetailsModal, /event\.key === 'Escape'/, 'GroupDetailsModal must support closing via Escape key');

// Owner/admin-only incomplete-metadata prompt (permission-gated, non-blocking)
assert.match(groupDetailsModal, /isOwner\s*&&\s*isMetadataMateriallyIncomplete/, 'GroupDetailsModal incomplete-metadata prompt must be gated on isOwner');
assert.match(groupDetailsModal, /from '\.\.\/groupMetadataCompleteness'/, 'GroupDetailsModal must use the named isGroupMetadataMateriallyIncomplete helper, not an inline ad-hoc condition');
assert.match(groupDetailsModal, /Add group type, activities, wellness topics and goals in Edit Group/, 'GroupDetailsModal must show the exact founder-specified incomplete-metadata copy');
assert.match(groupDetailsModal, /Edit Group →/, 'GroupDetailsModal incomplete-metadata prompt must have an Edit Group CTA');
assert.match(groupSharedHeader, /isOwner=\{group\.ownerId === user\?\.uid\}/, 'GroupSharedHeader must pass isOwner to GroupDetailsModal based on group ownership');

// ── Discover filter chips in GroupsScreen ─────────────────────────────────────
assert.match(groupsScreen, /discoverFilter/, 'GroupsScreen must have discoverFilter state');
assert.match(groupsScreen, /fitness.*Fitness|Fitness.*fitness/, 'GroupsScreen must have a Fitness filter chip');
assert.match(groupsScreen, /wellness.*Wellness|Wellness.*wellness/, 'GroupsScreen must have a Wellness filter chip');
assert.match(groupsScreen, /cause-based|Cause-based/, 'GroupsScreen must have a Cause-based filter chip');
assert.match(groupsScreen, /community.*Community|Community.*community/, 'GroupsScreen must have a Community filter chip');
assert.match(groupsScreen, /group\.groupType.*discoverFilter|discoverFilter.*group\.groupType/, 'GroupsScreen must filter by groupType using discoverFilter');

// ── Follow-up hardening: clearing optional metadata must use deleteField(), never a stripped `undefined` ──
assert.match(groupService, /import\s*\{[^}]*\bdeleteField\b[^}]*\}\s*from\s*'firebase\/firestore'/, 'groupService must import deleteField from firebase/firestore');
for (const field of ['groupType', 'activityInterests', 'wellnessTopics', 'groupGoals', 'locationScope', 'groupRules']) {
  assert.match(
    groupService,
    new RegExp(`patch\\.${field} === null \\? deleteField\\(\\) : patch\\.${field}`),
    `groupService.updateGroup must translate patch.${field} === null into deleteField(), not a stripped undefined`,
  );
}
assert.match(groupService, /groupType\?:\s*string\s*\|\s*null/, 'UpdateGroupInput.groupType must accept null as an explicit clear sentinel');
assert.match(groupService, /activityInterests\?:\s*string\[\]\s*\|\s*null/, 'UpdateGroupInput.activityInterests must accept null as an explicit clear sentinel');

// EditGroupScreen must submit `null` (not `undefined`) when a field is cleared, so clearing actually reaches Firestore.
assert.match(editGroup, /groupType:\s*groupType\s*\|\|\s*null/, 'EditGroupScreen must submit null (not undefined) when groupType is cleared');
assert.match(editGroup, /activityInterests\.length\s*\?\s*activityInterests\s*:\s*null/, 'EditGroupScreen must submit null (not undefined) when activityInterests is cleared');
assert.match(editGroup, /wellnessTopics\.length\s*\?\s*wellnessTopics\s*:\s*null/, 'EditGroupScreen must submit null (not undefined) when wellnessTopics is cleared');
assert.match(editGroup, /groupGoals\.length\s*\?\s*groupGoals\s*:\s*null/, 'EditGroupScreen must submit null (not undefined) when groupGoals is cleared');
assert.match(editGroup, /locationScope:\s*locationScope\s*\|\|\s*null/, 'EditGroupScreen must submit null (not undefined) when locationScope is cleared');
assert.match(editGroup, /groupRules\.length\s*\?\s*groupRules\s*:\s*null/, 'EditGroupScreen must submit null (not undefined) when groupRules is cleared');
// No literal undefined must reach the metadata fields of the patch object.
assert.doesNotMatch(editGroup, /groupType:\s*groupType\s*\|\|\s*undefined/, 'EditGroupScreen must not submit literal undefined for groupType');

// ── Follow-up hardening: private-group approval invariant, Create/Edit parity ──
assert.match(groupService, /needsApproval\s*=\s*!!group\.isPrivate\s*\|\|\s*!!group\.requireAdminApproval/, 'groupService.joinGroup must treat isPrivate groups as always needing approval');
assert.match(createGroup, /requireAdminApproval:\s*isPrivate\s*\?\s*true\s*:\s*requireAdminApproval/, 'CreateGroupScreen must force requireAdminApproval when isPrivate');
assert.match(editGroup, /resolvedRequireAdminApproval\s*=\s*isPrivate\s*\?\s*true\s*:\s*requireAdminApproval/, 'EditGroupScreen must force requireAdminApproval when isPrivate, matching CreateGroupScreen');
assert.match(editGroup, /disabled=\{isPrivate\}/, 'EditGroupScreen must disable the Require Admin Approval toggle when the group is private, so the UI cannot misrepresent forced-approval behavior');

// ── Follow-up hardening: legacy groupGoals normalization at Edit hydration ──
assert.match(editGroup, /normalizeGroupGoals\(group\.groupGoals\s*\?\?\s*\[\]\)/, 'EditGroupScreen must normalize legacy groupGoals values to canonical ids at hydration time');
const groupGoalNormalization = read('src/features/Groups/groupGoalNormalization.ts');
for (const legacyLabel of [
  'Keep Fit Together', 'Lose Weight', 'Build Strength', 'Improve Mental Health', 'Stay Consistent',
  'Train for an Event', 'Support a Cause', 'Build Workplace Wellness', 'Family / Friends Accountability', 'Other',
]) {
  assert.match(
    groupGoalNormalization,
    new RegExp(`'${legacyLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':`),
    `groupGoalNormalization must map the legacy literal "${legacyLabel}" to a canonical id`,
  );
}

// ── Follow-up hardening: Create/Edit validation parity ──
const groupValidation = read('src/features/Groups/groupValidation.ts');
assert.match(groupValidation, /MIN_GROUP_NAME_LENGTH\s*=\s*3/, 'groupValidation must define MIN_GROUP_NAME_LENGTH = 3');
assert.match(groupValidation, /MIN_GROUP_DESCRIPTION_LENGTH\s*=\s*10/, 'groupValidation must define MIN_GROUP_DESCRIPTION_LENGTH = 10');
assert.match(createGroup, /isValidGroupDraft\(name, description\)/, 'CreateGroupScreen canSubmit must use the shared isValidGroupDraft rule');
assert.match(editGroup, /isValidGroupDraft\(name, description\)/, 'EditGroupScreen must use the shared isValidGroupDraft rule (not just a non-empty-name check)');

// ── Follow-up hardening: error diagnostics retained in console, not just a toast ──
// Logging lives in the mutation hooks' onError (useGroups.ts), not in the
// screen components — CreateGroupScreen.tsx is on the pilot UX polish
// guard's forbidden-pattern list for raw console statements (see
// scripts/testPilotUxPolishGuards.ts), so logging there directly would trip
// that guard. Centralizing in the hook also covers every caller of the
// mutation, not just these two screens.
assert.match(useGroups, /console\.error\('Failed to create group', error\)/, 'useCreateGroup must log create failures to the console for diagnosability');
assert.match(useGroups, /console\.error\('Failed to update group', error\)/, 'useUpdateGroup must log update failures to the console for diagnosability');
assert.doesNotMatch(createGroup, /console\.error\(/, 'CreateGroupScreen must not contain raw console.error calls (forbidden by testPilotUxPolishGuards.ts) — log in the mutation hook instead');

// ── Follow-up hardening: Firestore rules already restrict group updates to owner/admin — confirm unchanged ──
const firestoreRules = read('firestore.rules');
assert.match(
  firestoreRules,
  /allow update, delete: if isAuthenticated\(\) && \(\s*resource\.data\.ownerId == request\.auth\.uid\s*\|\|\s*canManageGroups\(\)\s*\)/,
  'firestore.rules must continue restricting groups update/delete to the owner or an admin/moderator role',
);

// ── Final hardening: Create's private/approval toggle must match Edit's behavior exactly ──
assert.match(createGroup, /value=\{isPrivate \? true : requireAdminApproval\}/, 'CreateGroupScreen Require Admin Approval toggle must display forced-on when isPrivate, matching EditGroupScreen');
assert.match(createGroup, /disabled=\{isPrivate\}/, 'CreateGroupScreen must disable the Require Admin Approval toggle when isPrivate, matching EditGroupScreen');
assert.match(createGroup, /subtitle=\{isPrivate \? 'Always on for private groups' : /, 'CreateGroupScreen Require Admin Approval subtitle must explain the forced-on state when private');
assert.match(createGroup, /disabled\?:\s*boolean/, "CreateGroupScreen's local ToggleRow must support an optional disabled prop");

// ── Final hardening: cover-image clearing must use the same null → deleteField() contract as the 6 metadata fields ──
assert.match(groupService, /patch\.coverImageUrl === null \? deleteField\(\) : patch\.coverImageUrl/, 'groupService.updateGroup must translate patch.coverImageUrl === null into deleteField()');
assert.match(groupService, /coverImageUrl\?:\s*string\s*\|\s*null/, 'UpdateGroupInput.coverImageUrl must accept null as an explicit clear sentinel');
assert.match(editGroup, /coverRemoved/, 'EditGroupScreen must track an explicit cover-removed state distinct from an empty/invalid coverImageUrl input');
assert.match(editGroup, /handleRemoveCover/, 'EditGroupScreen must have an explicit remove-cover handler');
assert.match(editGroup, /Remove cover image/, 'EditGroupScreen must render an explicit, accessible "Remove cover image" control');
assert.match(editGroup, /const resolvedCover: string \| null \| undefined = coverRemoved\s*\?\s*null/, 'EditGroupScreen must only send null for coverImageUrl when the owner explicitly chose Remove, not merely because the input is empty/invalid');

// ── Final hardening: Create/Edit community rules consolidated into a single canonical module ──
const groupRulesModule = read('src/features/Groups/groupRules.ts');
assert.match(groupRulesModule, /export const DEFAULT_GROUP_RULES/, 'groupRules.ts must export canonical DEFAULT_GROUP_RULES');
assert.match(groupRulesModule, /export function getCustomGroupRules/, 'groupRules.ts must export getCustomGroupRules for surfacing non-canonical existing rules');
assert.match(groupRulesModule, /export function isDuplicateGroupRule/, 'groupRules.ts must export a documented duplicate-rule check');
assert.match(createGroup, /from '\.\/groupRules'/, 'CreateGroupScreen must import the canonical rules module instead of defining its own DEFAULT_RULES');
assert.match(editGroup, /from '\.\/groupRules'/, 'EditGroupScreen must import the canonical rules module instead of defining its own DEFAULT_RULES');
assert.doesNotMatch(createGroup, /const DEFAULT_RULES = \[/, 'CreateGroupScreen must not define its own local DEFAULT_RULES anymore');
assert.doesNotMatch(editGroup, /const DEFAULT_RULES = \[/, 'EditGroupScreen must not define its own local DEFAULT_RULES anymore');
assert.match(editGroup, /getCustomGroupRules\(groupRules\)/, 'EditGroupScreen must surface existing non-canonical rules via getCustomGroupRules so they remain visible and removable');
assert.match(editGroup, /removeRule/, 'EditGroupScreen must allow removing an existing custom rule');
assert.match(editGroup, /isDuplicateGroupRule\(trimmed, groupRules\)/, 'EditGroupScreen must prevent adding a duplicate custom rule');
assert.match(createGroup, /isDuplicateGroupRule\(trimmedCustomRule, enabledRules\)/, 'CreateGroupScreen must prevent adding a duplicate custom rule');
assert.match(editGroup, /groupRules\.length \? groupRules : null/, 'EditGroupScreen must clear groupRules via the null → deleteField() contract when all rules are removed');

// ── Final robustness correction: EditGroupScreen.handleCoverChange error handling ──
assert.match(
  editGroup,
  /try \{\s*const dataUrl = await readFileAsDataUrl\(file\);/,
  'EditGroupScreen.handleCoverChange must wrap readFileAsDataUrl in a try block, not await it unprotected',
);
assert.match(editGroup, /Could not read selected image\./, 'EditGroupScreen must show an error toast when reading the selected file fails');
assert.match(
  editGroup,
  /if \(isPersistableImageSource\(dataUrl\)\) \{\s*setCoverImageUrl\(dataUrl\);/,
  'EditGroupScreen must only fall back to the local data URL when it is actually persistable',
);
assert.match(editGroup, /Image upload failed\. Choose a smaller image or try again\./, 'EditGroupScreen must show a clear error when upload fails and the data URL is not persistable (preserving the existing stored cover)');
assert.match(
  editGroup,
  /setCoverRemoved\(false\);\s*setCoverPreview\(dataUrl\);/,
  'EditGroupScreen must only reset coverRemoved after the file has been read successfully',
);
assert.match(editGroup, /\}\s*finally\s*\{\s*\/\/[^\n]*\n\s*e\.target\.value = '';/, 'EditGroupScreen.handleCoverChange must reset the file input value in a finally block');

// ── Final correction: failed non-persistable upload must roll back the preview/removed state, not just leave coverImageUrl untouched ──
assert.match(
  editGroup,
  /const previousCoverImageUrl = coverImageUrl;\s*const previousCoverPreview = coverPreview;\s*const previousCoverRemoved = coverRemoved;/,
  'EditGroupScreen.handleCoverChange must snapshot the previous cover state before attempting a replacement',
);
assert.match(
  editGroup,
  /setCoverImageUrl\(previousCoverImageUrl\);\s*setCoverPreview\(previousCoverPreview\);\s*setCoverRemoved\(previousCoverRemoved\);\s*showToast\('Image upload failed\. Choose a smaller image or try again\.', 'error'\);/,
  'EditGroupScreen must restore the previous coverImageUrl/coverPreview/coverRemoved when upload fails and the data URL is not persistable, so the preview never shows a replacement that Save would not actually keep',
);
// The snapshot must be taken before the try block that optimistically sets coverPreview/coverRemoved.
{
  const snapshotIndex = editGroup.indexOf('const previousCoverImageUrl = coverImageUrl;');
  const optimisticSetIndex = editGroup.indexOf("setCoverRemoved(false);\n      setCoverPreview(dataUrl);");
  assert.ok(snapshotIndex >= 0 && optimisticSetIndex >= 0 && snapshotIndex < optimisticSetIndex,
    'EditGroupScreen must snapshot previous cover state BEFORE optimistically updating coverPreview/coverRemoved');
}

console.log('✅ All Group Detail and Edit guards passed.');
