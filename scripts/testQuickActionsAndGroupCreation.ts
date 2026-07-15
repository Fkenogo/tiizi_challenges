/**
 * Phase 18I-6S — Quick Actions routing, Browse Activities, Create Group metadata guards.
 * Run: npx tsx scripts/testQuickActionsAndGroupCreation.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const quickActions    = read('src/features/QuickActions/QuickActionsScreen.tsx');
const chooseChal      = read('src/features/Workouts/ChooseChallengeToLogScreen.tsx');
const createGroup     = read('src/features/Groups/CreateGroupScreen.tsx');
const groupService    = read('src/services/groupService.ts');
const groupTypes      = read('src/types/index.ts');
const appTsx          = read('src/App.tsx');
const createWizard    = read('src/features/Challenges/CreateChallengeWizard.tsx');
const groupsScreen    = read('src/features/Groups/GroupsScreen.tsx');

// ─── Log Activity routes to choose-challenge, NOT select-activity directly ───
assert.match(quickActions, /\/app\/workouts\/choose-challenge/, 'QuickActions Log Activity must route to /app/workouts/choose-challenge');
assert.doesNotMatch(quickActions, /logActivityPath.*select-activity|select-activity.*groupId.*=.*defaultGroupId/, 'QuickActions must not send Log Activity directly to select-activity with only groupId');

// ─── ChooseChallengeToLogScreen exists and has correct behaviour ──────────────
assert.match(chooseChal, /active.*challenges|challenges.*active/s, 'ChooseChallengeToLogScreen must filter to active challenges');
assert.match(chooseChal, /\/app\/workouts\/select-activity/, 'ChooseChallengeToLogScreen must navigate to select-activity with challengeId');
assert.match(chooseChal, /challengeId/, 'ChooseChallengeToLogScreen must pass challengeId when navigating');
assert.match(chooseChal, /groupId/, 'ChooseChallengeToLogScreen must pass groupId when navigating');
assert.match(chooseChal, /Browse Challenges|Discover Groups/s, 'ChooseChallengeToLogScreen empty state must have CTA buttons');
assert.match(chooseChal, /No active challenges/i, 'ChooseChallengeToLogScreen must show helpful empty state message');

// ─── Route registered ────────────────────────────────────────────────────────
assert.match(appTsx, /\/app\/workouts\/choose-challenge.*ChooseChallengeToLogScreen|ChooseChallengeToLogScreen.*\/app\/workouts\/choose-challenge/, 'App.tsx must register /app/workouts/choose-challenge route');

// ─── Browse Activities picker has both options ───────────────────────────────
assert.match(quickActions, /Browse Activities/, 'QuickActions must label action "Browse Activities"');
assert.match(quickActions, /\/app\/exercises/, 'QuickActions Browse Activities must include Exercise Library route');
assert.match(quickActions, /\/app\/wellness-activities/, 'QuickActions Browse Activities must include Wellness Activities route');
assert.match(quickActions, /showActivitiesPicker/, 'QuickActions must use a picker for Browse Activities');

// ─── Create Challenge template entry point ───────────────────────────────────
assert.match(createWizard, /Start from a template|template.*entry|challenges\/suggested|challenges\/wellness/s, 'CreateChallengeWizard must have a template entry point');
assert.match(createWizard, /challenges\/suggested/, 'CreateChallengeWizard must link to fitness templates (/app/challenges/suggested)');
assert.match(createWizard, /challenges\/wellness/, 'CreateChallengeWizard must link to wellness templates (/app/challenges/wellness)');

// ─── Group type in types/index.ts ────────────────────────────────────────────
assert.match(groupTypes, /groupType\?.*fitness.*wellness|groupType\?.*string/, 'Group interface must include groupType field');
assert.match(groupTypes, /activityInterests\?.*string\[\]/, 'Group interface must include activityInterests: string[]');
assert.match(groupTypes, /wellnessTopics\?.*string\[\]/, 'Group interface must include wellnessTopics: string[]');
assert.match(groupTypes, /groupGoals\?.*string\[\]/, 'Group interface must include groupGoals: string[]');
assert.match(groupTypes, /locationScope\?/, 'Group interface must include locationScope field');
assert.match(groupTypes, /groupRules\?.*string\[\]/, 'Group interface must include groupRules: string[]');

// ─── CreateGroupInput in groupService ────────────────────────────────────────
assert.match(groupService, /groupType\?.*string/, 'CreateGroupInput must have optional groupType');
assert.match(groupService, /activityInterests\?.*string\[\]/, 'CreateGroupInput must have optional activityInterests');
assert.match(groupService, /wellnessTopics\?.*string\[\]/, 'CreateGroupInput must have optional wellnessTopics');
assert.match(groupService, /groupGoals\?.*string\[\]/, 'CreateGroupInput must have optional groupGoals');
assert.match(groupService, /groupRules\?.*string\[\]/, 'CreateGroupInput must have optional groupRules');

// ─── New fields persisted in createGroup ─────────────────────────────────────
assert.match(groupService, /groupType.*input\.groupType|input\.groupType.*groupType/s, 'groupService.createGroup must persist groupType');
assert.match(groupService, /activityInterests.*input\.activityInterests|input\.activityInterests.*activityInterests/s, 'groupService.createGroup must persist activityInterests');

// ─── Create Group UI has metadata sections ───────────────────────────────────
assert.match(createGroup, /GROUP_TYPES/, 'CreateGroupScreen must define GROUP_TYPES');
assert.match(createGroup, /ACTIVITY_OPTIONS/, 'CreateGroupScreen must define ACTIVITY_OPTIONS');
assert.match(createGroup, /WELLNESS_OPTIONS/, 'CreateGroupScreen must define WELLNESS_OPTIONS');
assert.match(createGroup, /GROUP_GOALS/, 'CreateGroupScreen must define GROUP_GOALS');
assert.match(createGroup, /LOCATION_SCOPES/, 'CreateGroupScreen must define LOCATION_SCOPES');
assert.match(createGroup, /Community Rules/, 'CreateGroupScreen must include Community Rules section');

// ─── No duplicate Rules & Privacy section (comment + heading = 2 max) ────────
const rulesCount = (createGroup.match(/Rules & Privacy/g) ?? []).length;
assert.ok(rulesCount <= 2, `CreateGroupScreen must not have more than one "Rules & Privacy" UI section (found ${rulesCount})`);

// ─── Existing core fields preserved ──────────────────────────────────────────
assert.match(createGroup, /isPrivate/, 'CreateGroupScreen must preserve isPrivate toggle');
assert.match(createGroup, /allowMemberChallenges/, 'CreateGroupScreen must preserve allowMemberChallenges toggle');
assert.match(createGroup, /requireAdminApproval/, 'CreateGroupScreen must preserve requireAdminApproval toggle');

// ─── Group type chip on discover card ────────────────────────────────────────
assert.match(groupsScreen, /group\.groupType/, 'GroupsScreen must display groupType chip on cards');

console.log('✅ All Quick Actions and group creation guards passed.');
