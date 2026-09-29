import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  allowsMultipleActivities,
  createChallengeWizardRouteState,
  createInitialWizardState,
  restoreChallengeWizardRouteState,
  VISIBLE_STEPS,
} from '../src/v2/challenges/challengeCreationDraft';

const wizardPath = new URL('../src/v2/challenges/V2ChallengeCreationWizard.tsx', import.meta.url);
const guidePath = new URL('../src/v2/member/ActivityLibraryScreen.tsx', import.meta.url);
const wizard = readFileSync(wizardPath, 'utf8');
const guide = readFileSync(guidePath, 'utf8');
const stepThree = wizard.split('function StepActivities(')[1]?.split('function StepWhatCounts(')[0] ?? '';
const challengeDetail = guide.split('export function V2ActivityGuideDetailScreen()')[1] ?? '';

const draft = {
  ...createInitialWizardState(),
  challengeType: 'streak' as const,
  groupId: 'group-1',
  groupName: 'Test Group',
  title: 'Morning movement',
  description: 'A saved draft',
  activities: [{
    activity: 'activity-uuid-1', activityCode: 'FIT-STR-001', name: 'Walk', kind: 'fitness' as const,
    category: 'Movement', subcategory: 'Walking', imageUrl: null, observedVersion: 2,
    options: {} as never, metric: 'duration', unit: 'minutes', targetValue: '20', durationMode: 'CONTINUOUS',
    completionOccurrence: '', loadBasis: '',
  }],
};
const stepThreeIndex = VISIBLE_STEPS.indexOf('WHAT_ARE_WE_DOING');
const inspectRoute = createChallengeWizardRouteState(draft, stepThreeIndex, { fromChallengeDraft: true });
const restored = restoreChallengeWizardRouteState(inspectRoute);
assert.deepEqual(restored.draft, draft, 'inspection route preserves the complete Challenge draft');
assert.equal(restored.stepIndex, stepThreeIndex, 'inspection route returns to Step 3');
assert.equal(restored.routeState.activityId, undefined, 'inspection carries no implicit selection identity');

const explicitAdd = createChallengeWizardRouteState(draft, stepThreeIndex, {
  fromChallengeDraft: true, activityId: 'activity-uuid-2', activityCode: 'FIT-STR-002', addToDraft: true,
});
assert.equal(explicitAdd.activityId, 'activity-uuid-2', 'explicit add uses the canonical UUID');
assert.equal(explicitAdd.activityCode, 'FIT-STR-002', 'explicit add retains the immutable Activity Code');
assert.equal(explicitAdd.addToDraft, true, 'only explicit detail handoff requests addition');
assert.equal(allowsMultipleActivities('streak'), true, 'Streak retains multiple Activity support');
assert.equal(allowsMultipleActivities('collective'), false, 'other Challenge type cardinality remains governed');

assert.match(stepThree, /to=\{`\/v2\/guide\/\$\{encodeURIComponent\(item\.id\)\}`\}/, 'discovery row opens canonical Activity detail');
assert.match(stepThree, /createChallengeWizardRouteState\(state, VISIBLE_STEPS\.indexOf\('WHAT_ARE_WE_DOING'\), \{ fromChallengeDraft: true \}\)/, 'discovery passes draft context without selection identity');
assert.match(stepThree, /Selected activities/, 'Step 3 separates selected Activities from discovery');
assert.match(stepThree, /onRemove\(activity\.activity\)/, 'selected Activities expose explicit removal');
assert.match(stepThree, /Adding this Activity to your Challenge/, 'explicit handoff exposes its loading state');
assert.match(stepThree, /setDebounced\(search\.trim\(\)\)/, 'search narrows the catalogue as the participant types');
assert.doesNotMatch(stepThree, /item\.description|item\.measurementGuidance|item\.safetyNotes/, 'discovery rows do not show guide prose');
assert.match(challengeDetail, /Add to this Challenge/, 'Challenge-context detail has an explicit add action');
assert.match(challengeDetail, /Use in Challenge/, 'general Guide detail keeps its existing handoff');
assert.match(challengeDetail, /challengeContext\.draft/, 'detail handoff returns the preserved Challenge draft');
assert.match(wizard, /fetchActivityOptions\(item\.id\)/, 'add still uses the governed PF-04 options endpoint');

console.log('S6 Challenge Activity discovery and draft handoff checks passed.');
