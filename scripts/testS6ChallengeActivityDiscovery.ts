import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  allowsMultipleActivities,
  createChallengeWizardRouteState,
  createInitialWizardState,
  restoreChallengeWizardRouteState,
  VISIBLE_STEPS,
} from '../src/v2/challenges/challengeCreationDraft';
import {
  CHALLENGE_DRAFT_TTL_MS,
  clearChallengeDraft,
  clearOtherMembersChallengeDrafts,
  markChallengeGuideJourney,
  recoverChallengeDraft,
  saveChallengeDraft,
  type DraftStorage,
} from '../src/v2/challenges/challengeDraftSession';

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
assert.match(stepThree, /createChallengeWizardRouteState\(state, stepIndex, \{ fromChallengeDraft: true \}\)/, 'discovery passes draft context without selection identity');
assert.match(stepThree, /Selected activities/, 'Step 3 separates selected Activities from discovery');
assert.match(stepThree, /onRemove\(activity\.activity\)/, 'selected Activities expose explicit removal');
assert.match(stepThree, /Adding this Activity to your Challenge/, 'explicit handoff exposes its loading state');
assert.match(stepThree, /setDebounced\(search\.trim\(\)\)/, 'search narrows the catalogue as the participant types');
assert.doesNotMatch(stepThree, /item\.description|item\.measurementGuidance|item\.safetyNotes/, 'discovery rows do not show guide prose');
assert.match(challengeDetail, /Add to this Challenge/, 'Challenge-context detail has an explicit add action');
assert.match(challengeDetail, /Use in Challenge/, 'general Guide detail keeps its existing handoff');
assert.match(challengeDetail, /challengeContext\.draft/, 'detail handoff returns the preserved Challenge draft');
assert.match(wizard, /fetchActivityOptions\(item\.id\)/, 'add still uses the governed PF-04 options endpoint');

// P0-A: EVERY wizard -> Guide entry carries the draft (previously the intro
// "Activity Guide" link was stateless and "Use in Challenge" restarted at Step 1).
const guideLinks = [...stepThree.matchAll(/<Link\b[\s\S]*?>/g)].map((m) => m[0]).filter((tag) => /\/v2\/guide/.test(tag));
assert.equal(guideLinks.length, 2, 'Step 4 has exactly two Guide entries (intro link and result rows)');
for (const tag of guideLinks) {
  assert.match(tag, /state=\{createChallengeWizardRouteState\(state, stepIndex, \{ fromChallengeDraft: true \}\)\}/, 'each Guide entry carries the draft and step');
  assert.match(tag, /onClick=\{onGuideTrip\}/, 'each Guide entry arms the session backup');
}
const libraryList = guide.split('export function V2ActivityLibraryScreen()')[1]?.split('function ActivityCard(')[0] ?? '';
assert.match(libraryList, /restoreChallengeWizardRouteState\(location\.state\)/, 'Guide list reads the wizard draft context');
assert.match(libraryList, /<ActivityCard key=\{item\.id\} item=\{item\} linkState=\{draftContext\} \/>/, 'Guide list forwards the draft to Activity details');
assert.match(libraryList, /Back to this Challenge/, 'Guide list offers a way back to the same draft');
assert.match(guide, /state=\{linkState \?\? undefined\}/, 'Activity cards forward the draft');
assert.match(wizard, /recoverChallengeDraft\(uid\)/, 'wizard recovers a dropped draft after a Guide trip');
assert.match(wizard, /clearChallengeDraft\(uid\);\s*navigate\(`\/v2\/challenges\/\$\{established\.challengeId\}`/, 'established Challenge clears the session draft');
assert.doesNotMatch(wizard + guide, /firestore|collection\(|setDoc/i, 'no Firestore draft persistence');

// Session backup behaviour (in-memory storage stub).
class MemoryStorage implements DraftStorage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
}
const mem = new MemoryStorage();
const t0 = 1_000_000;
saveChallengeDraft('uid-a', draft, stepThreeIndex, { storage: mem, now: t0 });
assert.equal(recoverChallengeDraft('uid-a', { storage: mem, now: t0 + 1 }), null, 'a backup is never recovered without an explicit Guide trip');
markChallengeGuideJourney('uid-a', draft, stepThreeIndex, { storage: mem, now: t0 + 2 });
assert.equal(recoverChallengeDraft('uid-b', { storage: mem, now: t0 + 3 }), null, 'another account never reads this draft');
const recovered = recoverChallengeDraft('uid-a', { storage: mem, now: t0 + 3 });
assert.deepEqual(recovered?.draft, draft, 'recovery returns the complete draft');
assert.equal(recovered?.stepIndex, stepThreeIndex, 'recovery returns the same step');
assert.equal(recoverChallengeDraft('uid-a', { storage: mem, now: t0 + 4 }), null, 'recovery disarms: the draft cannot resurrect on a later visit');
markChallengeGuideJourney('uid-a', draft, stepThreeIndex, { storage: mem, now: t0 + 5 });
assert.equal(recoverChallengeDraft('uid-a', { storage: mem, now: t0 + 5 + CHALLENGE_DRAFT_TTL_MS + 1 }), null, 'expired backups are discarded');
markChallengeGuideJourney('uid-a', draft, stepThreeIndex, { storage: mem, now: t0 + 6 });
clearChallengeDraft('uid-a', { storage: mem });
assert.equal(recoverChallengeDraft('uid-a', { storage: mem, now: t0 + 7 }), null, 'cleared (established/abandoned) drafts are gone');
saveChallengeDraft('uid-a', draft, 0, { storage: mem, now: t0 });
saveChallengeDraft('uid-c', draft, 0, { storage: mem, now: t0 });
clearOtherMembersChallengeDrafts('uid-c', { storage: mem });
assert.equal(mem.getItem('tiizi.v2.challengeDraft.v1:uid-a'), null, 'another member\'s draft is removed on account switch');
assert.notEqual(mem.getItem('tiizi.v2.challengeDraft.v1:uid-c'), null, 'the current member\'s draft stays');
mem.setItem('tiizi.v2.challengeDraft.v1:uid-d', '{not json');
assert.equal(recoverChallengeDraft('uid-d', { storage: mem }), null, 'malformed storage is ignored, not thrown');
assert.doesNotThrow(() => saveChallengeDraft('uid-a', draft, 0, { storage: null }), 'missing storage never breaks the wizard');

console.log('S6 Challenge Activity discovery and draft handoff checks passed.');
