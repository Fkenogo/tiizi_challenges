import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { V2ChallengeSummary } from '../src/api/v2ChallengeApi.js';
import type { V2DiscoverableChallenge } from '../src/api/challengeDiscoveryApi.js';
import { filterChallengeDiscovery, lifecycleBucket } from '../src/v2/challenges/challengeDiscovery.js';
import { inclusiveDurationDays } from '../src/v2/challenges/challengeCreationDraft.js';
import { findChallenges, myJoinedChallenges } from '../src/v2/challenges/challengePageModel.js';

let failures = 0;
function check(label: string, ok: boolean): void {
  if (!ok) { failures += 1; console.error(`FAIL ${label}`); }
  else console.log(`ok ${label}`);
}
const challenge = (overrides: Partial<V2ChallengeSummary> = {}): V2ChallengeSummary => ({
  challengeId: 'challenge-id', groupId: 'group-id', groupName: 'Morning Movers', activities: [
    { name: 'Push-Up', domain: 'fitness', category: 'Strength', subcategory: 'Bodyweight' },
  ], title: 'Morning Push-Up Week', description: 'Build consistency', challengeType: 'collective', status: 'active',
  startDate: '2026-10-01', endDate: '2026-10-14', timezone: 'Africa/Bujumbura', governingToday: '2026-10-02',
  finalized: false, currentConfigVersion: 1, goalValue: 100, goalUnit: 'reps', collectiveTotal: 0,
  collectiveGoalReached: false, completionsCount: 0, myParticipation: null, ...overrides,
});
const active = challenge();
const upcoming = challenge({ challengeId: 'upcoming', status: 'establishment', governingToday: '2026-09-30' });
const completed = challenge({ challengeId: 'done', status: 'ended', finalized: true });
const discoverable = (row: V2ChallengeSummary): V2DiscoverableChallenge => ({
  ...row,
  host: { groupId: row.groupId, groupName: row.groupName ?? 'Group', admissionMode: 'open', viewerRelationship: 'none' },
  relevance: { interests: [], goals: [], domains: [] },
}) as V2DiscoverableChallenge;
check('lifecycle labels derive from served Challenge state', lifecycleBucket(active) === 'active'
  && lifecycleBucket(upcoming) === 'upcoming' && lifecycleBucket(completed) === 'completed');
check('type and domain filters use canonical types and Knowledge domain', filterChallengeDiscovery([active], { search: '', lifecycle: 'all', type: 'collective', domain: 'fitness' }).length === 1
  && filterChallengeDiscovery([active], { search: '', lifecycle: 'all', type: 'streak', domain: 'all' }).length === 0
  && filterChallengeDiscovery([active], { search: '', lifecycle: 'all', type: 'all', domain: 'wellness' }).length === 0);
const wellnessStreak = challenge({
  challengeId: 'wellness-streak', status: 'establishment', governingToday: '2026-09-30', challengeType: 'streak',
  activities: [{ name: 'Breathing', domain: 'wellness', category: 'Mindfulness', subcategory: 'Breathwork' }],
});
const independentFilterRows = [active, wellnessStreak, completed];
check('Status, Type, and Domain filters work independently and compose',
  filterChallengeDiscovery(independentFilterRows, { search: '', lifecycle: 'active', type: 'all', domain: 'all' }).map(({ challengeId }) => challengeId).join() === 'challenge-id'
  && filterChallengeDiscovery(independentFilterRows, { search: '', lifecycle: 'all', type: 'streak', domain: 'all' }).map(({ challengeId }) => challengeId).join() === 'wellness-streak'
  && filterChallengeDiscovery(independentFilterRows, { search: '', lifecycle: 'all', type: 'all', domain: 'wellness' }).map(({ challengeId }) => challengeId).join() === 'wellness-streak'
  && filterChallengeDiscovery(independentFilterRows, { search: '', lifecycle: 'upcoming', type: 'streak', domain: 'wellness' }).map(({ challengeId }) => challengeId).join() === 'wellness-streak'
  && filterChallengeDiscovery(independentFilterRows, { search: '', lifecycle: 'upcoming', type: 'streak', domain: 'fitness' }).length === 0);
const joined = challenge({ challengeId: 'joined', myParticipation: { status: 'active' } as V2ChallengeSummary['myParticipation'] });
const withdrawn = challenge({ challengeId: 'withdrawn', myParticipation: { status: 'withdrawn' } as V2ChallengeSummary['myParticipation'] });
const groupVisible = challenge({ challengeId: 'group-visible' });
const findRows = findChallenges([joined, withdrawn, groupVisible], [discoverable(challenge({ challengeId: 'remote' })), discoverable(joined)]);
check('My Challenges requires active participation; Find combines discovery and Group-visible rows without duplicates or joined rows',
  myJoinedChallenges([joined, withdrawn, groupVisible]).map(({ challengeId }) => challengeId).join() === 'joined'
  && findRows.map(({ challengeId }) => challengeId).join() === 'remote,withdrawn,group-visible');
check('search matches title, description, Group, Activity, domain, and category', ['push-up', 'morning movers', 'consistency', 'fitness', 'bodyweight'].every((term) =>
  filterChallengeDiscovery([active], { search: term, lifecycle: 'all', type: 'all', domain: 'all' }).length === 1));
check('custom date duration is inclusive and date-only', inclusiveDurationDays('2026-10-01', '2026-10-07') === 7
  && inclusiveDurationDays('2026-10-08', '2026-10-07') === null);

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const list = read('src/v2/challenges/V2ChallengeListScreen.tsx');
const routes = read('src/v2/routes.tsx');
const pageModel = read('src/v2/challenges/challengePageModel.ts');
const pageModelTests = read('src/v2/challenges/challengePageModel.test.ts');
const screenTests = read('src/v2/challenges/V2ChallengeListScreen.dom.test.tsx');
const wizard = read('src/v2/challenges/V2ChallengeCreationWizard.tsx');
// P5T-2 S1: reusable steps live in wizardSteps/; assertions about them follow the code.
const nameAppearance = read('src/v2/challenges/wizardSteps/NameAppearanceFields.tsx');
const whatCountsStep = read('src/v2/challenges/wizardSteps/WhatCountsStep.tsx');
const detail = read('src/v2/challenges/V2CreatedChallengeScreen.tsx');
const draft = read('src/v2/challenges/challengeCreationDraft.ts');
const members = read('api/src/memberships.ts');
const review = wizard.slice(wizard.indexOf('function StepReview'), wizard.indexOf('function CreatorParticipation'));
check('registered Challenges route uses one integrated My + Find screen with Status, Type, and Domain dropdowns',
  routes.includes('path="challenges" element={<V2ChallengeListScreen />}')
  && list.includes('<section aria-label="My Challenges"') && list.includes('<section aria-label="Find Challenges"')
  && list.includes('label="Status"') && list.includes('label="Type"') && list.includes('label="Domain"')
  && list.includes("value: 'active'") && list.includes("value: 'upcoming'") && list.includes("value: 'completed'")
  && list.includes("value: 'collective'") && list.includes("value: 'competitive'") && list.includes("value: 'streak'")
  && list.includes("value: 'fitness'") && list.includes("value: 'wellness'")
  && !list.includes('V2ExploreChallenges'));
check('My Challenges shows active participation only and Find preserves discovery plus Group-visible access',
  pageModel.includes("challenge.myParticipation?.status === 'active'")
  && list.includes('const joined = myJoinedChallenges(ownRows)')
  && list.includes('const candidates = findChallenges(ownRows, discoveryRows)')
  && pageModelTests.includes('shows only explicitly active participation under My Challenges')
  && pageModelTests.includes('combines discovery and Group-visible candidates without duplicates or joined rows')
  && screenTests.includes('shows a single Find interface and a suitable empty My Challenges state'));
check('My and Find have separate loading, error, empty, and no-match states',
  list.includes('You have not joined a Challenge yet') && list.includes('No matching Challenges')
  && list.includes('Clear search and filters') && list.includes('We could not load your Challenges')
  && list.includes('Challenge discovery is unavailable'));
check('Challenge result rows render V2ChallengeCard', list.includes('V2ChallengeCard')
  && list.includes('MyChallengeProgress') && list.includes('FindChallengeProgress'));
check('host selector is searchable and excludes restricted non-steward memberships', wizard.includes('Search Groups')
  && wizard.includes('allowMemberChallenges !== false') && wizard.includes("membership.role.toLowerCase()"));
const hostStep = wizard.slice(wizard.indexOf('function StepHosting'), wizard.indexOf('function StepChallengeDetails'));
const detailsStep = wizard.slice(wizard.indexOf('function StepChallengeDetails'), wizard.indexOf('function StepActivities')) + nameAppearance;
check('Challenge title/description have their own third wizard step', draft.includes("'CHALLENGE_DETAILS'")
  && wizard.includes('StepChallengeDetails') && !hostStep.includes('Challenge title')
  && detailsStep.includes('Challenge title') && detailsStep.includes('Description'));
check('What Counts copy is schedule-independent and Together uses the Shared goal label', !draft.includes('over ${duration}')
  && !draft.includes('before the day ends in ${timezone}') && whatCountsStep.includes("type === 'collective' ? 'Shared goal'"));
check('Review avoids duplicating the persistent Challenge summary', !review.includes('summarize(state)'));
check('preset and custom dates set inclusive end/duration, with no timezone selector', wizard.includes('Custom')
  && wizard.includes('inclusiveDurationDays') && !wizard.includes('Time setting')
  && draft.includes('Intl.DateTimeFormat().resolvedOptions().timeZone'));
check('creator local timezone remains an internal Challenge config value', draft.includes('timezone: creatorTimezone()')
  && wizard.includes('Dates use your local time'));
check('completed reuse submits only a fresh wizard draft through governed creation', detail.includes("endState === 'finalized'")
  && detail.includes('Use as new Challenge')
  && detail.includes('createChallengeWizardRouteState(draft, 0') && detail.includes('creatorJoins: false')
  && detail.includes('fetchKnowledgeByCode') && detail.includes('fetchKnowledgeById'));
check('host permission uses the existing Group metadata contract', members.includes('allow_member_challenges AS group_allow_member_challenges'));

if (failures) process.exit(1);
console.log('Challenge discovery guards passed.');
